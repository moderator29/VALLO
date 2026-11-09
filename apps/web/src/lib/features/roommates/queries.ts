import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSessionClaims } from "@/lib/actions/session";
import { reportReadFault } from "@/lib/observability/read-error";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

import { faults, isNotLive } from "../degrade";
import {
  EMPTY_LIFESTYLE,
  EMPTY_PROFILE,
  LIMITS,
  roommatePhotoUrl,
  type BadgeKind,
  type ExpenseStatus,
  type GroupStage,
  type InstitutionRef,
  type InterestStatus,
  type MyRoommateProfile,
  type PeopleFilters,
  type PersonRef,
  type RoomCard,
  type RoomDetail,
  type RoomFilters,
  type RoommateCard,
  type RoommateProfileView,
  type VerificationKind,
  type VerificationStatus,
  type ViewingMode,
  type ViewingStatus,
  type Vote,
  type Period,
  type ListingDraft,
} from "./model";

/**
 * VALLO ROOMMATES, THE READS.
 *
 * Everything that shows one member to another goes through a SECURITY
 * DEFINER function in the database (`roommate_discover`,
 * `roommate_profile_view`, `roommate_listing_view`, ...). Those functions
 * hold the privacy rules (hidden fields come back null, blocked people never
 * come back, people discovery needs an active profile of your own) and return
 * JSON already in the shapes of `model.ts`. This file only calls them, turns
 * storage paths into URLs and reads an absent function (the SQL not run yet)
 * as `live: false`, never as a sample.
 */

type Db = SupabaseClient;
type Viewer = { id: string | null; db: Db };

async function viewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured()) return null;
  const claims = await resolveSessionClaims();
  if (claims.state === "signed-in") return { id: claims.userId, db: claims.supabase as unknown as Db };
  return { id: null, db: (await createClient()) as unknown as Db };
}

const photo = (path: string) => roommatePhotoUrl(SUPABASE_URL, path);

/* Photo paths become URLs on every card the database returns. */
function withRoomPhotos<T extends { photoUrls?: string[] | null }>(row: T): T {
  return { ...row, photoUrls: (row.photoUrls ?? []).map(photo) };
}

function withLifestyle<T extends { lifestyle?: unknown }>(row: T): T {
  return { ...row, lifestyle: { ...EMPTY_LIFESTYLE, ...((row.lifestyle as object | null) ?? {}) } };
}

async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>, kind: `read.${string}`): Promise<{ live: boolean; data: T | null }> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    /* Reported first (an absent function is filtered out by `faults`). */
    await reportReadFault(kind, ...faults(error));
    if (isNotLive(error)) return { live: false, data: null };
    return { live: true, data: null };
  }
  return { live: true, data: (data as T) ?? null };
}

/* ------------------------------------------------------------------ home */

export type HomeStats = { people: number; rooms: number; groups: number };
export type InstitutionCount = InstitutionRef & { people: number; rooms: number };

export type RoommatesHome = {
  live: boolean;
  signedIn: boolean;
  viewerName: string | null;
  myStatus: MyRoommateProfile["status"] | "none";
  completeness: number;
  stats: HomeStats | null;
  recommended: RoommateCard[];
  rooms: RoomCard[];
  together: RoomCard[];
  institutions: InstitutionCount[];
  pending: { requests: number; invites: number; viewings: number };
};

export async function readRoommatesHome(): Promise<RoommatesHome> {
  const empty: RoommatesHome = {
    live: false,
    signedIn: false,
    viewerName: null,
    myStatus: "none",
    completeness: 0,
    stats: null,
    recommended: [],
    rooms: [],
    together: [],
    institutions: [],
    pending: { requests: 0, invites: 0, viewings: 0 },
  };
  const v = await viewer();
  if (!v) return empty;
  const res = await rpc<Omit<RoommatesHome, "live" | "signedIn">>(v.db, "roommate_home", {}, "read.roommates.home");
  if (!res.live) return { ...empty, signedIn: v.id !== null };
  const d = res.data;
  if (!d) return { ...empty, live: true, signedIn: v.id !== null };
  return {
    ...empty,
    ...d,
    live: true,
    signedIn: v.id !== null,
    recommended: (d.recommended ?? []).map(withLifestyle),
    rooms: (d.rooms ?? []).map(withRoomPhotos),
    together: (d.together ?? []).map(withRoomPhotos),
    institutions: d.institutions ?? [],
  };
}

