/**
 * VALLO ROOMMATES, THE MODEL. Pure types, constants and arithmetic, safe on
 * both sides (no Supabase, no dictionary). The database holds the rules
 * (`supabase/migrations/pending/ROOMMATES_ALL.sql`); this file mirrors the
 * shapes the reads return and the limits the forms check before a write.
 *
 * Money is always in minor units (kobo), as everywhere on Vallo. Rent in
 * Nigeria is usually quoted by the year, so every amount carries its period
 * and comparisons run on the monthly equivalent.
 */

export const INTENTS = ["find_roommate", "find_room", "offer_room", "find_together"] as const;
export type Intent = (typeof INTENTS)[number];

export const LIFE_STAGES = ["student", "corps_member", "graduate", "professional", "other"] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const LISTING_KINDS = ["room_offer", "roommate_wanted", "together"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_STATUSES = ["draft", "submitted", "in_review", "changes_requested", "rejected", "live", "paused", "filled", "expired", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const PERIODS = ["month", "year"] as const;
export type Period = (typeof PERIODS)[number];

export const ROOM_TYPES = ["private", "shared", "ensuite"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const FURNISHED = ["furnished", "semi", "unfurnished"] as const;
export type Furnished = (typeof FURNISHED)[number];

export const ROOM_PREFS = ["private", "shared", "either"] as const;
export type RoomPref = (typeof ROOM_PREFS)[number];

export const FURNISHED_PREFS = ["furnished", "unfurnished", "either"] as const;
export type FurnishedPref = (typeof FURNISHED_PREFS)[number];

export const MOVE_IN_FLEX = ["asap", "fixed", "flexible"] as const;
export type MoveInFlex = (typeof MOVE_IN_FLEX)[number];

export const GENDER_PREFS = ["any", "female", "male"] as const;
export type GenderPref = (typeof GENDER_PREFS)[number];

export const GENDERS = ["female", "male"] as const;
export type Gender = (typeof GENDERS)[number];

export const AUTHORITIES = ["owner", "tenant_permitted", "agent", "manager"] as const;
export type Authority = (typeof AUTHORITIES)[number];

export const AMENITIES = [
  "wifi",
  "power_backup",
  "prepaid_meter",
  "water",
  "security",
  "parking",
  "kitchen",
  "laundry",
  "ac",
  "wardrobe",
  "gated",
  "cleaning",
] as const;
export type Amenity = (typeof AMENITIES)[number];

/** The lifestyle questions, each optional. Ordinal ones are 1 to 3. */
export const LIFESTYLE_KEYS = ["cleanliness", "social", "sleep", "smoking", "pets", "guests", "cooking", "schedule"] as const;
export type LifestyleKey = (typeof LIFESTYLE_KEYS)[number];
export const LIFESTYLE_OPTIONS = {
  cleanliness: [1, 2, 3],
  social: [1, 2, 3],
  sleep: ["early", "late", "varies"],
  smoking: ["never", "outside", "yes"],
  pets: ["none", "fine", "have"],
  guests: ["rarely", "sometimes", "often"],
  cooking: ["rarely", "sometimes", "often"],
  schedule: ["day", "night", "mixed", "home"],
} as const;
export type Lifestyle = {
  cleanliness: 1 | 2 | 3 | null;
  social: 1 | 2 | 3 | null;
  sleep: "early" | "late" | "varies" | null;
  smoking: "never" | "outside" | "yes" | null;
  pets: "none" | "fine" | "have" | null;
  guests: "rarely" | "sometimes" | "often" | null;
  cooking: "rarely" | "sometimes" | "often" | null;
  schedule: "day" | "night" | "mixed" | "home" | null;
};

export const VERIFICATION_KINDS = ["student_email", "student_id", "nysc", "workplace"] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];
/** The badges a card can carry: the roommate checks plus Vallo's identity and phone checks. */
export type BadgeKind = VerificationKind | "identity" | "phone";
export type VerificationStatus = "pending" | "review" | "verified" | "rejected" | "expired";

export const REASONS = [
  "budget",
  "same_area",
  "same_city",
  "same_state",
  "move_in",
  "quiet",
  "social",
  "tidy",
  "non_smoking",
  "sleep",
  "room",
  "institution",
  "life_stage",
] as const;
export type ReasonCode = (typeof REASONS)[number];

export const MATCH_PARTS = ["budget", "location", "move_in", "lifestyle", "accommodation"] as const;
export type MatchPart = (typeof MATCH_PARTS)[number];

/**
 * A compatibility result from `private.roommate_match`. `score` is null when
 * fewer than two parts could be compared (then the screen asks for more
 * profile, it never shows a number it could not work out). Each part is 0 to
 * 1, absent when either side left it blank.
 */
export type MatchView = {
  score: number | null;
  parts: Partial<Record<MatchPart, number>>;
  reasons: ReasonCode[];
};

export type GroupStage = "forming" | "searching" | "decided" | "living" | "closed";
export type InterestStatus = "pending" | "accepted" | "declined" | "withdrawn" | "ended";
export type ViewingStatus = "requested" | "confirmed" | "declined" | "cancelled" | "done";
export type ViewingMode = "in_person" | "virtual";
export type Vote = "yes" | "maybe" | "no";
export type ExpenseStatus = "planned" | "recorded" | "settled";

/** The person a card or a row is about, as public as their social profile. */
export type PersonRef = {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
};

export type InstitutionRef = { id: string; slug: string; name: string; shortName: string | null; kind: string; stateCode: string | null; city: string | null; logoUrl?: string | null; aliases?: string[] };

export type Budget = { minMinor: number | null; maxMinor: number | null; period: Period };

/** A roommate in a list (discover, home, campus). Hidden fields are already null. */
export type RoommateCard = PersonRef & {
  intro: string | null;
  lifeStage: LifeStage | null;
  institution: InstitutionRef | null;
  workplace: string | null;
  stateCode: string | null;
  city: string | null;
  areas: string[];
  budget: Budget;
  moveInOn: string | null;
  moveInFlex: MoveInFlex;
  intents: Intent[];
  roomPref: RoomPref | null;
  lifestyle: Lifestyle;
  gender: Gender | null;
  badges: BadgeKind[];
  lastActiveAt: string;
  match: MatchView | null;
};

/** The connection between the viewer and somebody else. */
export type ConnectionState =
  | { state: "none" }
  | { state: "sent"; interestId: string }
  | { state: "received"; interestId: string; note: string | null }
  | { state: "connected"; interestId: string; conversationId: string | null }
  | { state: "declined" };

export type RoommateProfileView = RoommateCard & {
  course: string | null;
  studyLevel: string | null;
  householdSize: number | null;
  furnishedPref: FurnishedPref | null;
  genderPref: GenderPref;
  memberSince: string;
  connection: ConnectionState;
  isSelf: boolean;
  listings: RoomCard[];
};

/** A room listing (offer, roommate wanted, or find together) in a list. */
export type RoomCard = {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  stateCode: string | null;
  city: string | null;
  area: string | null;
  institution: InstitutionRef | null;
  rentMinor: number | null;
  rentPeriod: Period;
  shareMinor: number | null;
  roomsAvailable: number | null;
  occupantsNow: number | null;
  occupantsMax: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  roomType: RoomType | null;
  furnished: Furnished | null;
  amenities: Amenity[];
  availableFrom: string | null;
  genderPref: GenderPref;
  photoUrls: string[];
  verified: boolean;
  linkedListingId: string | null;
  owner: PersonRef & { badges: BadgeKind[] };
  publishedAt: string | null;
  match: MatchView | null;
};

export type RoomDetail = RoomCard & {
  description: string;
  depositMinor: number | null;
  agencyFeeMinor: number | null;
  legalFeeMinor: number | null;
  serviceChargeMinor: number | null;
  utilitiesMonthlyMinor: number | null;
  houseRules: string[];
  minStayMonths: number | null;
  authority: Authority | null;
  expiresAt: string | null;
  viewCount: number;
  interestCount: number;
  isOwner: boolean;
  connection: ConnectionState;
  myViewing: { id: string; status: ViewingStatus; proposedAt: string } | null;
  linkedListing: { id: string; title: string; area: string | null; city: string | null; photoUrl: string | null; priceLabel: string | null } | null;
};

/** The viewer's own roommate profile, as the editor reads it. */
export type MyRoommateProfile = {
  status: "draft" | "active" | "paused" | "held";
  intents: Intent[];
  intro: string;
  lifeStage: LifeStage | null;
  institutionId: string | null;
  institutionVisible: boolean;
  course: string;
  studyLevel: string;
  workplace: string;
  workplaceVisible: boolean;
  nyscStateCode: string | null;
  stateCode: string | null;
  city: string;
  areas: string[];
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  budgetPeriod: Period;
  moveInOn: string | null;
  moveInFlex: MoveInFlex;
  roomPref: RoomPref | null;
  furnishedPref: FurnishedPref | null;
  householdSize: number | null;
  lifestyle: Lifestyle;
  gender: Gender | null;
  genderVisible: boolean;
  genderPref: GenderPref;
};

export const EMPTY_LIFESTYLE: Lifestyle = {
  cleanliness: null,
  social: null,
  sleep: null,
  smoking: null,
  pets: null,
  guests: null,
  cooking: null,
  schedule: null,
};

export const EMPTY_PROFILE: MyRoommateProfile = {
  status: "draft",
  intents: [],
  intro: "",
  lifeStage: null,
  institutionId: null,
  institutionVisible: true,
  course: "",
  studyLevel: "",
  workplace: "",
  workplaceVisible: false,
  nyscStateCode: null,
  stateCode: null,
  city: "",
  areas: [],
  budgetMinMinor: null,
  budgetMaxMinor: null,
  budgetPeriod: "year",
  moveInOn: null,
  moveInFlex: "flexible",
  roomPref: null,
  furnishedPref: null,
  householdSize: null,
  lifestyle: EMPTY_LIFESTYLE,
  gender: null,
  genderVisible: false,
  genderPref: "any",
};

/** The editable listing, as the create and edit flow holds it. */
export type ListingDraft = {
  id: string | null;
  kind: ListingKind;
  title: string;
  description: string;
  stateCode: string | null;
  city: string;
  area: string;
  institutionId: string | null;
  linkedListingId: string | null;
  rentMinor: number | null;
  rentPeriod: Period;
  shareMinor: number | null;
  depositMinor: number | null;
  agencyFeeMinor: number | null;
  legalFeeMinor: number | null;
  serviceChargeMinor: number | null;
  utilitiesMonthlyMinor: number | null;
  roomsAvailable: number | null;
  occupantsNow: number | null;
  occupantsMax: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  roomType: RoomType | null;
  furnished: Furnished | null;
  amenities: Amenity[];
  houseRules: string[];
  availableFrom: string | null;
  minStayMonths: number | null;
  genderPref: GenderPref;
  /** Storage paths in the `roommate-photos` bucket, in order. */
  photos: string[];
  authority: Authority | null;
  declared: boolean;
};

export const EMPTY_LISTING: ListingDraft = {
  id: null,
  kind: "room_offer",
  title: "",
  description: "",
  stateCode: null,
  city: "",
  area: "",
  institutionId: null,
  linkedListingId: null,
  rentMinor: null,
  rentPeriod: "year",
  shareMinor: null,
  depositMinor: null,
  agencyFeeMinor: null,
  legalFeeMinor: null,
  serviceChargeMinor: null,
  utilitiesMonthlyMinor: null,
  roomsAvailable: 1,
  occupantsNow: null,
  occupantsMax: null,
  bedrooms: null,
  bathrooms: null,
  roomType: null,
  furnished: null,
  amenities: [],
  houseRules: [],
  availableFrom: null,
  minStayMonths: null,
  genderPref: "any",
  photos: [],
  authority: null,
  declared: false,
};

export const LIMITS = {
  introMax: 600,
  titleMin: 8,
  titleMax: 120,
  descriptionMax: 2000,
  noteMax: 300,
  areasMax: 6,
  photosMax: 12,
  galleryMax: 6,
  rulesMax: 10,
  ruleMax: 120,
  groupNameMin: 3,
  groupNameMax: 60,
  groupIntroMax: 500,
  postMax: 1000,
  pageSize: 20,
} as const;

/**
 * The profile gallery's paths, cleaned: only photos in the member's own
 * folder, no repeats, no climbing out of it, at most six. Null when a path is
 * not theirs (the action then refuses, the database repeats the rule).
 */
export function cleanGallery(userId: string, paths: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const p of paths) {
    if (!p.startsWith(`${userId}/`) || p.includes("..") || p.length > 300) return null;
    if (!out.includes(p)) out.push(p);
  }
  return out.length > LIMITS.galleryMax ? null : out;
}

/* ------------------------------------------------------------------ money */

/** The monthly equivalent of an amount quoted per month or per year. */
export function monthlyMinor(amountMinor: number | null, period: Period): number | null {
  if (amountMinor === null || !Number.isFinite(amountMinor)) return null;
  return period === "year" ? Math.round(amountMinor / 12) : amountMinor;
}

/** The yearly equivalent. */
export function yearlyMinor(amountMinor: number | null, period: Period): number | null {
  if (amountMinor === null || !Number.isFinite(amountMinor)) return null;
  return period === "month" ? amountMinor * 12 : amountMinor;
}

export type MoveInCost = {
  /** The person's rent for the first period (their share when given, else the whole rent). */
  rentMinor: number;
  depositMinor: number;
  agencyMinor: number;
  legalMinor: number;
  serviceMinor: number;
  totalMinor: number;
};

/**
 * What one person pays to move into a listed room, from the lister's own
 * figures. Fees and deposits quoted for the whole home are divided by the
 * number of people who will live there when the listing gives it; otherwise
 * they are shown whole, never guessed.
 */
export function moveInCost(d: {
  rentMinor: number | null;
  shareMinor: number | null;
  depositMinor: number | null;
  agencyFeeMinor: number | null;
  legalFeeMinor: number | null;
  serviceChargeMinor: number | null;
}): MoveInCost | null {
  const rent = d.shareMinor ?? d.rentMinor;
  if (rent === null) return null;
  const deposit = d.depositMinor ?? 0;
  const agency = d.agencyFeeMinor ?? 0;
  const legal = d.legalFeeMinor ?? 0;
  const service = d.serviceChargeMinor ?? 0;
  return {
    rentMinor: rent,
    depositMinor: deposit,
    agencyMinor: agency,
    legalMinor: legal,
    serviceMinor: service,
    totalMinor: rent + deposit + agency + legal + service,
  };
}

export type SplitLine = { key: string; label: string; amountMinor: number; period: Period | "once" };
export type SplitResult = {
  people: number;
  shares: { index: number; weight: number; upfrontMinor: number; monthlyMinor: number }[];
  upfrontTotalMinor: number;
  monthlyTotalMinor: number;
};

/**
 * The cost splitter. Recurring lines (rent, service charge, utilities) are
 * turned into a monthly figure; one-off lines (deposit, agency, legal) and
 * the first rent period make the move-in amount. Weights let a bigger room
 * pay more: equal weights split equally. Rounding goes to the first person
 * so the shares always add up to the total exactly.
 */
export function splitCosts(lines: SplitLine[], weights: number[]): SplitResult {
  const people = Math.max(1, weights.length);
  const w = weights.length ? weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0)) : [1];
  const wSum = w.reduce((a, b) => a + b, 0) || people;
  let upfront = 0;
  let monthly = 0;
  for (const line of lines) {
    const amount = Math.max(0, Math.round(line.amountMinor || 0));
    if (line.period === "once") upfront += amount;
    else {
      monthly += line.period === "year" ? Math.round(amount / 12) : amount;
      upfront += amount;
    }
  }
  const share = (total: number) => {
    const raw = w.map((x) => Math.floor((total * (wSum ? x : 1)) / wSum));
    const diff = total - raw.reduce((a, b) => a + b, 0);
    raw[0] = (raw[0] ?? 0) + diff;
    return raw;
  };
  const up = share(upfront);
  const mo = share(monthly);
  return {
    people,
    shares: w.map((weight, index) => ({ index, weight, upfrontMinor: up[index] ?? 0, monthlyMinor: mo[index] ?? 0 })),
    upfrontTotalMinor: upfront,
    monthlyTotalMinor: monthly,
  };
}

