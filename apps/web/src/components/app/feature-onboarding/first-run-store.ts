import "server-only";
import { reportError } from "@/lib/observability/report";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FEATURE_RUNS_COOKIE,
  FEATURE_RUN_PASSED_PARAM,
  firstRunHref,
  parseFeatureRuns,
  shouldShowFirstRun,
  type FirstRunAnswer,
} from "./first-run-device";
import type { MountedFirstRun } from "./first-runs";

/**
 * WHETHER A MEMBER HAS MET A FEATURE'S FIRST RUN, AND THE ONE GATE THAT ASKS.
 *
 * Who owns what (cross-session contract, section 2, "Feature onboarding"):
 * Session 3 owns the system and the screens; Session 2 owns the server-side
 * seen-state that survives a device change. That state does not exist yet,
 * so this file builds against an interface and marks the stub plainly.
 *
 * ===========================================================================
 * STUB, PENDING SESSION 2 REQUEST W7-R1 (the member's seen-state) AND W7-R2
 * (the write). `serverFirstRunStore` below answers "unknown" for every
 * feature and records nothing. When W7-R1 lands, its two methods call the
 * read and the write Session 2 provides, and nothing else in this folder
 * changes: the gate already prefers a server answer over the device's.
 * ===========================================================================
 *
 * FAILING SAFE, which is the whole design of the stub. While the server cannot
 * answer, the device's cookie decides (`first-run-device.ts`), so the rule in
 * force is "at most once per device". Every failure points the same way, at
 * NOT showing: an unknown answer with no cookie shows the first run once and
 * the first run records itself as it opens; a read that throws shows nothing;
 * the passed flag on the address shows nothing. A first run that fails to
 * appear costs a member nothing. One that appears twice, or traps them, is
 * the product nagging, and is the failure this file exists to rule out.
 */

/**
 * The seen-state, per member, per feature. Session 2 implements it (W7-R1,
 * W7-R2); the shape below is exactly what the gate needs and no more.
 */
export type { FirstRunAnswer };

export interface FirstRunStore {
  /** Whether the signed-in member has been shown this feature's first run. "unknown" when the store cannot say. */
  read(feature: MountedFirstRun): Promise<FirstRunAnswer>;
  /** Record that the signed-in member has been shown it. Never throws; a failed write is retried by the next show. */
  mark(feature: MountedFirstRun): Promise<void>;
}

/**
 * THE STUB (W7-R1, W7-R2). Answers "unknown" and records nothing, so the
 * device decides. Replace the two bodies, not the interface.
 */
export const serverFirstRunStore: FirstRunStore = {
  async read() {
    return "unknown";
  },
  async mark() {
    /* Nothing to write until Session 2 provides the record (W7-R2). */
  },
};

/**
 * THE GATE. Called by a feature's page, after it has established the member
 * is signed in and before it draws anything, with the address the member
 * asked for. Redirects to the first run once; otherwise returns and the page
 * draws as normal. Never throws for any reason but the redirect itself.
 *
 *   await gateFirstRun("host", "/host", searchParams);
 */
/** Every feature intro is off (founder, 7 November 2026). */
export const FEATURE_INTROS_OFF = true;

export async function gateFirstRun(
  feature: MountedFirstRun,
  here: string,
  searchParams?: Record<string, string | string[] | undefined>,
  store: FirstRunStore = serverFirstRunStore,
  /** Tests switch the dormant intros back on to keep the machinery honest. */
  introsOff: boolean = FEATURE_INTROS_OFF,
): Promise<void> {
  /* THE FOUNDER, 7 November 2026: the feature intro slides are removed
     from the whole platform ("remove those welcome banner stuff"). A
     feature opens straight onto itself; the panels, their words and
     /first-run stay in the code, unused, so nothing that links there breaks. */
  if (introsOff) return;
  let show = false;
  try {
    const passed = searchParams?.[FEATURE_RUN_PASSED_PARAM] !== undefined;
    const jar = await cookies();
    const deviceSeen = parseFeatureRuns(jar.get(FEATURE_RUNS_COOKIE)?.value).has(feature);
    const server = passed || deviceSeen ? "unknown" : await store.read(feature);
    show = shouldShowFirstRun({ server, deviceSeen, passed });
  } catch (error) {
    /* A read that failed is not a reason to interrupt somebody, but it is
       a reason to know (D49.3). `redirect` is outside this try, so its own
       control-flow throw never lands here. */
    await reportError({ error, context: { kind: "read.first_run" } });
    show = false;
  }
  if (show) redirect(firstRunHref(feature, here));
}