/* ------------------------------------------------------------------ discover */

export type PeoplePage =
  | { state: "not-open" }
  | { state: "signed-out" }
  | { state: "need-profile" }
  | { state: "ok"; items: RoommateCard[]; next: number | null };

export async function discoverPeople(filters: PeopleFilters, offset = 0): Promise<PeoplePage> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  if (!v.id) return { state: "signed-out" };
  const res = await rpc<{ needProfile?: boolean; items: RoommateCard[]; next: number | null }>(
    v.db,
    "roommate_discover",
    { p: { ...filters, offset, limit: LIMITS.pageSize } },
    "read.roommates.discover",
  );
  if (!res.live) return { state: "not-open" };
  if (res.data?.needProfile) return { state: "need-profile" };
  return { state: "ok", items: (res.data?.items ?? []).map(withLifestyle), next: res.data?.next ?? null };
}

export type RoomsPage = { state: "not-open" } | { state: "ok"; items: RoomCard[]; next: number | null };

export async function searchRooms(filters: RoomFilters, offset = 0): Promise<RoomsPage> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  const res = await rpc<{ items: RoomCard[]; next: number | null }>(
    v.db,
    "roommate_search_listings",
    { p: { ...filters, offset, limit: LIMITS.pageSize } },
    "read.roommates.rooms",
  );
  if (!res.live) return { state: "not-open" };
  return { state: "ok", items: (res.data?.items ?? []).map(withRoomPhotos), next: res.data?.next ?? null };
}

/* ------------------------------------------------------------------ one person, one listing */

export type ProfileRead =
  | { state: "not-open" }
  | { state: "signed-out" }
  | { state: "need-profile" }
  | { state: "not-found" }
  | { state: "ok"; profile: RoommateProfileView };

export async function readRoommateProfile(userId: string): Promise<ProfileRead> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  if (!v.id) return { state: "signed-out" };
  const res = await rpc<(RoommateProfileView & { needProfile?: boolean }) | null>(v.db, "roommate_profile_view", { p_user: userId }, "read.roommates.profile");
  if (!res.live) return { state: "not-open" };
  if (!res.data) return { state: "not-found" };
  if (res.data.needProfile) return { state: "need-profile" };
  const p = withLifestyle(res.data);
  return { state: "ok", profile: { ...p, listings: (p.listings ?? []).map(withRoomPhotos) } };
}

export type ListingRead = { state: "not-open" } | { state: "not-found" } | { state: "ok"; listing: RoomDetail; signedIn: boolean };

export async function readRoomListing(id: string): Promise<ListingRead> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  const res = await rpc<RoomDetail | null>(v.db, "roommate_listing_view", { p_id: id }, "read.roommates.listing");
  if (!res.live) return { state: "not-open" };
  if (!res.data) return { state: "not-found" };
  const l = withRoomPhotos(res.data);
  const linked = l.linkedListing ? { ...l.linkedListing, photoUrl: l.linkedListing.photoUrl ? photo(l.linkedListing.photoUrl) : null } : null;
  return { state: "ok", listing: { ...l, linkedListing: linked }, signedIn: v.id !== null };
}

/* ------------------------------------------------------------------ my own */

export type MyProfileRead = { state: "not-open" } | { state: "signed-out" } | { state: "ok"; profile: MyRoommateProfile; exists: boolean; hasPhoto: boolean; name: string | null };

