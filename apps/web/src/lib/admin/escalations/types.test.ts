import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STAFF_SCOPES } from "../guard";
import {
  CATEGORY_LABEL,
  DUE_HOURS,
  ESCALATION_ACTIONS,
  ESCALATION_CATEGORIES,
  ESCALATION_EVENT_KINDS,
  ESCALATION_SEVERITIES,
  ESCALATION_STATUSES,
  LIMITS,
  PERSONAL_NUMBER_REFUSAL,
  REOPEN_DAYS,
  ROUTE_CHOICES,
  ROUTE_FALLBACK,
  ROUTE_LABEL,
  ROUTING,
  SEVERITY_LABEL,
  actionsFor,
  bumpWindowHours,
  carriesPersonalNumber,
  deskRoot,
  dueAt,
  isEscalationRoute,
  levelOf,
  mayAct,
  planRoute,
  readEscalationView,
  safeRecordUrl,
  sourceDeskOf,
  withWhom,
  type ActSubject,
  type EscalationViewer,
} from "./types";
import { clockOf, eventWords, ownerWords, raisedByWords, sentWords, spanWords, waitedWords, whereItGoesWords } from "./words";

/**
 * The routing table, the fallback, the response clock, the lists of
 * categories, statuses and event kinds, and the text rule live twice: in SQL
 * (`supabase/migrations/pending/staff_escalations_2026-11-15.sql`) and in
 * `types.ts`. This reads the SQL so the two cannot drift, the way
 * `staff-positions.test.ts` pins the scope bundles.
 */
const sql = readFileSync(
  fileURLToPath(new URL("../../../../../../supabase/migrations/pending/staff_escalations_2026-11-15.sql", import.meta.url)),
  "utf8",
);

