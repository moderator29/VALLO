import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PAYOFF_MOMENTS,
  SUCCESS_FEEL,
  SUCCESS_VARIANT,
  momentFeel,
  type SuccessMomentId,
} from "./success-moments";

/**
 * THE HAPTIC CENSUS (CRAFT_DOCTRINE 6, B14).
 *
 *   light    a digit, a chip, a toggle, a tab            feedback("select")
 *   medium   a primary action committing, a sheet landing feedback("confirm")
 *   heavy    a payoff, and nothing else                  feedback("success")
 *   error    one sharp pattern, for a genuine failure    feedback("error")
 *
 * "Nothing in a list, a scroll or a passive state ever vibrates."
 *
 * `haptic-grammar.test.ts` holds every haptic to the one helper; this holds
 * every CALL of the helper to the weights. It reads the source, so a new call
 * site is counted the day it lands, and each rule names the file that broke
 * it.
 */

const SRC = join(__dirname, "..", "..");

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Comments out, so a sentence about a haptic is not counted as one. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const SOURCES = files(SRC).map((path) => ({
  rel: relative(SRC, path).split("\\").join("/"),
  src: code(readFileSync(path, "utf8")),
}));

/** The helper itself, and the styleguide's specimen board that plays each kind on request. */
const HELPER = new Set(["lib/ui/feedback.ts", "app/(site)/styleguide/FeedbackSpecimens.tsx"]);

type Call = { rel: string; at: number; arg: string };

const CALLS: Call[] = SOURCES.flatMap(({ rel, src }) => {
  if (HELPER.has(rel)) return [];
  return [...src.matchAll(/\bfeedback\(([^)]*)\)/g)].map((m) => ({ rel, at: m.index ?? 0, arg: m[1]!.trim() }));
});

const literal = (call: Call) => /^"(select|confirm|success|warning|error)"$/.exec(call.arg)?.[1] ?? null;

/** From an opening bracket, the index just past its match. */
function closing(src: string, open: number): number {
  const pair: Record<string, string> = { "(": ")", "{": "}" };
  const want = pair[src[open]!];
  if (!want) return open;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === src[open]) depth += 1;
    else if (src[i] === want) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

/** The body span of a handler named in a registration (`const onMove = ...`). */
function namedSpan(src: string, name: string): [number, number] | null {
  const def = new RegExp(`(?:const|let|function)\\s+${name}\\b`).exec(src);
  if (!def) return null;
  const brace = src.indexOf("{", def.index);
  if (brace < 0) return null;
  return [def.index, closing(src, brace)];
}

/**
 * Where a vibration would be passive: a scroll, a finger in mid-move, a wheel,
 * a thing scrolling into view, a timer that repeats, the network coming back,
 * the outbox delivering, a realtime row arriving. Each is something the
 * person did not just do.
 */
const PASSIVE_EVENTS = /^(scroll|scrollend|touchmove|pointermove|mousemove|wheel|online|offline|visibilitychange|focus)$/;

