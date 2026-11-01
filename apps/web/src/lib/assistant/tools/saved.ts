import { z } from "zod";
import { getListingRepository } from "@/lib/listings/repository";
import type { Listing } from "@/lib/listings/types";
import { cardFor } from "../cards";
import { listingItemOf } from "./listing-detail";
import { callerOf, NOT_SIGNED_IN } from "./private-common";
import { defineTool } from "./types";

const uuid = z.string().uuid();

type Row = Record<string, unknown>;
type Builder = {
  from: (t: string) => {
    select: (c: string, o?: Record<string, unknown>) => {
      eq: (c: string, v: string) => PromiseLike<{ data: unknown; error: unknown; count?: number | null }> & {
        order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> };
        not: (c: string, op: string, v: string) => PromiseLike<{ data: unknown; error: unknown; count?: number | null }>;
      };
    };
    upsert: (row: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: unknown }>;
  };
};

/** The member's saved listing ids, newest first. Null when the read failed. */
export async function readSavedIds(supabase: unknown, userId: string, limit = 12): Promise<string[] | null> {
  try {
    const { data, error } = await (supabase as Builder)
      .from("saved_items")
      .select("listing_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return null;
    return (data as Row[]).map((r) => String(r.listing_id));
  } catch {
    return null;
  }
}

async function listingsById(ids: string[]): Promise<Listing[]> {
  const repo = getListingRepository();
  const found = await Promise.all(ids.map((id) => repo.byId(id)));
  return found.filter((l): l is Listing => Boolean(l));
}

export const listSavedListingsTool = defineTool({
  name: "list_saved_listings",
  description: "Show the listings the person has saved, as cards with buttons. Read only.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "saved_prefs",
  workspaces: ["consumer"],
  async run(ctx) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const ids = await readSavedIds(who.supabase, who.userId, 8);
    if (ids === null) return { data: { error: "Your saved places could not be read just now." } };
    if (ids.length === 0) return { data: { saved: [] }, note: "The person has saved nothing yet. Say so and offer to search." };
    const rows = await listingsById(ids);
    const viewings = Boolean(ctx.access?.permissions.includes("bookings_viewings"));
    return {
      data: { saved: rows.map((l) => ({ id: l.id, title: l.title, city: l.city, kind: l.kind })) },
      events: [{ type: "cards", title: "Saved by you", items: rows.map((l) => cardFor(listingItemOf(l), { saved: true, viewings, example: Boolean(l.isDemo) })) }],
    };
  },
});

export const proposeSaveListingTool = defineTool({
  name: "propose_save_listing",
  description:
    "Put a Save button for ONE listing on screen. It saves nothing by itself: the person taps it. Say it is not saved until they tap.",
  input: z.object({ listing_id: uuid }),
  inputSchema: {
    type: "object",
    properties: { listing_id: { type: "string", description: "The listing id exactly as search_listings gave it." } },
    required: ["listing_id"],
  },
  mode: "propose",
  requires: "saved_prefs",
  workspaces: ["consumer"],
  async run(_ctx, input) {
    const l = await getListingRepository().byId(input.listing_id);
    if (!l) return { data: { error: "That listing could not be found." } };
    if (l.isDemo) return { data: { example: true }, note: "This is an example listing, so it cannot be saved. Say so." };
    return {
      data: { button: "Save", title: l.title },
      events: [{ type: "actions", items: [{ id: `save-${l.id}`, label: `Save ${l.title}`.slice(0, 48), kind: "save", listingId: l.id }] }],
    };
  },
});

/* ------------------------------------------------------------ preferences */

export const PREFERENCE_DIMENSIONS = ["city", "area", "kind", "bedrooms", "budget_max_naira", "style", "feature"] as const;
export const MAX_PREFERENCES = 40;

