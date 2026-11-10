import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The share action: gate, public-listing-only, own and others' listings, the
 * limit of two, a super admin without one, a duplicate, removal freeing a slot
 * and two parallel requests. The fake database below behaves like the trigger
 * (`private.listing_share_guard`): it serialises per user, counts active
 * shares, and refuses with the same SQLSTATEs.
 */
const world = vi.hoisted(() => ({
  session: { state: "signed-in", user: { id: "u1" } } as { state: string; user?: { id: string } },
  posts: [] as { id: string; author_id: string; shared_listing_id: string; status: string; body: string | null }[],
  roles: new Set<string>(),
  listings: new Map<string, { id: string; status: string; closed_at: string | null; is_demo: boolean; agent_id: string; title: string }>(),
  agentOwner: new Map<string, string>(),
  seq: 0,
  lock: Promise.resolve(),
  notices: [] as unknown[],
}));

function listingRow(id: string) {
  const l = world.listings.get(id)!;
  return { ...l, area: "Yaba", city: "Lagos", listing_intent: "rent", rate_minor: null, rate_period: null, rent_amount_minor: 100000000, rent_period: "year", sale_price_minor: null, bedrooms: 2, bathrooms: 2, listing_photos: [], listing_amenities: [] };
}

function builder(table: string) {
  const f: Record<string, unknown> = {};
  let op: "select" | "insert" | "update" = "select";
  let payload: Record<string, unknown> = {};
  let head = false;
  const eqs: [string, unknown][] = [];
  const neqs: [string, unknown][] = [];
  const api: Record<string, unknown> = {
    select: (_c?: string, o?: { head?: boolean }) => {
      head = Boolean(o?.head);
      return api;
    },
    insert: (p: Record<string, unknown>) => {
      op = "insert";
      payload = p;
      return api;
    },
    update: (p: Record<string, unknown>) => {
      op = "update";
      payload = p;
      return api;
    },
    eq: (c: string, v: unknown) => (eqs.push([c, v]), api),
    neq: (c: string, v: unknown) => (neqs.push([c, v]), api),
    is: (c: string, v: unknown) => (eqs.push([c, v]), api),
    limit: () => api,
    maybeSingle: () => run().then((r) => ({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error })),
    single: () => run().then((r) => ({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error })),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => run().then(res, rej),
  };
  void f;
  async function run(): Promise<{ data: unknown; error: { code?: string } | null; count?: number }> {
    const get = (c: string) => eqs.find(([k]) => k === c)?.[1];
    if (table === "user_roles") {
      const uid = get("user_id") as string;
      return { data: world.roles.has(uid) ? [{ role: "super_admin" }] : [], error: null };
    }
    if (table === "listings") {
      const l = world.listings.get(get("id") as string);
      if (!l || l.status !== "PUBLISHED" || l.closed_at !== null) return { data: null, error: null };
      return { data: listingRow(l.id), error: null };
    }
    if (table === "agents") {
      const owner = world.agentOwner.get(get("id") as string);
      if (get("user_id")) return { data: owner === get("user_id") ? [{ id: get("id") }] : [], error: null };
      return { data: owner ? { user_id: owner } : null, error: null };
    }
    if (table === "posts") {
      const active = (p: (typeof world.posts)[number]) => neqs.every(([c, v]) => (p as Record<string, unknown>)[c] !== v);
      if (op === "insert") {
        /* The trigger: one request per user at a time, count under the lock. */
        const uid = payload.author_id as string;
        const prev = world.lock;
        let release!: () => void;
        world.lock = new Promise<void>((r) => (release = r));
        await prev;
        await new Promise((r) => setTimeout(r, 1));
        try {
          const lid = payload.shared_listing_id as string;
          const mine = world.posts.filter((p) => p.author_id === uid && p.status !== "REMOVED");
          if (mine.some((p) => p.shared_listing_id === lid)) return { data: null, error: { code: "LS002" } };
          if (!world.roles.has(uid) && mine.length >= 2) return { data: null, error: { code: "LS001" } };
          const row = { id: `10000000-0000-4000-8000-00000000000${++world.seq}`, author_id: uid, shared_listing_id: lid, status: "LIVE", body: (payload.body as string | null) ?? null };
          world.posts.push(row);
          return { data: [{ id: row.id, status: row.status }], error: null };
        } finally {
          release();
        }
      }
      if (op === "update") {
        const rows = world.posts.filter((p) => p.id === get("id") && p.author_id === get("author_id"));
        rows.forEach((p) => (p.status = "REMOVED"));
        return { data: rows.map((p) => ({ id: p.id })), error: null };
      }
      const rows = world.posts.filter((p) => p.author_id === get("author_id") && active(p) && (get("shared_listing_id") === undefined || p.shared_listing_id === get("shared_listing_id")));
      return { data: head ? null : rows.map((p) => ({ id: p.id })), error: null, count: rows.length };
    }
    return { data: [], error: null };
  }
  return api;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/social/flag", () => ({ SOCIAL_OFF_MESSAGE: "off", isSocialEnabled: async () => true }));
vi.mock("@/lib/actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "unconfigured",
  SIGNED_OUT_MESSAGE: "Sign in to continue.",
  resolveSession: async () => (world.session.state === "signed-in" ? { ...world.session, supabase: { from: builder } } : world.session),
}));
vi.mock("@/lib/offline/replay-guard", () => ({ oncePerTap: async (_a: string, _b: string, _k: unknown, run: () => unknown) => run(), tapKey: () => null }));
vi.mock("@/lib/security/rate-limit", () => ({ consume: async () => ({ allowed: true, degraded: false }), subjectForUser: (id: string) => `user:${id}` }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: builder }) }));
vi.mock("@/lib/notify/in-app", () => ({ writeInAppNotice: async (_c: unknown, n: unknown) => void world.notices.push(n) }));

