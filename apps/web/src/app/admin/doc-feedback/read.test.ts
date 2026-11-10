import { describe, expect, it } from "vitest";
import { rankByNo, readDocFeedback } from "./read";

const row = (page: string, helpful: number, notHelpful: number) => ({ page, helpful, notHelpful, notes: [], lastAt: null });

describe("pages that fail", () => {
  it("ranks the most no first, then the larger share of no, then the page", () => {
    const ranked = rankByNo([row("/help#a", 9, 2), row("/docs/b", 0, 2), row("/guides/c", 1, 5), row("/docs/a", 0, 2)]);
    expect(ranked.map((r) => r.page)).toEqual(["/guides/c", "/docs/a", "/docs/b", "/help#a"]);
  });

  it("says not switched on when the function does not exist, and unavailable on any other fault", async () => {
    const client = (code: string) => ({ rpc: async () => ({ data: null, error: { code } }) }) as never;
    expect(await readDocFeedback(client("PGRST202"))).toEqual({ state: "not-switched-on" });
    expect(await readDocFeedback(client("42883"))).toEqual({ state: "not-switched-on" });
    expect(await readDocFeedback(client("42501"))).toEqual({ state: "unavailable" });
  });

  it("reads the summary rows into the desk's shape", async () => {
    const client = {
      rpc: async () => ({ data: [{ page: "/help#refunds", helpful: 1, not_helpful: 3, latest_notes: ["no date given"], last_at: "2026-11-10T09:00:00Z" }], error: null }),
    } as never;
    expect(await readDocFeedback(client)).toEqual({
      state: "ok",
      rows: [{ page: "/help#refunds", helpful: 1, notHelpful: 3, notes: ["no date given"], lastAt: "2026-11-10T09:00:00Z" }],
    });
  });
});
