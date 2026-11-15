import { describe, expect, it } from "vitest";
import type { AdminClient } from "../rpc";
import { escalationsOverdue, escalationsOverdueVerdict } from "./escalations-overdue";

/**
 * THE OVERDUE ESCALATIONS JOB. Pinned: it calls the one database function
 * with the client it was handed (the service client) and nothing else; it
 * reports what moved; it is a clean, quiet run until the SQL has run; and any
 * other error, or a refusal, is a failed run and never a quiet zero.
 */
function admin(answer: { data: unknown; error: unknown }) {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return answer;
    },
  };
  return { client: client as unknown as AdminClient, calls };
}

describe("the overdue escalations job", () => {
  it("calls the overdue function once, with no arguments", async () => {
    const db = admin({ data: { status: "ok", bumped: 0, reminded: 0, nudged: 0 }, error: null });
    await escalationsOverdue(db.client);
    expect(db.calls).toEqual([{ fn: "staff_escalation_bump_overdue", args: {} }]);
  });

  it("reports what moved up, who was reminded and which raisers were reminded", async () => {
    const db = admin({ data: { status: "ok", bumped: 2, reminded: 1, nudged: 3 }, error: null });
    expect(await escalationsOverdue(db.client)).toEqual({
      outcome: "ok",
      counts: { moved_up: 2, reminded: 1, raiser_reminded: 3 },
      detail: {},
      alert: null,
    });
  });

  it("is a clean, quiet run until the SQL has run", async () => {
    for (const code of ["PGRST202", "42883"]) {
      const db = admin({ data: null, error: { code, message: "Could not find the function" } });
      const verdict = await escalationsOverdue(db.client);
      expect(verdict).toMatchObject({ outcome: "ok", alert: null, detail: { reason: "not_set_up" } });
      expect(verdict.counts).toEqual({ moved_up: 0, reminded: 0, raiser_reminded: 0 });
    }
  });

  it("fails the run on any other error, so it is seen", async () => {
    const db = admin({ data: null, error: { code: "42501", message: "permission denied for function" } });
    await expect(escalationsOverdue(db.client)).rejects.toThrow("staff_escalation_bump_overdue: permission denied for function");
  });

  it("fails the run when the function refuses the caller or answers nothing", async () => {
    await expect(escalationsOverdue(admin({ data: { status: "forbidden" }, error: null }).client)).rejects.toThrow("answered forbidden");
    await expect(escalationsOverdue(admin({ data: null, error: null }).client)).rejects.toThrow("answered nothing");
  });

  it("never reports a negative or a broken count", async () => {
    const db = admin({ data: { status: "ok", bumped: "x", reminded: -2 }, error: null });
    expect((await escalationsOverdue(db.client)).counts).toEqual({ moved_up: 0, reminded: 0, raiser_reminded: 0 });
  });

  it("raises no alert of its own: an urgent escalation pages a person when it is raised", () => {
    expect(escalationsOverdueVerdict({ bumped: 9, reminded: 9, nudged: 9 }).alert).toBeNull();
  });
});
