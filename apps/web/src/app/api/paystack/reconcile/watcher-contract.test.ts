import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE CONTRACT BETWEEN THIS ROUTE AND THE DATABASE THAT WATCHES IT.
 *
 * `private.request_money_reconciliation` is the pg_cron job that calls this
 * route hourly, and it has a memory: on each run it reads what came back LAST
 * time and decides whether the call reached the reconciler or the Vallo site
 * shell, because an unknown path on this platform answers 200 with the shell
 * rather than 404. Its whole test, read out of `pg_proc` on the live project
 * on 13 November 2026, is two conditions on the body:
 *
 *   coalesce(previous_body, '') like '%"charges"%'
 *   and coalesce(previous_body, '') ~ '"ok"\\s*:\\s*true'
 *
 * WHAT WENT WRONG. R-03 added a heartbeat short-circuit so a clean run inside
 * the window skips its audit row, and that early return answered
 * `{"ok":true,"apply":true,"needsAttention":false,"recorded":false}`. No
 * `charges` key, so the watcher read a correct, successful, clean run as a
 * route that had been renamed, and raised a HIGH alert reading "no payment is
 * being reconciled" once a day from 9 to 12 November. Four of them are open on
 * the money desk and every one of them is false.
 *
 * This spec is a text read of the route rather than a request through it,
 * deliberately: the condition is a property of EVERY exit this handler has,
 * and the next person to add a fast path will add it the same way. A test that
 * drove one request would have passed all four of those days.
 */

const ROUTE = join(__dirname, "route.ts");

/** Every `NextResponse.json({...})` in the file, with its object text. */
function jsonResponses(source: string): string[] {
  const out: string[] = [];
  const marker = "NextResponse.json(";
  let at = source.indexOf(marker);
  while (at !== -1) {
    let depth = 0;
    let i = at + marker.length;
    const start = i;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "(" || ch === "{" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "}" || ch === "]") {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    out.push(source.slice(start, i));
    at = source.indexOf(marker, i);
  }
  return out;
}

describe("the money reconciliation route, as the database watcher reads it", () => {
  const source = readFileSync(ROUTE, "utf8");
  const bodies = jsonResponses(source);

  it("has the exits this spec expects to find", () => {
    /* A guard on the reader itself: if the handler is rewritten so that no
       `NextResponse.json` literal is left, this spec must fail loudly rather
       than pass by finding nothing. */
    expect(bodies.length).toBeGreaterThanOrEqual(4);
  });

  it("names `charges` in every success body, which is how the watcher knows the route answered", () => {
    const successes = bodies.filter((body) => /\bok:\s*true\b/.test(body));
    expect(successes.length).toBeGreaterThanOrEqual(2);
    for (const body of successes) {
      expect(body).toContain("charges");
    }
  });

  it("never claims ok on a refusal, so a shell response cannot read as a run", () => {
    /* `refused()` is the one refusal shape and it answers ok: false. */
    expect(source).toContain("{ ok: false, reason }");
  });
});
