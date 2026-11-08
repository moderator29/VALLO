/**
 * Fictional rows for the Roommates preview harness (dev only, never served on
 * Vercel). Every person here is invented, photos are Vallo's own interior
 * shots from public/brand/photos, and nothing here reaches a real page.
 */
import { EMPTY_LIFESTYLE, type InstitutionRef, type RoomCard, type RoomDetail, type RoommateCard, type RoommateProfileView } from "@/lib/features/roommates/model";
import type { GroupView, RoommatesHome, RoommatesHub } from "@/lib/features/roommates/queries";

export const NOW = Date.parse("2026-11-08T18:00:00Z");
const day = (n: number) => new Date(NOW + n * 86_400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const UNILAG: InstitutionRef = { id: id(900), slug: "university-of-lagos", name: "University of Lagos", shortName: "UNILAG", kind: "university", stateCode: "LA", city: "Lagos" };
const UI: InstitutionRef = { id: id(901), slug: "university-of-ibadan", name: "University of Ibadan", shortName: "UI", kind: "university", stateCode: "OY", city: "Ibadan" };

const person = (n: number, name: string, handle: string) => ({ userId: id(n), name, handle, avatarUrl: null });

export const PEOPLE: RoommateCard[] = [
  {
    ...person(1, "Adaeze N.", "adaeze"),
    intro: "Final year law student. Quiet weekdays, church on Sundays, I cook most evenings and keep the kitchen spotless.",
    lifeStage: "student",
    institution: UNILAG,
    workplace: null,
    stateCode: "LA",
    city: "Lagos",
    areas: ["Akoka", "Yaba"],
    budget: { minMinor: 90_000_000, maxMinor: 150_000_000, period: "year" },
    moveInOn: day(30),
    moveInFlex: "fixed",
    intents: ["find_roommate", "find_together"],
    roomPref: "private",
    lifestyle: { ...EMPTY_LIFESTYLE, cleanliness: 3, social: 1, sleep: "early", smoking: "never", cooking: "often" },
    gender: null,
    badges: ["student_email", "phone"],
    lastActiveAt: ago(2),
    match: { score: 92, parts: { budget: 1, location: 1, move_in: 0.75, lifestyle: 0.88 }, reasons: ["same_area", "budget", "quiet", "non_smoking", "institution"] },
  },
  {
    ...person(2, "Tobi A.", "tobi"),
    intro: "Software engineer at a fintech in Yaba. Out most days, gym in the evenings, friendly but private.",
    lifeStage: "professional",
    institution: null,
    workplace: "Fintech, Yaba",
    stateCode: "LA",
    city: "Lagos",
    areas: ["Yaba", "Surulere"],
    budget: { minMinor: 15_000_000, maxMinor: 22_000_000, period: "month" },
    moveInOn: null,
    moveInFlex: "asap",
    intents: ["find_room"],
    roomPref: "private",
    lifestyle: { ...EMPTY_LIFESTYLE, cleanliness: 2, social: 2, sleep: "late", smoking: "never", schedule: "day" },
    gender: null,
    badges: ["identity", "phone"],
    lastActiveAt: ago(20),
    match: { score: 78, parts: { budget: 0.8, location: 0.75, lifestyle: 0.7 }, reasons: ["same_city", "budget", "non_smoking"] },
  },
  {
    ...person(3, "Hauwa B.", "hauwa"),
    intro: "Corps member posted to Lagos from Kaduna. Looking for a calm shared flat near my PPA in Ikeja.",
    lifeStage: "corps_member",
    institution: null,
    workplace: null,
    stateCode: "LA",
    city: "Lagos",
    areas: ["Ikeja", "Ogba"],
    budget: { minMinor: 60_000_000, maxMinor: 100_000_000, period: "year" },
    moveInOn: day(12),
    moveInFlex: "fixed",
    intents: ["find_room", "find_together"],
    roomPref: "either",
    lifestyle: { ...EMPTY_LIFESTYLE, cleanliness: 3, social: 1, smoking: "never", guests: "rarely" },
    gender: null,
    badges: ["nysc"],
    lastActiveAt: ago(5),
    match: null,
  },
];

const room = (n: number, over: Partial<RoomCard>): RoomCard => ({
  id: id(100 + n),
  kind: "room_offer",
  status: "live",
  title: "Ensuite room in a 3 bedroom flat",
  stateCode: "LA",
  city: "Lagos",
  area: "Yaba",
  institution: UNILAG,
  rentMinor: 360_000_000,
  rentPeriod: "year",
  shareMinor: 120_000_000,
  roomsAvailable: 1,
  occupantsNow: 2,
  occupantsMax: 3,
  bedrooms: 3,
  bathrooms: 3,
  roomType: "ensuite",
  furnished: "furnished",
  amenities: ["wifi", "power_backup", "security", "water"],
  availableFrom: day(20),
  genderPref: "any",
  photoUrls: ["/brand/photos/bedroom-01.webp", "/brand/photos/living-room-day.webp", "/brand/photos/bathroom-01.webp"],
  verified: true,
  linkedListingId: null,
  owner: { ...person(10, "Emeka O.", "emeka"), badges: ["identity", "phone"] },
  publishedAt: ago(30),
  match: { score: 88, parts: { budget: 1, location: 1, accommodation: 1, move_in: 0.75 }, reasons: ["same_area", "budget", "room", "institution"] },
  ...over,
});

export const ROOMS: RoomCard[] = [
  room(1, {}),
  room(2, {
    title: "Private room near UI second gate",
    city: "Ibadan",
    area: "Agbowo",
    stateCode: "OY",
    institution: UI,
    rentMinor: 90_000_000,
    shareMinor: 45_000_000,
    occupantsNow: 1,
    occupantsMax: 2,
    bedrooms: 2,
    bathrooms: 1,
    roomType: "private",
    furnished: "semi",
    amenities: ["prepaid_meter", "water"],
    photoUrls: ["/brand/photos/bedroom-02.webp"],
    verified: false,
    owner: { ...person(11, "Funke S.", "funke"), badges: ["student_email"] },
    match: null,
  }),
  room(3, {
    kind: "together",
    title: "Two UNILAG students looking for a third for a 3 bed",
    area: "Akoka",
    rentMinor: null,
    shareMinor: 130_000_000,
    roomType: null,
    furnished: null,
    amenities: [],
    photoUrls: [],
    verified: false,
    owner: { ...person(1, "Adaeze N.", "adaeze"), badges: ["student_email", "phone"] },
  }),
];

export const ROOM_DETAIL: RoomDetail = {
  ...ROOMS[0]!,
  description:
    "Bright ensuite room in a quiet three bedroom flat on a gated close, ten minutes' walk to the UNILAG main gate. Two of us live here: a medical student and a young lawyer. Shared kitchen and living room, a generator for the evenings and a cleaner every Saturday.",
  depositMinor: 20_000_000,
  agencyFeeMinor: 10_000_000,
  legalFeeMinor: 5_000_000,
  serviceChargeMinor: 15_000_000,
  utilitiesMonthlyMinor: 2_500_000,
  houseRules: ["No smoking indoors", "Quiet after 11pm on weeknights", "Guests overnight at weekends only"],
  minStayMonths: 12,
  authority: "tenant_permitted",
  expiresAt: day(52),
  viewCount: 148,
  interestCount: 9,
  isOwner: false,
  connection: { state: "none" },
  myViewing: null,
  linkedListing: { id: id(500), title: "3 bedroom flat, Onike, Yaba", area: "Yaba", city: "Lagos", photoUrl: "/brand/photos/living-room-dusk.webp", priceLabel: "NGN 3,600,000 per year" },
};

export const PROFILE: RoommateProfileView = {
  ...PEOPLE[0]!,
  course: "Law",
  studyLevel: "500 level",
  householdSize: 3,
  furnishedPref: "furnished",
  genderPref: "any",
  memberSince: "2026-08-14T10:00:00Z",
  connection: { state: "none" },
  isSelf: false,
  listings: [ROOMS[2]!],
};

export const HOME: RoommatesHome = {
  live: true,
  signedIn: true,
  viewerName: "Kemi",
  myStatus: "active",
  completeness: 86,
  stats: { people: 1284, rooms: 312, groups: 57 },
  recommended: PEOPLE,
  rooms: ROOMS.slice(0, 2),
  together: [ROOMS[2]!],
  institutions: [
    { ...UNILAG, people: 214, rooms: 61 },
    { ...UI, people: 133, rooms: 28 },
    { id: id(902), slug: "obafemi-awolowo-university", name: "Obafemi Awolowo University", shortName: "OAU", kind: "university", stateCode: "OS", city: "Ile-Ife", people: 97, rooms: 19 },
    { id: id(903), slug: "lagos-state-university", name: "Lagos State University", shortName: "LASU", kind: "university", stateCode: "LA", city: "Ojo", people: 88, rooms: 23 },
  ],
  pending: { requests: 2, invites: 1, viewings: 1 },
};

export const HOME_NEW: RoommatesHome = { ...HOME, myStatus: "none", completeness: 0, recommended: [], viewerName: "Kemi", pending: { requests: 0, invites: 0, viewings: 0 } };

export const HUB: RoommatesHub = {
  live: true,
  signedIn: true,
  myStatus: "active",
  badges: ["student_email", "phone"],
  interests: [
    { id: id(300), direction: "in", status: "pending", note: "Hi! I'm also at UNILAG and looking around Akoka.", createdAt: ago(3), decidedAt: null, conversationId: null, person: { ...person(1, "Adaeze N.", "adaeze"), badges: ["student_email"] }, listing: null },
    { id: id(301), direction: "out", status: "accepted", note: null, createdAt: ago(40), decidedAt: ago(30), conversationId: id(700), person: { ...person(2, "Tobi A.", "tobi"), badges: ["identity"] }, listing: null },
  ],
  groups: [
    { id: id(400), name: "UNILAG girls, 3 bed in Akoka", stage: "searching", city: "Lagos", role: "owner", state: "active", memberCount: 2, sizeTarget: 3, faces: [person(1, "Adaeze N.", "adaeze"), person(5, "Kemi O.", "kemi")], invitedBy: null },
  ],
  viewings: [
    { id: id(600), role: "guest", status: "confirmed", mode: "in_person", proposedAt: new Date(NOW + 2 * 86_400_000).toISOString(), altAt: null, note: null, listing: { id: ROOMS[0]!.id, title: ROOMS[0]!.title, area: "Yaba", city: "Lagos", photoUrl: "/brand/photos/bedroom-01.webp" }, person: person(10, "Emeka O.", "emeka") },
  ],
  listings: [],
  searches: [{ id: id(800), label: "Rooms near UNILAG under 1.5m", kind: "room_offer", city: "Lagos", stateCode: "LA", institutionId: UNILAG.id, maxMinor: 150_000_000, period: "year", alert: true, createdAt: ago(100) }],
  verifications: [{ id: id(810), kind: "student_email", status: "verified", institution: UNILAG, emailMasked: "ke****@live.unilag.edu.ng", reason: null, createdAt: ago(200), reviewedAt: ago(199) }],
};

export const GROUP: GroupView = {
  id: id(400),
  name: "UNILAG girls, 3 bed in Akoka",
  intro: "Three final year students who want a calm, clean flat close to the main gate.",
  visibility: "open",
  stage: "searching",
  stateCode: "LA",
  city: "Lagos",
  areas: ["Akoka", "Yaba"],
  institution: UNILAG,
  bedrooms: 3,
  sizeTarget: 3,
  budgetMinMinor: 100_000_000,
  budgetMaxMinor: 150_000_000,
  budgetPeriod: "year",
  moveInOn: day(30),
  myRole: "owner",
  myState: "active",
  members: [
    { ...person(5, "Kemi O.", "kemi"), role: "owner", state: "active", sharePercent: null, badges: ["student_email"] },
    { ...person(1, "Adaeze N.", "adaeze"), role: "member", state: "active", sharePercent: null, badges: ["student_email", "phone"] },
  ],
  shortlist: [
    { id: id(410), note: "Close to the gate, landlord lives elsewhere", addedBy: person(1, "Adaeze N.", "adaeze"), createdAt: ago(10), kind: "property", target: { id: id(500), title: "3 bedroom flat, Onike, Yaba", area: "Yaba", city: "Lagos", photoUrl: "/brand/photos/living-room-day.webp", priceMinor: 360_000_000, period: "year", bedrooms: 3, href: "#" }, votes: { yes: 2, maybe: 0, no: 0, mine: "yes" } },
    { id: id(411), note: null, addedBy: person(5, "Kemi O.", "kemi"), createdAt: ago(30), kind: "property", target: { id: id(501), title: "3 bedroom apartment, Akoka", area: "Akoka", city: "Lagos", photoUrl: "/brand/photos/living-room-dusk.webp", priceMinor: 420_000_000, period: "year", bedrooms: 3, href: "#" }, votes: { yes: 1, maybe: 1, no: 0, mine: "maybe" } },
  ],
  posts: [
    { id: id(420), body: "Can we all do a viewing on Saturday morning? The agent says 10am works.", createdAt: ago(4), author: person(1, "Adaeze N.", "adaeze"), mine: false },
    { id: id(421), body: "Saturday works for me. Let's ask about the generator schedule.", createdAt: ago(2), author: person(5, "Kemi O.", "kemi"), mine: true },
  ],
  expenses: [],
  createdAt: ago(300),
};
