import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";

const h = vi.hoisted(() => ({
  session: vi.fn(),
  readRoom: vi.fn(),
  readProfile: vi.fn(),
}));

vi.mock("@/lib/actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "Not configured.",
  SIGNED_OUT_MESSAGE: "Sign in first.",
  resolveSession: h.session,
}));
vi.mock("../roommates/queries", () => ({ readRoomListing: h.readRoom, readRoommateProfile: h.readProfile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/notify/in-app", () => ({ writeInAppNotice: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { listShareableCircles, shareRoommateToCircle } from "./actions";

const w = getDictionary("en").roommates.circleShare;
const ME = "11111111-1111-4111-8111-111111111111";
const COMMUNITY = "22222222-2222-4222-8222-222222222222";
const ROOM = "33333333-3333-4333-8333-333333333333";
const PERSON = "44444444-4444-4444-8444-444444444444";

type Res = { data: unknown; error: { code?: string; message?: string } | null };

/** A chainable stand-in for the member's client: each table answers per its config. */
function fakeDb(config: {
  community?: Res;
  membership?: Res;
  memberships?: Res;
  dup?: Res;
  insert?: Res;
}) {
  const inserted: Record<string, unknown>[] = [];
  const from = (table: string) => {
    let inserting = false;
    const answer = (): Res => {
      if (table === "circle_communities") return config.community ?? { data: { id: COMMUNITY, slug: "finding-roommates", name: "Finding roommates", status: "live" }, error: null };
      if (table === "circle_memberships") return config.membership ?? config.memberships ?? { data: { status: "active", role: "member" }, error: null };
      if (table === "posts") return inserting ? (config.insert ?? { data: { id: "post-1", status: "LIVE" }, error: null }) : (config.dup ?? { data: [], error: null });
      return { data: null, error: null };
    };
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "gte", "limit", "in", "not", "order"]) c[m] = () => c;
    c.insert = (row: Record<string, unknown>) => {
      inserting = true;
      inserted.push(row);
      return c;
    };
    c.maybeSingle = async () => answer();
    c.single = async () => answer();
    c.then = (res: (v: Res) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(answer()).then(res, rej);
    return c;
  };
  return { db: { from }, inserted };
}

const room = {
  id: ROOM,
  kind: "room_offer",
  status: "live",
  title: "Sunny room in Yaba",
  stateCode: "LA",
  city: "Lagos",
  area: "Yaba",
  rentMinor: 80_000_00,
  rentPeriod: "year",
  shareMinor: null,
  description: "WhatsApp 08031234567",
  owner: { userId: PERSON, name: "Tolu Ade", handle: "tolu", avatarUrl: null, badges: [] },
};
const profile = { userId: PERSON, name: "Tolu Ade", handle: "tolu", avatarUrl: null, institution: null, areas: ["Yaba"], city: "Lagos", stateCode: "LA", intents: ["find_room"], lifeStage: "student", isSelf: false };

const signedIn = (db: unknown) => h.session.mockResolvedValue({ state: "signed-in", supabase: db, user: { id: ME } });
const share = (over: Record<string, unknown> = {}) =>
  shareRoommateToCircle({ communityId: COMMUNITY, target: { kind: "room", id: ROOM }, ...over } as never);

beforeEach(() => {
  h.session.mockReset();
  h.readRoom.mockReset().mockResolvedValue({ state: "ok", listing: room, signedIn: true });
  h.readProfile.mockReset().mockResolvedValue({ state: "ok", profile });
});

describe("share a Roommates page into a Circle: the action", () => {
  it("gate: signed out is refused before anything is read", async () => {
    h.session.mockResolvedValue({ state: "signed-out" });
    const out = await share();
    expect(out).toMatchObject({ ok: false, error: "Sign in first." });
    expect(h.readRoom).not.toHaveBeenCalled();
  });

  it("validation: bad ids, an unknown kind and a long note are refused with a sentence", async () => {
    const { db, inserted } = fakeDb({});
    signedIn(db);
    expect((await share({ communityId: "nope" })).ok).toBe(false);
    expect((await share({ target: { kind: "listing", id: ROOM } })).ok).toBe(false);
    expect((await share({ target: { kind: "room", id: "x" } })).ok).toBe(false);
    const long = await share({ note: "x".repeat(281) });
    expect(long).toMatchObject({ ok: false, fieldErrors: { note: "Keep the note to 280 characters." } });
    expect(inserted).toHaveLength(0);
  });

  it("posting rules: not a member, a request only, and a paused community are each refused and nothing is posted", async () => {
    for (const [cfg, words] of [
      [{ membership: { data: null, error: null } }, w.notMember],
      [{ membership: { data: { status: "requested", role: "member" }, error: null } }, w.notMember],
      [{ community: { data: { id: COMMUNITY, slug: "s", name: "Paused", status: "paused" }, error: null } }, w.notLive],
      [{ community: { data: null, error: null } }, w.notLive],
    ] as const) {
      const { db, inserted } = fakeDb(cfg);
      signedIn(db);
      expect(await share()).toMatchObject({ ok: false, error: words });
      expect(inserted).toHaveLength(0);
    }
  });

  it("posts a Circle discussion with a card that holds only public fields, and the note as the body", async () => {
    const { db, inserted } = fakeDb({});
    signedIn(db);
    const out = await share({ note: "  Anyone near Yaba?  " });
    expect(out).toEqual({ ok: true, data: { id: "post-1", held: false, slug: "finding-roommates", name: "Finding roommates" } });
    expect(inserted).toHaveLength(1);
    const row = inserted[0]!;
    expect(row).toMatchObject({ author_id: ME, author_kind: "USER", circle_type: "discussion", community_id: COMMUNITY, status: "LIVE", title: "Sunny room in Yaba", body: "Anyone near Yaba?", roommate_listing_id: ROOM });
    expect(row.roommate_card).toEqual({ v: 1, kind: "room", ref: ROOM, title: "Sunny room in Yaba", place: "Yaba, Lagos", summary: expect.stringContaining("Room available") });
    const flat = JSON.stringify(row.roommate_card);
    for (const secret of ["08031234567", "Tolu", "tolu", "WhatsApp"]) expect(flat).not.toContain(secret);
  });

  it("without a note the body is the title; a person is shared by first name with no roommate_listing_id", async () => {
    const { db, inserted } = fakeDb({});
    signedIn(db);
    const out = await share({ target: { kind: "person", id: PERSON } });
    expect(out.ok).toBe(true);
    const row = inserted[0]!;
    expect(row.title).toBe("Tolu on Vallo Roommates");
    expect(row.body).toBe("Tolu on Vallo Roommates");
    expect(row).not.toHaveProperty("roommate_listing_id");
    expect(row.roommate_card).toMatchObject({ kind: "person", ref: PERSON, title: "Tolu" });
    expect(JSON.stringify(row.roommate_card)).not.toContain("Ade");
  });

  it("refuses a page that is gone, a room that is not live, and your own profile", async () => {
    const { db, inserted } = fakeDb({});
    signedIn(db);
    h.readRoom.mockResolvedValue({ state: "not-found" });
    expect(await share()).toMatchObject({ ok: false, error: w.gone });
    h.readRoom.mockResolvedValue({ state: "ok", listing: { ...room, status: "paused" }, signedIn: true });
    expect(await share()).toMatchObject({ ok: false, error: w.gone });
    h.readProfile.mockResolvedValue({ state: "need-profile" });
    expect(await share({ target: { kind: "person", id: PERSON } })).toMatchObject({ ok: false, error: w.gone });
    expect(await share({ target: { kind: "person", id: ME } })).toMatchObject({ ok: false, error: w.ownProfile });
    expect(inserted).toHaveLength(0);
  });

  it("a title that carries a phone number is not shared as a card", async () => {
    const { db, inserted } = fakeDb({});
    signedIn(db);
    h.readRoom.mockResolvedValue({ state: "ok", listing: { ...room, title: "Room, call 08031234567" }, signedIn: true });
    expect(await share()).toMatchObject({ ok: false, error: w.gone });
    expect(inserted).toHaveLength(0);
  });

  it("refuses the same page into the same Circle twice in a week", async () => {
    const { db, inserted } = fakeDb({ dup: { data: [{ id: "earlier" }], error: null } });
    signedIn(db);
    expect(await share()).toMatchObject({ ok: false, error: w.already });
    expect(inserted).toHaveLength(0);
  });

  it("a post the scanner holds comes back held, so the sheet offers no Undo", async () => {
    const { db } = fakeDb({ insert: { data: { id: "post-2", status: "HELD" }, error: null } });
    signedIn(db);
    expect(await share()).toMatchObject({ ok: true, data: { id: "post-2", held: true } });
  });

  it("before the SQL is run it says so plainly, and a database rule is shown as its own sentence", async () => {
    signedIn(fakeDb({ insert: { data: null, error: { code: "42703", message: "column roommate_card does not exist" } } }).db);
    expect(await share()).toMatchObject({ ok: false, error: w.notOpen });
    signedIn(fakeDb({ insert: { data: null, error: { code: "RM344", message: "A Roommates card never carries contact details." } } }).db);
    expect(await share()).toMatchObject({ ok: false, error: "A Roommates card never carries contact details." });
    signedIn(fakeDb({ insert: { data: null, error: { code: "XX000", message: "boom" } } }).db);
    expect(await share()).toMatchObject({ ok: false, error: "That did not go through. Try again." });
  });
});

describe("the Circles the sheet lists", () => {
  it("only the ones the person is in and can post in, with how many they are in", async () => {
    const row = (id: string, name: string, status: string) => ({ status: "active", role: "member", circle_communities: { id, slug: name.toLowerCase(), name, category: "roommates", visibility: "public", status } });
    signedIn(fakeDb({ memberships: { data: [row("a", "Zed", "live"), row("b", "Closed", "paused"), row("c", "Alpha", "live")], error: null } }).db);
    const out = await listShareableCircles();
    expect(out).toMatchObject({ ok: true, data: { memberOf: 3 } });
    expect(out.ok && out.data.circles.map((c) => c.name)).toEqual(["Alpha", "Zed"]);
  });

  it("signed out is refused; a read failure says so", async () => {
    h.session.mockResolvedValue({ state: "signed-out" });
    expect(await listShareableCircles()).toMatchObject({ ok: false });
    signedIn(fakeDb({ memberships: { data: null, error: { code: "XX000" } } }).db);
    expect(await listShareableCircles()).toMatchObject({ ok: false, error: w.loadFailed });
  });
});
