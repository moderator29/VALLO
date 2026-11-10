import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LISTING_SHARE_LIMIT,
  LISTING_SHARE_NOTE_MAX,
  SHARE_CARD_WORDS,
  SHARE_WORDS,
  canShareMore,
  cleanNote,
  decideShare,
  slotsFrom,
  slotsLine,
  wordsForDbCode,
  wordsForReason,
} from "./model";

describe("the share slots", () => {
  it("says how many shares are left before the person tries", () => {
    expect(slotsLine(slotsFrom(0, false))).toBe("You have 2 of 2 shares left");
    expect(slotsLine(slotsFrom(1, false))).toBe("You have 1 of 2 shares left");
    expect(slotsLine(slotsFrom(2, false))).toContain("used all 2");
  });
  it("two is the limit, and a super admin has none", () => {
    expect(LISTING_SHARE_LIMIT).toBe(2);
    expect(canShareMore(slotsFrom(2, false))).toBe(false);
    expect(canShareMore(slotsFrom(50, true))).toBe(true);
    expect(slotsFrom(5, true).left).toBeNull();
    expect(slotsLine(slotsFrom(5, true))).toBe(SHARE_WORDS.unlimited);
  });
  it("never goes below zero left", () => {
    expect(slotsFrom(9, false).left).toBe(0);
  });
});

describe("the note", () => {
  it("is optional", () => {
    expect(cleanNote("")).toEqual({ ok: true, note: null });
    expect(cleanNote("   ")).toEqual({ ok: true, note: null });
    expect(cleanNote(undefined)).toEqual({ ok: true, note: null });
  });
  it("is plain text on one line", () => {
    expect(cleanNote("Nice\n\n  place\u0000 here")).toEqual({ ok: true, note: "Nice place here" });
  });
  it("holds 280 characters and refuses 281", () => {
    expect(cleanNote("a".repeat(LISTING_SHARE_NOTE_MAX)).ok).toBe(true);
    const over = cleanNote("a".repeat(LISTING_SHARE_NOTE_MAX + 1));
    expect(over.ok).toBe(false);
  });
  it("leaves out links and contact details", () => {
    expect(cleanNote("see https://x.test").ok).toBe(false);
    expect(cleanNote("call 0803 123 4567").ok).toBe(false);
    expect(cleanNote("mail me a@b.co").ok).toBe(false);
    expect(cleanNote("3 bed, 2 baths, quiet street").ok).toBe(true);
  });
});

describe("who may share what", () => {
  const free = slotsFrom(0, false);
  it("a guest is sent to sign up", () => {
    expect(decideShare({ signedIn: false, live: true, alreadyShared: false, slots: free })).toEqual({ allowed: false, reason: "signed-out" });
  });
  it("only a live public listing", () => {
    expect(decideShare({ signedIn: true, live: false, alreadyShared: false, slots: free })).toEqual({ allowed: false, reason: "not-live" });
  });
  it("not the same listing twice", () => {
    expect(decideShare({ signedIn: true, live: true, alreadyShared: true, slots: free }).allowed).toBe(false);
  });
  it("two shares, then the limit; a removal frees a slot", () => {
    expect(decideShare({ signedIn: true, live: true, alreadyShared: false, slots: slotsFrom(1, false) }).allowed).toBe(true);
    expect(decideShare({ signedIn: true, live: true, alreadyShared: false, slots: slotsFrom(2, false) })).toEqual({ allowed: false, reason: "limit" });
    expect(decideShare({ signedIn: true, live: true, alreadyShared: false, slots: slotsFrom(1, false) }).allowed).toBe(true);
  });
  it("a super admin is never limited", () => {
    expect(decideShare({ signedIn: true, live: true, alreadyShared: false, slots: slotsFrom(9, true) }).allowed).toBe(true);
  });
  it("each refusal says something true", () => {
    expect(wordsForReason("limit")).toContain("up to 2");
    expect(wordsForDbCode("LS001")).toBe(SHARE_WORDS.limitReached);
    expect(wordsForDbCode("LS002")).toBe(SHARE_WORDS.alreadyShared);
    expect(wordsForDbCode("23505")).toBe(SHARE_WORDS.alreadyShared);
    expect(wordsForDbCode("LS004")).toBe(SHARE_WORDS.notLive);
    expect(wordsForDbCode("XX000")).toBeNull();
  });
});

describe("the feed card's words", () => {
  it("says Shared, never Featured", () => {
    expect(SHARE_CARD_WORDS.badge).toBe("Shared");
    const everything = JSON.stringify(SHARE_WORDS) + JSON.stringify(SHARE_CARD_WORDS);
    expect(everything).not.toMatch(/featured/i);
  });
  it("has a quiet unavailable state", () => {
    expect(SHARE_CARD_WORDS.gone).toBe("No longer available");
  });
  it("the card draws the share branch with the badge, no button when the listing is gone, and the real listing link otherwise", () => {
    const source = readFileSync(join(process.cwd(), "src/components/social/feed/PostCard.tsx"), "utf8");
    expect(source).toContain("SHARE_CARD_WORDS.badge");
    expect(source).toContain("SHARE_CARD_WORDS.gone");
    expect(source).toMatch(/\{featured \? \(\s*<Link href=\{`\/listing\/\$\{featured\.id\}`\}/);
  });
});

describe("the SQL (text sanity)", () => {
  const full = readFileSync(join(process.cwd(), "..", "..", "supabase/migrations/pending/feed_listing_shares_2026-11-10.sql"), "utf8");
  /* The code only: the header comment names what the file does not do. */
  const sql = full
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  it("is additive and safe to run twice", () => {
    expect(sql).toMatch(/add column if not exists is_listing_share/);
    expect(sql).toMatch(/add column if not exists shared_listing_id/);
    expect(sql).toMatch(/create or replace function private\.listing_share_guard/);
    expect(sql).toMatch(/drop trigger if exists posts_listing_share_guard/);
    expect(sql).not.toMatch(/drop table|drop column|truncate/i);
  });
  it("takes an advisory lock before counting, and refuses past 2 unless super admin", () => {
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("select count(*)"));
    expect(sql).toMatch(/v_used >= 2/);
    expect(sql).toMatch(/role = 'super_admin'/);
    expect(sql).toMatch(/errcode = 'LS001'/);
  });
  it("references auth-free listing id with ON DELETE SET NULL and no NOT NULL on it", () => {
    expect(sql).toMatch(/shared_listing_id uuid references public\.listings \(id\) on delete set null/);
    expect(sql).not.toMatch(/add column if not exists shared_listing_id[^\n]*not null/);
  });
  it("adds no new table or grant, so db-06 needs no entry", () => {
    expect(sql).not.toMatch(/create table|\bgrant\b/i);
  });
  it("has no em dash", () => {
    expect(full).not.toContain(String.fromCharCode(0x2014));
  });
});
