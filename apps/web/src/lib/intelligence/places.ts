import { NEIGHBOURHOODS, PLACE_ALIASES } from "@/lib/places/neighbourhoods";

/**
 * VALLO INTELLIGENCE: THE PLACES IT RECOGNISES, AND NOTHING ELSE.
 *
 * A closed list, like `lib/places/neighbourhoods.ts` (which this builds on and
 * never copies): the neighbourhoods the broadcast reader and the demand board
 * already recognise, the areas the live catalogue is actually filed under
 * (read from `public.listings` on 16 November 2026: Banana Island, Magodo,
 * Akoka, Chevron Drive, Bodija, Jericho, the three Port Harcourt GRAs,
 * Rumuokoro, Independence Layout, Karsana), and the five cities those sit in.
 *
 * A place not on this list is left as words. It is never guessed: a guessed
 * place is a search in the wrong city.
 *
 * Aliases are how Lagos and Abuja actually write: "VI", "Lekki phase one",
 * "Lekki ph 1", "PH" for Port Harcourt, "FCT" for Abuja. Staff can add more
 * from the console (`public.search_aliases`, kind `place`), which only ever
 * point at a name already on this list.
 */

export type Place = {
  /** "Lekki Phase 1", or the city itself. */
  name: string;
  city: string;
  /** Two letters, as `listings.state_code` holds it. */
  stateCode: string;
  /** True when `name` is the city. */
  isCity: boolean;
};

const CITIES: readonly Place[] = [
  { name: "Lagos", city: "Lagos", stateCode: "LA", isCity: true },
  { name: "Abuja", city: "Abuja", stateCode: "FC", isCity: true },
  { name: "Ibadan", city: "Ibadan", stateCode: "OY", isCity: true },
  { name: "Port Harcourt", city: "Port Harcourt", stateCode: "RI", isCity: true },
  { name: "Enugu", city: "Enugu", stateCode: "EN", isCity: true },
];

/* Areas the live catalogue holds that the neighbourhood list does not. */
const CATALOGUE_AREAS: readonly [string, string, string][] = [
  ["Banana Island", "Lagos", "LA"],
  ["Magodo", "Lagos", "LA"],
  ["Akoka", "Lagos", "LA"],
  ["Chevron Drive", "Lagos", "LA"],
  ["Bodija", "Ibadan", "OY"],
  ["Jericho", "Ibadan", "OY"],
  ["GRA Phase 2", "Port Harcourt", "RI"],
  ["Old GRA", "Port Harcourt", "RI"],
  ["New GRA", "Port Harcourt", "RI"],
  ["Rumuokoro", "Port Harcourt", "RI"],
  ["Independence Layout", "Enugu", "EN"],
  ["Karsana", "Abuja", "FC"],
];

export const PLACES: readonly Place[] = [
  ...CITIES,
  ...NEIGHBOURHOODS.map((n) => ({ name: n.area, city: n.city, stateCode: n.stateCode, isCity: false })),
  ...CATALOGUE_AREAS.map(([name, city, stateCode]) => ({ name, city, stateCode, isCity: false })),
];

/** How people write a place, to the name on the list. Lower case, dots removed. */
export const INTELLIGENCE_PLACE_ALIASES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(PLACE_ALIASES).map(([k, v]) => [k.replace(/\./g, ""), v])),
  "victoria island": "Victoria Island",
  "lekki phase one": "Lekki Phase 1",
  "lekki phase on": "Lekki Phase 1",
  "lekki phase i": "Lekki Phase 1",
  "lekki phase1": "Lekki Phase 1",
  "lekki ph 1": "Lekki Phase 1",
  "lekki ph1": "Lekki Phase 1",
  "lekki 1": "Lekki Phase 1",
  "lekki phase two": "Lekki Phase 2",
  "lekki phase ii": "Lekki Phase 2",
  "lekki phase2": "Lekki Phase 2",
  "lekki ph 2": "Lekki Phase 2",
  "ikeja g r a": "Ikeja GRA",
  "gra ikeja": "Ikeja GRA",
  "wuse ii": "Wuse 2",
  wuse2: "Wuse 2",
  "wuse zone 2": "Wuse 2",
  ph: "Port Harcourt",
  portharcourt: "Port Harcourt",
  "port-harcourt": "Port Harcourt",
  "port harcourt": "Port Harcourt",
  fct: "Abuja",
  "abuja fct": "Abuja",
  lasgidi: "Lagos",
  "gra phase ii": "GRA Phase 2",
  "gra 2": "GRA Phase 2",
  "banana island": "Banana Island",
};

