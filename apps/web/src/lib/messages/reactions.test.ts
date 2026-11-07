import { describe, expect, it } from "vitest";
import {
  REACTION_EMOJI,
  applyReactionChange,
  isReactionEmoji,
  reactionCounts,
  reactionMapFrom,
  reactionSummary,
  toggleTarget,
  withReaction,
} from "./reactions";

const HEART = "\u{2764}\u{FE0F}";
const THUMBS = "\u{1F44D}";

describe("reactions", () => {
  it("is the eight of the database check, the heart with its variation selector", () => {
    expect(REACTION_EMOJI).toHaveLength(8);
    expect(isReactionEmoji(HEART)).toBe(true);
    expect(isReactionEmoji("\u{2764}")).toBe(false);
    expect(isReactionEmoji("hello")).toBe(false);
  });

  it("toggles: the same again takes it away, another replaces it", () => {
    expect(toggleTarget(undefined, HEART)).toBe(HEART);
    expect(toggleTarget(HEART, HEART)).toBeNull();
    expect(toggleTarget(HEART, THUMBS)).toBe(THUMBS);
  });

  it("keeps one reaction per person and drops a message nobody reacts to", () => {
    let map = withReaction({}, "m1", "me", HEART);
    map = withReaction(map, "m1", "me", THUMBS);
    expect(map).toEqual({ m1: { me: THUMBS } });
    expect(withReaction(map, "m1", "me", null)).toEqual({});
  });

  it("counts in the set's own order and marks mine", () => {
    const map = reactionMapFrom([
      { message_id: "m1", user_id: "a", emoji: HEART },
      { message_id: "m1", user_id: "b", emoji: HEART },
      { message_id: "m1", user_id: "me", emoji: THUMBS },
      { message_id: "m1", user_id: "c", emoji: "nope" },
    ]);
    const counts = reactionCounts(map.m1, "me");
    expect(counts).toEqual([
      { emoji: THUMBS, count: 1, mine: true },
      { emoji: HEART, count: 2, mine: false },
    ]);
    expect(reactionSummary(counts)).toBe("Reactions: Thumbs up 1, Heart 2, including yours");
    expect(reactionCounts(undefined, "me")).toEqual([]);
  });

  it("applies the realtime feed: insert, update and delete", () => {
    let map = applyReactionChange({}, { eventType: "INSERT", new: { message_id: "m1", user_id: "b", emoji: HEART } });
    map = applyReactionChange(map, { eventType: "UPDATE", new: { message_id: "m1", user_id: "b", emoji: THUMBS } });
    expect(map).toEqual({ m1: { b: THUMBS } });
    map = applyReactionChange(map, { eventType: "DELETE", old: { message_id: "m1", user_id: "b" } });
    expect(map).toEqual({});
    /* A row it cannot read changes nothing. */
    expect(applyReactionChange(map, { eventType: "INSERT", new: { message_id: "m1", user_id: "b", emoji: "x" } })).toBe(map);
  });
});
