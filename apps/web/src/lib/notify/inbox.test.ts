import { describe, expect, it } from "vitest";

import { loadNotificationPage, olderThan } from "./inbox";

type Call = { method: string; args: unknown[] };

/** A PostgREST builder stand-in that records the chain and answers with `result`.
 * `is` is here because the read also filters out archived rows (`.is("archived_at", null)`). */
function fakeClient(result: { data: unknown[] | null; error: unknown }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order", "or", "is"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.limit = (...args: unknown[]) => {
    calls.push({ method: "limit", args });
    return Promise.resolve(result);
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { client: client as never, calls };
}

const row = (n: number) => ({ id: `id-${n}`, created_at: `2026-09-28T10:00:0${n}+00:00` });

describe("loadNotificationPage", () => {
  it("reads one more than the page, newest first with id as the tie-break, and says there is more", async () => {
    const { client, calls } = fakeClient({ data: [row(3), row(2), row(1)], error: null });
    const page = await loadNotificationPage(client, null, 2);
    expect(page).toEqual({ state: "ok", rows: [row(3), row(2)], more: true });
    expect(calls).toContainEqual({ method: "from", args: ["notifications"] });
    expect(calls).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
    expect(calls).toContainEqual({ method: "order", args: ["id", { ascending: false }] });
    expect(calls).toContainEqual({ method: "limit", args: [3] });
    expect(calls.some((c) => c.method === "or")).toBe(false);
  });

  it("says there is no more when the read came back short", async () => {
    const { client } = fakeClient({ data: [row(1)], error: null });
    expect(await loadNotificationPage(client, null, 2)).toEqual({ state: "ok", rows: [row(1)], more: false });
  });

  it("an empty inbox is ok and empty, not an error", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await loadNotificationPage(client)).toEqual({ state: "ok", rows: [], more: false });
  });

  it("a failed read is an error, never an empty inbox", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    expect(await loadNotificationPage(client)).toEqual({ state: "error" });
  });

  it("applies the cursor after the given row", async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await loadNotificationPage(client, { createdAt: "2026-09-28T10:00:00+00:00", id: "abc" });
    expect(calls).toContainEqual({
      method: "or",
      args: ['created_at.lt."2026-09-28T10:00:00+00:00",and(created_at.eq."2026-09-28T10:00:00+00:00",id.lt."abc")'],
    });
  });
});

describe("olderThan", () => {
  it("keeps a row that shares the cursor's timestamp but sorts after it", () => {
    /* Rows from one transaction share now(). Without the id half, the second
       of two such rows would fall between pages. */
    expect(olderThan({ createdAt: "t", id: "b" })).toContain('and(created_at.eq."t",id.lt."b")');
  });
});