const { shareListingToFeed, removeListingShare, readListingSharePreview } = await import("./actions");

const L = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

beforeEach(() => {
  world.session = { state: "signed-in", user: { id: "u1" } };
  world.posts = [];
  world.roles = new Set();
  world.seq = 0;
  world.notices = [];
  world.listings = new Map([1, 2, 3].map((n) => [L(n), { id: L(n), status: "PUBLISHED", closed_at: null, is_demo: false, agent_id: "a1", title: `Flat ${n}` }]));
  world.listings.set(L(4), { id: L(4), status: "DRAFT", closed_at: null, is_demo: false, agent_id: "a1", title: "Draft" });
  world.agentOwner = new Map([["a1", "owner-1"]]);
});

describe("shareListingToFeed", () => {
  it("sends a guest to sign in", async () => {
    world.session = { state: "signed-out" };
    expect(await shareListingToFeed({ listingId: L(1) })).toEqual({ ok: false, error: "Sign in to continue." });
  });

  it("shares somebody else's public listing and tells its owner", async () => {
    const result = await shareListingToFeed({ listingId: L(1), note: "Lovely street" });
    expect(result.ok).toBe(true);
    expect(world.posts).toHaveLength(1);
    expect(world.notices).toHaveLength(1);
  });

  it("lets a lister share their own listing and does not notify themselves", async () => {
    world.agentOwner.set("a1", "u1");
    expect((await shareListingToFeed({ listingId: L(1) })).ok).toBe(true);
    expect(world.notices).toHaveLength(0);
  });

  it("refuses a listing that is not live", async () => {
    const result = await shareListingToFeed({ listingId: L(4) });
    expect(result.ok).toBe(false);
    expect(world.posts).toHaveLength(0);
  });

  it("refuses a note with a link, or over 280 characters", async () => {
    expect((await shareListingToFeed({ listingId: L(1), note: "go to https://x.test" })).ok).toBe(false);
    expect((await shareListingToFeed({ listingId: L(1), note: "a".repeat(281) })).ok).toBe(false);
  });

  it("allows two, refuses the third with the clear message", async () => {
    expect((await shareListingToFeed({ listingId: L(1) })).ok).toBe(true);
    expect((await shareListingToFeed({ listingId: L(2) })).ok).toBe(true);
    const third = await shareListingToFeed({ listingId: L(3) });
    expect(third).toEqual({ ok: false, error: "You can share up to 2 listings at a time. Remove one to share another." });
  });

  it("does not limit a super admin", async () => {
    world.roles.add("u1");
    for (const n of [1, 2, 3]) expect((await shareListingToFeed({ listingId: L(n) })).ok).toBe(true);
    expect(world.posts).toHaveLength(3);
  });

  it("refuses the same listing twice at once", async () => {
    expect((await shareListingToFeed({ listingId: L(1) })).ok).toBe(true);
    const again = await shareListingToFeed({ listingId: L(1) });
    expect(again).toEqual({ ok: false, error: "You have already shared this listing. Remove that share first." });
  });

  it("a removal frees the slot", async () => {
    await shareListingToFeed({ listingId: L(1) });
    await shareListingToFeed({ listingId: L(2) });
    expect((await shareListingToFeed({ listingId: L(3) })).ok).toBe(false);
    const removed = await removeListingShare({ postId: world.posts[0]!.id });
    expect(removed.ok && removed.data.slots.left).toBe(1);
    expect((await shareListingToFeed({ listingId: L(3) })).ok).toBe(true);
  });

  it("two parallel requests cannot exceed the limit", async () => {
    await shareListingToFeed({ listingId: L(1) });
    const [a, b] = await Promise.all([shareListingToFeed({ listingId: L(2) }), shareListingToFeed({ listingId: L(3) })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(world.posts.filter((p) => p.status !== "REMOVED")).toHaveLength(2);
  });

  it("removal only touches the sharer's own share", async () => {
    await shareListingToFeed({ listingId: L(1) });
    world.session = { state: "signed-in", user: { id: "someone-else" } };
    expect((await removeListingShare({ postId: world.posts[0]!.id })).ok).toBe(false);
  });
});

describe("readListingSharePreview", () => {
  it("shows the card and the slots left before the person tries", async () => {
    await shareListingToFeed({ listingId: L(1) });
    const preview = await readListingSharePreview({ listingId: L(2) });
    expect(preview.ok && preview.data.slots.left).toBe(1);
    expect(preview.ok && preview.data.listing.title).toBe("Flat 2");
    const dup = await readListingSharePreview({ listingId: L(1) });
    expect(dup.ok && dup.data.alreadyShared).toBe(true);
  });
  it("shows nothing of an unpublished listing", async () => {
    expect((await readListingSharePreview({ listingId: L(4) })).ok).toBe(false);
  });
});
