import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { catalogueReader } from "@/lib/catalogue/listings";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import type { Listing } from "@/lib/listings/types";
import { dealRoomHref } from "@/lib/offers/routes";
import { SAVED_SEARCH_COLUMNS, type SavedSearchRow } from "@/lib/saved/searches-db";
import { toSavedSearchView } from "@/lib/saved/searches-queries";
import type { IntelligenceResult } from "../contract";
import type { PersonalTarget } from "../vocabulary";
import { compact, matchesAllWords, nairaOf } from "./format";
import type { Source, SourceContext } from "./types";

/**
 * THE MEMBER'S OWN RECORDS: SAVED HOMES, OFFERS, BOOKINGS, MESSAGES, SAVED
 * SEARCHES AND (FOR AN AGENT) THEIR LISTINGS.
 *
 * Read ONLY through the member's own session client, so RLS is the authority
 * (`saved_items` own rows, `deal_agreements_party_read`, the bookings and
 * conversations policies). Never the service key. Each read also names the
 * member's own id, because an admin's own session can read more than their
 * own rows and this list is "mine", nothing else.
 *
 * A listing's title is read from the public catalogue by id; a record whose
 * listing is no longer published is shown by its own facts (a reference, the
 * dates) rather than hidden or invented.
 */

const PER_TARGET = 6;
const ALL_TARGETS: PersonalTarget[] = ["saved", "offers", "bookings", "messages", "searches", "listings"];

type Db = SupabaseClient;

const OFFER_STATE: Record<string, string> = {
  draft: "Draft",
  submitted: "Sent",
  in_review: "In review",
  approved: "Agreed",
  agreed: "Agreed",
  declined: "Declined",
  rejected: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
  cancelled: "Cancelled",
  paid: "Paid",
};

function dayLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

async function titles(ids: string[]): Promise<Map<string, Listing>> {
  const reader = catalogueReader();
  const found = await Promise.all([...new Set(ids)].map((id) => reader.byId(id).catch(() => null)));
  return new Map(found.filter((l): l is Listing => Boolean(l)).map((l) => [l.id, l]));
}

