import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/* V-80: the weight gate's two rules, and a budget file it can read. */
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
type Gate = { overBudget: (kb: number, budget: number | null) => boolean; recordedBudget: (kb: number) => number };
let gate: Gate;
beforeAll(async () => {
  gate = (await import(/* @vite-ignore */ pathToFileURL(join(WEB, "scripts", "check-weight.mjs")).href)) as Gate;
});

describe("the weight budget (V-80)", () => {
  it("fails a route over its budget and never one without a budget", () => {
    expect(gate.overBudget(900, 800)).toBe(true);
    expect(gate.overBudget(800, 800)).toBe(false);
    expect(gate.overBudget(99_999, null)).toBe(false);
  });
  it("records today's weight minus 20 percent", () => {
    expect(gate.recordedBudget(1544)).toBe(1235);
  });
  it("names the routes: the eight V-80 asked for, less the retired wallet, plus the workspaces (C12)", () => {
    const budget = JSON.parse(readFileSync(join(WEB, "perf-budget.json"), "utf8")) as { routes: { path: string }[] };
    expect(budget.routes.map((r) => r.path)).toEqual([
      "/",
      "/welcome",
      "/sign-in",
      /* The front-door gates (A15) add the public doors a visitor lands on. */
      "/sign-up/email",
      "/check",
      "/move-in-cost",
      "/for-agents",
      "/guides/avoiding-rental-scams",
      /* The documentation (17 October 2026): it shipped 640 KB of dictionary
         and chapter text through its client rail with nobody watching. */
      "/docs/quick-start",
      "/home",
      "/search",
      "/listing/seed-2",
      "/stays/search",
      "/host",
      "/agent/dashboard",
      "/agent/listings",
    ]);
  });
});