export async function readMyRoommateProfile(): Promise<MyProfileRead> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  if (!v.id) return { state: "signed-out" };
  const [row, social] = await Promise.all([
    v.db.from("roommate_profiles").select("*").eq("user_id", v.id).maybeSingle(),
    v.db.from("social_profiles").select("display_label, avatar_path").eq("user_id", v.id).maybeSingle(),
  ]);
  if (row.error) {
    await reportReadFault("read.roommates.mine", ...faults(row.error));
    if (isNotLive(row.error)) return { state: "not-open" };
  }
  if (social.error) await reportReadFault("read.roommates.mine", ...faults(social.error));
  const s = social.data as { display_label: string | null; avatar_path: string | null } | null;
  const r = row.data as Record<string, unknown> | null;
  return {
    state: "ok",
    exists: r !== null,
    hasPhoto: Boolean(s?.avatar_path),
    name: s?.display_label ?? null,
    profile: r ? profileFromRow(r) : EMPTY_PROFILE,
  };
}

function profileFromRow(r: Record<string, unknown>): MyRoommateProfile {
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const num = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : r[k] === null || r[k] === undefined ? null : Number(r[k]));
  return {
    status: (r.status as MyRoommateProfile["status"]) ?? "draft",
    intents: (r.intents as MyRoommateProfile["intents"]) ?? [],
    intro: str("intro"),
    lifeStage: (r.life_stage as MyRoommateProfile["lifeStage"]) ?? null,
    institutionId: (r.institution_id as string | null) ?? null,
    institutionVisible: r.institution_visible !== false,
    course: str("course"),
    studyLevel: str("study_level"),
    workplace: str("workplace"),
    workplaceVisible: r.workplace_visible === true,
    nyscStateCode: (r.nysc_state_code as string | null) ?? null,
    stateCode: (r.state_code as string | null) ?? null,
    city: str("city"),
    areas: (r.areas as string[]) ?? [],
    budgetMinMinor: num("budget_min_minor"),
    budgetMaxMinor: num("budget_max_minor"),
    budgetPeriod: (r.budget_period as Period) ?? "year",
    moveInOn: (r.move_in_on as string | null) ?? null,
    moveInFlex: (r.move_in_flex as MyRoommateProfile["moveInFlex"]) ?? "flexible",
    roomPref: (r.room_pref as MyRoommateProfile["roomPref"]) ?? null,
    furnishedPref: (r.furnished_pref as MyRoommateProfile["furnishedPref"]) ?? null,
    householdSize: num("household_size"),
    lifestyle: {
      cleanliness: (num("cleanliness") as 1 | 2 | 3 | null) ?? null,
      social: (num("social") as 1 | 2 | 3 | null) ?? null,
      sleep: (r.sleep as MyRoommateProfile["lifestyle"]["sleep"]) ?? null,
      smoking: (r.smoking as MyRoommateProfile["lifestyle"]["smoking"]) ?? null,
      pets: (r.pets as MyRoommateProfile["lifestyle"]["pets"]) ?? null,
      guests: (r.guests as MyRoommateProfile["lifestyle"]["guests"]) ?? null,
      cooking: (r.cooking as MyRoommateProfile["lifestyle"]["cooking"]) ?? null,
      schedule: (r.schedule as MyRoommateProfile["lifestyle"]["schedule"]) ?? null,
    },
    gender: (r.gender as MyRoommateProfile["gender"]) ?? null,
    genderVisible: r.gender_visible === true,
    genderPref: (r.gender_pref as MyRoommateProfile["genderPref"]) ?? "any",
  };
}

