/**
 * THE TOGGLES DO NOT REVALIDATE (Agent FEEL, 13 November 2026).
 *
 * In this Next, a server action that calls `revalidatePath` (or `refresh`, or
 * `revalidateTag`/`updateTag` without a stale profile) renders the WHOLE
 * current page into its own answer before its promise settles
 * (next/dist/server/app-render/action-handler.js: `skipPageRendering` is
 * false once `pathWasRevalidated` is set), and the client then drops every
 * page from its router cache. Measured on production: a heart's banner
 * waited about 2 seconds for /search to render again, the heart stayed
 * disabled for 3.6 seconds, and going back refetched the page behind.
 *
 * The actions a person fires many times in a minute (save, unsave, follow,
 * like and bookmark, mark all read) keep their screens honest another way
 * (optimistic state, `SavedFreshness`, a refresh of the one page that needs
 * it). This pins that none of them starts revalidating again.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** The body of `export async function <name>` up to the next top-level export. */
function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  if (start === -1) throw new Error(`no ${name}`);
  const next = src.indexOf("\nexport ", start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

const REVALIDATES = /\b(revalidatePath|revalidateTag|updateTag|refresh)\s*\(/;

describe("the hot toggles answer without re-rendering the page", () => {
  it.each([
    ["lib/saved/actions.ts", "toggleSave"],
    ["lib/saved/places-actions.ts", "savePlace"],
    ["lib/saved/places-actions.ts", "unsavePlace"],
    ["lib/social/follows-actions.ts", "toggleFollow"],
    ["lib/social/posts-actions.ts", "toggleMark"],
    ["lib/messages/actions.ts", "markInboxRead"],
  ])("%s %s", (file, name) => {
    expect(body(read(file), name)).not.toMatch(REVALIDATES);
  });

  it("follow's shared settle does not revalidate either", () => {
    const src = read("lib/social/follows-actions.ts");
    const at = src.indexOf("async function settle(");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, src.indexOf("\n}\n", at))).not.toMatch(REVALIDATES);
  });
});
