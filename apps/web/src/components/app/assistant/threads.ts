/**
 * Assistant conversation model and persistence.
 *
 * Conversations live on the device under `nf_ai_threads` as an array of
 * threads, newest activity first when rendered. Each thread takes its title
 * from the first user message so the history list reads like a table of
 * contents. The original single-thread key `nf_ai_thread` is migrated into
 * the array on first load so nobody loses an existing conversation.
 */

import type { AssistantListingItem, AssistantStreamEvent } from "@/lib/assistant/types";

export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  text: string;
  /** Real catalogue results streamed alongside this assistant turn. */
  listings?: AssistantListingItem[];
  /**
   * Interactive blocks (cards with buttons, times, summaries, a payment to
   * review) for this turn. In memory only: they hold money figures and offers
   * that were true at one moment, so `saveThreads` never writes them down.
   */
  blocks?: Extract<AssistantStreamEvent, { type: "cards" | "actions" | "slots" | "summary" | "payment_review" | "photos" }>[];
  /** The turn failed and the bubble should offer a retry. */
  error?: boolean;
  /** The person stopped this answer (or sent again) while it streamed. What arrived is kept. */
  stopped?: boolean;
  /**
   * When the turn was sent or first arrived, epoch milliseconds. The
   * governing render stamps every bubble with its time; a message stored
   * before this field existed has none and is simply drawn without one.
   */
  at?: number;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  /** The persisted ai_conversations id, once the server returns one. */
  serverId?: string;
};

export const THREADS_KEY = "nf_ai_threads";
const LEGACY_KEY = "nf_ai_thread";

const TITLE_LIMIT = 48;

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** First user message, trimmed to a listable length. */
export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= TITLE_LIMIT) return clean || "New chat";
  return `${clean.slice(0, TITLE_LIMIT - 1).trimEnd()}…`;
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Message;
  return (
    typeof m.id === "string" &&
    typeof m.text === "string" &&
    (m.role === "user" || m.role === "assistant")
  );
}

function isThread(value: unknown): value is Thread {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Thread;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.createdAt === "number" &&
    typeof t.updatedAt === "number" &&
    Array.isArray(t.messages) &&
    t.messages.every(isMessage)
  );
}

/** Read every stored thread, folding in the legacy single-thread key once. */
export function loadThreads(): Thread[] {
  let threads: Thread[] = [];
  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) threads = parsed.filter(isThread);
    }
  } catch {
    threads = [];
  }

  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const parsed: unknown = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        const messages = parsed.filter(isMessage);
        if (messages.length > 0) {
          const now = Date.now();
          const firstUser = messages.find((m) => m.role === "user");
          threads = [
            {
              id: makeId(),
              title: deriveTitle(firstUser ? firstUser.text : "New chat"),
              createdAt: now,
              updatedAt: now,
              messages,
            },
            ...threads,
          ];
        }
      }
      window.localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* A malformed legacy value is simply left behind. */
  }

  return threads;
}

export function saveThreads(threads: Thread[]): void {
  try {
    /* Blocks carry figures and offers; they stay in memory (see Message.blocks). */
    const slim = threads.map((t) => ({ ...t, messages: t.messages.map(({ blocks: _blocks, ...m }) => m) }));
    window.localStorage.setItem(THREADS_KEY, JSON.stringify(slim));
  } catch {
    /* Storage full or blocked: the conversations simply live in memory. */
  }
}

export function clearStoredThreads(): void {
  try {
    window.localStorage.removeItem(THREADS_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* Nothing to recover from: state is already cleared. */
  }
}
