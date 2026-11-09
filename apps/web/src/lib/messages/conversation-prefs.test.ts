import { describe, expect, it } from "vitest";
import { PIN_LIMIT, isMuted, muteUntil, pinnedFirst } from "./conversation-prefs";

describe("pin and mute", () => {
  it("pins at most five, the database's own limit", () => {
    expect(PIN_LIMIT).toBe(5);
  });

  it("puts pinned rows first, newest pin on top, the rest in their own order", () => {
    const rows = [
      { id: "a" },
      { id: "b", pinnedAt: "2026-11-07T10:00:00Z" },
      { id: "c" },
      { id: "d", pinnedAt: "2026-11-07T11:00:00Z" },
    ];
    expect(pinnedFirst(rows).map((r) => r.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("works out when a mute ends and whether it still runs", () => {
    const now = Date.UTC(2026, 10, 7, 12);
    expect(muteUntil("8h", now)).toBe("2026-11-07T20:00:00.000Z");
    expect(muteUntil("week", now)).toBe("2026-11-14T12:00:00.000Z");
    expect(isMuted(muteUntil("always", now), now)).toBe(true);
    expect(isMuted("2026-11-07T11:00:00Z", now)).toBe(false);
    expect(isMuted(null, now)).toBe(false);
  });
});