/** One of my listings, for the edit flow. Null when it is not mine. */
export async function readMyListingDraft(id: string): Promise<ListingDraft | null> {
  const v = await viewer();
  if (!v?.id) return null;
  const { data, error } = await v.db.from("roommate_listings").select("*").eq("id", id).eq("owner_id", v.id).maybeSingle();
  if (error) {
    await reportReadFault("read.roommates.draft", ...faults(error));
    return null;
  }
  const r = data as Record<string, unknown> | null;
  if (!r) return null;
  const n = (k: string) => (r[k] === null || r[k] === undefined ? null : Number(r[k]));
  return {
    id: r.id as string,
    kind: r.kind as ListingDraft["kind"],
    title: (r.title as string) ?? "",
    description: (r.description as string) ?? "",
    stateCode: (r.state_code as string | null) ?? null,
    city: (r.city as string) ?? "",
    area: (r.area as string) ?? "",
    institutionId: (r.institution_id as string | null) ?? null,
    linkedListingId: (r.listing_id as string | null) ?? null,
    rentMinor: n("rent_minor"),
    rentPeriod: (r.rent_period as Period) ?? "year",
    shareMinor: n("share_minor"),
    depositMinor: n("deposit_minor"),
    agencyFeeMinor: n("agency_fee_minor"),
    legalFeeMinor: n("legal_fee_minor"),
    serviceChargeMinor: n("service_charge_minor"),
    utilitiesMonthlyMinor: n("utilities_monthly_minor"),
    roomsAvailable: n("rooms_available"),
    occupantsNow: n("occupants_now"),
    occupantsMax: n("occupants_max"),
    bedrooms: n("bedrooms"),
    bathrooms: n("bathrooms"),
    roomType: (r.room_type as ListingDraft["roomType"]) ?? null,
    furnished: (r.furnished as ListingDraft["furnished"]) ?? null,
    amenities: (r.amenities as ListingDraft["amenities"]) ?? [],
    houseRules: (r.house_rules as string[]) ?? [],
    availableFrom: (r.available_from as string | null) ?? null,
    minStayMonths: n("min_stay_months"),
    genderPref: (r.gender_pref as ListingDraft["genderPref"]) ?? "any",
    photos: (r.photos as string[]) ?? [],
    authority: (r.authority as ListingDraft["authority"]) ?? null,
    declared: Boolean(r.authority_declared_at),
  };
}

/* ------------------------------------------------------------------ the hub */

export type InterestRow = {
  id: string;
  direction: "in" | "out";
  status: InterestStatus;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  conversationId: string | null;
  person: PersonRef & { badges: BadgeKind[] };
  listing: { id: string; title: string } | null;
};

export type GroupRow = {
  id: string;
  name: string;
  stage: GroupStage;
  city: string | null;
  role: "owner" | "member" | null;
  state: "invited" | "requested" | "active";
  memberCount: number;
  sizeTarget: number;
  faces: PersonRef[];
  invitedBy: PersonRef | null;
};

export type ViewingRow = {
  id: string;
  role: "host" | "guest";
  status: ViewingStatus;
  mode: ViewingMode;
  proposedAt: string;
  altAt: string | null;
  note: string | null;
  listing: { id: string; title: string; area: string | null; city: string | null; photoUrl: string | null };
  person: PersonRef;
};

export type MyListingRow = RoomCard & { viewCount: number; interestCount: number; expiresAt: string | null };

export type SavedSearchRow = {
  id: string;
  label: string;
  kind: RoomCard["kind"] | null;
  city: string | null;
  stateCode: string | null;
  institutionId: string | null;
  maxMinor: number | null;
  period: Period;
  alert: boolean;
  createdAt: string;
};

