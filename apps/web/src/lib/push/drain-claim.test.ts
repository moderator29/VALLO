import { describe, expect, it } from "vitest";

/**
 * THE CLAIM IS A HANDFUL OF STATEMENTS, NOT ONE PER ROW.
 *
 * `claimDue` takes up to a hundred queue rows a run and has to raise
 * `attempts` on each, because the drain reads that count to decide backoff
 * and to decide when to give a row up. It used to take the rows in one
 * UPDATE and then issue one more UPDATE PER ROW to bump the count: a hundred
 * and one round trips for a full run, every run, for a number the claim
 * already knew.
 *
 * `attempts` is per row and PostgREST writes one value per statement, so the
 * rows are grouped by the count they carry and each group is claimed with
 * its own `attempts: n + 1`. A claimable row has been attempted fewer than
 * MAX_QUEUE_ATTEMPTS times, so a run issues at most four UPDATEs however
 * many rows are due.
 *
 * It also closes a window: the bump no longer happens after the claim, so a
 * drain that dies in between cannot leave a row claimed with a count that
 * does not reflect the attempt it just spent.
 */

const { claimDue } = await import("./drain");

type Statement = { table: string; verb: "select" | "update"; patch?: Record<string, unknown>; ids?: string[] };

/**
 * A client that records every statement, and answers an update with the rows
 * it would have moved, carrying the patched `attempts` as PostgREST does.
 */
function recordingClient(queue: { id: string; attempts: number }[], log: Statement[]) {
  const builder = (table: string) => {
    const statement: Statement = { table, verb: "select" };
    let patch: Record<string, unknown> | null = null;
    let ids: string[] | null = null;
    let wantAttempts: number | null = null;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = () => {
      if (patch) {
        log.push({ table, verb: "update", patch, ids: ids ?? [] });
        const claimed = queue
          .filter((row) => (ids ?? []).includes(row.id) && (wantAttempts === null || row.attempts === wantAttempts))
          .map((row) => ({
            id: row.id,
            notification_id: `n-${row.id}`,
            user_id: `u-${row.id}`,
            expires_at: "2026-11-11T00:00:00.000Z",
            attempts: patch?.attempts as number,
          }));
        return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: claimed, error: null }).then(ok) };
      }
      return chain;
    };
    chain.update = (next: Record<string, unknown>) => {
      patch = next;
      return chain;
    };
    chain.in = (column: string, values: string[]) => {
      if (column === "id") ids = values;
      return chain;
    };
    chain.eq = (column: string, value: unknown) => {
      if (column === "attempts") wantAttempts = value as number;
      return chain;
    };
    chain.lte = self;
    chain.order = self;
    chain.limit = () => {
      log.push(statement);
      return { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: queue, error: null }).then(ok) };
    };
    return chain;
  };
  return { from: (table: string) => builder(table) } as never;
}

describe("claimDue", () => {
  it("claims a hundred rows in one statement per distinct attempt count", async () => {
    /* Ninety never tried, ten that failed once: two counts, so two claims. */
    const queue = [
      ...Array.from({ length: 90 }, (_, i) => ({ id: `fresh-${i}`, attempts: 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `retry-${i}`, attempts: 1 })),
    ];
    const log: Statement[] = [];
    const rows = await claimDue(recordingClient(queue, log), "33333333-3333-4333-8333-333333333333");

    const updates = log.filter((entry) => entry.verb === "update");
    expect(updates).toHaveLength(2);
    expect(log.filter((entry) => entry.verb === "select")).toHaveLength(1);
    expect(rows).toHaveLength(100);
  });

  it("spends the attempt in the same statement that takes the row", async () => {
    const queue = [
      { id: "fresh", attempts: 0 },
      { id: "retry", attempts: 2 },
    ];
    const log: Statement[] = [];
    const rows = await claimDue(recordingClient(queue, log), "44444444-4444-4444-8444-444444444444");

    for (const update of log.filter((entry) => entry.verb === "update")) {
      expect(update.patch).toMatchObject({ state: "sending" });
      expect(update.patch?.attempts).toBeTypeOf("number");
    }
    /* The row the drain works on carries the attempt about to happen. */
    expect(rows.find((row) => row.id === "fresh")?.attempts).toBe(1);
    expect(rows.find((row) => row.id === "retry")?.attempts).toBe(3);
  });

  it("asks for nothing when nothing is due", async () => {
    const log: Statement[] = [];
    const rows = await claimDue(recordingClient([], log), "55555555-5555-4555-8555-555555555555");
    expect(rows).toEqual([]);
    expect(log.filter((entry) => entry.verb === "update")).toHaveLength(0);
  });
});
