import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { messageSubjects, ownCaseVerdict, reportSubjects } = await import("./self-review");

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "22222222-2222-4222-8222-222222222222";

/** A stand-in that answers one row per table, or an error for `broken`. */
function client(rows: Record<string, Record<string, unknown> | Record<string, unknown>[] | null>, broken: string[] = []) {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.maybeSingle = async () =>
        broken.includes(table) ? { data: null, error: { message: "down" } } : { data: rows[table] ?? null, error: null };
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(
          broken.includes(table)
            ? { data: null, error: { message: "down" } }
            : { data: Array.isArray(rows[table]) ? rows[table] : rows[table] ? [rows[table]] : [], error: null },
        ).then(resolve);
      return chain;
    },
  } as never;
}

describe("who a case is about", () => {
  it("a post report is about the post's author", async () => {
    expect(await reportSubjects(client({ posts: { author_id: ME } }), "post", "p1")).toEqual([ME]);
    expect(await reportSubjects(client({ posts: { author_id: ME } }), "POST", "p1")).toEqual([ME]);
  });

  it("a profile report is about the person", async () => {
    expect(await reportSubjects(client({}), "social_profile", ME)).toEqual([ME]);
  });

  it("a listing report is about its lister", async () => {
    const c = client({ listings: { agent_id: "a1", assigned_agent_id: null }, agents: [{ user_id: ME }] });
    expect(await reportSubjects(c, "listing", "l1")).toEqual([ME]);
  });

  it("a message is about its sender and both sides of the thread", async () => {
    const c = client({ messages: { sender_id: THEM, conversation_id: "c1" }, conversations: { guest_id: THEM, agent_id: ME } });
    expect(await messageSubjects(c, "m1")).toEqual([THEM, THEM, ME]);
  });

  it("a read that fails is unknown, never clear", async () => {
    expect(await reportSubjects(client({}, ["posts"]), "post", "p1")).toBeNull();
    expect(ownCaseVerdict(ME, null)).toBe("unknown");
  });

  it("the verdict", () => {
    expect(ownCaseVerdict(ME, [THEM, ME])).toBe("own");
    expect(ownCaseVerdict(ME, [THEM])).toBe("clear");
    expect(ownCaseVerdict(ME, [])).toBe("clear");
  });
});