/* ------------------------------------------------------------------ profile completeness */

export type CompletenessItem = "intents" | "location" | "budget" | "move_in" | "about" | "lifestyle" | "photo";

/** What is still missing, in the order the editor asks for it. Pure. */
export function profileGaps(p: MyRoommateProfile, hasPhoto: boolean): CompletenessItem[] {
  const gaps: CompletenessItem[] = [];
  if (p.intents.length === 0) gaps.push("intents");
  if (!p.city.trim()) gaps.push("location");
  if (p.budgetMaxMinor === null) gaps.push("budget");
  if (!p.moveInOn && p.moveInFlex === "fixed") gaps.push("move_in");
  if (!p.lifeStage || p.intro.trim().length < 20) gaps.push("about");
  const answered = Object.values(p.lifestyle).filter((v) => v !== null).length;
  if (answered < 4) gaps.push("lifestyle");
  if (!hasPhoto) gaps.push("photo");
  return gaps;
}

/** 0 to 100, from the gaps above. */
export function completenessPercent(p: MyRoommateProfile, hasPhoto: boolean): number {
  const total = 7;
  return Math.round(((total - profileGaps(p, hasPhoto).length) / total) * 100);
}

/** Can this profile go live? Mirrors `roommate_profiles_active_shape`. */
export function canPublishProfile(p: MyRoommateProfile): boolean {
  return p.intents.length > 0 && p.city.trim().length > 0 && p.budgetMaxMinor !== null;
}

