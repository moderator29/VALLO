/**
 * VALLO INTELLIGENCE: NEAR MISSES, MEASURED THE WAY POSTGRES MEASURES THEM.
 *
 * `trigramSimilarity` is `pg_trgm`'s `similarity()`, written out: each word is
 * padded with two spaces in front and one behind, cut into three-letter
 * windows, and the score is the shared windows over all windows. The engine
 * uses it where the database cannot (a closed vocabulary held in memory, the
 * catalogue's titles) so a typo reads the same in both places.
 *
 * `editDistance` is optimal string alignment (Damerau-Levenshtein with one
 * edit per character): "hotle" is one swap from "hotel", which a trigram
 * score alone undersells on a five letter word.
 *
 * Pure and dependency free.
 */

export function trigrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3));
  }
  return out;
}

export function trigramSimilarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared += 1;
  return shared / (x.size + y.size - shared);
}

/**
 * `word_similarity`'s idea, simplified: the best similarity between `needle`
 * and any run of words in `haystack` as long as the needle. "banana iland"
 * against "4 bedroom duplex on banana island" scores the matching window, not
 * the whole title.
 */
export function bestWindowSimilarity(needle: string, haystack: string): number {
  const n = needle.toLowerCase().split(/\s+/).filter(Boolean);
  const h = haystack.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (n.length === 0 || h.length === 0) return 0;
  if (h.length <= n.length) return trigramSimilarity(needle, haystack);
  let best = 0;
  for (let i = 0; i + n.length <= h.length; i += 1) {
    const score = trigramSimilarity(n.join(" "), h.slice(i, i + n.length).join(" "));
    if (score > best) best = score;
  }
  return best;
}

export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j += 1) d[0]![j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[m]![n]!;
}

/**
 * The closest word in `vocabulary` to `word`, or null when nothing is close
 * enough to offer. Close enough is one edit for a word of five to seven
 * letters, two for a longer one, or a trigram score of at least 0.5. Words
 * under five letters are never guessed at: "show" is not a typo of "shop".
 */
export function closestWord(word: string, vocabulary: readonly string[]): string | null {
  const w = word.toLowerCase();
  if (w.length < 5 || /\d/.test(w)) return null;
  let best: { word: string; distance: number; similarity: number } | null = null;
  for (const candidate of vocabulary) {
    if (candidate === w) return null;
    if (Math.abs(candidate.length - w.length) > 2) continue;
    const distance = editDistance(w, candidate);
    const similarity = trigramSimilarity(w, candidate);
    const allowed = w.length >= 8 ? 2 : 1;
    if (distance > allowed && similarity < 0.5) continue;
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && similarity > best.similarity)
    ) {
      best = { word: candidate, distance, similarity };
    }
  }
  return best?.word ?? null;
}
