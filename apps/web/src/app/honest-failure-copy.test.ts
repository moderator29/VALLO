import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getDictionary } from "@vallo/i18n";

/**
 * STORE-01 / UX-17. The failure screens promised "Nothing you were doing was
 * lost" — false on the one screen where it matters most: a half-typed form
 * behind a dropped connection or a crashed render IS lost. And several
 * consumer strings spoke in the engineer's voice (row level security, the
 * ledger, kobo-stored totals, a list of 749).
 *
 * These screens are client error boundaries and a static shell page, which
 * this node suite cannot render, so the promise is checked in their source.
 */
const FAILURE_SCREENS = [
  "app/error.tsx",
  "app/(app)/error.tsx",
  "app/global-error.tsx",
  "app/offline/page.tsx",
  "../../native-shell/index.html",
];

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(`./${relative.replace(/^app\//, "")}`, import.meta.url)), "utf8");
}

describe("failure screens promise nothing they cannot keep", () => {
  it.each(FAILURE_SCREENS)("%s does not say nothing was lost", (file) => {
    const text = read(file).replace(/\s+/g, " ");
    expect(text).not.toMatch(/nothing (you were doing )?(has been|was) lost/i);
    expect(text).not.toMatch(/nothing you were doing was lost/i);
    expect(text).not.toMatch(/Everything is where you left it/i);
  });

  it.each(["app/error.tsx", "app/global-error.tsx"])(
    "%s always has a reference to quote, and it is the one the report carries (C13)",
    (file) => {
      const text = read(file).replace(/\s+/g, " ");
      /* 13 November 2026: the calm words. The screen now comes only after the
         quiet tries (useSignalHold), so the reference is kept but small, in one
         line that says when to use it: "If this keeps happening, quote it to
         support." The promise this test guards is unchanged: a reference is
         always on the final screen, it is the one the report carries, and the
         screen tells the reader what to do with it. */
      expect(text).toMatch(/Reference <span[^>]*>\{reference\}<\/span>\. If this keeps happening, quote it to support\./);
      /* A client error has no digest, so one is made (lib/observability/reference.ts)
         and sent with the report: the promise of a reference is kept every time. */
      expect(text).toMatch(/useErrorReport|digestFor\(error\)/);
    },
  );
});

describe("the safe claim is the same claim in calmer words (13 November 2026)", () => {
  /* The calm rewrite swapped "undoes nothing you had already sent or saved"
     for "Nothing you sent or saved was undone". Same claim, same scope: what
     was sent or saved before the failure is untouched. It still promises
     nothing about what was being typed, and nothing about "nothing was lost". */
  const CLAIM = "Nothing you sent or saved was undone.";
  it.each(["app/error.tsx", "app/global-error.tsx"])("%s makes the one safe claim and no wider one", (file) => {
    const text = read(file).replace(/\s+/g, " ");
    expect(text).toContain(CLAIM);
    expect(text).not.toMatch(/nothing (was|has been) lost|nothing you (did|typed) was/i);
  });
  it("the in-app screen's dictionary makes the same claim", () => {
    const body = getDictionary("en").trustVisible.state.screenErrorBody;
    expect(body).toContain(CLAIM);
    /* It is reached only after the quiet tries, which is what lets it say so. */
    expect(body).toMatch(/^Vallo tried a few times/);
  });
});

describe("consumer copy is not written for engineers", () => {
  it("names no mechanism a renter cannot know", () => {
    const all = JSON.stringify(getDictionary("en"));
    for (const word of ["row level security", "your own row", "from the ledger", "read the ledger", "list of 749", "read from the platform as the page loads"]) {
      expect(all).not.toContain(word);
    }
    const checkout = read("app/(app)/checkout/page.tsx");
    expect(checkout).not.toContain("stored to the kobo");
  });
});
