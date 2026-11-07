import { VOICE_BODY } from "@/lib/messages/voice-note";
import type { BadgeTier } from "@/lib/trust/badge-tier";

/**
 * FORWARD, THE CHOOSER'S RULES (founder, 11 October 2026). Pure, so it is
 * tested rather than trusted.
 *
 * Forward sends a message's words into another of the reader's conversations,
 * through `forward_message` (migration 20261011142309), which holds every rule
 * that matters: the reader must be in both conversations, must follow the
 * person on the other side, and neither may have blocked the other. The
 * chooser only offers what that function would take, so a refusal is rare and,
 * when it comes, it is the database's own sentence.
 *
 *   WHAT CAN BE FORWARDED: a sent message with words. Not a photo (the
 *   function refuses one: "photos cannot be forwarded yet"), not a voice note
 *   or a file, not a card, not a call, not a message deleted for everyone, and
 *   not a bubble still on its way.
 *
 *   WHERE IT CAN GO: the reader's conversations whose other side they follow,
 *   read from the inbox's own summaries (the follow comes from `public.follows`
 *   through `readViewerFollowing`), never the conversation it came from.
 */

export type ForwardTarget = {
  /** The conversation the message would land in. */
  id: string;
  name: string;
  /** What that conversation is about (a listing or a venue), or null. */
  title: string | null;
  avatarUrl: string | null;
  tier: BadgeTier;
  kind: "agent" | "member";
};

/** The fields of an inbox summary the chooser reads. */
export type ForwardSource = {
  id: string;
  counterpartName: string;
  listingTitle: string | null;
  counterpartTier: BadgeTier;
  counterpartKind: "agent" | "member";
  counterpartAvatarUrl?: string | null;
  viewerFollows?: boolean;
};

export function forwardTargetsFrom(rows: readonly ForwardSource[], fromConversationId: string | null): ForwardTarget[] {
  return rows
    .filter((row) => row.viewerFollows === true && row.id !== fromConversationId)
    .map((row) => ({
      id: row.id,
      name: row.counterpartName,
      title: row.listingTitle,
      avatarUrl: row.counterpartAvatarUrl ?? null,
      tier: row.counterpartTier,
      kind: row.counterpartKind,
    }));
}

/** The search field: a name or the thing the chat is about, any case. */
export function matchTargets(targets: readonly ForwardTarget[], query: string): ForwardTarget[] {
  const q = query.trim().toLocaleLowerCase();
  if (q.length === 0) return [...targets];
  return targets.filter((t) => `${t.name} ${t.title ?? ""}`.toLocaleLowerCase().includes(q));
}

export type ForwardableMessage = {
  id: string;
  body: string;
  imageUrl: string | null;
  state?: "sending" | "failed" | "waiting";
  deleted?: boolean;
  audio?: unknown;
  file?: unknown;
  card?: unknown;
  call?: unknown;
};

/** Words, sent, and nothing else riding on it. */
const PHOTO_PLACEHOLDER = "\u{1F4F7} Photo";

export function canForward(m: ForwardableMessage): boolean {
  if (m.id.startsWith("local-") || m.state !== undefined) return false;
  if (m.deleted || m.imageUrl !== null || m.audio || m.file || m.card || m.call) return false;
  /* A photo or a voice note that arrived live, before its attachment was read,
     is still its placeholder words: never forwarded as if they were the note. */
  if (m.body === PHOTO_PLACEHOLDER || m.body === VOICE_BODY) return false;
  return m.body.trim().length > 0;
}

/** The database's refusal, said as a sentence: a capital first letter and a full stop. */
export function asSentence(text: string): string {
  const t = text.trim();
  if (t.length === 0) return t;
  const head = t.charAt(0).toLocaleUpperCase() + t.slice(1);
  return /[.!?]$/.test(head) ? head : `${head}.`;
}
