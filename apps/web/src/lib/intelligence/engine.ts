import { lagosToday } from "@/lib/stays/query";
import type { IntelligenceKind, IntelligenceResult, IntelligenceTab, SearchResponse, Understood } from "./contract";
import { applyModelAnswer, shouldAskModel, type ModelAnswer } from "./model";
import { cityOf, placeFromLabel, placeLabel } from "./places";
import { decodeCursor, encodeCursor, rankAll, TAB_KINDS } from "./rank";
import type { Source, SourceContext, SourcePage } from "./sources/types";
import { cleanQuery } from "./text";
import { LOOSENABLE, queryFromUnderstood, understand, withoutFilter, type Loosenable, type ReadingHints } from "./understand";
import type { Viewer } from "./viewer";

/**
 * VALLO INTELLIGENCE: THE ENGINE.
 *
 * One search, start to finish:
 *
 *   1. read the words by rules (`understand`), with the staff synonyms;
 *   2. apply what the screen removed or set (a chip taken off is a filter dropped);
 *   3. on submit only, when the rules read little of a long query, ask the
 *      model for a patch (`model.ts`), and fall back to the rules on any failure;
 *   4. fan out to every source that has something to say, in parallel, each
 *      with its own deadline: a slow or failed source marks the answer
 *      `partial` and the others still return;
 *   5. when the words as typed found nothing and a spelling fix exists, search
 *      the fix and SAY so (`showing`);
 *   6. rank "All" into groups, or page one tab with a cursor;
 *   7. when nothing matched, offer ways forward that are themselves checked to
 *      return something: drop a filter, widen the place, the fix.
 *
 * Pure orchestration: the sources, the alias reader, the model and the clock
 * are passed in, so the whole flow runs in a unit test with fakes.
 */

export const PAGE_SIZE = 20;
export const SOURCE_DEADLINE_MS = 1_800;

export type EngineDeps = {
  sources: readonly Source[];
  aliases?: () => Promise<{ words: Record<string, string>; places: Record<string, string> }>;
  /** The model step; called only when `allowModel` and the rules read too little. */
  model?: (query: string, today: string) => Promise<ModelAnswer | null>;
  deadlineMs?: number;
  now?: () => Date;
};

export type SearchInput = {
  q: string;
  tab: IntelligenceTab;
  cursor?: string | null;
  viewer: Viewer;
  /** Keys of `Understood` the person removed (chips taken off). */
  drop?: readonly string[];
  /** Filters the person set on the screen, already validated by the route. */
  set?: Partial<Understood>;
  /** True on a submitted search (never on a keystroke) when the caller cleared consent and limits. */
  allowModel?: boolean;
};

type Run = {
  byKind: Map<IntelligenceKind, SourcePage>;
  partial: boolean;
};

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("deadline")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const DROPPABLE = new Set<string>(["kind", "intent", "place", "bedrooms", "maxPrice", "minPrice", "furnished", "amenities", "checkIn", "checkOut", "guests", "addedSince", "listingKinds", "text", "didYouMean"]);

/** The reading after the screen's chips: removed keys gone, set keys replaced. */
export function adjust(u: Understood, drop: readonly string[] = [], set: Partial<Understood> = {}): Understood {
  const next: Understood = { ...u, ...set, raw: u.raw, via: u.via };
  for (const key of drop) {
    if (!DROPPABLE.has(key)) continue;
    delete (next as unknown as Record<string, unknown>)[key];
    if (key === "checkIn" || key === "checkOut") {
      delete next.checkIn;
      delete next.checkOut;
    }
  }
  return next;
}

/** The sources that have something to say for this reading on this tab. */
function sourcesFor(sources: readonly Source[], u: Understood, hints: ReadingHints, viewer: Viewer, tab: IntelligenceTab): Source[] {
  if (tab === "all") return sources.filter((s) => s.applies({ understood: u, hints, viewer }));
  const kinds = TAB_KINDS[tab];
  /* On a tab, ask each of its sources as though the words pointed at that kind. */
  return sources.filter((s) => kinds.includes(s.kind) && s.applies({ understood: { ...u, kind: s.kind }, hints, viewer }));
}

