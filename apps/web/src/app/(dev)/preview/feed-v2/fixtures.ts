import type { PostView } from "@/components/social/feed/PostCard";
import type { DirEntry } from "@/lib/directory/model";
import type { ProfileFacts, FollowedProfile } from "@/lib/social/people-discovery-model";
import type { PersonHit } from "@/lib/social/people-hits";

/**
 * FIXTURE PROPS, NOT DATA, for `/preview/feed-v2` (13 October 2026). Invented
 * people, the platform's own photography, and counts invented HERE to fill the
 * slots a live read fills. The ranking on the people page is the real pure
 * model (`lib/social/people-discovery-model`) run over these rows, so what the
 * screenshots show is the real ordering rule on stand-in numbers. Nothing here
 * ships, and every picture taken from it is fixture-backed.
 */

const house = "/brand/photos/villa-exterior-sunset-640.jpg";
const pool = "/brand/photos/resort-pool-deck-640.jpg";
const living = "/brand/photos/living-room-dusk-640.jpg";
const bedroom = "/brand/photos/bedroom-01-640.jpg";

function person(
  n: number,
  handle: string,
  name: string,
  over: Partial<NonNullable<PostView["author"]>> = {},
): NonNullable<PostView["author"]> {
  return {
    id: `00000000-0000-4000-8000-0000000fd${String(n).padStart(3, "0")}`,
    handle,
    displayLabel: name,
    avatarPath: null,
    isAgent: false,
    moderatorOf: null,
    ...over,
  };
}

function post(over: Partial<PostView> & Pick<PostView, "id" | "author">): PostView {
  return {
    kind: "GIST",
    authorKind: "USER",
    body: null,
    createdLabel: "2h ago",
    edited: false,
    areaName: null,
    areaSlug: null,
    listing: null,
    sourceNote: null,
    cited: [],
    replyingTo: null,
    repostedBy: null,
    replyCount: 0,
    likeCount: 0,
    repostCount: 0,
    viewCount: 0,
    liked: false,
    reposted: false,
    saved: false,
    heldReason: null,
    removed: false,
    isMine: false,
    editable: false,
    rawBody: null,
    media: [],
    ...over,
  };
}

