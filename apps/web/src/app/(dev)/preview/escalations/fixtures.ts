import type { EscalationCounts, EscalationDetail, EscalationListData, EscalationRead } from "@/lib/admin/escalations/read";
import type { EscalationRow } from "@/lib/admin/escalations/types";

/**
 * Fixture escalations for the preview harness: invented staff, invented
 * cases, no member's real details. The clock every screen is drawn against
 * is fixed, so "due in" and "overdue by" read the same on every run.
 */
export const PREVIEW_NOW = Date.parse("2026-11-15T12:00:00Z");

const row = (over: Partial<EscalationRow> & Pick<EscalationRow, "id" | "reference" | "title">): EscalationRow => ({
  category: "other",
  severity: "normal",
  status: "open",
  routedTo: "coo",
  level: 1,
  sourceDesk: "/admin",
  raisedByName: "Kemi Adeyemi",
  raisedByMe: false,
  assignedToName: null,
  assignedToMe: false,
  dueAt: "2026-11-16T09:00:00Z",
  createdAt: "2026-11-15T09:00:00Z",
  updatedAt: "2026-11-15T09:00:00Z",
  acknowledgedAt: null,
  resolvedAt: null,
  waitingOnMe: true,
  ...over,
});

export const ROWS: EscalationRow[] = [
  row({
    id: "10000000-0000-4000-8000-000000000001",
    reference: "ESC-000041",
    title: "The same selfie on two accounts",
    category: "identity_fraud",
    severity: "high",
    routedTo: "trust_safety",
    level: 0,
    sourceDesk: "/admin/kyc",
    dueAt: "2026-11-15T09:00:00Z",
    createdAt: "2026-11-15T05:00:00Z",
  }),
  row({
    id: "10000000-0000-4000-8000-000000000002",
    reference: "ESC-000044",
    title: "A payout looks like it was sent twice",
    category: "money",
    severity: "urgent",
    routedTo: "finance",
    level: 0,
    sourceDesk: "/admin/payments",
    raisedByName: "Tolu Bello",
    dueAt: "2026-11-15T12:40:00Z",
    createdAt: "2026-11-15T11:40:00Z",
  }),
  row({
    id: "10000000-0000-4000-8000-000000000003",
    reference: "ESC-000039",
    title: "Refund asked for after the window closed, with a long reason that runs on to show how a title wraps on a phone",
    category: "policy_decision",
    severity: "normal",
    status: "in_progress",
    assignedToName: "You",
    assignedToMe: true,
    sourceDesk: "/admin/support",
    raisedByName: "Ngozi Eze",
    dueAt: "2026-11-16T08:00:00Z",
    createdAt: "2026-11-15T08:00:00Z",
    acknowledgedAt: "2026-11-15T08:20:00Z",
  }),
  row({
    id: "10000000-0000-4000-8000-000000000004",
    reference: "ESC-000036",
    title: "Which of two listings of one flat stays up",
    category: "listing",
    severity: "low",
    status: "waiting_on_raiser",
    routedTo: "listing_approval",
    level: 0,
    sourceDesk: "/admin/listings",
    raisedByName: null,
    raisedByMe: true,
    dueAt: "2026-11-17T10:00:00Z",
    createdAt: "2026-11-14T10:00:00Z",
    acknowledgedAt: "2026-11-14T12:00:00Z",
  }),
  row({
    id: "10000000-0000-4000-8000-000000000005",
    reference: "ESC-000031",
    title: "The payments page showed an error all morning",
    category: "technical",
    severity: "normal",
    status: "resolved",
    routedTo: "technical",
    level: 0,
    sourceDesk: "/admin/payments",
    raisedByName: "Tolu Bello",
    dueAt: "2026-11-14T09:00:00Z",
    createdAt: "2026-11-13T09:00:00Z",
    updatedAt: "2026-11-13T15:00:00Z",
    acknowledgedAt: "2026-11-13T09:30:00Z",
    resolvedAt: "2026-11-13T15:00:00Z",
    waitingOnMe: false,
  }),
];

export const LIST_EMPTY: EscalationRead<EscalationListData> = { state: "ok", data: { view: "for_me", rows: [], canSeeAll: true } };
export const LIST_MIXED: EscalationRead<EscalationListData> = { state: "ok", data: { view: "all", rows: ROWS, canSeeAll: true } };
export const LIST_NOT_SET_UP: EscalationRead<EscalationListData> = { state: "not_set_up" };

