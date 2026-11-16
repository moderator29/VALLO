import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { getDictionary } from "@vallo/i18n";
import { describe, expect, it } from "vitest";
import {
  BODY_MAX,
  TITLE_MAX,
  bannedPhrasesIn,
  stateCopyProblems,
  stateRole,
  STATE_KINDS,
  STATE_TONE,
} from "./voice";

const codes = (copy: Parameters<typeof stateCopyProblems>[0]) => stateCopyProblems(copy).map((p) => p.code);

describe("the voice rules (V-97)", () => {
  it("passes a state written to the rules", () => {
    expect(
      codes({
        kind: "empty",
        title: "No saved places yet",
        body: "Tap the heart on a listing and it will wait for you here.",
        actions: ["Find a place"],
      }),
    ).toEqual([]);
  });

  it("holds titles to 40 characters and bodies to 180", () => {
    expect(codes({ kind: "empty", title: "x".repeat(TITLE_MAX), body: "y", actions: ["Find a place"] })).toEqual([]);
    expect(codes({ kind: "empty", title: "x".repeat(TITLE_MAX + 1), body: "y", actions: ["Find a place"] })).toEqual([
      "title_long",
    ]);
    expect(
      codes({ kind: "empty", title: "Fine", body: "y".repeat(BODY_MAX + 1), actions: ["Find a place"] }),
    ).toEqual(["body_long"]);
  });

  it("bans the hotel pun on the shared 404, and the shrugs", () => {
    expect(bannedPhrasesIn("This page has checked out").map((b) => b.phrase)).toEqual(["checked out"]);
    expect(bannedPhrasesIn("Oops! Something went wrong.").map((b) => b.phrase)).toEqual(["oops", "something went wrong"]);
    expect(bannedPhrasesIn("Don’t worry").map((b) => b.phrase)).toEqual(["don't worry"]);
    expect(bannedPhrasesIn("Checkout is on Friday")).toEqual([]);
  });

  it("wants an action where the state would leave somebody stuck, and names its destination", () => {
    expect(codes({ kind: "error", title: "Your wallet did not load", body: "Nothing was moved." })).toEqual(["no_action"]);
    expect(codes({ kind: "offline", title: "You are offline", body: "Saved pages still open." })).toEqual(["no_action"]);
    expect(codes({ kind: "done", title: "Request sent", body: "The lister has it now." })).toEqual([]);
    expect(codes({ kind: "empty", title: "Nothing here", body: "Yet.", actions: ["OK"] })).toEqual(["label_vague"]);
    expect(codes({ kind: "empty", title: "Nothing here", body: "Yet.", actions: ["a", "b", "c"] })).toEqual([
      "too_many_actions",
    ]);
  });

  it("judges only the label of a loading state", () => {
    expect(codes({ kind: "loading", title: "Loading your bookings", body: "" })).toEqual([]);
    expect(codes({ kind: "loading", title: "", body: "" })).toEqual(["title_empty"]);
  });

  it("gives every kind a role and every drawn kind a tone", () => {
    expect(STATE_KINDS.map(stateRole)).toEqual(["status", undefined, undefined, "alert", "status"]);
    expect(Object.keys(STATE_TONE).sort()).toEqual(["done", "empty", "error", "offline"]);
  });
});

describe("the State kit and the old families", () => {
  const src = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");

  it("draws its title and body in the type roles Screen names", () => {
    const kit = src("components/ui/State.tsx");
    const screen = src("components/app/Screen.tsx");
    const title = /STATE_TITLE_CLASS = "([^"]+)"/.exec(kit)?.[1];
    const body = /STATE_BODY_CLASS = "([^"]+)"/.exec(kit)?.[1];
    expect(screen).toContain(`sectionTitle: "${title}"`);
    expect(screen).toContain(`body: "${body}"`);
  });

  it("makes EmptyState a wrapper over the kit", () => {
    const screen = src("components/app/Screen.tsx");
    expect(screen).toContain('import { State } from "@/components/ui/State"');
    expect(screen).toMatch(/<State\s+kind="empty"/);
  });

  it("no longer tells everyone on the shared 404 that the page has checked out", () => {
    expect(bannedPhrasesIn(src("app/not-found.tsx"))).toEqual([]);
  });

  it("writes the kit's own 404 to the rules", () => {
    const copy = getDictionary("en").trustVisible.state;
    expect(
      stateCopyProblems({ kind: "error", title: copy.lostTitle, body: copy.lostBody, actions: ["Search", "Back to home"] }),
    ).toEqual([]);
  });

  it("passes the sweep over the whole source", () => {
    const out = execFileSync("node", [join(__dirname, "../../../../../scripts/design/state-sweep.mjs")], { encoding: "utf8" });
    expect(out).toContain("state sweep: clean");
  });

  it("draws the full-screen states through the kit, in the voice", () => {
    const copy = getDictionary("en").trustVisible.state;
    expect(
      stateCopyProblems({ kind: "error", title: copy.screenErrorTitle, body: copy.screenErrorBody, actions: ["Try again", "Back to home"] }),
    ).toEqual([]);
    expect(
      stateCopyProblems({ kind: "offline", title: copy.offlineTitle, body: copy.offlineBody, actions: ["Try again", "Back to home"] }),
    ).toEqual([]);
    expect(src("app/(app)/error.tsx")).toContain("<StateMoment");
    /* The offline page is the one full-screen state that is NOT drawn through
       `StateMoment` any more (W11, 6 October 2026, north star 10 L): it is the
       navy ground, one Island and one action, the same card the packaged shell
       draws, so it has its own screen (`OfflineScreen`) and its own words
       (`experienceEntry.offline*`), still in the kit's voice. */
    expect(src("app/offline/page.tsx")).toContain("<OfflineScreen");
    const offlineCopy = getDictionary("en").experienceEntry;
    expect(
      stateCopyProblems({ kind: "offline", title: offlineCopy.offlineTitle, body: offlineCopy.offlineBody, actions: [offlineCopy.offlineRetry] }),
    ).toEqual([]);
    expect(bannedPhrasesIn(src("app/(app)/error.tsx"))).toEqual([]);
  });

  it("announces every shared loading shell through the kit", () => {
    /* The kit's loading drawing lives in `StateLoading` (so a loading screen
       does not carry the kit's glyphs and actions), and `State` draws its own
       loading kind by calling it: still one drawing, reached two ways. */
    expect(src("components/app/ScreenSkeleton.tsx")).toContain("<StateLoading title={label}");
    expect(src("components/ui/State.tsx")).toMatch(/if \(kind === "loading"\) \{[\s\S]*?<StateLoading title=\{title\}/);
    expect(src("components/social/profile/LoadingPeople.tsx")).toContain('<State kind="loading"');
  });
});