/** Can this listing go live? Mirrors `roommate_listings_live_shape` and the form's own minimums. */
export function listingProblems(d: ListingDraft): string[] {
  const out: string[] = [];
  if (d.title.trim().length < LIMITS.titleMin) out.push("title");
  if (!d.city.trim()) out.push("city");
  if (d.kind === "room_offer") {
    if (d.rentMinor === null) out.push("rent");
    if (!d.authority) out.push("authority");
    if (!d.declared) out.push("declared");
    if (d.photos.length < REVIEW_MIN_PHOTOS) out.push("photos");
  }
  return out;
}

/** A room offer needs this many photos to be sent for review (the database repeats it on approval). */
export const REVIEW_MIN_PHOTOS = 3;

/* ------------------------------------------------------------------ discover filters */

export type PeopleFilters = {
  q: string;
  stateCode: string | null;
  city: string | null;
  institutionId: string | null;
  maxMinor: number | null;
  period: Period;
  moveBy: string | null;
  lifeStage: LifeStage | null;
  intent: Intent | null;
  verifiedOnly: boolean;
  sort: "match" | "newest" | "budget";
};

export type RoomFilters = {
  q: string;
  stateCode: string | null;
  city: string | null;
  institutionId: string | null;
  kind: ListingKind | null;
  /** Several kinds at once (the feed's "Offering a room" chip); wins over `kind` when set. */
  kinds?: ListingKind[];
  maxMinor: number | null;
  /** The budget range's floor (monthly equivalent, with `period`); optional so older callers are unchanged. */
  minMinor?: number | null;
  period: Period;
  moveBy: string | null;
  roomType: RoomType | null;
  furnished: Furnished | null;
  genderPref: GenderPref | null;
  verifiedOnly: boolean;
  sort: "match" | "newest" | "budget";
};

