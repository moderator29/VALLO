"use client";

import { REACTION_NAMES, reactionSummary, type ReactionCount, type ReactionEmoji } from "@/lib/messages/reactions";

/**
 * THE LINE UNDER A BUBBLE: WHO REACTED, COUNTED (Platform Grade 1, P1.3).
 *
 * "❤️ 2  👍 1", each emoji once with its count, the reader's own on the brand
 * tint. Each is a button: tapping one you chose takes yours away, tapping one
 * somebody else chose adds the same, the way a chat app lets a reaction be
 * agreed with in one tap. Nothing drawn when nobody has reacted.
 */
export function ReactionCounts({
  counts,
  mine,
  onToggle,
}: {
  counts: ReactionCount[];
  mine: boolean;
  onToggle?: (emoji: ReactionEmoji) => void;
}) {
  if (counts.length === 0) return null;
  return (
    <div
      className={`nf-reactions${mine ? " nf-reactions--mine" : ""}`}
      role="group"
      aria-label={reactionSummary(counts)}
      data-testid="reaction-counts"
    >
      {counts.map((c) => (
        <button
          key={c.emoji}
          type="button"
          className="nf-reactions__chip"
          data-mine={c.mine || undefined}
          aria-pressed={c.mine}
          aria-label={`${REACTION_NAMES[c.emoji]} ${c.count}${c.mine ? ", yours. Tap to remove it" : ". Tap to add yours"}`}
          disabled={!onToggle}
          onClick={() => onToggle?.(c.emoji)}
        >
          <span aria-hidden="true">{c.emoji}</span>
          <span className="nf-reactions__count nf-numeric" aria-hidden="true">
            {c.count}
          </span>
        </button>
      ))}
    </div>
  );
}
