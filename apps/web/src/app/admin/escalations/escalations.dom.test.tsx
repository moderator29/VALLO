import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EscalationDetail, EscalationListData, EscalationRead } from "@/lib/admin/escalations/read";
import type { EscalationRow } from "@/lib/admin/escalations/types";

/**
 * THE ESCALATION SCREENS, drawn from what the reads answer. Pinned: every
 * screen says "not set up yet" in plain words before the SQL has run, and
 * never fails; a list reads overdue rows first, each in plain words; the
 * record is a brief a receiver can act from, and offers only the actions
 * this viewer may take; and the page form reads its three query values and
 * trusts none of them.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }), usePathname: () => "/admin/escalations" }));
vi.mock("@/lib/admin/escalations/actions", () => ({
  raiseEscalation: async () => ({ ok: false, error: "not in a test" }),
  actOnEscalation: async () => ({ ok: false, error: "not in a test" }),
}));

const { EscalationsDesk, sortForDesk } = await import("./EscalationsDesk");
const { EscalationRecordView } = await import("./EscalationRecordView");
const { NewEscalation, readNewEscalationQuery } = await import("./NewEscalation");
const { WaitingOnYou } = await import("./WaitingOnYou");
const { deskName } = await import("./desk-name");

const NOW = Date.parse("2026-11-15T12:00:00Z");
const words = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const row = (over: Partial<EscalationRow> = {}): EscalationRow => ({
  id: "10000000-0000-4000-8000-000000000001",
  reference: "ESC-000041",
  title: "The same selfie on two accounts",
  category: "identity_fraud",
  severity: "high",
  status: "open",
  routedTo: "trust_safety",
  level: 0,
  sourceDesk: "/admin/kyc",
  raisedByName: "Kemi",
  raisedByMe: false,
  assignedToName: null,
  assignedToMe: false,
  dueAt: "2026-11-15T14:00:00Z",
  createdAt: "2026-11-15T07:00:00Z",
  updatedAt: "2026-11-15T07:00:00Z",
  acknowledgedAt: null,
  resolvedAt: null,
  waitingOnMe: true,
  ...over,
});

const list = (rows: EscalationRow[], canSeeAll = false): EscalationRead<EscalationListData> => ({ state: "ok", data: { view: "for_me", rows, canSeeAll } });
const desk = (read: EscalationRead<EscalationListData>, over: Partial<Parameters<typeof EscalationsDesk>[0]> = {}) =>
  renderToStaticMarkup(<EscalationsDesk read={read} view="for_me" canSeeAll={false} waiting={null} now={NOW} locale="en" {...over} />);

describe("the escalations desk", () => {
  it("says not set up yet, in plain words, before the SQL has run", () => {
    const html = desk({ state: "not_set_up" });
    expect(html).toContain('data-testid="escalations-not-set-up"');
    expect(words(html)).toContain("Escalations are not set up yet");
    expect(words(html)).toContain("staff_escalations_2026-11-15.sql");
    expect(html).toContain('href="/admin/manual/escalation"');
    expect(html).not.toContain('data-testid="escalation-row"');
  });

  it("says so when a read failed, and when the viewer is not staff", () => {
    expect(desk({ state: "unavailable" })).toContain('role="alert"');
    expect(words(desk({ state: "forbidden" }))).toContain("Staff only");
  });

  it("says nothing is waiting, and how to raise one", () => {
    expect(words(desk(list([])))).toContain("Nothing is waiting on you");
    expect(words(desk(list([]), { view: "mine" }))).toContain("Use Escalate at the top of any admin page");
    expect(desk(list([]))).toContain('href="/admin/escalations/new"');
  });

  it("draws a row in plain words: the title, who raised it and from where, urgency, the wait, the clock and the status", () => {
    const text = words(desk(list([row()])));
    expect(text).toContain("The same selfie on two accounts");
    expect(text).toContain("Kemi raised this from the Verification desk.");
    expect(text).toContain("High");
    expect(text).toContain("waiting 5 hours");
    expect(text).toContain("due in 2 hours");
    expect(text).toContain("Not seen yet");
    expect(text).not.toContain("identity_fraud");
    expect(text).not.toContain("trust_safety");
  });

  it("says overdue by, counts the overdue, and marks the row", () => {
    const html = desk(list([row({ dueAt: "2026-11-15T09:00:00Z" })]));
    expect(words(html)).toContain("overdue by 3 hours");
    expect(html).toContain('data-overdue="true"');
    expect(words(html)).toContain("1 overdue");
  });

  it("puts overdue rows first, then the soonest due, and closed ones last", () => {
    const soon = row({ id: "a", title: "Due soon", dueAt: "2026-11-15T13:00:00Z" });
    const later = row({ id: "b", title: "Due later", dueAt: "2026-11-16T13:00:00Z" });
    const late = row({ id: "c", title: "Overdue", dueAt: "2026-11-15T10:00:00Z" });
    const veryLate = row({ id: "d", title: "Very overdue", dueAt: "2026-11-14T10:00:00Z" });
    const closed = row({ id: "e", title: "Closed", status: "resolved", resolvedAt: "2026-11-15T08:00:00Z", dueAt: "2026-11-13T10:00:00Z" });
    expect(sortForDesk([later, closed, soon, late, veryLate], NOW).map((r) => r.title)).toEqual(["Very overdue", "Overdue", "Due soon", "Due later", "Closed"]);
    const html = desk(list([later, closed, soon, late]));
    expect(html.indexOf("Overdue")).toBeLessThan(html.indexOf("Due soon"));
    expect(html.indexOf("Due later")).toBeLessThan(html.indexOf("Closed"));
  });

  it("offers All only to the COO and the super admin, and counts what waits on the viewer", () => {
    expect(desk(list([row()]))).not.toContain("view=all");
    const lead = desk(list([row()], true), { waiting: 3 });
    expect(lead).toContain('href="/admin/escalations?view=all"');
    expect(lead).toContain('href="/admin/escalations?view=mine"');
    expect(words(lead)).toContain("Waiting on me 3");
  });

  it("opens each row's own record", () => {
    expect(desk(list([row()]))).toContain('href="/admin/escalations/10000000-0000-4000-8000-000000000001"');
  });

  it("names a desk the way the rail does, and never prints a raw address", () => {
    expect(deskName("/admin/kyc")).toBe("the Verification desk");
    expect(deskName("/admin/arrangements/44444444-4444-4444-8444-444444444444")).toBe("the Protected payments desk");
    expect(deskName("/admin")).toBe("the console overview");
    expect(deskName("/admin/somewhere-new")).toBe("the console");
  });
});

const detail = (over: Partial<EscalationDetail> = {}, record: Partial<EscalationDetail["record"]> = {}): EscalationRead<EscalationDetail> => ({
  state: "ok",
  data: {
    record: {
      ...row({ status: "acknowledged", acknowledgedAt: "2026-11-15T08:00:00Z" }),
      whatHappened: "The selfie on this check is the same photograph as on another account.",
      whatIsNeeded: "Decide whether both accounts are held.",
      recordUrl: "/admin/people/44444444-4444-4444-8444-444444444444",
      recordLabel: "Identity check for a member",
      resolution: null,
      resolvedByName: null,
      ...record,
    },
    events: [
      { id: "e1", kind: "raised", body: null, detail: { routed_to: "trust_safety", intended: "trust_safety", fallback: false }, createdAt: "2026-11-15T07:00:00Z", system: false, actorName: "Kemi", actorMe: false },
      { id: "e2", kind: "asked_raiser", body: "Is the second account still open?", detail: {}, createdAt: "2026-11-15T08:00:00Z", system: false, actorName: "Tolu", actorMe: true },
    ],
    viewer: { isRaiser: false, isHandler: true, isLead: false, isAssignee: false },
    assignable: [],
    ...over,
  },
});
const record = (read: EscalationRead<EscalationDetail>) => renderToStaticMarkup(<EscalationRecordView read={read} now={NOW} locale="en" />);

describe("one escalation", () => {
  it("reads as a brief: what happened, what is needed, the record as a link, who has it and the clock", () => {
    const html = record(detail());
    const text = words(html);
    expect(text).toContain("The same selfie on two accounts");
    expect(text).toContain("ESC-000041 · Identity or fraud");
    expect(text).toContain("What happened The selfie on this check is the same photograph as on another account.");
    expect(text).toContain("What is needed Decide whether both accounts are held.");
    expect(html).toContain('href="/admin/people/44444444-4444-4444-8444-444444444444"');
    expect(text).toContain("Open: Identity check for a member");
    expect(text).toContain("Kemi raised this from the Verification desk.");
    expect(text).toContain("Trust and Safety. Nobody has taken it yet.");
    expect(text).toContain("due in 2 hours, waiting 5 hours");
    expect(text).toContain("High: answered within 4 hours");
  });

  it("warns never to tip off the member on identity and safety, and not on anything else", () => {
    expect(words(record(detail()))).toContain("Never tell the member you suspect them.");
    expect(words(record(detail({}, { category: "money" })))).not.toContain("Never tell the member");
  });

  it("writes the timeline in plain words, with each note under its line", () => {
    const text = words(record(detail()));
    expect(text).toContain("Kemi raised this. It went to Trust and Safety.");
    expect(text).toContain("You asked the raiser a question. Is the second account still open?");
  });

  it("offers the receiving side every action that is theirs, and only those", () => {
    const html = record(detail({}, { status: "open", acknowledgedAt: null }));
    for (const key of ["acknowledge", "assign", "comment", "ask_raiser", "reroute", "resolve", "decline"]) {
      expect(html, key).toContain(`data-testid="escalation-act-${key}"`);
    }
    expect(html).not.toContain('data-testid="escalation-act-raiser_reply"');
    expect(html).not.toContain('data-testid="escalation-act-reopen"');
    expect(html).not.toContain('data-testid="escalation-act-give"');
  });

  it("lets a lead give it to somebody, and nobody else", () => {
    const people = [{ id: "20000000-0000-4000-8000-000000000001", name: "Chidi" }];
    const lead = record(detail({ viewer: { isRaiser: false, isHandler: true, isLead: true, isAssignee: false }, assignable: people }));
    expect(lead).toContain('data-testid="escalation-act-give"');
    expect(record(detail({ assignable: people }))).not.toContain('data-testid="escalation-act-give"');
  });

  it("gives the raiser a note while it is open, and the answer box when a question is waiting", () => {
    const raiser = { isRaiser: true, isHandler: false, isLead: false, isAssignee: false };
    const open = record(detail({ viewer: raiser }, { raisedByMe: true }));
    expect(open).toContain('data-testid="escalation-act-comment"');
    expect(open).not.toContain('data-testid="escalation-act-resolve"');
    expect(open).not.toContain('data-testid="escalation-act-acknowledge"');
    const asked = record(detail({ viewer: raiser }, { raisedByMe: true, status: "waiting_on_raiser" }));
    expect(asked).toContain('data-testid="escalation-act-raiser_reply"');
    expect(words(asked)).toContain("The raiser, who has a question to answer.");
    expect(words(asked)).toContain("waiting for the raiser to answer");
  });

  it("shows a resolved one's closing note, stops its clock, and offers the raiser a reopen within 14 days", () => {
    const raiser = { isRaiser: true, isHandler: false, isLead: false, isAssignee: false };
    const closed = { raisedByMe: true, status: "resolved" as const, resolvedAt: "2026-11-15T10:00:00Z", resolution: "Both accounts are held. Thank you.", resolvedByName: "Tolu" };
    const html = record(detail({ viewer: raiser }, closed));
    const text = words(html);
    expect(text).toContain("Closing note Both accounts are held. Thank you.");
    expect(text).toContain("closed after 3 hours");
    expect(text).not.toContain("due in");
    expect(text).toContain("Nobody. It is closed.");
    expect(html).toContain('data-testid="escalation-act-reopen"');
    const old = record(detail({ viewer: raiser }, { ...closed, resolvedAt: "2026-10-20T10:00:00Z" }));
    expect(old).not.toContain('data-testid="escalation-act-reopen"');
    expect(words(old)).toContain("Nothing for you to do here");
  });

  it("says where it moved to when nobody answered in time", () => {
    const text = words(record(detail({}, { level: 1 })));
    expect(text).toContain("The COO. Nobody has taken it yet.");
    expect(text).toContain("Trust and Safety first. It moved up to the COO when nobody answered in time.");
  });

  it("says no such escalation to somebody who may not see it, and not set up before the SQL has run", () => {
    expect(words(record({ state: "not_found" }))).toContain("No such escalation");
    expect(record({ state: "not_set_up" })).toContain('data-testid="escalations-not-set-up"');
    expect(record({ state: "unavailable" })).toContain('role="alert"');
  });

  it("keeps long text inside the page: it wraps by word, never by letter", () => {
    const html = record(detail({}, { whatHappened: "x".repeat(400) }));
    expect(html).toContain("break-words");
    expect(html).not.toContain("break-all");
    expect(html).not.toContain("anywhere");
  });
});

describe("the form as a page", () => {
  const counts = { state: "ok" as const, data: { waiting: 0, overdue: 0, staffed: ["compliance", "coo"], canSeeAll: false } };
  const page = (query: Parameters<typeof NewEscalation>[0]["query"], c: Parameters<typeof NewEscalation>[0]["counts"] = counts) =>
    renderToStaticMarkup(<NewEscalation query={query} counts={c} locale="en" />);

  it("reads the category, the record and the label from the address", () => {
    expect(readNewEscalationQuery({ category: "identity_fraud", record: "/admin/people/abc", label: "Identity check for Ada" })).toEqual({
      category: "identity_fraud",
      recordUrl: "/admin/people/abc",
      recordLabel: "Identity check for Ada",
    });
  });

  it.each([
    [{ record: "https://example.com/admin/x" }],
    [{ record: "/settings/phone" }],
    [{ record: "/admin/../settings" }],
    [{ record: "//example.com" }],
    [{ record: ["javascript:alert(1)", "/admin/kyc"] }],
  ])("drops a record that is not a page inside the console: %o", (params) => {
    expect(readNewEscalationQuery(params).recordUrl).toBeNull();
  });

  it("ignores a category it does not know, a label with nothing to label, and a label carrying a number", () => {
    expect(readNewEscalationQuery({ category: "weather" }).category).toBeNull();
    expect(readNewEscalationQuery({ label: "Orphan" }).recordLabel).toBeNull();
    expect(readNewEscalationQuery({ record: "/admin/kyc", label: "NIN 12345678901" }).recordLabel).toBeNull();
    expect(readNewEscalationQuery({ record: "/admin/kyc", label: "x".repeat(300) }).recordLabel).toHaveLength(120);
  });

  it("arrives from the ID cross-check with identity chosen, the record attached and the warning showing", () => {
    const html = page({ category: "identity_fraud", recordUrl: "/admin/people/abc", recordLabel: "Identity check for a member" });
    const text = words(html);
    expect(html).toMatch(/<option value="identity_fraud" selected="">/);
    expect(text).toContain("Attached: Identity check for a member");
    expect(html).toContain('href="/admin/people/abc"');
    expect(text).toContain("Never tell the member you suspect them.");
    expect(text).toContain("Do not paste ID numbers, bank details or documents. The link carries the record.");
    /* Nobody is on Trust and Safety in this fixture, so it says where it will really go. */
    expect(text).toContain("Nobody is on Trust and Safety yet, so this goes to the Compliance team. They aim to answer within 24 hours.");
  });

  it("asks the five questions, each urgency with its response time in words", () => {
    const text = words(page({ category: null, recordUrl: null, recordLabel: null }));
    for (const label of ["What kind of issue is it?", "How urgent is it?", "A short title", "What happened", "What you need from them"]) {
      expect(text, label).toContain(label);
    }
    expect(text).toContain("Urgent · answered within 1 hour");
    expect(text).toContain("High · answered within 4 hours");
    expect(text).toContain("Normal · answered within 24 hours");
    expect(text).toContain("Low · answered within 3 days");
    expect(text).toContain("Nothing is attached.");
    expect(text).toContain("Send it somewhere else");
  });

  it("gives every text box a keyboard: sentences, and a return key that says what it does", () => {
    const html = page({ category: null, recordUrl: null, recordLabel: null });
    expect(html.match(/<textarea[^>]*autoCapitalize="sentences"[^>]*enterKeyHint="enter"/g)).toHaveLength(2);
    expect(html).toMatch(/<input[^>]*type="text"[^>]*autoCapitalize="sentences"[^>]*enterKeyHint="next"/);
  });

  it("says not set up instead of offering a form that cannot send", () => {
    const html = page({ category: null, recordUrl: null, recordLabel: null }, { state: "not_set_up" });
    expect(html).toContain('data-testid="escalations-not-set-up"');
    expect(html).not.toContain('data-testid="escalation-form"');
  });

  it("still offers the form when only the staffed list could not be read", () => {
    const html = page({ category: "money", recordUrl: null, recordLabel: null }, { state: "unavailable" });
    expect(html).toContain('data-testid="escalation-form"');
    expect(words(html)).toContain("This goes to the Finance team.");
  });
});

