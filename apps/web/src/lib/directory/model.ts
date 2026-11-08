import { plural, type PluralForms } from "@vallo/i18n/core";
import type { Side } from "@/lib/side.constants";

/**
 * ONE DIRECTORY, BOTH SIDES (D76: "the property agents page should be stay
 * agent too, it's the same thing but flipped").
 *
 * Property lists agents, landlords (only those who chose a public handle) and
 * firms; Stays lists hotels, hosts and shortlet operators. The same card, the
 * same search and filters, City or Global. Rows come from `public.directory`
 * (supabase/migrations/pending/d76_*), which carries public-safe fields only.
 * Pure; tested in `model.test.ts`.
 */

export type DirKind = "agent" | "landlord" | "firm" | "hotel" | "host" | "shortlet";

export type DirEntry = {
  kind: DirKind;
  name: string;
  ref: string | null;
  avatarUrl: string | null;
  placeCode: string | null;
  placeName: string | null;
  area: string | null;
  verified: boolean;
  completed: number;
  liveListings: number;
  since: string | null;
};

export const SIDE_KINDS: Record<Side, readonly DirKind[]> = {
  property: ["agent", "landlord", "firm"],
  stays: ["hotel", "host", "shortlet"],
};

export type DirFilter = "all" | DirKind;

/** SW11: source of truth is now `packages/i18n/src/locales/directory.en.ts`. */
import { getDictionary } from "@vallo/i18n";
const _dir = getDictionary("en").directory;
export const KIND_PLURAL = _dir.kindPlural as Record<DirKind, string>;
export const KIND_ONE = _dir.kindOne as Record<DirKind, string>;

const KINDS: readonly DirKind[] = ["agent", "landlord", "firm", "hotel", "host", "shortlet"];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function count(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export function parseEntries(data: unknown, side: Side): DirEntry[] {
  if (!Array.isArray(data)) return [];
  const allowed = SIDE_KINDS[side];
  const out: DirEntry[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const kind = KINDS.includes(r.kind as DirKind) ? (r.kind as DirKind) : null;
    const name = str(r.display_name);
    /* A row of the other side is a server mistake; it is not drawn here. */
    if (!kind || !name || !allowed.includes(kind)) continue;
    out.push({
      kind,
      name,
      ref: str(r.ref),
      avatarUrl: str(r.avatar_url),
      placeCode: str(r.place_code),
      placeName: str(r.place_name),
      area: str(r.area),
      verified: r.verified === true,
      completed: count(r.completed),
      liveListings: count(r.live_listings),
      since: str(r.since),
    });
  }
  return out;
}

/** Search and the kind filter, applied on the client so typing is instant. */
export function filterEntries(entries: readonly DirEntry[], filter: DirFilter, query: string): DirEntry[] {
  const q = query.trim().toLocaleLowerCase("en-NG");
  return entries.filter((e) => {
    if (filter !== "all" && e.kind !== filter) return false;
    if (!q) return true;
    return [e.name, e.area, e.placeName].some((v) => v?.toLocaleLowerCase("en-NG").includes(q));
  });
}

/** Where a card opens: a person's public profile, a hotel's page; a firm has none yet. */
export function entryHref(e: Pick<DirEntry, "kind" | "ref">): string | null {
  if (!e.ref) return null;
  const ref = encodeURIComponent(e.ref);
  switch (e.kind) {
    case "agent":
    case "landlord":
      return `/u/${ref}`;
    case "firm":
      return null;
    default:
      return `/stay/${ref}`;
  }
}

const FACT_FORMS = {
  stays: { one: "{count} stay on Vallo", other: "{count} stays on Vallo" },
  deals: { one: "{count} deal on Vallo", other: "{count} deals on Vallo" },
  places: { one: "{count} place live", other: "{count} places live" },
  listings: { one: "{count} listing live", other: "{count} listings live" },
} satisfies Record<string, PluralForms>;

/** The card's one fact line, from real counts only, in the locale's plural forms. */
export function factLine(e: Pick<DirEntry, "kind" | "completed" | "liveListings">): string {
  const parts: string[] = [];
  const stays = e.kind === "hotel" || e.kind === "host" || e.kind === "shortlet";
  if (e.completed > 0) parts.push(plural(e.completed, stays ? FACT_FORMS.stays : FACT_FORMS.deals));
  if (e.liveListings > 0) parts.push(plural(e.liveListings, stays ? FACT_FORMS.places : FACT_FORMS.listings));
  return parts.length ? parts.join(" · ") : "New on Vallo";
}

export const DIRECTORY_COPY = _dir.copy as Record<Side, { title: string; lede: string; search: string; emptyCta: { label: string; href: string } }>;

export function emptyDirectoryTitle(side: Side, filter: DirFilter, scope: "city" | "global", placeName: string): string {
  const who = filter === "all" ? (side === "property" ? "agents" : "hosts") : KIND_PLURAL[filter].toLowerCase();
  return scope === "city" ? `No ${who} in ${placeName} yet` : `No ${who} on Vallo yet`;
}