export const EMPTY_PEOPLE_FILTERS: PeopleFilters = {
  q: "",
  stateCode: null,
  city: null,
  institutionId: null,
  maxMinor: null,
  period: "year",
  moveBy: null,
  lifeStage: null,
  intent: null,
  verifiedOnly: false,
  sort: "match",
};

export const EMPTY_ROOM_FILTERS: RoomFilters = {
  q: "",
  stateCode: null,
  city: null,
  institutionId: null,
  kind: null,
  maxMinor: null,
  period: "year",
  moveBy: null,
  roomType: null,
  furnished: null,
  genderPref: null,
  verifiedOnly: false,
  sort: "newest",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const pick = <T extends string>(v: string | null, allowed: readonly T[]): T | null => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null);
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateShape = /^\d{4}-\d{2}-\d{2}$/;
const amount = (v: string | null): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Filters from the address bar, so Back and a shared link land on the same results. */
export function readPeopleFilters(p: Params): PeopleFilters {
  const inst = one(p.school);
  const move = one(p.by);
  return {
    q: one(p.q)?.slice(0, 80) ?? "",
    stateCode: one(p.state)?.toUpperCase().slice(0, 2) ?? null,
    city: one(p.city)?.slice(0, 60) ?? null,
    institutionId: inst && uuidShape.test(inst) ? inst : null,
    maxMinor: amount(one(p.max)),
    period: pick(one(p.per), PERIODS) ?? "year",
    moveBy: move && dateShape.test(move) ? move : null,
    lifeStage: pick(one(p.who), LIFE_STAGES),
    intent: pick(one(p.intent), INTENTS),
    verifiedOnly: one(p.verified) === "1",
    sort: pick(one(p.sort), ["match", "newest", "budget"] as const) ?? "match",
  };
}