async function saved(db: Db, me: string): Promise<IntelligenceResult[]> {
  const { data, error } = await db.from("saved_items").select("listing_id, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(PER_TARGET * 2);
  if (error) throw error;
  const ids = ((data ?? []) as { listing_id: string }[]).map((r) => r.listing_id);
  const listings = await titles(ids);
  return ids
    .map((id) => listings.get(id))
    .filter((l): l is Listing => Boolean(l))
    .map((l) => {
      const href = hrefForListing(l.kind, l.id, marketFactsOf(l));
      return compact({
        key: `personal:saved:${l.id}`,
        kind: "personal",
        title: l.title,
        href,
        subtitle: "Saved",
        imageUrl: l.photos[0],
        place: [l.area, l.city].filter(Boolean).join(", ") || undefined,
        actions: [{ id: "open", label: "Open", href }],
      });
    });
}

async function offers(db: Db, me: string): Promise<IntelligenceResult[]> {
  const { data, error } = await db
    .from("deal_agreements")
    .select("id, reference, listing_id, amount_minor, status, renter_id, owner_id, submitted_at, created_at")
    .eq("kind", "sale")
    .or(`renter_id.eq.${me},owner_id.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(PER_TARGET * 2);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; reference: string | null; listing_id: string | null; amount_minor: number | null; status: string; renter_id: string; submitted_at: string | null; created_at: string }[];
  const listings = await titles(rows.map((r) => r.listing_id).filter((x): x is string => Boolean(x)));
  return rows.map((r) => {
    const href = dealRoomHref(r.id);
    const listing = r.listing_id ? listings.get(r.listing_id) : undefined;
    return compact({
      key: `personal:offer:${r.id}`,
      kind: "personal",
      title: listing?.title ?? (r.reference ? `Offer ${r.reference}` : "Your offer"),
      href,
      subtitle: [r.renter_id === me ? "Offer you made" : "Offer you received", OFFER_STATE[r.status] ?? null].filter(Boolean).join(" · "),
      imageUrl: listing?.photos[0],
      price: r.amount_minor && r.amount_minor > 0 ? { amount: nairaOf(r.amount_minor), per: "once" } : undefined,
      actions: [{ id: "open", label: "Open", href }],
    });
  });
}

async function bookings(db: Db, me: string): Promise<IntelligenceResult[]> {
  const { data, error } = await db
    .from("bookings")
    .select("id, listing_id, check_in, check_out, status, total_minor, created_at")
    .eq("guest_id", me)
    .order("created_at", { ascending: false })
    .limit(PER_TARGET * 2);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; listing_id: string | null; check_in: string | null; check_out: string | null; status: string; total_minor: number | null }[];
  const listings = await titles(rows.map((r) => r.listing_id).filter((x): x is string => Boolean(x)));
  return rows.map((r) => {
    const href = `/bookings/${r.id}`;
    const listing = r.listing_id ? listings.get(r.listing_id) : undefined;
    const dates = r.check_in && r.check_out ? `${dayLabel(r.check_in)} to ${dayLabel(r.check_out)}` : null;
    return compact({
      key: `personal:booking:${r.id}`,
      kind: "personal",
      title: listing?.title ?? "Your booking",
      href,
      subtitle: ["Booking", dates, r.status.replace(/_/g, " ").toLowerCase()].filter(Boolean).join(" · "),
      imageUrl: listing?.photos[0],
      price: r.total_minor && r.total_minor > 0 ? { amount: nairaOf(r.total_minor), per: "once" } : undefined,
      actions: [{ id: "open", label: "Open", href }],
    });
  });
}

async function myAgentIds(db: Db, me: string): Promise<string[]> {
  const { data } = await db.from("agents").select("id").eq("user_id", me);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

async function messages(db: Db, me: string): Promise<IntelligenceResult[]> {
  const agents = await myAgentIds(db, me).catch(() => [] as string[]);
  let read = db.from("conversations").select("id, listing_id, last_message_at, guest_id, agent_id");
  read = agents.length > 0 ? read.or(`guest_id.eq.${me},agent_id.in.(${agents.join(",")})`) : read.eq("guest_id", me);
  const { data, error } = await read.order("last_message_at", { ascending: false, nullsFirst: false }).limit(PER_TARGET * 2);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; listing_id: string | null; last_message_at: string | null }[];
  const listings = await titles(rows.map((r) => r.listing_id).filter((x): x is string => Boolean(x)));
  return rows.map((r) => {
    const href = `/messages/${r.id}`;
    const listing = r.listing_id ? listings.get(r.listing_id) : undefined;
    return compact({
      key: `personal:message:${r.id}`,
      kind: "personal",
      title: listing ? `About ${listing.title}` : "Conversation",
      href,
      subtitle: r.last_message_at ? `Messages · last ${dayLabel(r.last_message_at)}` : "Messages",
      actions: [{ id: "message", label: "Open chat", href }],
    });
  });
}

async function searches(db: Db, me: string): Promise<IntelligenceResult[]> {
  const { data, error } = await db.from("saved_searches").select(SAVED_SEARCH_COLUMNS).eq("user_id", me).order("created_at", { ascending: false }).limit(PER_TARGET * 2);
  if (error) throw error;
  return ((data ?? []) as unknown as SavedSearchRow[]).map((row) => {
    const view = toSavedSearchView(row);
    return compact({
      key: `personal:search:${view.id}`,
      kind: "personal",
      title: view.label,
      href: view.href,
      subtitle: view.alertEnabled ? "Saved search · alerts on" : "Saved search",
      actions: [{ id: "apply-filters", label: "Run search", href: view.href }],
    });
  });
}

async function myListings(db: Db, me: string): Promise<IntelligenceResult[]> {
  const agents = await myAgentIds(db, me);
  if (agents.length === 0) return [];
  const { data, error } = await db
    .from("listings")
    .select("id, title, status, area, city")
    .in("agent_id", agents)
    .order("updated_at", { ascending: false })
    .limit(PER_TARGET * 2);
  if (error) throw error;
  return ((data ?? []) as { id: string; title: string; status: string; area: string | null; city: string | null }[]).map((l) =>
    compact({
      key: `personal:listing:${l.id}`,
      kind: "personal",
      title: l.title,
      href: "/agent/listings",
      subtitle: `Your listing · ${l.status.toLowerCase().replace(/_/g, " ")}`,
      place: [l.area, l.city].filter(Boolean).join(", ") || undefined,
      actions: [{ id: "open", label: "Open your listings", href: "/agent/listings" }],
    }),
  );
}

const READERS: Record<Exclude<PersonalTarget, "viewings">, (db: Db, me: string) => Promise<IntelligenceResult[]>> = {
  saved,
  offers,
  bookings,
  messages,
  searches,
  listings: myListings,
};

const MORE: Record<PersonalTarget, string> = {
  saved: "/saved",
  offers: "/offers",
  bookings: "/bookings",
  messages: "/messages",
  viewings: "/bookings",
  searches: "/saved/searches",
  listings: "/agent/listings",
};

export function personalTargets(ctx: Pick<SourceContext, "hints" | "understood">): PersonalTarget[] {
  if (ctx.hints.personal.length > 0) return ctx.hints.personal;
  return ctx.understood.kind === "personal" ? ALL_TARGETS : [];
}

export const personalSource: Source = {
  kind: "personal",
  applies: ({ understood, viewer, hints }) => viewer.signedIn && (understood.kind === "personal" || hints.personal.length > 0 || Boolean(understood.text)),
  async run(ctx) {
    const db = ctx.viewer.signedIn ? (ctx.viewer.db as Db | null) : null;
    const me = ctx.viewer.userId;
    if (!db || !me) return { results: [] };
    /* Words alone (no "my") search the member's saved homes and offers by title. */
    const asked = personalTargets(ctx);
    const targets = asked.length > 0 ? asked : (["saved", "offers"] as PersonalTarget[]);
    const settled = await Promise.allSettled(
      targets.filter((t): t is Exclude<PersonalTarget, "viewings"> => t !== "viewings").map((t) => READERS[t](db, me)),
    );
    const failed = settled.some((s) => s.status === "rejected");
    let rows = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    if (ctx.understood.text) rows = rows.filter((r) => matchesAllWords(ctx.understood.text, `${r.title} ${r.subtitle ?? ""} ${r.place ?? ""}`));
    if (failed && rows.length === 0) throw new Error("personal read failed");
    return {
      results: rows.slice(ctx.offset, ctx.offset + ctx.limit),
      total: failed ? undefined : rows.length,
      more: MORE[targets[0]!],
    };
  },
};
