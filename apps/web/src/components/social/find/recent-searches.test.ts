import { describe, expect, it } from "vitest";
import { cleanRecent, clearRecent, forgetRecent, readRecent, RECENT_KEY, RECENT_MAX, rememberRecent } from "./recent-searches";
import { filterHits } from "./people-filters";
import type { PersonHit } from "@/lib/social/people-hits";

/** A storage that behaves like the browser's, in memory. */
function memory(seed?: string) {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(RECENT_KEY, seed);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    raw: () => map.get(RECENT_KEY),
  };
}

describe("recent people searches, on this device only", () => {
  it("keeps the newest first, with no repeats whatever the case", () => {
    const s = memory();
    rememberRecent("ada", s);
    rememberRecent("Tunde", s);
    expect(rememberRecent("ADA", s)).toEqual(["ADA", "Tunde"]);
  });

  it("never keeps more than six", () => {
    const s = memory();
    for (const q of ["aa", "bb", "cc", "dd", "ee", "ff", "gg", "hh"]) rememberRecent(q, s);
    expect(readRecent(s)).toHaveLength(RECENT_MAX);
    expect(readRecent(s)[0]).toBe("hh");
  });

  it("keeps only what a search box could have produced", () => {
    expect(cleanRecent("@ada")).toBe("ada");
    expect(cleanRecent("  two   words ")).toBe("two words");
    for (const bad of ["a", "", "x".repeat(41), "<script>", 7, null]) expect(cleanRecent(bad), String(bad)).toBeNull();
  });

  it("reads a damaged or foreign value as nothing, never as a crash", () => {
    expect(readRecent(memory("not json"))).toEqual([]);
    expect(readRecent(memory(JSON.stringify({ a: 1 })))).toEqual([]);
    expect(readRecent(memory(JSON.stringify(["ok search", 4, "<b>x</b>"])))).toEqual(["ok search"]);
    expect(readRecent(null)).toEqual([]);
  });

  it("forgets one, or all, and leaves no key behind when empty", () => {
    const s = memory();
    rememberRecent("ada", s);
    rememberRecent("tunde", s);
    expect(forgetRecent("ADA", s)).toEqual(["tunde"]);
    expect(clearRecent(s)).toEqual([]);
    expect(s.raw()).toBeUndefined();
  });

  it("survives storage that refuses to write", () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("quota"); } };
    expect(rememberRecent("ada", refusing)).toEqual(["ada"]);
  });
});

const hit = (handle: string, role: PersonHit["role"], tier: PersonHit["tier"] = "none"): PersonHit => ({
  handle,
  displayLabel: handle,
  avatarUrl: "",
  isAgent: role === "agent",
  role,
  tier,
  viewerFollows: false,
  isViewer: false,
});

describe("the search filters", () => {
  const hits = [hit("agent1", "agent", "gold"), hit("owner1", "landlord"), hit("member1", null), hit("agent2", "agent")];

  it("shows everyone, or one side of the platform", () => {
    expect(filterHits(hits, "all", false)).toHaveLength(4);
    expect(filterHits(hits, "agent", false).map((h) => h.handle)).toEqual(["agent1", "agent2"]);
    expect(filterHits(hits, "landlord", false).map((h) => h.handle)).toEqual(["owner1"]);
    expect(filterHits(hits, "member", false).map((h) => h.handle)).toEqual(["member1"]);
  });

  it("keeps only a published badge when asked, never an inferred one", () => {
    expect(filterHits(hits, "all", true).map((h) => h.handle)).toEqual(["agent1"]);
    expect(filterHits(hits, "landlord", true)).toEqual([]);
  });
});