/** `dimension:value`, lower case, short, no markup. Null when it is not a shape we keep. */
export function preferenceKey(dimension: string, value: string): string | null {
  if (!(PREFERENCE_DIMENSIONS as readonly string[]).includes(dimension)) return null;
  const clean = value.toLowerCase().replace(/[^a-z0-9 \-]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (clean.length === 0) return null;
  return `${dimension}:${clean}`;
}

export type Taste = { key: string; weight: number };

export async function readTastes(supabase: unknown, userId: string): Promise<Taste[]> {
  try {
    const { data, error } = await (supabase as Builder)
      .from("ai_learned_preferences")
      .select("key, weight, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_PREFERENCES + 20);
    if (error || !Array.isArray(data)) return [];
    return (data as Row[])
      .map((r) => ({ key: String(r.key), weight: Number(r.weight) }))
      .filter((t) => !t.key.startsWith("cleared:") && Number.isFinite(t.weight));
  } catch {
    return [];
  }
}

export const rememberPreferenceTool = defineTool({
  name: "remember_preference",
  description:
    "Record ONE thing the person said they like or dislike in THIS conversation (an area, a kind of place, bedrooms, a budget ceiling in naira, a style, a feature) so recommendations fit them. Only what they actually said. They can review and clear this in Settings.",
  input: z.object({
    dimension: z.enum(PREFERENCE_DIMENSIONS),
    value: z.string().min(1).max(60),
    stance: z.enum(["like", "dislike"]),
  }),
  inputSchema: {
    type: "object",
    properties: {
      dimension: { type: "string", enum: [...PREFERENCE_DIMENSIONS] },
      value: { type: "string", description: "Short and plain, for example lekki, apartment, 2, 5000000, modern kitchen." },
      stance: { type: "string", enum: ["like", "dislike"] },
    },
    required: ["dimension", "value", "stance"],
  },
  mode: "read",
  requires: "saved_prefs",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const key = preferenceKey(input.dimension, input.value);
    if (!key) return { data: { error: "That is not something I can remember." } };
    const tastes = await readTastes(who.supabase, who.userId);
    if (!tastes.some((t) => t.key === key) && tastes.length >= MAX_PREFERENCES) {
      return { data: { error: "The list of things I remember is full. They can clear some in Settings, VALLO AI Assistant." } };
    }
    try {
      const { error } = await (who.supabase as Builder).from("ai_learned_preferences").upsert(
        {
          user_id: who.userId,
          key,
          value: { dimension: input.dimension, value: key.slice(input.dimension.length + 1) },
          source: "conversation",
          weight: input.stance === "like" ? 3 : -3,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,key" },
      );
      if (error) return { data: { error: "That could not be saved just now." } };
    } catch {
      return { data: { error: "That could not be saved just now." } };
    }
    return { data: { remembered: key, stance: input.stance }, note: "Tell the person briefly what you noted and that they can review it in Settings." };
  },
});

/* ---------------------------------------------------------- picked for you */

export type Profile = { cities: Map<string, number>; kinds: Map<string, number>; bedrooms: Map<number, number>; budgetMaxMinor: number | null; dislikes: Set<string>; likes: Set<string> };

export function profileFrom(saved: readonly Listing[], tastes: readonly Taste[]): Profile {
  const bump = <K,>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
  const p: Profile = { cities: new Map(), kinds: new Map(), bedrooms: new Map(), budgetMaxMinor: null, dislikes: new Set(), likes: new Set() };
  for (const l of saved) {
    bump(p.cities, l.city.toLowerCase());
    bump(p.kinds, l.kind);
    if (l.bedrooms > 0) bump(p.bedrooms, l.bedrooms);
  }
  for (const t of tastes) {
    const [dim, ...rest] = t.key.split(":");
    const value = rest.join(":");
    if (t.weight < 0) {
      p.dislikes.add(t.key);
      continue;
    }
    p.likes.add(t.key);
    if (dim === "city" || dim === "area") bump(p.cities, value, 2);
    else if (dim === "kind") bump(p.kinds, value, 2);
    else if (dim === "bedrooms" && Number.isFinite(Number(value))) bump(p.bedrooms, Number(value), 2);
    else if (dim === "budget_max_naira" && Number.isFinite(Number(value))) p.budgetMaxMinor = Math.round(Number(value) * 100);
  }
  return p;
}

export function hasSignal(p: Profile): boolean {
  return p.cities.size + p.kinds.size + p.bedrooms.size > 0 || p.budgetMaxMinor !== null;
}

/** Score one candidate against the profile and say why, in plain words. Zero means no reason to pick it. */
export function scoreCandidate(l: Listing, p: Profile): { score: number; reason: string } {
  if (p.dislikes.has(`city:${l.city.toLowerCase()}`) || p.dislikes.has(`kind:${l.kind}`) || p.dislikes.has(`area:${l.area.toLowerCase()}`)) {
    return { score: 0, reason: "" };
  }
  if (p.budgetMaxMinor !== null && l.priceMinor > 0 && l.priceMinor > p.budgetMaxMinor) return { score: 0, reason: "" };
  let score = 0;
  const reasons: string[] = [];
  const cityHits = p.cities.get(l.city.toLowerCase()) ?? p.cities.get(l.area.toLowerCase()) ?? 0;
  if (cityHits > 0) {
    score += 2 + cityHits;
    reasons.push(`you keep looking in ${l.city}`);
  }
  const kindHits = p.kinds.get(l.kind) ?? 0;
  if (kindHits > 0) {
    score += 2 + kindHits;
    reasons.push(`you like ${l.kind === "apartment" ? "apartments" : `${l.kind} places`}`);
  }
  const bedHits = l.bedrooms > 0 ? (p.bedrooms.get(l.bedrooms) ?? 0) : 0;
  if (bedHits > 0) {
    score += 1 + bedHits;
    reasons.push(`it has ${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}, like the ones you saved`);
  }
  if (p.budgetMaxMinor !== null && l.priceMinor > 0 && l.priceMinor <= p.budgetMaxMinor) {
    score += 1;
    reasons.push("it is inside your budget");
  }
  if (score === 0) return { score: 0, reason: "" };
  const first = reasons[0] ?? "";
  const rest = reasons.slice(1, 3);
  const sentence = [first, ...rest].filter(Boolean).join(", and ");
  return { score, reason: sentence.charAt(0).toUpperCase() + sentence.slice(1) + "." };
}

export type PicksResult =
  | { state: "unreadable" }
  | { state: "no-signal" }
  | { state: "none" }
  | { state: "ok"; picks: { listing: Listing; reason: string }[] };

/** The picks for one member, from what they saved and told the assistant. Shared by the tool and the "Picked for you" rail. */
export async function computePicks(supabase: unknown, userId: string, limit = 5): Promise<PicksResult> {
  const [savedIds, tastes] = await Promise.all([readSavedIds(supabase, userId, 20), readTastes(supabase, userId)]);
  if (savedIds === null) return { state: "unreadable" };
  const saved = await listingsById(savedIds);
  const profile = profileFrom(saved, tastes);
  if (!hasSignal(profile)) return { state: "no-signal" };
  const pool = await getListingRepository().search({ excludeDemo: true });
  const savedSet = new Set(savedIds);
  const picks = pool
    .filter((l) => !savedSet.has(l.id))
    .map((l) => ({ listing: l, ...scoreCandidate(l, profile) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (picks.length === 0) return { state: "none" };
  return { state: "ok", picks: picks.map((x) => ({ listing: x.listing, reason: x.reason })) };
}

export const pickedForYouTool = defineTool({
  name: "picked_for_you",
  description:
    "Recommend real listings that fit what this person saved and told you they like, each with a short plain reason. Returns cards with buttons. If they have given no signal yet, it says so and you ask what they like.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "saved_prefs",
  workspaces: ["consumer"],
  async run(ctx) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const result = await computePicks(who.supabase, who.userId);
    if (result.state === "unreadable") return { data: { error: "Your saved places could not be read just now." } };
    if (result.state === "no-signal") {
      return { data: { picks: [] }, note: "There is nothing saved or noted yet, so there is nothing to base picks on. Ask what area, kind of place, bedrooms and budget they like, then use remember_preference." };
    }
    if (result.state === "none") return { data: { picks: [] }, note: "Nothing real matches what they like right now. Say so honestly and offer to widen the search." };
    const viewings = Boolean(ctx.access?.permissions.includes("bookings_viewings"));
    return {
      data: { picks: result.picks.map((x) => ({ id: x.listing.id, title: x.listing.title, city: x.listing.city, why: x.reason })) },
      note: "The picks are on screen as cards, each with its reason. Do not repeat them at length.",
      events: [{ type: "cards", title: "Picked for you by VALLO AI", items: result.picks.map((x) => cardFor(listingItemOf(x.listing), { reason: x.reason, viewings })) }],
    };
  },
});
