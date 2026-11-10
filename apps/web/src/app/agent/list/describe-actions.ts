"use server";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { resolveSession, SIGNED_OUT_MESSAGE } from "@/lib/actions/session";
import { hasAiConsent } from "@/lib/ai/consent-server";
import { MAX_TITLE_LENGTH } from "@/lib/agent/listings-model";
import { consume, subjectForUser } from "@/lib/security/rate-limit";

/**
 * "WRITE WITH AI" ON THE LISTING WIZARD'S FINISH STEP (P1.1, R18.11, R35).
 *
 * The fence, in the order it is checked:
 *
 *   1. SIGNED IN, and the account has agreed to the AI disclosure (STORE-07,
 *      `hasAiConsent`, the record `recordAiConsent` writes). The screen asks
 *      first; this refuses whatever the screen did.
 *   2. CONFIGURED: `ANTHROPIC_API_KEY` is set and `ASSISTANT_MODEL` names the
 *      model (no model name is written in this repository). Without both the
 *      answer is "unavailable", and the screen offers the writer that needs no
 *      AI ("Rewrite from my answers").
 *   3. ONLY THE ANSWERS THE DISCLOSURE NAMES ARE SENT: the type, area, city
 *      and state, the rooms, light and water, amenities, and the lister's own
 *      title and description. Never the street address, the landmark, the gate
 *      details, a phone number or a price: the input type below has no field
 *      for any of them, and every string is clamped.
 *   4. THE ANSWER IS A PROPOSAL. It comes back as text the lister reads and
 *      edits, with Undo on the screen; nothing is saved until they move on.
 *
 * Fifteen seconds, one call, no retries. Any failure is a plain refusal and
 * nothing on the screen changes.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_DESCRIPTION = 4000;

export type AiListingInput = {
  market: "stay" | "rent" | "sale";
  propertyType: string;
  area: string;
  city: string;
  state: string;
  bedrooms: number | null;
  bathrooms: number | null;
  toilets: number | null;
  sizeSqm: string;
  furnishing: string;
  condition: string;
  power: string;
  backup: string;
  water: string;
  amenities: string[];
  title: string;
  description: string;
};

export type AiListingAnswer =
  | { kind: "written"; title: string; description: string }
  | { kind: "consent" }
  | { kind: "unavailable" };

const clip = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 50 ? Math.trunc(value) : null;

/** Only the named fields, each clamped, whatever the client sent. */
function fenced(input: AiListingInput): AiListingInput {
  const market = input.market === "sale" || input.market === "rent" ? input.market : "stay";
  return {
    market,
    propertyType: clip(input.propertyType, 40),
    area: clip(input.area, 80),
    city: clip(input.city, 80),
    state: clip(input.state, 40),
    bedrooms: count(input.bedrooms),
    bathrooms: count(input.bathrooms),
    toilets: count(input.toilets),
    sizeSqm: clip(input.sizeSqm, 12),
    furnishing: clip(input.furnishing, 40),
    condition: clip(input.condition, 40),
    power: clip(input.power, 80),
    backup: clip(input.backup, 80),
    water: clip(input.water, 80),
    amenities: Array.isArray(input.amenities) ? input.amenities.slice(0, 30).map((a) => clip(a, 40)).filter(Boolean) : [],
    title: clip(input.title, MAX_TITLE_LENGTH),
    description: clip(input.description, MAX_DESCRIPTION),
  };
}

/** Plain text the listing can carry: no markup, no long dashes, collapsed spaces in the title. */
function tidy(text: string, max: number, oneLine: boolean): string {
  let out = text.replace(/[<>]/g, "").replace(/\u2014|\u2013/g, ", ");
  out = oneLine ? out.replace(/\s+/g, " ") : out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return out.trim().slice(0, max).trim();
}

/** At most 10 AI listing writes per person per day (founder, 7 November 2026). */
const AI_LISTING_BUCKET = { bucket: "ai_listing_write", limit: 10, windowSeconds: 86_400 } as const;

export async function writeListingWithAi(raw: AiListingInput): Promise<ActionResult<AiListingAnswer>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  if (!(await hasAiConsent({ supabase: session.supabase, userId: session.user.id }))) return ok({ kind: "consent" });

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const model = (process.env.ASSISTANT_MODEL ?? "").trim();
  if (!apiKey || !model) return ok({ kind: "unavailable" });

  /* The founder's ruling (7 November 2026): the AI listing description, at most
     10 per person per day. Counted only when a write would really run. A
     broken limiter lets the write through (degraded): nothing here costs a
     member money, and the cap is a cost guard, not a safety gate. */
  const verdict = await consume({
    bucket: AI_LISTING_BUCKET.bucket,
    subject: subjectForUser(session.user.id),
    limit: AI_LISTING_BUCKET.limit,
    windowSeconds: AI_LISTING_BUCKET.windowSeconds,
  });
  if (!verdict.allowed) {
    return fail("You have used today's 10 AI writes. Nothing changed. Rewrite from your answers, or try the AI again tomorrow.");
  }

  const input = fenced(raw);
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system:
          "You write a property listing for Vallo, a Nigerian marketplace. Use only the facts given. Never invent a feature, a distance, a price, a landmark or a street. Plain British English, warm and specific, no hype words, no emoji, no long dashes. The title names the place and what makes it good, under 80 characters, with no street address. The description is 60 to 140 words in short paragraphs. If the lister's own text is given, keep their facts and voice and improve it.",
        tools: [
          {
            name: "write_listing",
            description: "The listing's title and description.",
            input_schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "description"],
              properties: {
                title: { type: "string", maxLength: MAX_TITLE_LENGTH },
                description: { type: "string", maxLength: MAX_DESCRIPTION },
              },
            },
          },
        ],
        tool_choice: { type: "tool", name: "write_listing" },
        messages: [{ role: "user", content: JSON.stringify(input) }],
      }),
    });
    if (!response.ok) return fail("The AI writer did not answer. Nothing changed. Try again, or rewrite from your answers.");
    const body = (await response.json()) as { content?: { type?: string; input?: { title?: unknown; description?: unknown } }[] };
    const call = body.content?.find((part) => part.type === "tool_use")?.input;
    const title = tidy(typeof call?.title === "string" ? call.title : "", MAX_TITLE_LENGTH, true);
    const description = tidy(typeof call?.description === "string" ? call.description : "", MAX_DESCRIPTION, false);
    if (!title || !description) return fail("The AI writer did not answer. Nothing changed. Try again, or rewrite from your answers.");
    return ok({ kind: "written", title, description });
  } catch {
    return fail("The AI writer did not answer. Nothing changed. Try again, or rewrite from your answers.");
  }
}
