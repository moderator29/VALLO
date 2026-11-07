import type { CircleAuthor, CirclePostView, CommunityPage, CommunityView, JoinRequest, ReplyView, Thread } from "@/lib/features/circle/queries";

/**
 * Sample Circle rows for the FEATURES decks. Fictional people and a
 * fictional community, never real personal data; nothing here reaches a
 * live page.
 */
export const NOW = Date.parse("2026-11-07T18:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

export const PEOPLE: Record<string, CircleAuthor> = {
  kemi: { id: "00000000-0000-4000-8000-0000000000a1", handle: null, label: "Kemi A.", avatar: null, isAgent: false, verified: false },
  tunde: { id: "00000000-0000-4000-8000-0000000000a2", handle: null, label: "Tunde O.", avatar: null, isAgent: true, verified: true },
  ada: { id: "00000000-0000-4000-8000-0000000000a3", handle: null, label: "Ada N.", avatar: null, isAgent: false, verified: false },
  bayo: { id: "00000000-0000-4000-8000-0000000000a4", handle: null, label: "Bayo L.", avatar: null, isAgent: false, verified: false },
  zainab: { id: "00000000-0000-4000-8000-0000000000a5", handle: null, label: "Zainab M.", avatar: null, isAgent: false, verified: false },
};

export const COMMUNITY: CommunityView = {
  id: "00000000-0000-4000-8000-000000000c01",
  slug: "lekki-renters",
  name: "Lekki renters",
  description: "Rents, caution fees, estate dues and landlords in Lekki Phase 1 to Ajah, from people who live there. Ask before you pay.",
  category: "renting",
  visibility: "public",
  rules: [
    "Share what you saw yourself, and say when it is an opinion.",
    "No names or numbers of private people. Talk about the place, not the person.",
    "No listings for sale or rent in posts; link the Vallo listing instead.",
    "Be kind to first-time renters. Everyone asks the basic question once.",
  ],
  byVallo: false,
  members: 412,
  posts: 96,
  areaId: null,
  lastActivityAt: ago(1),
};

export function communityPage(kind: "member" | "visitor" | "private" | "owner"): CommunityPage {
  const community = kind === "private" ? { ...COMMUNITY, visibility: "private" as const, name: "Abuja landlords", slug: "abuja-landlords", category: "landlords" as const, members: 188, posts: 40 } : COMMUNITY;
  return {
    community,
    membership: kind === "member" ? { role: "member", status: "active" } : kind === "owner" ? { role: "owner", status: "active" } : null,
    active: 37,
    signedIn: kind !== "visitor",
    viewerId: kind === "visitor" ? null : PEOPLE.ada!.id,
  };
}

const post = (id: string, title: string, type: CirclePostView["type"], author: CircleAuthor, answers: number, helpful: number, hours: number, body: string, answered = false): CirclePostView => ({
  id: `00000000-0000-4000-8000-00000000${id.padStart(4, "0")}`,
  title,
  body,
  type,
  createdAt: ago(hours),
  editedAt: null,
  answers,
  likes: 0,
  helpful,
  author,
  community: { slug: COMMUNITY.slug, name: COMMUNITY.name },
  listingId: null,
  answered,
});

export const POSTS: CirclePostView[] = [
  post("1", "How much caution fee is normal for a 2 bedroom in Lekki Phase 1?", "question", PEOPLE.kemi!, 9, 14, 3, "We were asked for a full year of caution on top of the rent and the agency fee. Is that normal here, and can it be negotiated?", true),
  post("2", "Estate dues went up 40% this year. Did yours?", "discussion", PEOPLE.bayo!, 12, 6, 20, "Our estate on the Lekki to Epe road moved service charge from 450k to 630k with two weeks' notice. Curious what other estates did."),
  post("3", "Which part of Ajah floods least in July?", "question", PEOPLE.zainab!, 0, 0, 30, "Moving in June with a toddler. I would rather pay a bit more than wade to the gate."),
  post("4", "A checklist I use before paying for any flat", "discussion", PEOPLE.tunde!, 4, 21, 52, "Water pressure at 7am, the meter type, who holds the C of O, the gate rules after 10pm, and a photo of every wall before you move in."),
];

const reply = (id: string, author: CircleAuthor, hours: number, body: string, helpful: number, extra: Partial<ReplyView> = {}): ReplyView => ({
  id: `00000000-0000-4000-8000-0000000001${id.padStart(2, "0")}`,
  parentId: POSTS[0]!.id,
  depth: 1,
  body,
  createdAt: ago(hours),
  helpful,
  author,
  isMine: false,
  markedHelpful: false,
  ...extra,
});

export function threadOf(kind: "question" | "discussion" | "empty" | "visitor"): Thread {
  const isQ = kind !== "discussion";
  const base = isQ ? POSTS[0]! : POSTS[1]!;
  const replies: ReplyView[] =
    kind === "empty"
      ? []
      : [
          reply("1", PEOPLE.tunde!, 2.5, "Six months of caution is the usual ask in Phase 1 right now; a full year is high. Offer six, and ask for the caution in writing with the date it comes back and what it can be used for.", 11, { markedHelpful: true }),
          reply("2", PEOPLE.ada!, 2, "We paid six months last year in Agungi and got it back in three weeks, minus a repaint. Take photos on day one.", 3),
          reply("3", PEOPLE.kemi!, 1.5, "Thank you both. Asked for six in writing and they agreed.", 0, { depth: 2, parentId: null, isMine: kind === "question" }),
        ];
  return {
    post: { ...base, listingId: isQ ? "00000000-0000-4000-8000-00000000f001" : null, answers: replies.length, answered: isQ && kind !== "empty" },
    replies,
    acceptedId: isQ && kind !== "empty" ? replies[0]!.id : null,
    following: false,
    isAsker: kind === "question",
    canReply: kind !== "visitor",
    signedIn: kind !== "visitor",
  };
}

export const REQUESTS: JoinRequest[] = [
  { userId: PEOPLE.bayo!.id, author: PEOPLE.bayo!, at: ago(4) },
  { userId: PEOPLE.zainab!.id, author: PEOPLE.zainab!, at: ago(26) },
  { userId: PEOPLE.ada!.id, author: { ...PEOPLE.ada!, label: "Adaeze Nwachukwu-Okafor" }, at: ago(80) },
];
