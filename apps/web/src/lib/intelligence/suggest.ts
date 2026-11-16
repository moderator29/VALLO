import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findScreens } from "@/lib/assistant/tools/find-screen";
import { catalogueReader } from "@/lib/catalogue/listings";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { isSocialEnabled } from "@/lib/social/flag";
import type { IntelligenceTab, Suggestion, SuggestResponse } from "./contract";
import { readPopularQueries, readRecentSearches } from "./analytics";
import { trigramSimilarity } from "./fuzzy";
import { placeLabel, placesMatching } from "./places";
import { placeHref } from "./sources/places";
import { safePattern } from "./sources/format";
import { cleanQuery, foldKey } from "./text";
import { understand } from "./understand";
import type { Viewer } from "./viewer";

/**
 * VALLO INTELLIGENCE: TYPED-AHEAD SUGGESTIONS.
 *
 * Fast and model-free, called (debounced) on keystrokes. Every suggestion is
 * a real thing: the words themselves as a search, the spelling fix, places on
 * the closed list, published listing titles, discoverable people (signed in),
 * Vallo screens, the member's own recent searches and popular searches above
 * the privacy floor. Each read has its own short deadline; a slow one is left
 * out rather than waited for.
 */

const READ_DEADLINE_MS = 200;

function soon<T>(work: Promise<T>, empty: T): Promise<T> {
  return Promise.race([work.catch(() => empty), new Promise<T>((resolve) => setTimeout(() => resolve(empty), READ_DEADLINE_MS))]);
}

/** The words before the place being typed: "apartments in lek" -> "apartments in". */
function splitTail(folded: string): { head: string; tail: string } {
  const m = /^(.*\b(?:in|near|at|around)\s+)(.+)$/.exec(folded);
  if (m) return { head: m[1]!.trim(), tail: m[2]!.trim() };
  const words = folded.split(" ");
  return { head: words.slice(0, -1).join(" "), tail: words[words.length - 1] ?? "" };
}

async function listingSuggestions(text: string): Promise<Suggestion[]> {
  if (text.length < 3) return [];
  const rows = await catalogueReader().search({});
  const q = text.toLowerCase();
  return rows
    .map((l) => {
      const title = l.title.toLowerCase();
      const score = title.startsWith(q) ? 2 : title.includes(q) ? 1.5 : trigramSimilarity(q, title);
      return { l, score };
    })
    .filter((s) => s.score >= 0.35)
    .sort((a, b) => b.score - a.score || Number(a.l.isDemo) - Number(b.l.isDemo))
    .slice(0, 3)
    .map(({ l }) => ({
      key: `listing:${l.id}`,
      kind: "property" as const,
      label: l.title,
      hint: l.isDemo ? "Example listing" : "Listing",
      href: hrefForListing(l.kind, l.id, marketFactsOf(l)),
      ...(l.photos[0] ? { imageUrl: l.photos[0] } : {}),
    }));
}

async function peopleSuggestions(viewer: Viewer, text: string): Promise<Suggestion[]> {
  if (!viewer.signedIn || !viewer.db) return [];
  const pattern = safePattern(text.replace(/^@+/, ""));
  if (pattern.length < 2 || !(await isSocialEnabled())) return [];
  const { data, error } = await (viewer.db as SupabaseClient)
    .from("social_profiles")
    .select("user_id, handle, display_label, avatar_path")
    .or(`handle.ilike.${pattern}%,display_label.ilike.${pattern}%`)
    .limit(3);
  if (error || !data) return [];
  return (data as { user_id: string; handle: string; display_label: string | null; avatar_path: string | null }[]).map((p) => ({
    key: `person:${p.user_id}`,
    kind: "person" as const,
    label: p.display_label?.trim() || `@${p.handle}`,
    hint: p.user_id === viewer.userId ? "You" : `@${p.handle}`,
    href: `/u/${encodeURIComponent(p.handle)}`,
    ...(p.avatar_path ? { imageUrl: p.avatar_path } : {}),
  }));
}

export async function suggest(input: { q: string; tab: IntelligenceTab; viewer: Viewer; now?: Date }): Promise<SuggestResponse> {
  const typed = cleanQuery(input.q);
  const folded = foldKey(typed);
  if (folded.length === 0) {
    const recent = await soon(readRecentSearches(input.viewer, 6), []);
    return {
      q: typed,
      suggestions: recent.map((r, i) => ({ key: `recent:${i}:${foldKey(r.query)}`, kind: "recent" as const, label: r.query, hint: "Recent", query: r.query })),
    };
  }

  const reading = understand(typed, { now: input.now });
  const { head, tail } = splitTail(folded);
  const text = reading.understood.text ?? (reading.understood.place ? "" : folded);

  const [recent, popular, listings, people] = await Promise.all([
    soon(readRecentSearches(input.viewer, 8), []),
    soon(readPopularQueries(20), []),
    soon(listingSuggestions(text || folded), []),
    soon(peopleSuggestions(input.viewer, text || folded), []),
  ]);

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion) => {
    const id = s.query ? `q:${foldKey(s.query)}` : `h:${s.href}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(s);
  };

  push({ key: `query:${folded}`, kind: "query", label: typed, hint: "Search", query: typed });
  if (reading.understood.didYouMean) {
    push({ key: `fix:${foldKey(reading.understood.didYouMean)}`, kind: "query", label: reading.understood.didYouMean, hint: "Did you mean", query: reading.understood.didYouMean });
  }
  for (const r of recent.filter((r) => foldKey(r.query).startsWith(folded) && foldKey(r.query) !== folded).slice(0, 3)) {
    push({ key: `recent:${foldKey(r.query)}`, kind: "recent", label: r.query, hint: "Recent", query: r.query });
  }
  for (const place of placesMatching(tail, 3)) {
    const query = head ? `${head} ${place.name}` : undefined;
    if (query) push({ key: `place:${place.name}:${folded}`, kind: "place", label: `${head} ${placeLabel(place)}`, hint: "Location", query });
    else push({ key: `place:${place.name}`, kind: "place", label: placeLabel(place), hint: "Location", href: placeHref(place) });
  }
  for (const q of popular.filter((p) => foldKey(p).includes(folded) && foldKey(p) !== folded).slice(0, 3)) {
    push({ key: `popular:${foldKey(q)}`, kind: "query", label: q, hint: "Search", query: q });
  }
  for (const s of listings) push(s);
  for (const s of people) push(s);
  for (const screen of findScreens(typed, "consumer").slice(0, 2)) {
    const label = screen.label.replace(/^(?:the|your)\s+/i, "");
    push({ key: `screen:${screen.href}`, kind: "screen", label: label.charAt(0).toUpperCase() + label.slice(1), hint: "Screen", href: screen.href });
  }

  return {
    q: typed,
    suggestions: out.slice(0, 12),
    ...(reading.understood.didYouMean ? { didYouMean: reading.understood.didYouMean } : {}),
  };
}
