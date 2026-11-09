/**
 * TALK TO A PERSON, FROM INSIDE THE ASSISTANT (Platform Grade 1, P1.4; R70).
 *
 * The member asked Vallo AI something and wants a person instead. What they
 * were asking travels with them, so nobody has to repeat themselves: the
 * assistant writes it here as they tap "Talk to a person", and the inner page
 * (`/assistant/person`) reads it back and files it with the support ticket
 * through the existing support API (`fileSupportTicket`: the question as the
 * ticket's body, the whole exchange as its opening message, `chatTranscript`).
 *
 * It lives in this tab's session storage only: it is the member's own words,
 * it never leaves the device until they press Send, and it goes stale after
 * half an hour, so an old question is never filed by surprise.
 */

import { chatTranscript } from "@/lib/support/new-query";

export const HANDOFF_KEY = "nf_ai_handoff";
const STALE_MS = 30 * 60 * 1000;

export type Handoff = {
  /** What the member was asking: their unsent words, else their last question. */
  question: string;
  /** The whole exchange, labelled and capped, for the person who picks it up. */
  transcript: string;
  at: number;
};

type Turn = { role: "user" | "assistant"; text: string };

/** From the open conversation and the unsent draft. Null when nothing has been asked. */
export function buildHandoff(turns: readonly Turn[], draft: string, now = Date.now()): Handoff | null {
  const unsent = draft.trim();
  const said = turns.filter((t) => t.text.trim().length > 0);
  const lastQuestion = [...said].reverse().find((t) => t.role === "user")?.text.trim() ?? "";
  const question = (unsent || lastQuestion).slice(0, 4000);
  if (!question && said.length === 0) return null;
  const all = unsent ? [...said, { role: "user" as const, text: unsent }] : said;
  return {
    question,
    transcript: chatTranscript(all).replace(
      "Conversation with the AI helper before this ticket:",
      "Conversation with Vallo AI before this ticket:",
    ),
    at: now,
  };
}

export function saveHandoff(handoff: Handoff | null): void {
  try {
    if (handoff) window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    else window.sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* Storage blocked: the page still opens, with an empty question. */
  }
}

export function readHandoff(now = Date.now()): Handoff | null {
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Handoff>;
    if (typeof parsed.question !== "string" || typeof parsed.transcript !== "string" || typeof parsed.at !== "number") {
      return null;
    }
    if (now - parsed.at > STALE_MS) return null;
    return { question: parsed.question, transcript: parsed.transcript, at: parsed.at };
  } catch {
    return null;
  }
}

export function clearHandoff(): void {
  saveHandoff(null);
}