export const COUNTS: EscalationRead<EscalationCounts> = {
  state: "ok",
  data: { waiting: 4, overdue: 1, staffed: ["finance", "compliance", "listing_approval", "kyc_review", "support", "coo"], canSeeAll: true },
};

/** A record waiting on the viewer: raised by a colleague, moved up once, a question asked and answered. */
export const RECORD_WAITING: EscalationRead<EscalationDetail> = {
  state: "ok",
  data: {
    record: {
      ...ROWS[0]!,
      routedTo: "trust_safety",
      level: 1,
      status: "acknowledged",
      /* Moved up at 09:00 with half the window again, so due at 11:00. */
      dueAt: "2026-11-15T11:00:00Z",
      acknowledgedAt: "2026-11-15T10:30:00Z",
      whatHappened:
        "The selfie on this identity check is the same photograph as the selfie on another account opened last week. The names and the dates of birth are different.\n\nI have not approved or refused either check, and I have not contacted either person.",
      whatIsNeeded: "Decide whether both accounts are held, and tell me what to do with the check that is open on my desk.",
      recordUrl: "/admin/kyc?person=example",
      recordLabel: "The identity check",
      resolution: null,
      resolvedByName: null,
    },
    events: [
      { id: "e1", kind: "raised", body: null, detail: { routed_to: "trust_safety", intended: "trust_safety", fallback: false }, createdAt: "2026-11-15T05:00:00Z", system: false, actorName: "Kemi Adeyemi", actorMe: false },
      { id: "e2", kind: "bumped", body: null, detail: { from_level: 0, to_level: 1 }, createdAt: "2026-11-15T09:00:00Z", system: true, actorName: null, actorMe: false },
      { id: "e3", kind: "acknowledged", body: null, detail: {}, createdAt: "2026-11-15T10:30:00Z", system: false, actorName: "You", actorMe: true },
      { id: "e4", kind: "asked_raiser", body: "Is the second account still open, or was it closed?", detail: {}, createdAt: "2026-11-15T10:35:00Z", system: false, actorName: "You", actorMe: true },
      { id: "e5", kind: "raiser_replied", body: "Still open. It has one listing waiting for review.", detail: {}, createdAt: "2026-11-15T11:10:00Z", system: false, actorName: "Kemi Adeyemi", actorMe: false },
    ],
    viewer: { isRaiser: false, isHandler: true, isLead: true, isAssignee: false },
    assignable: [
      { id: "20000000-0000-4000-8000-000000000001", name: "Chidi Okafor" },
      { id: "20000000-0000-4000-8000-000000000002", name: "Funke Lawal" },
    ],
  },
};

/** A resolved record, as its raiser sees it. */
export const RECORD_RESOLVED: EscalationRead<EscalationDetail> = {
  state: "ok",
  data: {
    record: {
      ...ROWS[4]!,
      raisedByName: null,
      raisedByMe: true,
      whatHappened: "The payments page showed an error from about nine this morning. Two colleagues saw the same thing.",
      whatIsNeeded: "Find out why and tell us when it is working again.",
      recordUrl: "/admin/payments",
      recordLabel: null,
      resolution: "A scheduled job had stopped. It was started again at 15:00 and the page loads. Nothing was lost.",
      resolvedByName: "Sola Akin",
    },
    events: [
      { id: "r1", kind: "raised", body: null, detail: { routed_to: "technical", intended: "technical", fallback: false }, createdAt: "2026-11-13T09:00:00Z", system: false, actorName: null, actorMe: true },
      { id: "r2", kind: "assigned", body: null, detail: { self: true, to_name: "Sola Akin" }, createdAt: "2026-11-13T09:30:00Z", system: false, actorName: "Sola Akin", actorMe: false },
      { id: "r3", kind: "resolved", body: "A scheduled job had stopped. It was started again at 15:00 and the page loads. Nothing was lost.", detail: {}, createdAt: "2026-11-13T15:00:00Z", system: false, actorName: "Sola Akin", actorMe: false },
    ],
    viewer: { isRaiser: true, isHandler: false, isLead: false, isAssignee: false },
    assignable: [],
  },
};
