

import { countOf } from "@vallo/i18n/core";

/**
 * @vallo in the replies: the shapes, the words and the arithmetic.
 *
 * Client safe on purpose and it imports nothing but zod. A card has to be able
 * to recognise the bot's name in a body of text, and a server action has to be
 * able to price a call, and neither of those should drag `server-only` into a
 * browser bundle. This codebase has already paid for that mistake once: a
 * constant imported from a `"use client"` module into a server component
 * typechecks perfectly and throws at runtime.
 */

/**
 * The assistant's name, and it is not a person.
 *
 * `private.validate_social_handle` refuses any handle containing `vallo`, so
 * nobody can ever hold this one and `/u/vallo` is not somewhere to send
 * anybody. The card renders it as a mark rather than as a link for exactly that
 * reason.
 */
export const BOT_HANDLE = "vallo";

/** Does this body summon the assistant? Same rule the renderer highlights. */
export function mentionsBot(body: string): boolean {
  return new RegExp(`(^|[^\\w@])@${BOT_HANDLE}\\b`, "i").test(body ?? "");
}

/**
 * What a call costs, in integer kobo, and why it is a constant rather than a
 * guess made at the call site.
 *
 * `public.bot_invocations.cost_minor` is what `private.bot_may_run` sums against
 * the monthly and daily ceilings. **If this ever returns zero the ceilings stop
 * existing**, which is the same defect as a feature flag nothing reads, so this
 * is load bearing rather than bookkeeping.
 *
 * The default is the published price of the model in `bot_settings.model`,
 * one US dollar per million input tokens and five per million output, carried
 * into kobo at sixteen hundred naira to the dollar. Both numbers are overridable
 * by environment, because the second one moves and the platform's rule is that
 * the owner sets keys and figures rather than an engineer inventing them.
 *
 * **Nobody is ever shown this number.** It is an internal spend ledger for a
 * ceiling, not a price, and the platform charges nothing for anything. The exact
 * token counts are recorded beside it, so the true cost stays recomputable at
 * any rate, whatever this constant happened to be on the day.
 */
const DEFAULT_INPUT_KOBO_PER_MTOK = 160_000;

const DEFAULT_OUTPUT_KOBO_PER_MTOK = 800_000;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : fallback;
}

/** Integer kobo. Rounded up, so a ceiling is never undercounted. */
export function costMinorFor(inputTokens: number, outputTokens: number): number {
  const perInput = envInt("BOT_INPUT_KOBO_PER_MTOK", DEFAULT_INPUT_KOBO_PER_MTOK);
  const perOutput = envInt("BOT_OUTPUT_KOBO_PER_MTOK", DEFAULT_OUTPUT_KOBO_PER_MTOK);
  const input = Math.max(0, Math.round(inputTokens));
  const output = Math.max(0, Math.round(outputTokens));
  return Math.ceil((input * perInput) / 1_000_000) + Math.ceil((output * perOutput) / 1_000_000);
}

/* ------------------------------------------------------------------ words */

/**
 * What the assistant says when it cannot answer, in its own voice.
 *
 * Every one of these is posted as a real reply rather than swallowed, because a
 * summon that answers once and then goes quiet reads as a broken product where a
 * summon that says "not today" reads as a paused one. They are short, they never
 * blame the person, and not one of them mentions a ceiling in naira: what the
 * platform spends on its own assistant is nobody's business but the platform's.
 *
 * The keys are the exact strings `private.bot_may_run` returns, so a new reason
 * added to that function shows up here as a missing key at compile time rather
 * than as a silent fallback in production.
 */
export const BOT_REFUSALS: Record<"off" | "month" | "day" | "person", string> = {
  off: "I am not answering in places just yet. Ask the people around here, they will know better than me anyway.",
  month:
    "I have done all the answering I can do this month. I will be back at the start of the next one.",
  day: "I have answered as much as I can today. Try me again tomorrow morning.",
  person:
    "You have asked me a fair few times today already. Give it until tomorrow and I will pick it up again.",
};

/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
import { getDictionary } from "@vallo/i18n";
export const BOT_COPY = getDictionary("en").social.bot;

/**
 * The one line under a bot reply that says where the answer came from.
 *
 * `SOCIAL_DESIGN.md` section 10: every factual claim carries its source. A
 * concierge that cites its rows is the only kind that belongs in a trust
 * product, and it is also the cheapest way to keep it honest, because a claim
 * with no source is visibly a claim with no source.
 */
export function sourceNote(listings: number, areaName: string | null): string {
  const place = areaName ? ` around ${areaName}` : "";
  if (listings === 0) return `Answered from what is published on Vallo${place}. No listings cited.`;
  return countOf(listings, "listingsCited").replace("{place}", place);
}
