/**
 * THE SCHOOL SEARCH (pure). Used on the server by `listInstitutions` and on the
 * device by the school picker, so a student finds "OAU Ife", "FUTA Akure" or
 * "poly ibadan" the same way in both places.
 *
 * Rules: the query is split into words; every word has to match somewhere in
 * the school's name, short name, city or aliases (case, hyphen and accent
 * insensitive). Ranking: an exact short name or alias first, then an acronym
 * prefix ("oau" for OAU), then a name that starts with the query, then a word
 * that starts a word of the name, then anything else that matched. Ties go to
 * universities, then polytechnics, then colleges, then the rest, then A to Z.
 */

export type SearchableSchool = {
  name: string;
  shortName: string | null;
  kind: string;
  stateCode: string | null;
  city: string | null;
  aliases?: string[] | null;
};

/** Lower case, accents removed, every run of punctuation becomes one space. */
export function foldText(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function queryWords(q: string | null | undefined): string[] {
  const folded = foldText(q);
  return folded ? Array.from(new Set(folded.split(" "))) : [];
}

const KIND_ORDER: Record<string, number> = { university: 0, polytechnic: 1, college: 2, other: 3 };
function kindRank(kind: string): number {
  return KIND_ORDER[kind] ?? 4;
}

/** The order a school list shows in with no search text: kind, then name. */
export function compareSchools(a: SearchableSchool, b: SearchableSchool): number {
  return kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name, "en");
}

/** Lower is better; null means the school does not match every word. */
export function schoolMatchRank(school: SearchableSchool, words: string[], whole: string): number | null {
  if (!words.length) return 4;
  const name = foldText(school.name);
  const short = foldText(school.shortName);
  const city = foldText(school.city);
  const aliases = (school.aliases ?? []).map(foldText).filter(Boolean);
  const fields = [name, short, city, ...aliases];
  const haystack = fields.join(" ");
  const compact = haystack.replace(/ /g, "");
  for (const w of words) {
    if (!haystack.includes(w) && !compact.includes(w)) return null;
  }
  if ((short && short === whole) || aliases.includes(whole)) return 0;
  const first = words[0]!;
  if ((short && short.startsWith(first)) || aliases.some((a) => a.startsWith(whole) || a.split(" ").includes(first))) return 1;
  if (name.startsWith(whole)) return 2;
  const nameWords = name.split(" ");
  if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) return 3;
  return 4;
}

export type SchoolSearch = { q?: string | null; stateCode?: string | null; limit?: number };

export const SCHOOL_DEFAULT_LIMIT = 200;
export const SCHOOL_MAX_LIMIT = 1500;

/** Filter, rank and cap a list of schools. An empty search is kind, then name. */
export function searchSchools<T extends SearchableSchool>(schools: readonly T[], input: SchoolSearch = {}): T[] {
  const limit = Math.max(1, Math.min(input.limit ?? SCHOOL_DEFAULT_LIMIT, SCHOOL_MAX_LIMIT));
  const words = queryWords(input.q);
  const whole = words.length ? foldText(input.q) : "";
  const ranked: { school: T; rank: number }[] = [];
  for (const school of schools) {
    if (input.stateCode && school.stateCode !== input.stateCode) continue;
    const rank = schoolMatchRank(school, words, whole);
    if (rank !== null) ranked.push({ school, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || compareSchools(a.school, b.school));
  return ranked.slice(0, limit).map((r) => r.school);
}