async function runSources(
  list: readonly Source[],
  base: Omit<SourceContext, "offset" | "limit">,
  limit: number,
  deadline: number,
): Promise<Run> {
  const byKind = new Map<IntelligenceKind, SourcePage>();
  let partial = false;
  const settled = await Promise.allSettled(list.map((s) => withDeadline(s.run({ ...base, offset: 0, limit }), deadline)));
  settled.forEach((outcome, i) => {
    const kind = list[i]!.kind;
    if (outcome.status === "rejected") {
      partial = true;
      return;
    }
    const prior = byKind.get(kind);
    if (!prior) byKind.set(kind, outcome.value);
    else {
      byKind.set(kind, {
        results: [...prior.results, ...outcome.value.results],
        total: prior.total !== undefined && outcome.value.total !== undefined ? prior.total + outcome.value.total : undefined,
        more: prior.more ?? outcome.value.more,
        closestTitle: prior.closestTitle ?? outcome.value.closestTitle,
      });
    }
  });
  return { byKind, partial };
}

function countOfRun(run: Run): number {
  let n = 0;
  for (const page of run.byKind.values()) n += page.results.length;
  return n;
}

/** The results a tab shows, in its kinds' order. */
function tabResults(run: Run, tab: IntelligenceTab): IntelligenceResult[] {
  return TAB_KINDS[tab].flatMap((k) => run.byKind.get(k)?.results ?? []);
}

const LOOSEN_LABEL: Record<Loosenable, (u: Understood) => string> = {
  maxPrice: () => "Any budget",
  minPrice: () => "Any budget",
  bedrooms: () => "Any number of bedrooms",
  amenities: (u) => `Without ${(u.amenities ?? []).join(", ")}`,
  furnished: () => "Furnished or not",
  checkIn: () => "Any dates",
  guests: () => "Any number of guests",
  addedSince: () => "Listed any time",
  listingKinds: () => "Every kind of place",
  intent: (u) => (u.intent === "buy" ? "To rent as well" : u.intent === "rent" ? "For sale as well" : "Any market"),
  text: (u) => `Without "${u.text}"`,
};

export async function runSearch(input: SearchInput, deps: EngineDeps): Promise<SearchResponse> {
  const started = Date.now();
  const now = deps.now?.() ?? new Date();
  const deadline = deps.deadlineMs ?? SOURCE_DEADLINE_MS;
  const typed = cleanQuery(input.q);
  const aliases = (await deps.aliases?.().catch(() => undefined)) ?? { words: {}, places: {} };

  const reading = understand(typed, { now, aliases });
  let understood = adjust(reading.understood, input.drop, input.set);
  const hints = reading.hints;
  if (input.drop?.includes("place")) hints.place = null;

  if (input.allowModel && deps.model && shouldAskModel(understood, hints)) {
    const answer = await deps.model(typed, lagosToday(now)).catch(() => null);
    understood = applyModelAnswer(understood, answer);
  }

  const offset = decodeCursor(input.cursor, input.tab, typed);
  const limit = Math.min(200, Math.max(12, offset + PAGE_SIZE + 1));
  const base = (u: Understood, h: ReadingHints, words: string) => ({ understood: u, hints: h, words, viewer: input.viewer, mode: "search" as const, now });

  let run = await runSources(sourcesFor(deps.sources, understood, hints, input.viewer, input.tab), base(understood, hints, typed), limit, deadline);
  let showing: SearchResponse["showing"];

  /* The words as typed found nothing: try the spelling fix, and say so. */
  /* "Nothing" means no record: a place card or a help page alone does not
     answer "resturants in VI", so the fix is still tried. */
  const RECORD_KINDS: IntelligenceKind[] = ["property", "stay", "restaurant", "roommate", "person", "community", "post", "personal"];
  const records = (r: Run) => RECORD_KINDS.reduce((n, k) => n + (r.byKind.get(k)?.results.length ?? 0), 0);
  const shown = (r: Run) => (input.tab === "all" ? countOfRun(r) : tabResults(r, input.tab).length);
  const weak = (r: Run) => (input.tab === "all" ? records(r) === 0 : shown(r) === 0);
  if (weak(run) && understood.didYouMean && !input.set && !(input.drop && input.drop.length > 0)) {
    const fixed = understand(understood.didYouMean, { now, aliases });
    const retry = await runSources(
      sourcesFor(deps.sources, fixed.understood, fixed.hints, input.viewer, input.tab),
      base(fixed.understood, fixed.hints, understood.didYouMean),
      limit,
      deadline,
    );
    /* The fix is shown when it finds records the words as typed did not,
       anything where they found nothing, or gives words with no meaning one
       ("make an ofer" is nothing; "make an offer" is the offer how-to). */
    const meaning = understood.kind === undefined && fixed.understood.kind !== undefined && shown(retry) > 0;
    const better = input.tab === "all" ? records(retry) > records(run) || (shown(run) === 0 && shown(retry) > 0) || meaning : shown(retry) > 0;
    if (better) {
      showing = { query: understood.didYouMean, insteadOf: typed };
      understood = { ...fixed.understood, raw: typed, didYouMean: understood.didYouMean, via: understood.via };
      run = retry;
    }
  }

  /* A misspelled listing title: the closest real title, offered. */
  if (!understood.didYouMean) {
    for (const page of run.byKind.values()) {
      if (page.closestTitle) {
        understood = { ...understood, didYouMean: page.closestTitle };
        break;
      }
    }
  }

  const tabs: SearchResponse["tabs"] = [{ tab: "all" }];
  for (const tab of ["property", "stay", "restaurant", "roommate", "person", "community", "guide", "personal"] as const) {
    const kinds = TAB_KINDS[tab];
    const n = tabResults(run, tab).length;
    if (n === 0) continue;
    const totals = kinds.map((k) => run.byKind.get(k)?.total);
    const exact = totals.every((t, i) => t !== undefined || !run.byKind.get(kinds[i]!));
    tabs.push(exact ? { tab, count: totals.reduce<number>((a, t) => a + (t ?? 0), 0) } : { tab });
  }

  const response: SearchResponse = { q: typed, understood, tab: input.tab, tabs, results: [], tookMs: 0 };
  if (input.tab === "all") {
    const groups = rankAll(run.byKind, understood);
    response.groups = groups;
    response.results = groups.flatMap((g) => g.results);
  } else {
    const all = tabResults(run, input.tab);
    response.results = all.slice(offset, offset + PAGE_SIZE);
    if (all.length > offset + PAGE_SIZE) response.next = encodeCursor(input.tab, offset + PAGE_SIZE, typed);
  }
  if (run.partial) response.partial = true;
  if (showing) response.showing = showing;

  if (response.results.length === 0 && offset === 0) {
    const alternatives = await findAlternatives(understood, input, deps, now, deadline);
    if (alternatives.length > 0) response.alternatives = alternatives;
  }

  response.tookMs = Date.now() - started;
  return response;
}