export const POSTS: PostView[] = [
  /* A photo post: caption first, then the picture in the big rounded frame. */
  post({
    id: "00000000-0000-4000-8000-0000000fd001",
    author: person(1, "tunde_realestate", "Tunde Adebayo", { isAgent: true, supplyRole: "agent", tier: "gold" }),
    body: "Just closed on this 4-bedroom duplex in Lekki Phase 1. Space, light and a good road to it.",
    createdLabel: "2h ago",
    areaName: "Lekki Phase 1",
    areaSlug: "lekki-phase-1",
    likeCount: 243,
    repostCount: 37,
    replyCount: 56,
    media: [{ url: house, width: 640, height: 427 }],
  }),
  /* A short text post: set large inside the same rounded container. */
  post({
    id: "00000000-0000-4000-8000-0000000fd002",
    kind: "ASK",
    author: person(2, "chii_realty", "Chioma Okafor", { isAgent: true, supplyRole: "owner", tier: "gold" }),
    body: "Any good serviced apartments in Victoria Island this month?",
    createdLabel: "4h ago",
    likeCount: 89,
    replyCount: 24,
  }),
  /* A long text post: body size, folded, with Read more. */
  post({
    id: "00000000-0000-4000-8000-0000000fd003",
    author: person(3, "lagosrealtor", "Lagos Realtor", { moderatorOf: "Ikoyi" }),
    body:
      "A few things I learned renting out three flats in Ikoyi this year, in case they help somebody.\n\n" +
      "One: photograph the meter, the water tank and the generator house before the tenant moves in, and send them the pictures the same day. " +
      "It ends most arguments before they start.\n\n" +
      "Two: write down what is included in the service charge, line by line, and agree it in the chat. If it is not in the chat it did not happen.\n\n" +
      "Three: the best tenants ask about the neighbours and the road at night. The ones who only ask the price tend to be the ones who leave in six months. " +
      "Ask them where they work and how they get there, and tell them the truth about traffic.\n\n" +
      "Four: when something breaks, reply within the day, even if the fix takes a week.",
    createdLabel: "Yesterday",
    areaName: "Ikoyi",
    areaSlug: "ikoyi",
    likeCount: 412,
    repostCount: 61,
    replyCount: 98,
  }),
  /* More than one picture: a swipe inside the one frame. */
  post({
    id: "00000000-0000-4000-8000-0000000fd004",
    author: person(4, "propertyplug", "Property Plug", { isAgent: true, supplyRole: "owner" }),
    body: "Open house on Saturday. The living room, the master bedroom and the pool deck.",
    createdLabel: "1d ago",
    areaName: "Lekki Phase 1",
    areaSlug: "lekki-phase-1",
    likeCount: 57,
    repostCount: 4,
    replyCount: 9,
    media: [
      { url: living, width: 640, height: 427 },
      { url: bedroom, width: 640, height: 427 },
      { url: pool, width: 640, height: 427 },
    ],
  }),
  /* Words with a listing attached. */
  post({
    id: "00000000-0000-4000-8000-0000000fd005",
    author: person(5, "adaeze_homes", "Adaeze Homes", { isAgent: true, supplyRole: "agent", tier: "gold" }),
    body: "New on Vallo, and the viewing slots are open.",
    createdLabel: "2d ago",
    likeCount: 12,
    replyCount: 3,
    listing: {
      id: "00000000-0000-4000-8000-0000000fd0a1",
      title: "Two-bedroom flat, Yaba",
      area: "Yaba",
      city: "Lagos",
      priceLabel: "N2,400,000",
      periodLabel: "/yr",
      photoUrl: bedroom,
      verified: false,
      beds: 2,
      baths: 2,
      amenities: ["Parking", "Generator", "Water"],
    },
  }),
  /* A member posting a listing to the feed ("Post to your feed"): the same
     editorial card with the Shared badge, their own words above the listing. */
  post({
    id: "00000000-0000-4000-8000-0000000fd007",
    author: person(2, "ada_okafor", "Ada Okafor"),
    body: "Saw this one on Saturday. The fees are all stated and the road does not flood.",
    createdLabel: "1h ago",
    likeCount: 12,
    replyCount: 3,
    repostCount: 0,
    listingShare: { listingId: "00000000-0000-4000-8000-0000000fd0a3", available: true },
    listing: {
      id: "00000000-0000-4000-8000-0000000fd0a3",
      title: "Three bedroom terrace in Lekki Phase 1",
      area: "Lekki Phase 1",
      city: "Lagos",
      priceLabel: "N4,500,000",
      periodLabel: "a year",
      photoUrl: house,
      verified: false,
      beds: 3,
      baths: 4,
    },
  }),
  /* A member featuring a listing with no pictures of their own: the
     full-bleed editorial card (founder, 7 November 2026). */
  post({
    id: "00000000-0000-4000-8000-0000000fd006",
    author: person(6, "vallo_homes", "Lekki Homes", { isAgent: true, supplyRole: "agent", tier: "gold" }),
    body: "Modern living, five minutes from the beach road.",
    createdLabel: "2h ago",
    likeCount: 842,
    replyCount: 124,
    repostCount: 31,
    listing: {
      id: "00000000-0000-4000-8000-0000000fd0a2",
      title: "Four-bedroom duplex, Lekki Phase 1",
      area: "Lekki Phase 1",
      city: "Lagos",
      priceLabel: "N9,500,000",
      periodLabel: "a year",
      photoUrl: house,
      verified: true,
      beds: 4,
      baths: 5,
    },
  }),
];

/* ------------------------------------------------------------ people page */

function dir(over: Partial<DirEntry> & Pick<DirEntry, "kind" | "name">): DirEntry {
  return {
    ref: null,
    avatarUrl: null,
    placeCode: null,
    placeName: null,
    area: null,
    verified: false,
    completed: 0,
    liveListings: 0,
    since: null,
    ...over,
  };
}

