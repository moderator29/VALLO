import { describe, expect, it, vi } from "vitest";

/**
 * RECIPIENT RESOLUTION, held to the one distinction it was missing.
 *
 * WHY THIS SPEC EXISTS. On 13 November 2026 four of the five DROPPED rows in
 * the live outbox (project uccixoonmbhrnyczyigt) carried the single reason
 * "no contact for recipient". That string stood for a person who had switched
 * the channel off, a person with no address, AND a directory that could not be
 * read. The first two are terminal and dropping them is right. The third is
 * transient, and dropping it throws a letter away for good, with a reason in
 * the column that blames the recipient for an outage.
 *
 * So the only thing worth asserting here is that the three are told apart, and
 * that `contactForUser` still answers exactly null for all three, because nine
 * best-effort send sites depend on that and none of them were changed.
 */

vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { contactForUser, resolveContact } = await import("./recipients");

type Answer = { data?: unknown; error?: unknown };

/** Just enough of the admin client for the two reads resolution makes. */
function fakeAdmin(user: Answer, settings: unknown = null) {
  return {
    auth: { admin: { getUserById: async () => user } },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: settings, error: null }),
        }),
      }),
    }),
  } as never;
}

const ADA = "11111111-1111-4111-8111-111111111111";

describe("resolveContact says why there is no address", () => {
  it("answers ok with the address and the display name", async () => {
    const admin = fakeAdmin({ data: { user: { email: " ada@example.com " } } }, { display_name: "Ada Balogun" });
    const resolved = await resolveContact(admin, ADA);
    expect(resolved).toEqual({ kind: "ok", contact: { email: "ada@example.com", name: "Ada Balogun" } });
  });

  it("answers no-address when the record has none, which is terminal", async () => {
    const resolved = await resolveContact(fakeAdmin({ data: { user: { email: "" } } }), ADA);
    expect(resolved).toEqual({ kind: "no-address" });
  });

  it("answers unreachable when the directory errors, which is NOT terminal", async () => {
    const resolved = await resolveContact(fakeAdmin({ error: new Error("503") }), ADA);
    expect(resolved).toEqual({ kind: "unreachable" });
  });

  it("answers unreachable when the client throws rather than answering", async () => {
    const admin = {
      auth: { admin: { getUserById: async () => { throw new Error("socket"); } } },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    } as never;
    expect(await resolveContact(admin, ADA)).toEqual({ kind: "unreachable" });
  });

  it("answers muted for a channel the person switched off, before reading the directory", async () => {
    let asked = false;
    const admin = {
      auth: { admin: { getUserById: async () => { asked = true; return { data: { user: { email: "ada@example.com" } } }; } } },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { settings: { notifications: { messages: false } } }, error: null }) }),
        }),
      }),
    } as never;
    expect(await resolveContact(admin, ADA, "messages")).toEqual({ kind: "muted" });
    /* No address is read for somebody who has said no, which is the point of
       resolving the switch first. */
    expect(asked).toBe(false);
  });

  it("does not treat an unreadable profile as a mute: the mail still goes", async () => {
    const admin = {
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "ada@example.com" } } }) } },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => { throw new Error("no"); } }) }),
      }),
    } as never;
    const resolved = await resolveContact(admin, ADA, "messages");
    expect(resolved.kind).toBe("ok");
  });
});

describe("contactForUser is unchanged for its nine best-effort callers", () => {
  it("is the address on ok", async () => {
    const admin = fakeAdmin({ data: { user: { email: "ada@example.com" } } }, { display_name: "" });
    expect(await contactForUser(admin, ADA)).toEqual({ email: "ada@example.com", name: null });
  });

  it("is null for every one of the three failures, as it always was", async () => {
    expect(await contactForUser(fakeAdmin({ data: { user: { email: "" } } }), ADA)).toBeNull();
    expect(await contactForUser(fakeAdmin({ error: new Error("503") }), ADA)).toBeNull();
    const muted = {
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "ada@example.com" } } }) } },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { settings: { notifications: { messages: false } } }, error: null }) }),
        }),
      }),
    } as never;
    expect(await contactForUser(muted, ADA, "messages")).toBeNull();
  });
});