function passiveSpans(src: string): [number, number, string][] {
  const spans: [number, number, string][] = [];
  for (const m of src.matchAll(/addEventListener\(\s*(?:"([a-z]+)"|([A-Z_][A-Z0-9_]*))\s*,\s*([A-Za-z_$][\w$]*)?/g)) {
    const event = m[1] ?? m[2] ?? "";
    const passive = m[2] !== undefined ? /OUTBOX|SENT|SYNC|REALTIME/.test(event) : PASSIVE_EVENTS.test(event);
    if (!passive) continue;
    const handler = m[3];
    if (handler && handler !== "function") {
      const span = namedSpan(src, handler);
      if (span) spans.push([span[0], span[1], `${event} listener ${handler}`]);
    } else {
      const open = src.indexOf("(", m.index ?? 0);
      spans.push([m.index ?? 0, closing(src, open), `${event} listener`]);
    }
  }
  for (const m of src.matchAll(/\bon(Scroll|PointerMove|TouchMove|MouseMove|Wheel)=\{/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    spans.push([m.index ?? 0, closing(src, open), `on${m[1]}`]);
  }
  for (const m of src.matchAll(/\b(new IntersectionObserver|new ResizeObserver|setInterval|\.on\(\s*"postgres_changes")\(?/g)) {
    const open = src.indexOf("(", m.index ?? 0);
    spans.push([m.index ?? 0, closing(src, open), m[1]!]);
  }
  return spans;
}

/**
 * THE PAYOFF SITES: the only files that may say "success" with their own
 * literal, each with the payoff it is. A new heavy beat is a decision, and it
 * is made here, in a review, not at a call site.
 */
const HEAVY_SITES: Record<string, string> = {
  "components/verification/payoff-haptic.ts": "verification passed (the plate, the phone)",
  "components/ui/DragToConfirm.tsx": "money that moved, behind `if (isMoney)`",
  "components/auth/ArrivalMoment.tsx": "the first open: the account is in",
  "components/social/badges/BadgeMoment.tsx": "a badge earned",
  "components/app/pro/ProUnlock.tsx": "Pro unlock (MOTION_SYSTEM 2 and 5 name it a payoff)",
  "components/app/account/InviteTicket.tsx": "the invite reveal, once per device and on a replay asked for",
  "components/app/referral/WithdrawFlow.tsx": "a withdrawal confirmed by the server",
  "app/agent/listings/ListingsWorkspace.tsx": "a listing the server says is live",
  "components/auth/SignUpPhoneStep.tsx": "the phone number confirmed, the last step of sign-up",
  "components/verification/DojahPanel.tsx": "identity confirmed by the selfie check (the server's status, not the frame)",
};

/** Where the kind is decided from a map or an outcome, never a literal. */
const DECIDED_SITES: Record<string, RegExp> = {
  "components/ui/SuccessSheet.tsx": /^feel$/,
  "components/app/ResultSheet.tsx": /^kind$/,
  "components/app/inspections/GateHandshake.tsx": /^ok \? "success" : "error"$/,
};

describe("haptic census (CRAFT_DOCTRINE 6)", () => {
  it("finds the call sites at all (the census is reading the tree)", () => {
    expect(CALLS.length).toBeGreaterThan(40);
  });

  it("passes every call a literal kind, or decides it in one of the named maps", () => {
    const loose = CALLS.filter((call) => literal(call) === null).filter(
      (call) => !(DECIDED_SITES[call.rel]?.test(call.arg) ?? false),
    );
    expect(loose.map((c) => `${c.rel}: feedback(${c.arg})`)).toEqual([]);
  });

  it("has one error pattern: nothing says warning", () => {
    const warnings = CALLS.filter((call) => literal(call) === "warning" || /"warning"/.test(call.arg));
    expect(warnings.map((c) => c.rel)).toEqual([]);
    /* ResultSheet's map: a pending or in-review payment is a passive state. */
    const result = SOURCES.find((s) => s.rel === "components/app/ResultSheet.tsx")!.src;
    const feel = /const FEEL[^{]*\{([\s\S]*?)\};/.exec(result)?.[1] ?? "";
    expect(feel).toMatch(/pending:\s*null/);
    expect(feel).toMatch(/review:\s*null/);
    expect(feel).not.toMatch(/"warning"/);
  });

  it("says heavy only at the payoff sites", () => {
    const heavy = [...new Set(CALLS.filter((call) => literal(call) === "success").map((c) => c.rel))].sort();
    expect(heavy.filter((rel) => !(rel in HEAVY_SITES))).toEqual([]);
  });

  it("feels a slide that moved no money as its release, never as a payoff", () => {
    const drag = SOURCES.find((s) => s.rel === "components/ui/DragToConfirm.tsx")!.src;
    const successes = [...drag.matchAll(/(.{0,40})feedback\("success"\)/g)].map((m) => m[1]!);
    expect(successes.length).toBeGreaterThan(0);
    for (const before of successes) expect(before).toMatch(/if \(isMoney\)\s*$/);
  });

  it("never vibrates in a scroll, a mid-move, an observer, a timer or a delivery", () => {
    const hits: string[] = [];
    for (const { rel, src } of SOURCES) {
      if (HELPER.has(rel)) continue;
      const spans = passiveSpans(src);
      for (const m of src.matchAll(/\bfeedback\(/g)) {
        const at = m.index ?? 0;
        const inside = spans.find(([from, to]) => at > from && at < to);
        if (inside) hits.push(`${rel}: inside ${inside[2]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps a list row's swipe and the pull to refresh silent", () => {
    /* Named, because neither shape is a passive event: opening a row only
       shows Remove (the removal is the commit), and arming a pull is a scroll. */
    for (const rel of ["app/(app)/saved/SwipeToRemove.tsx", "components/ui/PullToRefresh.tsx"]) {
      const src = SOURCES.find((s) => s.rel === rel)!.src;
      expect(src, rel).not.toMatch(/\bfeedback\(/);
    }
  });

  it("feels a heart, a like and a toggle as light", () => {
    for (const rel of ["components/app/SaveControl.tsx", "components/app/listing/ListingActions.tsx"]) {
      const kinds = CALLS.filter((c) => c.rel === rel).map(literal);
      expect(kinds.length, rel).toBeGreaterThan(0);
      expect(new Set(kinds), rel).toEqual(new Set(["select"]));
    }
  });

  it("feels an everyday unlock as a commit, not a payoff", () => {
    const kinds = CALLS.filter((c) => c.rel === "components/passcode/PasscodeLock.tsx").map(literal);
    expect(kinds).not.toContain("success");
    expect(kinds).toContain("confirm");
  });
});

describe("success moments: heavy only for a payoff", () => {
  const IDS = Object.keys(SUCCESS_VARIANT) as SuccessMomentId[];

  it("feels a payoff heavy and everything else as the commit it was", () => {
    for (const id of IDS) expect(momentFeel(id), id).toBe(PAYOFF_MOMENTS.has(id) ? "success" : "confirm");
  });

  it("never makes a submission a payoff", () => {
    for (const id of IDS) if (SUCCESS_VARIANT[id] === "submitted") expect(PAYOFF_MOMENTS.has(id), id).toBe(false);
  });

  it("keeps housekeeping out of the payoffs", () => {
    const housekeeping: SuccessMomentId[] = [
      "passwordChanged",
      "passcodeSet",
      "passcodeChanged",
      "cardSaved",
      "bankAccountAdded",
      "payoutAccountAdded",
      "reviewPosted",
      "tenancyReviewSent",
      "agreementDrawn",
      "agreementConfirmed",
      "stayHeld",
      "inspectionReportSubmitted",
      "inspectionRecorded",
    ];
    for (const id of housekeeping) expect(momentFeel(id), id).toBe("confirm");
  });

  it("hands a moment's own feel to the sheet wherever the variant's default would be wrong", () => {
    /* The sheet's default is by variant (`SUCCESS_FEEL`), and a non-payoff
       moment that LOOKS like success must not borrow its weight. So every
       file that names such a moment, or picks its moment at runtime, passes
       the moment's own `haptic` from `successCopy`. */
    const overridden = new Set(IDS.filter((id) => SUCCESS_FEEL[SUCCESS_VARIANT[id]] !== momentFeel(id)));
    const missing: string[] = [];
    const needs = (arg: string) => {
      const id = /^"([A-Za-z]+)"$/.exec(arg)?.[1];
      if (id) return overridden.has(id as SuccessMomentId);
      /* A runtime choice between literals: needs it if any of them does. */
      const choices = [...arg.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1] as SuccessMomentId);
      if (choices.length > 0) return choices.some((c) => overridden.has(c));
      /* Wholly dynamic (a flag, a latch, a state): always. */
      return true;
    };
    for (const { rel, src } of SOURCES) {
      if (rel.startsWith("app/(dev)/") || rel === "lib/ui/success-moments.ts" || rel.startsWith("lib/email/")) continue;
      for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=[^;]*?successCopy\(\s*[^,]+,\s*([^,)]+)/g)) {
        const [, name, arg] = m;
        if (!needs(arg!.trim())) continue;
        /* That very result's haptic reaches a sheet. */
        if (!new RegExp(`haptic=\\{[^}]*\\b${name}\\.haptic\\}`).test(src)) missing.push(`${rel}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("the native path is real", () => {
  const WEB = join(SRC, "..");
  it("ships the Haptics plugin in the package and in both shells", () => {
    const pkg = JSON.parse(readFileSync(join(WEB, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@capacitor/haptics"]).toBeTruthy();
    expect(readFileSync(join(WEB, "android/capacitor.settings.gradle"), "utf8")).toMatch(/:capacitor-haptics/);
    expect(readFileSync(join(WEB, "ios/App/CapApp-SPM/Package.swift"), "utf8")).toMatch(/CapacitorHaptics/);
  });
});