/** Directory rows, deliberately out of order and with some that earn no shelf. */
export const DIRECTORY_PROPERTY: DirEntry[] = [
  dir({ kind: "landlord", name: "Kunle Ade", ref: "kunle_ade", completed: 2, liveListings: 3 }),
  dir({ kind: "landlord", name: "Chioma Okafor", ref: "chii_realty", verified: true, completed: 7, liveListings: 5 }),
  dir({ kind: "landlord", name: "Property Plug", ref: "propertyplug", liveListings: 4 }),
  dir({ kind: "landlord", name: "Newcomer Landlord", ref: "new_landlord" }),
  dir({ kind: "agent", name: "Adaeze Homes", ref: "adaeze_homes", verified: true, completed: 11, liveListings: 14 }),
  dir({ kind: "agent", name: "Tunde Adebayo", ref: "tunde_realestate", verified: true, completed: 9, liveListings: 6 }),
  dir({ kind: "agent", name: "Lagos Realtor", ref: "lagosrealtor", completed: 3, liveListings: 8 }),
  dir({ kind: "agent", name: "Brand New Agent", ref: "brand_new" }),
];

export const DIRECTORY_STAYS: DirEntry[] = [
  dir({ kind: "hotel", name: "Marina Suites", ref: "hotel/marina-suites", verified: true, completed: 38, liveListings: 24 }),
  dir({ kind: "hotel", name: "Terrace Resort", ref: "hotel/terrace-resort", completed: 12, liveListings: 18 }),
  dir({ kind: "hotel", name: "Quiet Inn", ref: "hotel/quiet-inn", liveListings: 6 }),
  dir({ kind: "host", name: "A Host, not a hotel", ref: "host/a-host", completed: 50, liveListings: 3 }),
];

function facts(userId: string, followers: number, over: Partial<ProfileFacts> = {}): ProfileFacts {
  return {
    userId,
    followers,
    tier: "none",
    viewerFollows: false,
    isViewer: false,
    avatarUrl: null,
    displayLabel: null,
    ...over,
  };
}

export const FACTS = new Map<string, ProfileFacts>([
  ["kunle_ade", facts("u1", 41)],
  ["chii_realty", facts("u2", 318, { tier: "gold" })],
  ["propertyplug", facts("u3", 96)],
  ["new_landlord", facts("u4", 0)],
  ["adaeze_homes", facts("u5", 1204, { tier: "gold" })],
  ["tunde_realestate", facts("u6", 782, { tier: "gold", viewerFollows: true })],
  ["lagosrealtor", facts("u7", 207)],
  ["brand_new", facts("u8", 0)],
]);

export const POPULAR: FollowedProfile[] = [
  { ...facts("u5", 1204, { tier: "gold", displayLabel: "Adaeze Homes" }), handle: "adaeze_homes", supplyRole: "agent" },
  { ...facts("u6", 782, { tier: "gold", displayLabel: "Tunde Adebayo" }), handle: "tunde_realestate", supplyRole: "agent" },
  { ...facts("u2", 318, { tier: "gold", displayLabel: "Chioma Okafor" }), handle: "chii_realty", supplyRole: "owner" },
  { ...facts("u9", 240, { displayLabel: "Ngozi Eze" }), handle: "ngozi_eze", supplyRole: null },
  { ...facts("u7", 207, { displayLabel: "Lagos Realtor" }), handle: "lagosrealtor", supplyRole: "agent" },
];

export const HITS: PersonHit[] = [
  { handle: "ada_obi", displayLabel: "Ada Obi", avatarUrl: "", isAgent: false, role: null, tier: "none", viewerFollows: false, isViewer: false },
  { handle: "adaeze_homes", displayLabel: "Adaeze Homes", avatarUrl: "", isAgent: true, role: "agent", tier: "gold", viewerFollows: false, isViewer: false },
  { handle: "adamu_lettings", displayLabel: "Adamu Lettings", avatarUrl: "", isAgent: true, role: "landlord", tier: "none", viewerFollows: true, isViewer: false },
];
