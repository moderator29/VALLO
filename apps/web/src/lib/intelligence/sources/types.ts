import type { IntelligenceKind, IntelligenceResult, Understood } from "../contract";
import type { ReadingHints } from "../understand";
import type { Viewer } from "../viewer";

/**
 * ONE RETRIEVER PER KIND.
 *
 * Every source answers the same question the same way: given what was
 * understood and who is asking, the real rows of its kind, best first, with
 * `offset`/`limit` paging. A source that cannot answer throws or times out,
 * and the engine marks the response `partial` and shows the others.
 */
export type SourceContext = {
  understood: Understood;
  hints: ReadingHints;
  /** The words actually searched: as typed, or the spelling fix the engine is showing. */
  words: string;
  viewer: Viewer;
  offset: number;
  limit: number;
  /** "suggest" is the typed-ahead path: fewer reads, no counts. */
  mode: "search" | "suggest";
  now: Date;
};

export type SourcePage = {
  results: IntelligenceResult[];
  /** The exact number of matches, when the source knows it cheaply. */
  total?: number;
  /** "See all" on the screen that already lists this kind in full. */
  more?: string;
  /** A record whose title is a near miss of the typed words, to offer as "Did you mean". */
  closestTitle?: string;
};

export type Source = {
  kind: IntelligenceKind;
  /** Whether this source has anything to say for this reading and viewer. */
  applies(ctx: Pick<SourceContext, "understood" | "hints" | "viewer">): boolean;
  run(ctx: SourceContext): Promise<SourcePage>;
};