function functionBody(name: string): string {
  const start = sql.indexOf(`function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("$function$;", start));
}

function whenThen(body: string): Map<string, string> {
  return new Map([...body.matchAll(/when '([a-z_]+)' then '([a-z_]+)'/g)].map((m) => [m[1]!, m[2]!]));
}

function checkList(constraint: string): string[] {
  const start = sql.indexOf(`constraint ${constraint} check`);
  expect(start, constraint).toBeGreaterThan(-1);
  const end = sql.indexOf(")),", start);
  return [...sql.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
}

describe("the app and the database state the same rules", () => {
  it("routes every category to the same place", () => {
    const table = whenThen(functionBody("private.staff_escalation_route"));
    expect([...table.keys()].sort()).toEqual([...ESCALATION_CATEGORIES].sort());
    for (const category of ESCALATION_CATEGORIES) expect(table.get(category), category).toBe(ROUTING[category]);
  });

  it("falls back the same way when a team is empty", () => {
    const table = whenThen(functionBody("private.staff_escalation_route_fallback"));
    expect(Object.fromEntries(table)).toEqual(ROUTE_FALLBACK);
  });

  it("gives every severity the same response time", () => {
    const body = functionBody("private.staff_escalation_window");
    const hours = new Map([...body.matchAll(/when '([a-z]+)' then interval '(\d+) hours?'/g)].map((m) => [m[1]!, Number(m[2])]));
    expect(Object.fromEntries(hours)).toEqual(DUE_HOURS);
  });

  it("allows exactly these categories, severities, statuses and event kinds in the tables", () => {
    expect(checkList("staff_escalations_category_chk")).toEqual([...ESCALATION_CATEGORIES].sort());
    expect(checkList("staff_escalations_severity_chk")).toEqual([...ESCALATION_SEVERITIES].sort());
    expect(checkList("staff_escalations_status_chk")).toEqual([...ESCALATION_STATUSES].sort());
    expect(checkList("staff_escalation_events_kind_chk")).toEqual([...ESCALATION_EVENT_KINDS].sort());
  });

  it("names the same actions the act function takes", () => {
    const body = functionBody("public.staff_escalation_act");
    const list = body.slice(body.indexOf("p_action not in"), body.indexOf("then", body.indexOf("p_action not in")));
    expect([...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...ESCALATION_ACTIONS].sort());
  });

  it("holds the same text limits", () => {
    expect(sql).toContain(`char_length(btrim(title)) between ${LIMITS.title.min} and ${LIMITS.title.max}`);
    expect(sql).toContain(`char_length(btrim(what_happened)) between ${LIMITS.whatHappened.min} and ${LIMITS.whatHappened.max}`);
    expect(sql).toContain(`char_length(btrim(what_is_needed)) between ${LIMITS.whatIsNeeded.min} and ${LIMITS.whatIsNeeded.max}`);
    expect(sql).toContain(`interval '${REOPEN_DAYS} days'`);
  });

  it("refuses the same numbers in text", () => {
    const body = functionBody("private.staff_escalation_text_ok");
    expect(body).toContain("'[0-9]{10,}'");
    expect(body).toContain("'[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{1,7}'");
    expect(body).toContain("'[0-9]{4}[ -][0-9]{6}[ -][0-9]{5}'");
  });

  it("is additive and safe to run twice: nothing is removed and nothing is created bare", () => {
    const statements = sql.replace(/--[^\n]*/g, "");
    expect(statements).not.toMatch(/\bdrop\s/i);
    expect(statements).not.toMatch(/\btruncate\s+table\b/i);
    expect(statements).not.toMatch(/\bdelete\s+from\b/i);
    expect(statements).not.toMatch(/create table (?!if not exists)/i);
    expect(statements).not.toMatch(/create (?:unique )?index (?!if not exists)/i);
    expect(statements).not.toMatch(/create function/i);
    expect(statements).not.toMatch(/cron\.schedule/i);
    expect(sql).not.toContain(String.fromCharCode(0x2014));
  });

  it("grants nothing on the tables and pins the search path on every definer function", () => {
    expect(sql).not.toMatch(/grant\s+(select|insert|update|all)[^;]*on (table )?public\.staff_escalation/i);
    const definers = sql.split(/create or replace function /).slice(1);
    for (const fn of definers) {
      const head = fn.slice(0, fn.indexOf("as $function$"));
      if (/security definer/.test(head)) expect(head, head.slice(0, 60)).toMatch(/set search_path to ''/);
    }
    for (const m of sql.matchAll(/create or replace function (private\.[a-z_]+)\(/g)) {
      expect(sql, m[1]).toMatch(new RegExp(`revoke all on function ${m[1]!.replace(".", "\\.")}\\(`));
    }
  });
});

describe("routes", () => {
  it("names every staff scope, the COO and the super admin, and nothing else", () => {
    expect(Object.keys(ROUTE_LABEL).sort()).toEqual([...STAFF_SCOPES, "coo", "super_admin"].sort());
  });

  it("routes only to real places, and offers only real places to choose", () => {
    for (const category of ESCALATION_CATEGORIES) expect(isEscalationRoute(ROUTING[category]), category).toBe(true);
    for (const route of ROUTE_CHOICES) expect(isEscalationRoute(route), route).toBe(true);
    expect(new Set(ROUTE_CHOICES).size).toBe(ROUTE_CHOICES.length);
    for (const target of new Set(Object.values(ROUTING))) expect(ROUTE_CHOICES, target).toContain(target);
    expect(isEscalationRoute("the_moon")).toBe(false);
    expect(isEscalationRoute("toString")).toBe(false);
  });

  it("follows the founder's table", () => {
    expect(ROUTING).toEqual({
      identity_fraud: "trust_safety",
      money: "finance",
      safety: "trust_safety",
      listing: "listing_approval",
      technical: "technical",
      policy_decision: "coo",
      staff_access: "super_admin",
      member_complaint: "support_lead",
      other: "coo",
    });
  });

  it("puts a team at level 0, the COO at 1 and the super admin at 2", () => {
    expect(levelOf("finance")).toBe(0);
    expect(levelOf("coo")).toBe(1);
    expect(levelOf("super_admin")).toBe(2);
    expect(withWhom("finance", 0)).toBe("the Finance team");
    expect(withWhom("finance", 1)).toBe("the COO");
    expect(withWhom("finance", 2)).toBe("the super admin");
  });

  it("goes to the category's team when somebody is on it", () => {
    expect(planRoute("money", null, ["finance", "coo"])).toEqual({ route: "finance", intended: "finance", fallback: false });
  });

  it("never routes to an empty team: the fallback, then the COO, then the super admin", () => {
    expect(planRoute("identity_fraud", null, ["compliance", "coo"]).route).toBe("compliance");
    expect(planRoute("identity_fraud", null, ["coo"]).route).toBe("coo");
    expect(planRoute("identity_fraud", null, [])).toEqual({ route: "super_admin", intended: "trust_safety", fallback: true });
    /* Safety has no stop before the COO. */
    expect(planRoute("safety", null, ["compliance", "coo"]).route).toBe("coo");
    expect(planRoute("policy_decision", null, []).route).toBe("super_admin");
    expect(planRoute("staff_access", null, []).fallback).toBe(false);
  });

  it("honours a person's own choice when that team has people, and skips the category fallback when it has none", () => {
    expect(planRoute("other", "kyc_review", ["kyc_review"]).route).toBe("kyc_review");
    expect(planRoute("identity_fraud", "finance", ["compliance", "coo"])).toEqual({ route: "coo", intended: "finance", fallback: true });
  });

  it("shows the table's own answer when the staffed list could not be read", () => {
    expect(planRoute("money", null, null)).toEqual({ route: "finance", intended: "finance", fallback: false });
  });
});

describe("the response clock", () => {
  it("is 1 hour, 4 hours, 24 hours and 72 hours", () => {
    expect(DUE_HOURS).toEqual({ urgent: 1, high: 4, normal: 24, low: 72 });
    const from = Date.parse("2026-11-15T09:00:00Z");
    expect(dueAt("urgent", from).toISOString()).toBe("2026-11-15T10:00:00.000Z");
    expect(dueAt("high", from).toISOString()).toBe("2026-11-15T13:00:00.000Z");
    expect(dueAt("normal", from).toISOString()).toBe("2026-11-16T09:00:00.000Z");
    expect(dueAt("low", from).toISOString()).toBe("2026-11-18T09:00:00.000Z");
  });

  it("says each response time in words that match the hours", () => {
    expect(SEVERITY_LABEL.urgent.answer).toBe("within 1 hour");
    expect(SEVERITY_LABEL.high.answer).toBe("within 4 hours");
    expect(SEVERITY_LABEL.normal.answer).toBe("within 24 hours");
    expect(SEVERITY_LABEL.low.answer).toBe("within 3 days");
  });

  it("gives half the window on a move up, and never under an hour", () => {
    expect(bumpWindowHours("low")).toBe(36);
    expect(bumpWindowHours("normal")).toBe(12);
    expect(bumpWindowHours("high")).toBe(2);
    expect(bumpWindowHours("urgent")).toBe(1);
  });
});

describe("who may do what", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const receiver: EscalationViewer = { isRaiser: false, isHandler: true, isLead: false, isAssignee: false };
  const raiser: EscalationViewer = { isRaiser: true, isHandler: false, isLead: false, isAssignee: false };
  const lead: EscalationViewer = { isRaiser: false, isHandler: true, isLead: true, isAssignee: false };
  const open: ActSubject = { status: "open", hasRaiser: true, resolvedAt: null };

  it("lets the receiving side acknowledge, take, note, send on, ask, resolve and decline an open one", () => {
    expect(actionsFor(receiver, open, now)).toEqual(["acknowledge", "assign", "comment", "reroute", "ask_raiser", "resolve", "decline"]);
  });

  it("lets the raiser add a note and nothing else while it is open", () => {
    expect(actionsFor(raiser, open, now)).toEqual(["comment"]);
  });

  it("never lets a person work their own escalation, even when they are on the team it went to", () => {
    const ownTeam: EscalationViewer = { isRaiser: true, isHandler: true, isLead: false, isAssignee: false };
    expect(actionsFor(ownTeam, open, now)).toEqual(["comment"]);
  });

  it("lets a lead work one they raised, because nobody is above them", () => {
    const founder: EscalationViewer = { isRaiser: true, isHandler: true, isLead: true, isAssignee: false };
    expect(mayAct("resolve", founder, open, now)).toBe(true);
  });

  it("acknowledges once, and does not offer to take what is already yours", () => {
    expect(mayAct("acknowledge", receiver, { ...open, status: "acknowledged" }, now)).toBe(false);
    expect(mayAct("assign", { ...receiver, isAssignee: true }, { ...open, status: "in_progress" }, now)).toBe(false);
  });

  it("asks the raiser only when there is one, and only one question at a time", () => {
    expect(mayAct("ask_raiser", receiver, { ...open, hasRaiser: false }, now)).toBe(false);
    expect(mayAct("ask_raiser", receiver, { ...open, status: "waiting_on_raiser" }, now)).toBe(false);
  });

  it("lets only the raiser answer, and only when a question is waiting", () => {
    const waiting: ActSubject = { ...open, status: "waiting_on_raiser" };
    expect(mayAct("raiser_reply", raiser, waiting, now)).toBe(true);
    expect(mayAct("raiser_reply", receiver, waiting, now)).toBe(false);
    expect(mayAct("raiser_reply", raiser, open, now)).toBe(false);
  });

  it("closes a resolved or declined one to everything but reopen", () => {
    const closed: ActSubject = { status: "resolved", hasRaiser: true, resolvedAt: "2026-11-14T12:00:00Z" };
    expect(actionsFor(receiver, closed, now)).toEqual([]);
    expect(actionsFor(raiser, closed, now)).toEqual(["reopen"]);
    expect(actionsFor(lead, { ...closed, status: "declined" }, now)).toEqual(["reopen"]);
  });

  it("reopens within 14 days and not a minute after", () => {
    const at = (iso: string): ActSubject => ({ status: "resolved", hasRaiser: true, resolvedAt: iso });
    expect(mayAct("reopen", raiser, at("2026-11-01T12:00:00Z"), now)).toBe(true);
    expect(mayAct("reopen", raiser, at("2026-11-01T11:59:00Z"), now)).toBe(false);
    expect(mayAct("reopen", raiser, { status: "resolved", hasRaiser: true, resolvedAt: null }, now)).toBe(false);
  });

  it("gives somebody who is neither side nothing at all", () => {
    const stranger: EscalationViewer = { isRaiser: false, isHandler: false, isLead: false, isAssignee: false };
    expect(actionsFor(stranger, open, now)).toEqual([]);
  });
});

describe("the text rule", () => {
  it.each([
    ["an 11 digit NIN or BVN", "Their NIN is 12345678901 and it failed."],
    ["a phone number", "Call 08031234567."],
    ["a 10 digit bank account number", "Refund to 0123456789 at their bank."],
    ["a card with no spaces", "Card 4084084084084081 was charged twice."],
    ["a card in fours", "Card 4084 0840 8408 4081 was charged twice."],
    ["a card with dashes", "5399-8300-0000-0008"],
    ["a card in four, six, five", "3714 496353 98431"],
  ])("refuses %s", (_what, text) => {
    expect(carriesPersonalNumber(text)).toBe(true);
  });

  it.each([
    ["an amount", "The payer sent NGN 1,250,000 on Friday."],
    ["a date and a time", "It happened on 2026-11-14 at 09:30, and again on 2026-11-15."],
    ["a reference", "See ESC-000123 and ticket VAL-SUP-4K2P."],
    ["a short count", "There are 123456789 rows, which is 9 digits."],
    ["nothing", ""],
  ])("lets through %s", (_what, text) => {
    expect(carriesPersonalNumber(text)).toBe(false);
  });

  it("answers null and undefined as clean", () => {
    expect(carriesPersonalNumber(null)).toBe(false);
    expect(carriesPersonalNumber(undefined)).toBe(false);
  });

  it("says what to do instead, in the founder's words", () => {
    expect(PERSONAL_NUMBER_REFUSAL).toBe("Link the record instead of pasting an ID or account number.");
  });
});

describe("the attached record", () => {
  it("takes an address inside the console, with its query", () => {
    expect(safeRecordUrl("/admin/kyc?person=abc&tab=documents")).toBe("/admin/kyc?person=abc&tab=documents");
    expect(safeRecordUrl("  /admin/listings/42  ")).toBe("/admin/listings/42");
  });

  it.each([
    "https://example.com/admin/kyc",
    "//example.com/admin/",
    "/admin",
    "/administrator/x",
    "/admin/../settings",
    "/admin//example.com",
    "/admin/kyc\\x",
    "/admin/kyc x",
    "/listings/42",
    "javascript:alert(1)",
    "",
  ])("drops %s", (value) => {
    expect(safeRecordUrl(value)).toBeNull();
  });

  it("drops a missing value and one that is too long", () => {
    expect(safeRecordUrl(null)).toBeNull();
    expect(safeRecordUrl(undefined)).toBeNull();
    expect(safeRecordUrl(`/admin/${"a".repeat(600)}`)).toBeNull();
  });

  it("reads the desk from the page it was raised on", () => {
    expect(sourceDeskOf("/admin/kyc?person=abc")).toBe("/admin/kyc");
    expect(sourceDeskOf("/admin/arrangements/44444444-4444-4444-8444-444444444444")).toBe("/admin/arrangements/44444444-4444-4444-8444-444444444444");
    expect(sourceDeskOf("/admin/")).toBe("/admin");
    expect(sourceDeskOf("/settings")).toBe("/admin");
    expect(sourceDeskOf(null)).toBe("/admin");
    expect(deskRoot("/admin/arrangements/4444")).toBe("/admin/arrangements");
    expect(deskRoot("/admin")).toBe("/admin");
  });

  it("reads a view from the address, and anything unknown as waiting on me", () => {
    expect(readEscalationView("mine")).toBe("mine");
    expect(readEscalationView("all")).toBe("all");
    expect(readEscalationView("everything")).toBe("for_me");
    expect(readEscalationView(undefined)).toBe("for_me");
  });
});

describe("the words", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");

  it("says a length of time in the largest unit that reads well", () => {
    expect(spanWords(20_000)).toBe("less than a minute");
    expect(spanWords(60_000)).toBe("1 minute");
    expect(spanWords(40 * 60_000)).toBe("40 minutes");
    expect(spanWords(2 * 3_600_000)).toBe("2 hours");
    expect(spanWords(47 * 3_600_000)).toBe("47 hours");
    expect(spanWords(72 * 3_600_000)).toBe("3 days");
  });

  it("says due in or overdue by", () => {
    expect(clockOf({ dueAt: "2026-11-15T14:00:00Z", status: "open", resolvedAt: null }, now)).toEqual({ words: "due in 2 hours", overdue: false });
    expect(clockOf({ dueAt: "2026-11-15T09:00:00Z", status: "in_progress", resolvedAt: null }, now)).toEqual({ words: "overdue by 3 hours", overdue: true });
  });

  it("stops the clock while a question is with the raiser, and when it is closed", () => {
    expect(clockOf({ dueAt: "2026-11-15T09:00:00Z", status: "waiting_on_raiser", resolvedAt: null }, now).overdue).toBe(false);
    expect(clockOf({ dueAt: "2026-11-15T09:00:00Z", status: "resolved", resolvedAt: "2026-11-15T10:00:00Z" }, now)).toEqual({ words: "resolved", overdue: false });
  });

  it("says how long it has waited", () => {
    expect(waitedWords({ createdAt: "2026-11-15T07:00:00Z", status: "open", resolvedAt: null }, now)).toBe("waiting 5 hours");
    expect(waitedWords({ createdAt: "2026-11-15T07:00:00Z", status: "resolved", resolvedAt: "2026-11-15T08:00:00Z" }, now)).toBe("closed after 1 hour");
  });

  it("says where it will go, and why when the team is empty", () => {
    expect(whereItGoesWords({ route: "trust_safety", intended: "trust_safety", fallback: false }, "high")).toBe(
      "This goes to Trust and Safety. They aim to answer within 4 hours.",
    );
    expect(whereItGoesWords({ route: "coo", intended: "trust_safety", fallback: true }, "urgent")).toBe(
      "Nobody is on Trust and Safety yet, so this goes to the COO. They aim to answer within 1 hour.",
    );
  });

  it("tells the raiser where it went", () => {
    expect(sentWords("ESC-000123", "finance", "finance")).toBe("ESC-000123 sent to the Finance team. They have been told.");
    expect(sentWords("ESC-000123", "coo", "trust_safety")).toBe(
      "ESC-000123 sent to the COO, because nobody is on Trust and Safety yet. They have been told.",
    );
  });

  it("names who raised it and who has it", () => {
    expect(raisedByWords({ raisedByName: "Kemi", raisedByMe: false }, "the Verification desk")).toBe("Kemi raised this from the Verification desk.");
    expect(raisedByWords({ raisedByName: null, raisedByMe: true }, "the Money desk")).toBe("You raised this from the Money desk.");
    expect(ownerWords({ assignedToName: null, assignedToMe: false, routedTo: "finance", level: 0, status: "open" })).toBe(
      "The Finance team. Nobody has taken it yet.",
    );
    expect(ownerWords({ assignedToName: "Tolu", assignedToMe: false, routedTo: "finance", level: 0, status: "in_progress" })).toBe("Tolu.");
    expect(ownerWords({ assignedToName: null, assignedToMe: false, routedTo: "finance", level: 2, status: "open" })).toBe(
      "The super admin. Nobody has taken it yet.",
    );
  });

  it("writes every line of the timeline in plain words", () => {
    const base = { id: "e", body: null, createdAt: "2026-11-15T10:00:00Z", system: false, actorName: "Tolu", actorMe: false };
    expect(eventWords({ ...base, kind: "raised", detail: { routed_to: "finance", intended: "finance", fallback: false } })).toBe(
      "Tolu raised this. It went to the Finance team.",
    );
    expect(eventWords({ ...base, kind: "raised", detail: { routed_to: "coo", intended: "trust_safety", fallback: true } })).toBe(
      "Tolu raised this. Nobody was on Trust and Safety, so it went to the COO.",
    );
    expect(eventWords({ ...base, kind: "assigned", detail: { self: true, to_name: "Tolu" } })).toBe("Tolu took this.");
    expect(eventWords({ ...base, kind: "assigned", actorName: "Chi", detail: { self: false, to_name: "Tolu" } })).toBe("Chi gave this to Tolu.");
    expect(eventWords({ ...base, kind: "rerouted", detail: { to: "compliance" } })).toBe("Tolu sent this to the Compliance team.");
    expect(eventWords({ ...base, kind: "bumped", system: true, actorName: null, detail: { to_level: 1 } })).toBe(
      "Nobody answered in time, so this moved up to the COO.",
    );
    expect(eventWords({ ...base, kind: "bumped", system: true, actorName: null, detail: { reminder: true } })).toBe(
      "Still overdue. The super admin was reminded.",
    );
    expect(eventWords({ ...base, kind: "resolved", actorMe: true, detail: {} })).toBe("You resolved this.");
    for (const kind of ESCALATION_EVENT_KINDS) expect(eventWords({ ...base, kind, detail: {} }).length, kind).toBeGreaterThan(10);
  });

  it("gives every category a name and a line saying what it covers", () => {
    for (const category of ESCALATION_CATEGORIES) {
      expect(CATEGORY_LABEL[category].name.length, category).toBeGreaterThan(3);
      expect(CATEGORY_LABEL[category].covers.length, category).toBeGreaterThan(20);
    }
  });
});
