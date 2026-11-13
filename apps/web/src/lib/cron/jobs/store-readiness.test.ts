import { describe, expect, it, vi } from "vitest";

/**
 * THE STORE READINESS ALERT SAYS WHAT IS WRONG, NOT JUST WHICH CHECK IS.
 *
 * MEASURED 13 November 2026 on the live project: `public.job_runs` holds 17
 * runs of this job and every one of them is outcome `repeat`, never `ok`, from
 * 2 October to 12 November. 28 "Store: readiness, red" rows are open and the
 * newest 19 carry `{"pass":7,"fail":1,"not_run":1,"red_1":"reviewer"}` and
 * nothing else. `reviewer` fails either because the credentials are not set in
 * production or because they are set and the sign-in was REFUSED, which is an
 * App Store reviewer who cannot get in and a submission that gets rejected.
 * The desk could not tell the two apart, so for six weeks nobody acted.
 *
 * These cases hold the detail to carrying the sentence and to keeping an
 * address out of it.
 */

const runStoreChecks = vi.hoisted(() => vi.fn());
vi.mock("../../store/run", () => ({ runStoreChecks }));
vi.mock("../../site", () => ({ siteUrl: () => "https://example.test" }));

const { storeReadiness } = await import("./store-readiness");

function run(checks: { key: string; state: string; detail: string | null }[]) {
  runStoreChecks.mockResolvedValue({ origin: "https://example.test", checks });
  return storeReadiness({} as never);
}

describe("the nightly store readiness alert", () => {
  it("carries the words beside the key for every red check", async () => {
    const verdict = await run([
      { key: "reviewer", state: "fail", detail: "No reviewer sign-in is set up, so this could not be proved." },
      { key: "deepLinks", state: "pass", detail: "Fine." },
      { key: "versions", state: "unknown", detail: "Could not read." },
    ]);

    expect(verdict.outcome).toBe("attention");
    expect(verdict.detail?.["red_1"]).toBe("reviewer");
    expect(verdict.detail?.["why_reviewer"]).toContain("No reviewer sign-in is set up");
    /* A check that passed never explains itself; only a red one does. */
    expect(verdict.detail?.["why_deepLinks"]).toBeUndefined();
  });

  it("names the checks that could not run rather than only counting them", async () => {
    const verdict = await run([
      { key: "reviewer", state: "fail", detail: "Refused." },
      { key: "versions", state: "unknown", detail: "Could not read." },
      { key: "deepLinks", state: "unknown", detail: "Could not read." },
    ]);

    expect(verdict.detail?.["not_run"]).toBe(2);
    expect(verdict.detail?.["not_run_checks"]).toBe("versions, deepLinks");
  });

  it("never puts an address in the alert, however the check phrased it", async () => {
    const verdict = await run([
      { key: "reviewer", state: "fail", detail: "Sign-in refused for reviewer@vallospaces.com: bad password." },
    ]);

    const why = String(verdict.detail?.["why_reviewer"]);
    expect(why).not.toContain("@");
    expect(why).toContain("an address");
  });

  it("raises nothing and reads ok when every check passes", async () => {
    const verdict = await run([
      { key: "reviewer", state: "pass", detail: "Fine." },
      { key: "deepLinks", state: "pass", detail: "Fine." },
    ]);

    expect(verdict.outcome).toBe("ok");
    expect(verdict.alert).toBeNull();
    expect(verdict.detail?.["not_run_checks"]).toBeUndefined();
  });
});
