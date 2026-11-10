import { describe, expect, it } from "vitest";

import { EMPTY_FEED_FILTERS, feedActiveCount, feedQuery, hasMore, readFeedState, startCursor, tabReads, toPeopleFilters, toRoomFilters, weave } from "./feed";
import type { RoomCard, RoommateCard } from "./model";

const room = (id: string) => ({ id }) as unknown as RoomCard;
const person = (userId: string) => ({ userId }) as unknown as RoommateCard;

describe("the feed's reads", () => {
  it("offering asks for both kinds of home post, all and looking ask for no kind filter", () => {
    expect(toRoomFilters("offering", EMPTY_FEED_FILTERS).kinds).toEqual(["room_offer", "roommate_wanted"]);
    expect(toRoomFilters("all", EMPTY_FEED_FILTERS).kinds).toBeUndefined();
  });

  it("sends the budget range to the database in kobo per month", () => {
    const r = toRoomFilters("all", { ...EMPTY_FEED_FILTERS, minNaira: 100_000, maxNaira: 300_000 });
    expect(r.minMinor).toBe(10_000_000);
    expect(r.maxMinor).toBe(30_000_000);
    expect(r.period).toBe("month");
    expect(toRoomFilters("all", EMPTY_FEED_FILTERS).maxMinor).toBeNull();
  });

  it("asks for people who are looking for a room", () => {
    expect(toPeopleFilters({ ...EMPTY_FEED_FILTERS, maxNaira: 200_000 }).intent).toBe("find_room");
    expect(toPeopleFilters({ ...EMPTY_FEED_FILTERS, maxNaira: 200_000 }).maxMinor).toBe(20_000_000);
  });

  it("uses only the reads a tab needs", () => {
    expect(tabReads("offering")).toEqual({ rooms: true, people: false });
    expect(startCursor("looking")).toEqual({ rooms: null, people: 0 });
    expect(startCursor("all")).toEqual({ rooms: 0, people: 0 });
    expect(hasMore({ rooms: null, people: null })).toBe(false);
  });

  it("weaves a person after every two rooms and keeps every item", () => {
    const out = weave([room("a"), room("b"), room("c")], [person("p"), person("q")]);
    expect(out.map((i) => (i.type === "room" ? i.room.id : i.person.userId))).toEqual(["a", "b", "p", "c", "q"]);
  });
});

describe("the feed's address", () => {
  it("round-trips the state", () => {
    const f = { ...EMPTY_FEED_FILTERS, q: "yaba", stateCode: "LA", minNaira: 50_000, maxNaira: 200_000, genderPref: "female" as const, roomType: "private" as const, moveBy: "2026-12-01" };
    const q = feedQuery("offering", f);
    const back = readFeedState(Object.fromEntries(new URLSearchParams(q.slice(1))));
    expect(back).toEqual({ tab: "offering", filters: f });
    expect(feedActiveCount(f)).toBe(5);
  });
  it("ignores junk", () => {
    const s = readFeedState({ tab: "nope", gender: "x", room: "y", by: "tomorrow", min: "-4" });
    expect(s.tab).toBe("all");
    expect(s.filters).toEqual(EMPTY_FEED_FILTERS);
    expect(feedQuery("all", EMPTY_FEED_FILTERS)).toBe("");
  });
});