/**
 * Ways forward when nothing matched, each checked to return at least one
 * result before it is offered: loosen one filter, widen the place to its city
 * or to everywhere, or the spelling fix.
 */
async function findAlternatives(
  u: Understood,
  input: SearchInput,
  deps: EngineDeps,
  now: Date,
  deadline: number,
): Promise<{ label: string; query?: string; href?: string }[]> {
  const candidates: { label: string; understood: Understood }[] = [];
  for (const key of LOOSENABLE) {
    if (u[key] === undefined || (Array.isArray(u[key]) && (u[key] as unknown[]).length === 0)) continue;
    if (key === "minPrice" && u.maxPrice !== undefined) continue;
    let next = withoutFilter(u, key);
    if (key === "maxPrice") next = withoutFilter(next, "minPrice");
    candidates.push({ label: LOOSEN_LABEL[key](u), understood: next });
  }
  const place = placeFromLabel(u.place);
  if (place) {
    const city = cityOf(place);
    if (city) candidates.push({ label: `All of ${city.name}`, understood: { ...u, place: placeLabel(city) } });
    else {
      const anywhere = { ...u };
      delete anywhere.place;
      candidates.push({ label: "Anywhere", understood: anywhere });
    }
  }

  const tab = input.tab;
  const checks = await Promise.all(
    candidates.slice(0, 8).map(async (c) => {
      /* What is offered is a query, so the query itself is what is checked:
         read back by the same rules the person's tap will run through. */
      const query = queryFromUnderstood(c.understood);
      if (!query || query === u.raw) return null;
      const reread = understand(query, { now });
      const run = await runSources(
        sourcesFor(deps.sources, reread.understood, reread.hints, input.viewer, tab),
        { understood: reread.understood, hints: reread.hints, words: query, viewer: input.viewer, mode: "search", now },
        3,
        deadline,
      ).catch(() => null);
      if (!run) return null;
      const found = tab === "all" ? countOfRun(run) : tabResults(run, tab).length;
      return found > 0 ? { label: c.label, query } : null;
    }),
  );
  const out: { label: string; query?: string; href?: string }[] = [];
  for (const c of checks) {
    if (c && !out.some((o) => o.query === c.query)) out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}