function byName(name: string): Place | null {
  const lower = name.toLowerCase();
  return PLACES.find((p) => p.name.toLowerCase() === lower) ?? null;
}

/** "Lekki Phase 1, Lagos", or "Lagos" for a city. */
export function placeLabel(place: Place): string {
  return place.isCity ? place.name : `${place.name}, ${place.city}`;
}

/** The place a label (as `placeLabel` wrote it, or a bare name) names, or null. */
export function placeFromLabel(label: string | undefined | null): Place | null {
  if (!label) return null;
  const name = label.split(",")[0]?.trim() ?? "";
  return byName(name) ?? byName(INTELLIGENCE_PLACE_ALIASES[name.toLowerCase()] ?? "");
}

/** The city a place sits in, as a place (for "broaden the place"). */
export function cityOf(place: Place): Place | null {
  return place.isCity ? null : byName(place.city);
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type PlaceHit = { place: Place; start: number; end: number; viaAlias: boolean; written: string };

/**
 * The first place named in folded text (see `foldKey`), longest name first,
 * so "Lekki Phase 1" wins over "Lekki" and "Ikeja GRA" over "Ikeja". Extra
 * aliases (staff-managed) are tried with the built-in ones and may only point
 * at a name on the list.
 */
export function findPlace(folded: string, extraAliases: Readonly<Record<string, string>> = {}): PlaceHit | null {
  const candidates: { written: string; name: string; viaAlias: boolean }[] = [];
  for (const [alias, name] of Object.entries({ ...INTELLIGENCE_PLACE_ALIASES, ...extraAliases })) {
    if (byName(name)) candidates.push({ written: alias.toLowerCase(), name, viaAlias: alias.toLowerCase() !== name.toLowerCase() });
  }
  for (const place of PLACES) candidates.push({ written: place.name.toLowerCase(), name: place.name, viaAlias: false });
  candidates.sort((a, b) => b.written.length - a.written.length);
  for (const c of candidates) {
    const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(c.written)})(?=[^a-z0-9]|$)`);
    const m = re.exec(folded);
    if (!m) continue;
    const place = byName(c.name);
    if (!place) continue;
    const start = m.index + m[1]!.length;
    return { place, start, end: start + c.written.length, viaAlias: c.viaAlias, written: c.written };
  }
  return null;
}

/** Every single word in a place name, for the spelling check's vocabulary. */
export function placeWords(): string[] {
  const words = new Set<string>();
  for (const p of PLACES) for (const w of p.name.toLowerCase().split(/\s+/)) if (w.length >= 4) words.add(w);
  return [...words];
}

/** Places whose name starts with (or contains) the words typed, for suggestions. */
export function placesMatching(prefix: string, limit = 4): Place[] {
  const q = prefix.toLowerCase().trim();
  if (q.length < 2) return [];
  const aliasHit = INTELLIGENCE_PLACE_ALIASES[q];
  const starts: Place[] = [];
  const contains: Place[] = [];
  for (const p of PLACES) {
    const n = p.name.toLowerCase();
    if (aliasHit && p.name === aliasHit) starts.unshift(p);
    else if (n.startsWith(q)) starts.push(p);
    else if (n.includes(` ${q}`)) contains.push(p);
  }
  return [...new Set([...starts, ...contains])].slice(0, limit);
}
