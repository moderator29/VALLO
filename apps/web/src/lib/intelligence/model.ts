import { z } from "zod";
import { INTELLIGENCE_KINDS, type Understood } from "./contract";
import { placeFromLabel, placeLabel } from "./places";
import { cleanQuery, foldKey } from "./text";
import type { ReadingHints } from "./understand";

/**
 * VALLO INTELLIGENCE: THE OPTIONAL MODEL STEP.
 *
 * When the rules leave a long, plain-language query mostly unread ("somewhere
 * quiet for my mum near her church in surulere, nothing too dear"), a small
 * fast model is asked to turn the words into a PATCH of the same `Understood`
 * filters, or into one clarifying question with tap answers. It never writes
 * results or prose: the rows still come from the database.
 *
 * GATED, IN THIS ORDER (`shouldAskModel`, then `askModel`):
 *   - only on submit, never on a keystroke (the suggest route never calls it);
 *   - only when the rules read under 40% of six or more words and found no kind;
 *   - VALLO_INTELLIGENCE_MODEL=off turns it off; so does a missing ANTHROPIC_API_KEY;
 *   - the caller has already checked the assistant switch, AI consent and the
 *     rate limit (the route does that: `lib/intelligence/engine.ts`);
 *   - 2.5 seconds, then the rules' answer stands, silently;
 *   - an in-memory LRU keyed by the normalised words, so a repeated query
 *     costs nothing.
 *
 * ONLY THE WORDS ARE SENT. No id, no session, no place the person lives, no
 * history. The answer is validated with zod and then checked again: a place
 * must be on the closed list, an amenity must be a code the schema holds, a
 * date must be a real ISO date not in the past.
 *
 * Same API and key as the member assistant (`app/api/assistant/route.ts`),
 * over fetch like it; a smaller model by default (`VALLO_INTELLIGENCE_MODEL_ID`
 * overrides it).
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-5-5";
export const MODEL_TIMEOUT_MS = 2_500;

const AMENITY_CODES = ["ac", "balcony", "elevator", "garden", "generator", "gym", "kitchen", "laundry", "parking", "pool", "security", "tv", "water", "wifi", "workspace"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const patchSchema = z
  .object({
    kind: z.enum(INTELLIGENCE_KINDS).optional(),
    intent: z.enum(["rent", "buy", "stay"]).optional(),
    place: z.string().max(60).optional(),
    bedrooms: z.number().int().min(1).max(20).optional(),
    maxPrice: z.number().int().min(1).max(100_000_000_000).optional(),
    minPrice: z.number().int().min(1).max(100_000_000_000).optional(),
    furnished: z.boolean().optional(),
    amenities: z.array(z.enum(AMENITY_CODES)).max(8).optional(),
    checkIn: z.string().regex(ISO_DATE).optional(),
    checkOut: z.string().regex(ISO_DATE).optional(),
    guests: z.number().int().min(1).max(30).optional(),
    listingKinds: z.array(z.enum(["hotel", "apartment", "home", "shortlet", "villa", "restaurant", "rental", "shop", "office", "land"])).max(4).optional(),
    text: z.string().max(80).optional(),
  })
  .strict();

const answerSchema = z.union([
  z.object({ patch: patchSchema }).strict(),
  z
    .object({
      clarify: z
        .object({
          question: z.string().min(5).max(140),
          options: z.array(z.object({ label: z.string().min(1).max(40), patch: patchSchema }).strict()).min(2).max(4),
        })
        .strict(),
    })
    .strict(),
]);

export type ModelPatch = z.infer<typeof patchSchema>;
export type ModelAnswer = { patch: Partial<Understood> } | { clarify: NonNullable<Understood["clarify"]> };

const SYSTEM = [
  "You read one search typed into Vallo, a Nigerian app for homes to rent or buy, short stays and hotels, restaurants, roommates, people and communities.",
  "Reply with one JSON object and nothing else.",
  'Either {"patch": {...}} with only the filters the words clearly state, or {"clarify": {"question": "...", "options": [{"label": "...", "patch": {...}}]}} when the words could mean two different searches.',
  "Patch fields, all optional: kind (property, stay, restaurant, roommate, person, community, post, screen, guide), intent (rent, buy, stay), place (a Nigerian area or city, as written), bedrooms (integer), maxPrice and minPrice (whole naira), furnished (boolean), amenities (only: ac, balcony, elevator, garden, generator, gym, kitchen, laundry, parking, pool, security, tv, water, wifi, workspace), checkIn and checkOut (YYYY-MM-DD), guests (integer), listingKinds (hotel, apartment, home, shortlet, villa, restaurant, rental, shop, office, land), text (a few words to match against titles).",
  "Never guess a number, a date or a place the words do not state. Leave a field out rather than guess.",
].join(" ");

/* ------------------------------------------------------------------ cache */

const CACHE_MAX = 300;
const CACHE_TTL_MS = 60 * 60_000;
const cache = new Map<string, { at: number; answer: ModelAnswer | null }>();

export function modelCacheKey(query: string): string {
  return foldKey(cleanQuery(query));
}

function cached(key: string, now: number): { hit: boolean; answer: ModelAnswer | null } {
  const entry = cache.get(key);
  if (!entry) return { hit: false, answer: null };
  if (now - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return { hit: false, answer: null };
  }
  /* Least recently used: a hit moves to the back of the line. */
  cache.delete(key);
  cache.set(key, entry);
  return { hit: true, answer: entry.answer };
}