describe("the waiting card", () => {
  const card = (read: EscalationRead<EscalationListData>, props: Partial<Parameters<typeof WaitingOnYou>[0]> = {}) =>
    renderToStaticMarkup(<WaitingOnYou read={read} now={NOW} locale="en" {...props} />);

  it("shows the three that have waited longest, in plain words, with a link to the rest", () => {
    const rows = [
      row({ id: "a", title: "Newest", createdAt: "2026-11-15T11:00:00Z" }),
      row({ id: "b", title: "Oldest", createdAt: "2026-11-13T11:00:00Z", dueAt: "2026-11-14T11:00:00Z" }),
      row({ id: "c", title: "Second", createdAt: "2026-11-14T11:00:00Z" }),
      row({ id: "d", title: "Third", createdAt: "2026-11-15T06:00:00Z" }),
    ];
    const html = card(list(rows));
    const text = words(html);
    expect(text).toContain("4 escalations are waiting on you, 1 overdue.");
    expect(html.match(/data-testid="escalations-waiting-row"/g)).toHaveLength(3);
    expect(html.indexOf("Oldest")).toBeLessThan(html.indexOf("Second"));
    expect(text).not.toContain("Newest");
    expect(text).toContain("See all 4");
    expect(html).toContain('href="/admin/escalations"');
  });

  it("is calm when nothing waits, and says not set up before the SQL has run", () => {
    expect(words(card(list([])))).toContain("Nothing is waiting on you");
    expect(card({ state: "not_set_up" })).toContain('data-testid="escalations-not-set-up"');
  });

  it("speaks of the COO on the COO desk", () => {
    const text = words(card(list([row()]), { title: "Escalations with the COO", who: "the COO" }));
    expect(text).toContain("Escalations with the COO");
    expect(text).toContain("1 escalation is waiting on the COO.");
  });
});
