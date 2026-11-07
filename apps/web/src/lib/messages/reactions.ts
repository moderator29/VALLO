/**
 * REACTIONS: THE MODEL (Platform Grade 1, P1.3; reference R62).
 *
 * One reaction per person per message, from a fixed set of eight. Choosing a
 * new one replaces the old; choosing the same one again takes it away. This
 * file is pure, shared by the thread (the optimistic state and the realtime
 * merge) and the server action (the allowed set), and tested on its own.
 *
 * The set matches the database check in
 * `grade1_voice_notes_and_message_reactions.sql` character for character, the
 * heart included with its variation selector.
 */

export const REACTION_EMOJI = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
  "\u{1F525}",
  "\u{1F389}",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

/** What a screen reader hears for each choice. */
export const REACTION_NAMES: Record<ReactionEmoji, string> = {
  "\u{1F44D}": "Thumbs up",
  "\u{2764}\u{FE0F}": "Heart",
  "\u{1F602}": "Laughing",
  "\u{1F62E}": "Surprised",
  "\u{1F622}": "Sad",
  "\u{1F64F}": "Thank you",
  "\u{1F525}": "Fire",
  "\u{1F389}": "Celebrate",
};

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && (REACTION_EMOJI as readonly string[]).includes(value);
}

/** One person's reaction on one message. */
export type Reaction = { messageId: string; userId: string; emoji: ReactionEmoji };

/** Every reaction in a thread, by message: `userId` to the emoji they chose. */
export type ReactionMap = Record<string, Record<string, ReactionEmoji>>;

/** Rows as the database returns them, into the map. Unknown emoji are dropped. */
export function reactionMapFrom(rows: readonly { message_id: string; user_id: string; emoji: string }[]): ReactionMap {
  const map: ReactionMap = {};
  for (const row of rows) {
    if (!isReactionEmoji(row.emoji)) continue;
    (map[row.message_id] ??= {})[row.user_id] = row.emoji;
  }
  return map;
}

/** Sets (or, with null, removes) one person's reaction, returning a new map. */
export function withReaction(map: ReactionMap, messageId: string, userId: string, emoji: ReactionEmoji | null): ReactionMap {
  const current = { ...(map[messageId] ?? {}) };
  if (emoji) current[userId] = emoji;
  else delete current[userId];
  const next = { ...map };
  if (Object.keys(current).length === 0) delete next[messageId];
  else next[messageId] = current;
  return next;
}

/**
 * What a tap on `emoji` does to my reaction: the same one again removes it,
 * any other sets it. Returns the emoji to store, or null to clear.
 */
export function toggleTarget(mine: ReactionEmoji | undefined, emoji: ReactionEmoji): ReactionEmoji | null {
  return mine === emoji ? null : emoji;
}

export type ReactionCount = { emoji: ReactionEmoji; count: number; mine: boolean };

/**
 * The compact line under a bubble: each emoji once with its count, in the
 * set's own order so the line does not reshuffle as people react, and mine
 * marked so it can be drawn highlighted.
 */
export function reactionCounts(byUser: Record<string, ReactionEmoji> | undefined, meId: string | null): ReactionCount[] {
  if (!byUser) return [];
  const counts = new Map<ReactionEmoji, ReactionCount>();
  for (const [userId, emoji] of Object.entries(byUser)) {
    const entry = counts.get(emoji) ?? { emoji, count: 0, mine: false };
    entry.count += 1;
    if (meId && userId === meId) entry.mine = true;
    counts.set(emoji, entry);
  }
  return REACTION_EMOJI.flatMap((emoji) => {
    const entry = counts.get(emoji);
    return entry ? [entry] : [];
  });
}

/** The words for the line, for a screen reader: "Heart 2, Thumbs up 1, including yours". */
export function reactionSummary(counts: readonly ReactionCount[]): string {
  const parts = counts.map((c) => `${REACTION_NAMES[c.emoji]} ${c.count}`);
  const mine = counts.some((c) => c.mine);
  return `Reactions: ${parts.join(", ")}${mine ? ", including yours" : ""}`;
}

/**
 * A realtime change on `message_reactions`, applied to the map. An INSERT or
 * UPDATE carries the new row; a DELETE carries the old one (the table has
 * `replica identity full`, so the old row is whole).
 */
export function applyReactionChange(
  map: ReactionMap,
  change: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new?: { message_id?: unknown; user_id?: unknown; emoji?: unknown } | null;
    old?: { message_id?: unknown; user_id?: unknown } | null;
  },
): ReactionMap {
  if (change.eventType === "DELETE") {
    const old = change.old;
    if (typeof old?.message_id !== "string" || typeof old.user_id !== "string") return map;
    return withReaction(map, old.message_id, old.user_id, null);
  }
  const row = change.new;
  if (typeof row?.message_id !== "string" || typeof row.user_id !== "string" || !isReactionEmoji(row.emoji)) return map;
  return withReaction(map, row.message_id, row.user_id, row.emoji);
}