export type VerificationRow = {
  id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  institution: InstitutionRef | null;
  emailMasked: string | null;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type RoommatesHub = {
  live: boolean;
  signedIn: boolean;
  myStatus: MyRoommateProfile["status"] | "none";
  interests: InterestRow[];
  groups: GroupRow[];
  viewings: ViewingRow[];
  listings: MyListingRow[];
  searches: SavedSearchRow[];
  verifications: VerificationRow[];
  badges: BadgeKind[];
};

export async function readRoommatesHub(): Promise<RoommatesHub> {
  const empty: RoommatesHub = {
    live: false,
    signedIn: false,
    myStatus: "none",
    interests: [],
    groups: [],
    viewings: [],
    listings: [],
    searches: [],
    verifications: [],
    badges: [],
  };
  const v = await viewer();
  if (!v) return empty;
  if (!v.id) return { ...empty, live: true };
  const res = await rpc<Omit<RoommatesHub, "live" | "signedIn">>(v.db, "roommate_my_hub", {}, "read.roommates.hub");
  if (!res.live) return { ...empty, signedIn: true };
  const d = res.data;
  if (!d) return { ...empty, live: true, signedIn: true };
  return {
    ...empty,
    ...d,
    live: true,
    signedIn: true,
    listings: (d.listings ?? []).map(withRoomPhotos),
    viewings: (d.viewings ?? []).map((row) => ({ ...row, listing: { ...row.listing, photoUrl: row.listing.photoUrl ? photo(row.listing.photoUrl) : null } })),
  };
}

/* ------------------------------------------------------------------ one group */

export type ShortlistItem = {
  id: string;
  note: string | null;
  addedBy: PersonRef;
  createdAt: string;
  kind: "property" | "room";
  target: { id: string; title: string; area: string | null; city: string | null; photoUrl: string | null; priceMinor: number | null; period: Period | null; bedrooms: number | null; href: string };
  votes: { yes: number; maybe: number; no: number; mine: Vote | null };
};

export type GroupPost = { id: string; body: string; createdAt: string; author: PersonRef; mine: boolean };
export type GroupExpense = {
  id: string;
  title: string;
  amountMinor: number;
  paidBy: PersonRef | null;
  dueOn: string | null;
  status: ExpenseStatus;
  createdAt: string;
};
export type GroupMember = PersonRef & { role: "owner" | "member"; state: "invited" | "requested" | "active"; sharePercent: number | null; badges: BadgeKind[] };

export type GroupView = {
  id: string;
  name: string;
  intro: string | null;
  visibility: "private" | "open";
  stage: GroupStage;
  stateCode: string | null;
  city: string | null;
  areas: string[];
  institution: InstitutionRef | null;
  bedrooms: number | null;
  sizeTarget: number;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  budgetPeriod: Period;
  moveInOn: string | null;
  myRole: "owner" | "member" | null;
  myState: "invited" | "requested" | "active" | null;
  members: GroupMember[];
  shortlist: ShortlistItem[];
  posts: GroupPost[];
  expenses: GroupExpense[];
  createdAt: string;
};

export type GroupRead = { state: "not-open" } | { state: "signed-out" } | { state: "not-found" } | { state: "ok"; group: GroupView };

export async function readRoommateGroup(id: string): Promise<GroupRead> {
  const v = await viewer();
  if (!v) return { state: "not-open" };
  if (!v.id) return { state: "signed-out" };
  const res = await rpc<GroupView | null>(v.db, "roommate_group_view", { p_id: id }, "read.roommates.group");
  if (!res.live) return { state: "not-open" };
  if (!res.data) return { state: "not-found" };
  const g = res.data;
  return {
    state: "ok",
    group: {
      ...g,
      shortlist: (g.shortlist ?? []).map((s) =>
        s.target.photoUrl ? { ...s, target: { ...s.target, photoUrl: photo(s.target.photoUrl) } } : s,
      ),
    },
  };
}

/** Open groups others can ask to join (find together). */
export async function readOpenGroups(filters: { stateCode: string | null; city: string | null }): Promise<{ live: boolean; groups: GroupRow[] }> {
  const v = await viewer();
  if (!v?.id) return { live: Boolean(v), groups: [] };
  const res = await rpc<GroupRow[]>(v.db, "roommate_open_groups", { p_state: filters.stateCode, p_city: filters.city }, "read.roommates.open-groups");
  return { live: res.live, groups: res.data ?? [] };
}

/* ------------------------------------------------------------------ institutions */

export async function listInstitutions(input: { q?: string; stateCode?: string | null; limit?: number } = {}): Promise<{ live: boolean; items: InstitutionRef[] }> {
  const v = await viewer();
  if (!v) return { live: false, items: [] };
  let query = v.db
    .from("institutions")
    .select("id, slug, name, short_name, kind, state_code, city")
    .eq("status", "live")
    .order("name")
    .limit(Math.min(input.limit ?? 200, 400));
  if (input.stateCode) query = query.eq("state_code", input.stateCode);
  const q = input.q?.trim();
  if (q) query = query.or(`name.ilike.%${q.replace(/[%_,()]/g, " ")}%,short_name.ilike.%${q.replace(/[%_,()]/g, " ")}%`);
  const { data, error } = await query;
  if (error) {
    await reportReadFault("read.roommates.institutions", ...faults(error));
    if (isNotLive(error)) return { live: false, items: [] };
    return { live: true, items: [] };
  }
  return {
    live: true,
    items: ((data ?? []) as { id: string; slug: string; name: string; short_name: string | null; kind: string; state_code: string | null; city: string | null }[]).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortName: r.short_name,
      kind: r.kind,
      stateCode: r.state_code,
      city: r.city,
    })),
  };
}

