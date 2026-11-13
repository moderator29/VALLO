import { describe, expect, it } from "vitest";
import { LAGOS_ZONE, validZone, yourTimeAt } from "./your-time";

/** 10:00 in Lagos on Friday 13 November 2026. */
const TEN_LAGOS = "2026-11-13T09:00:00Z";

describe("your time beside Lagos time", () => {
  it("adds the reader's clock when it differs from Lagos", () => {
    expect(yourTimeAt(TEN_LAGOS, "Europe/London", "en")).toEqual({ time: "09:00", day: null, zone: "Europe/London" });
    expect(yourTimeAt(TEN_LAGOS, "America/Toronto", "en")).toEqual({ time: "04:00", day: null, zone: "America/Toronto" });
    /* Ghana keeps GMT all year, an hour behind Lagos. */
    expect(yourTimeAt(TEN_LAGOS, "Africa/Accra", "en")?.time).toBe("09:00");
  });

  it("adds nothing when the reader's clock reads the same as Lagos", () => {
    expect(yourTimeAt(TEN_LAGOS, LAGOS_ZONE, "en")).toBeNull();
    expect(yourTimeAt(TEN_LAGOS, "Africa/Douala", "en")).toBeNull();
    expect(yourTimeAt(TEN_LAGOS, "Africa/Kinshasa", "en")).toBeNull();
  });

  it("follows summer time on the reader's side: London is level with Lagos in June", () => {
    expect(yourTimeAt("2026-06-12T09:00:00Z", "Europe/London", "en")).toBeNull();
  });

  it("names the day when the reader's date differs from Lagos's", () => {
    /* 21:30 Friday in Lagos is 00:30 Saturday in Dubai and 15:30 Friday in Toronto. */
    expect(yourTimeAt("2026-11-13T20:30:00Z", "Asia/Dubai", "en")).toEqual({ time: "00:30", day: "Sat", zone: "Asia/Dubai" });
    expect(yourTimeAt("2026-11-13T20:30:00Z", "America/Toronto", "en")).toEqual({ time: "15:30", day: null, zone: "America/Toronto" });
  });

  it("adds nothing for an unknown zone or an unreadable instant", () => {
    expect(yourTimeAt(TEN_LAGOS, "Mars/Olympus", "en")).toBeNull();
    expect(yourTimeAt(TEN_LAGOS, null, "en")).toBeNull();
    expect(yourTimeAt("not a date", "Europe/London", "en")).toBeNull();
    expect(validZone("x".repeat(100))).toBeNull();
  });
});
