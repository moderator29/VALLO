import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BANNED_EVERYWHERE, SCHEDULE_PROMISES, firstBannedPhrase } from "@/lib/copy/banned-phrases";
import { PUSH_BODY_MAX, PUSH_TITLE_MAX } from "@/lib/push/copy";

import { getDictionary } from "@vallo/i18n";
const REMINDERS_COPY = getDictionary("en").reminders;
import {
  NOTICE_TOPICS,
  NUDGE_GAP_DAYS,
  NUDGE_MAX_PER_KIND,
  NUDGE_ORDER,
  NUDGE_TOPICS,
  NUDGE_WORDS,
  areaDigestWords,
  chooseNudge,
  defaultPreferences,
  listingNoun,
  neighboursWords,
  nudgeAllowed,
  preferencesFromRows,
  type NudgeTopic,
} from "./model";

const SQL = readFileSync(
  join(__dirname, "..", "..", "..", "..", "..", "..", "supabase", "migrations", "20261107210100_features_a5_a6_notices.sql"),
  "utf8",
);

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-07T10:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("reminder preferences", () => {
  it("everything is on until a person says no", () => {
    const prefs = defaultPreferences();
    for (const topic of NOTICE_TOPICS) expect(prefs[topic]).toBe(true);
  });

  it("only an explicit false silences, and junk rows are skipped", () => {
    const prefs = preferencesFromRows([
      { topic: "nudge_phone", enabled: false },
      { topic: "new_in_area", enabled: true },
      { topic: "not_a_topic", enabled: false },
      { topic: "nudges", enabled: "false" },
    ]);
    expect(prefs.nudge_phone).toBe(false);
    expect(prefs.new_in_area).toBe(true);
    expect(prefs.nudges).toBe(true);
  });
});

describe("gentle nudges are never spammy", () => {
  const base = { preferences: defaultPreferences(), now: NOW };

  it("a first nudge is allowed", () => {
    expect(nudgeAllowed({ ...base, nudge: "nudge_phone", sent: [] })).toBe(true);
  });

  it("at most one a week, of any kind, so never two in a day", () => {
    expect(nudgeAllowed({ ...base, nudge: "nudge_phone", sent: [{ nudge: "nudge_profile", sentAt: ago(0.2) }] })).toBe(false);
    expect(nudgeAllowed({ ...base, nudge: "nudge_phone", sent: [{ nudge: "nudge_profile", sentAt: ago(6.9) }] })).toBe(false);
    expect(nudgeAllowed({ ...base, nudge: "nudge_phone", sent: [{ nudge: "nudge_profile", sentAt: ago(7.1) }] })).toBe(true);
  });

  it("each kind stops after three", () => {
    const sent = [ago(30), ago(20), ago(10)].map((sentAt) => ({ nudge: "nudge_phone", sentAt }));
    expect(nudgeAllowed({ ...base, nudge: "nudge_phone", sent })).toBe(false);
    expect(nudgeAllowed({ ...base, nudge: "nudge_profile", sent })).toBe(true);
  });

  it("every kind and all of them together can be switched off", () => {
    expect(nudgeAllowed({ ...base, preferences: { ...defaultPreferences(), nudges: false }, nudge: "nudge_phone", sent: [] })).toBe(false);
    expect(nudgeAllowed({ ...base, preferences: { ...defaultPreferences(), nudge_identity: false }, nudge: "nudge_identity", sent: [] })).toBe(false);
  });

  it("one nudge per run, the most useful first", () => {
    const owed = new Set<NudgeTopic>(["nudge_profile", "nudge_phone"]);
    expect(chooseNudge(owed, () => true)).toBe("nudge_phone");
    expect(chooseNudge(owed, (n) => n !== "nudge_phone")).toBe("nudge_profile");
    expect(chooseNudge(new Set(), () => true)).toBeNull();
    expect([...NUDGE_ORDER].sort()).toEqual([...NUDGE_TOPICS].sort());
  });
});

