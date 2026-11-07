/**
 * VALLO CIRCLE, THE PURE HALF (VALLO_CIRCLE.md v3; the SQL is
 * `supabase/migrations/pending/features_circle_1_core.sql`).
 *
 * The lists here mirror the table checks one for one, and a test holds them
 * together, so a category the database refuses can never be offered.
 */

export const CIRCLE_CATEGORIES = [
  "neighbourhood",
  "renting",
  "buying",
  "landlords",
  "investing",
  "short_lets",
  "design",
  "building",
  "professionals",
  "general",
] as const;
export type CircleCategory = (typeof CIRCLE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CircleCategory, string> = {
  neighbourhood: "Neighbourhood",
  renting: "Renting",
  buying: "Buying",
  landlords: "Landlords",
  investing: "Investing",
  short_lets: "Short lets",
  design: "Interiors and design",
  building: "Building and renovation",
  professionals: "Professionals",
  general: "General",
};

export const CIRCLE_TYPES = ["discussion", "question", "guide", "opportunity", "announcement"] as const;
export type CircleType = (typeof CIRCLE_TYPES)[number];

export const CIRCLE_TABS = [
  "for-you",
  "discussions",
  "ask",
  "neighbourhoods",
  "professionals",
  "opportunities",
  "guides",
] as const;
export type CircleTab = (typeof CIRCLE_TABS)[number];

export function readTab(value: unknown): CircleTab {
  return typeof value === "string" && (CIRCLE_TABS as readonly string[]).includes(value) ? (value as CircleTab) : "for-you";
}

/** The post type a tab lists, or null for the tabs that list something else. */
export const TAB_TYPE: Partial<Record<CircleTab, CircleType>> = {
  discussions: "discussion",
  ask: "question",
  opportunities: "opportunity",
  guides: "guide",
};

export const CIRCLE_SORTS = ["newest", "popular", "unanswered"] as const;
export type CircleSort = (typeof CIRCLE_SORTS)[number];
export function readSort(value: unknown): CircleSort {
  return typeof value === "string" && (CIRCLE_SORTS as readonly string[]).includes(value) ? (value as CircleSort) : "newest";
}

export const PROFESSIONAL_KINDS = [
  "agent",
  "landlord",
  "developer",
  "architect",
  "interior_designer",
  "property_manager",
  "surveyor",
  "lawyer",
  "valuer",
  "builder",
  "investor",
] as const;
export type ProfessionalKind = (typeof PROFESSIONAL_KINDS)[number];
export const PROFESSIONAL_LABEL: Record<ProfessionalKind, string> = {
  agent: "Agent",
  landlord: "Landlord",
  developer: "Developer",
  architect: "Architect",
  interior_designer: "Interior designer",
  property_manager: "Property manager",
  surveyor: "Surveyor",
  lawyer: "Property lawyer",
  valuer: "Valuer",
  builder: "Builder",
  investor: "Investor",
};

/** Limits, the same as the table checks. */
export const LIMITS = {
  nameMin: 3,
  nameMax: 60,
  descriptionMax: 500,
  rulesMax: 10,
  ruleMax: 200,
  titleMin: 3,
  titleMax: 140,
  bodyMax: 4000,
} as const;

/** A community's address from its name: lower case, words joined by hyphens. */
export function slugFrom(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length >= 3 && value.length <= 60;
}

/** What `circle_create_community` answered, read into one shape. */
export type CreateOutcome =
  | { ok: true; slug: string }
  | { ok: false; reason: "signed_out" | "phone" | "limit" | "taken" | "cover" | "failed" };

export function readCreateOutcome(value: unknown): CreateOutcome {
  if (typeof value === "string" && value.startsWith("ok:")) return { ok: true, slug: value.slice(3) };
  if (value === "signed_out" || value === "phone" || value === "limit" || value === "taken" || value === "cover") {
    return { ok: false, reason: value };
  }
  return { ok: false, reason: "failed" };
}

/** Counts as words for a screen reader and the banner: "1,204 members". */
export function countWords(n: number, one: string, many: string): string {
  return `${new Intl.NumberFormat("en-NG").format(n)} ${n === 1 ? one : many}`;
}

/** Compact for the banner face, the full figure stays in the label. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  return new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Keyset cursor `<iso>|<id>`, the same shape as `lib/social/posts-cursor.ts`. */
export function encodeCursor(row: { createdAt: string; id: string }): string {
  return `${row.createdAt}|${row.id}`;
}
export function decodeCursor(value: unknown): { createdAt: string; id: string } | null {
  if (typeof value !== "string") return null;
  const [createdAt, id] = value.split("|");
  if (!createdAt || !id || !Number.isFinite(Date.parse(createdAt))) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { createdAt, id };
}

export const PAGE_SIZE = 20;

/**
 * STARTER COMMUNITIES: suggestions on the empty Circle, never seeded rows.
 * Each opens Create a community with the name and topic filled in, so the
 * first communities are started by real people (the lead and founder, 7
 * November 2026: seed nothing fake).
 */
export const STARTER_COMMUNITIES: readonly { name: string; category: CircleCategory; line: string }[] = [
  { name: "Lekki renters", category: "renting", line: "Rents, caution fees and landlords around Lekki." },
  { name: "Abuja landlords", category: "landlords", line: "Tenants, agreements and upkeep, from people who let homes." },
  { name: "First-time renters in Lagos", category: "renting", line: "What to check before you pay for your first place." },
  { name: "Short let hosts", category: "short_lets", line: "Pricing, cleaning, guests and reviews." },
  { name: "Buying land in Nigeria", category: "buying", line: "Titles, surveys and the questions to ask before you pay." },
  { name: "Interiors on a budget", category: "design", line: "Making a rented place feel like home." },
];

/** A prefilled draft from `/circle/new?name=&category=`, only with values the flow accepts. */
export function prefillFrom(params: { name?: unknown; category?: unknown }): { name: string; category: CircleCategory | "" } {
  const name = typeof params.name === "string" ? params.name.trim().slice(0, LIMITS.nameMax) : "";
  const category =
    typeof params.category === "string" && (CIRCLE_CATEGORIES as readonly string[]).includes(params.category)
      ? (params.category as CircleCategory)
      : "";
  return { name, category };
}