function keep(key: string, answer: ModelAnswer | null, now: number): void {
  cache.set(key, { at: now, answer });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function clearModelCache(): void {
  cache.clear();
}

/* ------------------------------------------------------------------ gate */

export function modelSwitchedOff(env: Record<string, string | undefined> = process.env): boolean {
  return /^(off|0|false|no)$/i.test((env.VALLO_INTELLIGENCE_MODEL ?? "").trim()) || !(env.ANTHROPIC_API_KEY ?? "").trim();
}

/** Do the rules leave enough of a long query unread to be worth asking? */
export function shouldAskModel(understood: Understood, hints: ReadingHints): boolean {
  if (hints.wordCount < 6) return false;
  if (understood.kind) return false;
  return hints.readShare < 0.4;
}

/* ------------------------------------------------------------------ validate */

/** A model patch, checked against what the platform actually holds. */
export function cleanPatch(patch: ModelPatch, today: string): Partial<Understood> {
  const out: Partial<Understood> = {};
  if (patch.kind && patch.kind !== "personal") out.kind = patch.kind;
  if (patch.intent) out.intent = patch.intent;
  if (patch.place) {
    const place = placeFromLabel(patch.place);
    if (place) out.place = placeLabel(place);
  }
  if (patch.bedrooms !== undefined) out.bedrooms = patch.bedrooms;
  if (patch.maxPrice !== undefined) out.maxPrice = patch.maxPrice;
  if (patch.minPrice !== undefined && (out.maxPrice === undefined || patch.minPrice <= out.maxPrice)) out.minPrice = patch.minPrice;
  if (patch.furnished !== undefined) out.furnished = patch.furnished;
  if (patch.amenities && patch.amenities.length > 0) out.amenities = [...new Set(patch.amenities)];
  if (patch.checkIn && patch.checkOut && patch.checkIn >= today && patch.checkOut > patch.checkIn) {
    out.checkIn = patch.checkIn;
    out.checkOut = patch.checkOut;
  }
  if (patch.guests !== undefined) out.guests = patch.guests;
  if (patch.listingKinds && patch.listingKinds.length > 0) out.listingKinds = [...new Set(patch.listingKinds)];
  if (patch.text) {
    const text = foldKey(patch.text);
    if (text) out.text = text;
  }
  return out;
}

/** Parse what the model said; null for anything that is not exactly the shape. */
export function parseModelAnswer(raw: string, today: string): ModelAnswer | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = answerSchema.safeParse(json);
  if (!parsed.success) return null;
  if ("patch" in parsed.data) {
    const patch = cleanPatch(parsed.data.patch, today);
    return Object.keys(patch).length > 0 ? { patch } : null;
  }
  const options = parsed.data.clarify.options
    .map((o) => ({ label: cleanQuery(o.label), patch: cleanPatch(o.patch, today) }))
    .filter((o) => o.label && Object.keys(o.patch).length > 0);
  if (options.length < 2) return null;
  return { clarify: { question: cleanQuery(parsed.data.clarify.question), options } };
}

/* ------------------------------------------------------------------ ask */

export type AskDeps = {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  now?: number;
  timeoutMs?: number;
};

/**
 * The model's patch for these words, or null. Never throws, never waits more
 * than the timeout, and caches what the API answered (an empty answer too, so
 * it is not asked again within the hour; a timeout or an error is not kept).
 */
export async function askModel(query: string, today: string, deps: AskDeps = {}): Promise<ModelAnswer | null> {
  const env = deps.env ?? process.env;
  if (modelSwitchedOff(env)) return null;
  const now = deps.now ?? Date.now();
  const key = modelCacheKey(query);
  if (!key) return null;
  const hit = cached(key, now);
  if (hit.hit) return hit.answer;

  let answer: ModelAnswer | null = null;
  /* Only an answer the API actually gave is kept; a timeout or a 5xx is not. */
  let definitive = false;
  try {
    const res = await (deps.fetch ?? fetch)(ANTHROPIC_URL, {
      method: "POST",
      signal: AbortSignal.timeout(deps.timeoutMs ?? MODEL_TIMEOUT_MS),
      headers: {
        "x-api-key": (env.ANTHROPIC_API_KEY ?? "").trim(),
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: (env.VALLO_INTELLIGENCE_MODEL_ID ?? "").trim() || DEFAULT_MODEL,
        max_tokens: 400,
        thinking: { type: "disabled" },
        system: `${SYSTEM} Today in Lagos is ${today}.`,
        messages: [{ role: "user", content: cleanQuery(query) }],
      }),
    });
    if (res.ok) {
      definitive = true;
      const body = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
      if (body.stop_reason !== "refusal") {
        const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
        answer = parseModelAnswer(text, today);
      }
    }
  } catch {
    answer = null;
  }
  if (definitive) keep(key, answer, now);
  return answer;
}

/** The rules' reading with the model's patch on top, marked as read by the model. */
export function applyModelAnswer(understood: Understood, answer: ModelAnswer | null): Understood {
  if (!answer) return understood;
  if ("clarify" in answer) return { ...understood, clarify: answer.clarify, via: "model" };
  const next: Understood = { ...understood, ...answer.patch, via: "model" };
  if (answer.patch.text === undefined && understood.text && Object.keys(answer.patch).length > 0) {
    /* The words the model turned into filters are no longer searched as text. */
    delete next.text;
  }
  return next;
}