describe("the SQL keeps the same rules", () => {
  it("caps: seven days and three per kind", () => {
    expect(SQL).toContain(`interval '${NUDGE_GAP_DAYS} days'`);
    expect(SQL).toMatch(new RegExp(`g\\.nudge = p_nudge\\) < ${NUDGE_MAX_PER_KIND}`));
  });

  it("every topic is in the table's check, and nothing else", () => {
    const check = SQL.slice(SQL.indexOf("check (topic in ("), SQL.indexOf("enabled    boolean"));
    for (const topic of NOTICE_TOPICS) expect(check).toContain(`'${topic}'`);
    expect(check.match(/'[a-z_]+'/g)?.length).toBe(NOTICE_TOPICS.length);
  });

  it("the nudge words match the SQL, and the order matches the ranks", () => {
    for (const nudge of NUDGE_TOPICS) {
      expect(SQL).toContain(`'${NUDGE_WORDS[nudge].title}'`);
      expect(SQL).toContain(NUDGE_WORDS[nudge].body);
      expect(SQL).toContain(NUDGE_WORDS[nudge].href);
    }
    NUDGE_ORDER.forEach((nudge, rank) => {
      expect(SQL).toMatch(new RegExp(`'${nudge}'(::text)?(\\s+as nudge)?,\\s*${rank}`));
    });
  });

  it("the long rental is 5 months or more, and stays never reach the ID nudge", () => {
    expect(SQL).toMatch(/coalesce\(l\.minimum_tenancy_months, 0\)\) >= 5/);
    expect(SQL).toContain("l.listing_intent = 'rent'");
  });

  it("RLS is on and policies hold rows to their owner", () => {
    expect(SQL).toContain("alter table public.notice_preferences enable row level security");
    expect(SQL.match(/user_id = \(select auth\.uid\(\)\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(SQL).toContain("revoke all on table public.notice_preferences from public, anon");
    expect(SQL).toContain("revoke all on table private.nudge_log from public, anon, authenticated, service_role");
  });

  it("every function is security definer with an empty search path, and revoked from callers", () => {
    const fns = [...SQL.matchAll(/create or replace function (private\.[a-z_]+)\(/g)].map((m) => m[1] ?? "");
    expect(fns.length).toBe(5);
    for (const fn of fns) expect(SQL).toMatch(new RegExp(`revoke all on function ${fn.replace(".", "\\.")}\\(`));
    const definers = SQL.match(/security definer\s+set search_path = ''/g)?.length ?? 0;
    expect(definers).toBe(4);
    expect(SQL.match(/set search_path = ''/g)?.length).toBe(5);
  });

  it("the people a saved search alert already tells are left out of the area digest", () => {
    expect(SQL).toContain("s.user_id = pl.user_id and s.alert_enabled");
  });
});

describe("the words fit a lock screen", () => {
  it("nudges", () => {
    for (const nudge of NUDGE_TOPICS) {
      expect(NUDGE_WORDS[nudge].title.length).toBeLessThanOrEqual(PUSH_TITLE_MAX);
      expect(NUDGE_WORDS[nudge].body.length).toBeLessThanOrEqual(PUSH_BODY_MAX);
    }
  });

  it("the area digest, one and many", () => {
    expect(areaDigestWords({ areaName: "Lekki", count: 1, newestNoun: listingNoun("apartment", 2, "rent") })).toEqual({
      title: "New in Lekki",
      body: "A 2 bedroom flat just listed near you.",
    });
    expect(areaDigestWords({ areaName: "Yaba", count: 4, newestNoun: "flat" }).body).toBe("4 new places listed near you today.");
    expect(areaDigestWords({ areaName: "A very long estate name in the mainland part", count: 2, newestNoun: "x" }).title.length).toBeLessThanOrEqual(40);
    expect(listingNoun("land", 3, "sale")).toBe("plot of land for sale");
    expect(listingNoun(null, null, null)).toBe("place");
  });

  it("new neighbours", () => {
    expect(neighboursWords({ firstName: "Ada", count: 1, areaName: "Yaba", areas: 1 })).toBe("Ada joined Yaba.");
    expect(neighboursWords({ firstName: "Ada", count: 2, areaName: "Yaba", areas: 1 })).toBe("Ada and 1 other you follow joined Yaba.");
    expect(neighboursWords({ firstName: null, count: 3, areaName: null, areas: 2 })).toBe("Someone you follow and 2 others you follow joined your areas.");
  });

  it("no schedule promises and no em dashes on the screen", () => {
    const words = JSON.stringify(REMINDERS_COPY);
    expect(firstBannedPhrase(words, [...SCHEDULE_PROMISES, ...BANNED_EVERYWHERE])).toBeNull();
    expect(words).not.toMatch(/[–—]/);
  });
});