export function readRoomFilters(p: Params): RoomFilters {
  const inst = one(p.school);
  const move = one(p.by);
  return {
    q: one(p.q)?.slice(0, 80) ?? "",
    stateCode: one(p.state)?.toUpperCase().slice(0, 2) ?? null,
    city: one(p.city)?.slice(0, 60) ?? null,
    institutionId: inst && uuidShape.test(inst) ? inst : null,
    kind: pick(one(p.kind), LISTING_KINDS),
    maxMinor: amount(one(p.max)),
    ...(amount(one(p.min)) !== null ? { minMinor: amount(one(p.min)) } : {}),
    period: pick(one(p.per), PERIODS) ?? "year",
    moveBy: move && dateShape.test(move) ? move : null,
    roomType: pick(one(p.room), ROOM_TYPES),
    furnished: pick(one(p.furnished), FURNISHED),
    genderPref: pick(one(p.gender), GENDER_PREFS),
    verifiedOnly: one(p.verified) === "1",
    sort: pick(one(p.sort), ["match", "newest", "budget"] as const) ?? "newest",
  };
}

/** The address for a set of filters (only the ones set). */
export function filtersQuery(f: Partial<PeopleFilters & RoomFilters> & { mode?: "people" | "rooms" }): string {
  const q = new URLSearchParams();
  if (f.mode) q.set("mode", f.mode);
  if (f.q) q.set("q", f.q);
  if (f.stateCode) q.set("state", f.stateCode);
  if (f.city) q.set("city", f.city);
  if (f.institutionId) q.set("school", f.institutionId);
  if (f.maxMinor) q.set("max", String(f.maxMinor));
  if (f.minMinor) q.set("min", String(f.minMinor));
  if (f.period && f.period !== "year") q.set("per", f.period);
  if (f.moveBy) q.set("by", f.moveBy);
  if (f.lifeStage) q.set("who", f.lifeStage);
  if (f.intent) q.set("intent", f.intent);
  if (f.kind) q.set("kind", f.kind);
  if (f.roomType) q.set("room", f.roomType);
  if (f.furnished) q.set("furnished", f.furnished);
  if (f.genderPref) q.set("gender", f.genderPref);
  if (f.verifiedOnly) q.set("verified", "1");
  if (f.sort && f.sort !== "match" && f.sort !== "newest") q.set("sort", f.sort);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ routes */

export const ROOMMATES_ROUTES = {
  home: "/roommates",
  discover: "/roommates/discover",
  rooms: "/roommates/discover?mode=rooms",
  person: (userId: string) => `/roommates/p/${userId}`,
  listing: (id: string) => `/roommates/r/${id}`,
  editListing: (id: string) => `/roommates/r/${id}/edit`,
  create: "/roommates/new",
  profile: "/roommates/profile",
  hub: "/roommates/me",
  connected: (interestId: string) => `/roommates/connected/${interestId}`,
  groups: "/roommates/groups",
  group: (id: string) => `/roommates/groups/${id}`,
  newGroup: "/roommates/groups/new",
  split: "/roommates/split",
  checklist: "/roommates/tools/checklist",
  agreement: "/roommates/tools/agreement",
  safety: "/roommates/safety",
  verify: "/roommates/verify",
  campus: (slug: string) => `/roommates/campus/${slug}`,
  campuses: "/roommates/campus",
  nysc: "/roommates/nysc",
} as const;

/**
 * The public URL of a stored photo. A bare path is in the public
 * `roommate-photos` bucket; the database returns a linked property's photo as
 * `listing-photos/<path>` (Vallo's public listing bucket). Full URLs pass
 * through.
 */
export function roommatePhotoUrl(supabaseUrl: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public`;
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  if (path.startsWith("listing-photos/")) return `${base}/listing-photos/${enc(path.slice("listing-photos/".length))}`;
  return `${base}/roommate-photos/${enc(path)}`;
}
