import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "@/lib/copy/source-scan";

/**
 * ONE BACK, ONE CLOSE, EVERYWHERE (the founder, 14 November 2026, with App
 * Store screenshots: "our go back icon ... should be wide platform like I
 * repeat wide platform clean on dark mode and light mode ... Same as the x
 * one too ... every single page every single tab or area").
 *
 * He has asked for this twice. A table in a document is read once; this is
 * read on every run, so a new control that does not match the rule fails
 * here rather than being found in a screenshot a week later.
 *
 * THE TWO RULES, both from `docs/handoff/CONSISTENCY_AUDIT.md`:
 *
 *   1. BACK IS A CHEVRON. A control that navigates BACKWARD draws
 *      `chevron-left`. `arrow-left` is not forbidden: it is correct where
 *      something MOVES through content (a carousel, a photo reorder, the
 *      previous month, an undo). What is forbidden is an arrow inside a
 *      control whose accessible name says "back", which is how the two
 *      drifted apart in the first place.
 *
 *   2. A STANDALONE DISMISS IS 20. An X whose only job is to close a
 *      surface draws the glyph at 20px in a 44px box. A smaller X is
 *      allowed only where it removes an ITEM rather than closing a surface
 *      (a photo out of a grid, a chip out of a composer, a clear inside a
 *      field), because a 44px circle on a 72px thumbnail swallows it. Those
 *      are listed below, each with what it removes, so the list can be read
 *      and argued with rather than guessed at.
 */

const SRC = join(__dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", "dist"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (entry.endsWith(".tsx") && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

/**
 * The small X's: each removes one thing from a list or clears one field, and
 * none of them closes a surface. A new entry here needs a reason in writing.
 */
const REMOVES_AN_ITEM = new Set([
  "components/ui/Field.tsx", // clears the field it sits in
  "components/social/feed/Composer.tsx", // takes an attachment off a post
  "components/social/feed/ListingPicker.tsx", // takes the chosen listing off
  "components/social/share/ShareToFeedSheet.tsx", // takes the attachment off
  "components/social/find/PeopleFinder.tsx", // clears the search field
  "components/app/messages/PasteChip.tsx", // drops a pasted chip
  "components/app/messages/PasteTray.tsx", // drops a pasted chip from the tray
  "components/roommates/SchoolPicker.tsx", // clears the chosen school
  "components/roommates/FirstRunCard.tsx", // the glyph beside the word "Later"
  "components/docs/DocHelpful.tsx", // the glyph beside the word "No"
  "components/host/HostWizard.tsx", // an error mark beside a field
  "components/app/inspections/visit/VisitStatus.tsx", // a "stopped" status mark
  "components/app/deal-room/StageRail.tsx", // a stage's status mark
  "components/ui/SuccessMoment.tsx", // the problem dot's own mark
  "components/ui/ToastHost.tsx", // the banner's own dismiss, sized by the banner
  "app/agent/list/steps/ChargesStep.tsx", // removes a charge row
  "app/agent/list/steps/PhotosStep.tsx", // removes a photo from the grid
  "app/(app)/roommates/profile/_parts/ProfileFlow.tsx", // removes a photo
  "app/(app)/roommates/new/_parts/PostFlow.tsx", // removes a photo
  "app/(app)/messages/[id]/ThreadView.tsx", // drops a reply or an attachment
]);

const files = sources(SRC).map((full) => ({
  path: relative(SRC, full).split("\\").join("/"),
  text: withoutComments(readFileSync(full, "utf8")),
}));

describe("the back control is a chevron, platform wide", () => {
  it("draws chevron-left in BackControl itself", () => {
    const back = files.find((f) => f.path === "components/ui/BackControl.tsx");
    expect(back?.text).toContain('name="chevron-left"');
    expect(back?.text).not.toContain('name="arrow-left"');
  });

  it("has no arrow inside a control that says it goes back", () => {
    /* A window of source around each arrow, so the arrow and the name that
       describes it are read together. A control named "back", "previous
       page" or "return" with an arrow in it is the drift this catches; a
       carousel's "previous photo" is not, because it moves content. */
    const offenders: string[] = [];
    for (const file of files) {
      if (file.path.startsWith("app/(dev)/preview/")) continue;
      let from = 0;
      for (;;) {
        const at = file.text.indexOf('name="arrow-left"', from);
        if (at === -1) break;
        from = at + 1;
        const window = file.text.slice(Math.max(0, at - 400), at + 120).toLowerCase();
        const saysBack =
          /aria-label=\{[^}]*\bback\b/.test(window) ||
          /aria-label="[^"]*\bback\b/.test(window) ||
          /\bbacktolabel\b/.test(window) ||
          /data-nav-back/.test(window);
        if (saysBack) offenders.push(file.path);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("a standalone dismiss is one size", () => {
  it("draws the close glyph at 20 unless it removes an item", () => {
    const wrong: string[] = [];
    for (const file of files) {
      if (file.path.startsWith("app/(dev)/preview/")) continue;
      /* The console is dark only and sets its own density; it is audited
         separately and is not this rule's subject. */
      if (file.path.startsWith("app/admin/")) continue;
      if (REMOVES_AN_ITEM.has(file.path)) continue;
      for (const match of file.text.matchAll(/name="close"\s+size=\{(\d+)\}/g)) {
        if (match[1] !== "20") wrong.push(`${file.path}: close at ${match[1]}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("keeps the list of small X's honest: every one of them still draws a close", () => {
    /* A file that stops drawing an X must leave the list, or the list stops
       describing the product and starts excusing it. */
    const stale = [...REMOVES_AN_ITEM].filter((path) => {
      const file = files.find((f) => f.path === path);
      return file ? !file.text.includes('name="close"') : true;
    });
    expect(stale).toEqual([]);
  });
});