export type InstitutionPage = {
  state: "not-open" | "not-found" | "ok";
  institution: (InstitutionRef & { emailVerifyOn: boolean }) | null;
  people: number;
  roomsCount: number;
  rooms: RoomCard[];
  students: RoommateCard[];
};

export async function readInstitutionPage(slug: string): Promise<InstitutionPage> {
  const none: InstitutionPage = { state: "not-open", institution: null, people: 0, roomsCount: 0, rooms: [], students: [] };
  const v = await viewer();
  if (!v) return none;
  const res = await rpc<Omit<InstitutionPage, "state"> | null>(v.db, "roommate_institution_page", { p_slug: slug }, "read.roommates.campus");
  if (!res.live) return none;
  if (!res.data?.institution) return { ...none, state: "not-found" };
  return {
    state: "ok",
    ...res.data,
    rooms: (res.data.rooms ?? []).map(withRoomPhotos),
    students: (res.data.students ?? []).map(withLifestyle),
  };
}

/* ------------------------------------------------------------------ property integration */

/** Live roommate posts linked to one Vallo property listing (for the listing page). */
export async function readRoomsForProperty(listingId: string): Promise<RoomCard[]> {
  const v = await viewer();
  if (!v) return [];
  const res = await rpc<{ items: RoomCard[] }>(v.db, "roommate_search_listings", { p: { linkedListingId: listingId, offset: 0, limit: 6 } }, "read.roommates.for-property");
  return (res.data?.items ?? []).map(withRoomPhotos);
}

/** The viewer's active groups, for "Add to group shortlist" pickers. */
export async function readMyActiveGroups(): Promise<{ id: string; name: string }[]> {
  const v = await viewer();
  if (!v?.id) return [];
  const { data, error } = await v.db
    .from("roommate_group_members")
    .select("group_id, roommate_groups(name, stage)")
    .eq("user_id", v.id)
    .eq("state", "active");
  if (error) {
    if (!isNotLive(error)) await reportReadFault("read.roommates.my-groups", ...faults(error));
    return [];
  }
  return ((data ?? []) as unknown as { group_id: string; roommate_groups: { name: string; stage: string } | null }[])
    .filter((r) => r.roommate_groups && r.roommate_groups.stage !== "closed")
    .map((r) => ({ id: r.group_id, name: r.roommate_groups!.name }));
}

/** My accepted connections, for group invite pickers. */
export async function readMyConnections(): Promise<(PersonRef & { interestId: string })[]> {
  const v = await viewer();
  if (!v?.id) return [];
  const res = await rpc<(PersonRef & { interestId: string })[]>(v.db, "roommate_my_connections", {}, "read.roommates.connections");
  return res.data ?? [];
}
