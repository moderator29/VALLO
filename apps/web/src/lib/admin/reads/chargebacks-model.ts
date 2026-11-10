/**
 * THE CHARGEBACKS DESK'S MODEL, with nothing in it that reads or writes.
 *
 * The rules live in the database (`public.chargeback_move`, migration
 * 20261006093655). This file mirrors them for the SCREEN only: which buttons
 * a case offers, what each one sends, and what each refusal means in words.
 * A button this file offers that the database refuses comes back as that
 * refusal; nothing here widens what the function allows. The grid is tested
 * against the function's own transition list (chargebacks-model.test.ts).
 *
 * Pure, so the desk, the detail page, the server actions and the preview
 * fixtures all share one reading of a row.
 */

export const CHARGEBACK_STATES = ["opened", "evidence_requested", "evidence_submitted", "won", "lost"] as const;
export type ChargebackState = (typeof CHARGEBACK_STATES)[number];

export const RECOVERY_STATES = ["none", "owed", "recovered", "written_off"] as const;
export type RecoveryState = (typeof RECOVERY_STATES)[number];

export const CHARGEBACK_PROVIDERS = ["paystack"] as const;
export type ChargebackProvider = (typeof CHARGEBACK_PROVIDERS)[number];

/** Not yet decided by the payment partner. The nav badge counts these. */
export const UNDECIDED_STATES: readonly ChargebackState[] = ["opened", "evidence_requested", "evidence_submitted"];

/** The database's floor for a reason (`length(btrim(p_note)) >= 12`). The desk asks it of every move. */
export const REASON_MIN = 12;
export const REASON_MAX = 2000;

export function isChargebackState(value: unknown): value is ChargebackState {
  return typeof value === "string" && (CHARGEBACK_STATES as readonly string[]).includes(value);
}
export function isRecoveryState(value: unknown): value is RecoveryState {
  return typeof value === "string" && (RECOVERY_STATES as readonly string[]).includes(value);
}
export function isUndecided(state: ChargebackState): boolean {
  return UNDECIDED_STATES.includes(state);
}

/** One row of `public.staff_chargebacks()`, read into the app's words. */
export type ChargebackBase = {
  id: string;
  reference: string;
  transactionId: string;
  provider: string;
  providerDisputeId: string;
  amountMinor: number;
  currency: string;
  state: ChargebackState;
  providerStatus: string | null;
  evidenceDueAt: string | null;
  listerId: string | null;
  listerUnattributed: boolean;
  recoveryState: RecoveryState;
  recoveredMinor: number;
  openedAt: string;
  closedAt: string | null;
  recoveryClosedAt: string | null;
};

/** The base row and what the desk adds to it from the charge it sits on. */
export type ChargebackRow = ChargebackBase & {
  bookingId: string | null;
  agreementId: string | null;
  payerId: string | null;
  payerName: string | null;
  listerName: string | null;
  listingTitle: string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);

/** A row from the RPC, or null when it is not one (a shape the desk cannot read is dropped, never guessed). */
export function baseFromRpc(raw: unknown): ChargebackBase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const state = r.state;
  if (!id || !isChargebackState(state)) return null;
  const recovery = isRecoveryState(r.recovery_state) ? r.recovery_state : "none";
  return {
    id,
    reference: str(r.reference) ?? "",
    transactionId: str(r.transaction_id) ?? "",
    provider: str(r.provider) ?? "",
    providerDisputeId: str(r.provider_dispute_id) ?? "",
    amountMinor: num(r.amount_minor),
    currency: str(r.currency) ?? "NGN",
    state,
    providerStatus: str(r.provider_status),
    evidenceDueAt: str(r.evidence_due_at),
    listerId: str(r.lister_user_id),
    listerUnattributed: r.lister_unattributed === true,
    recoveryState: recovery,
    recoveredMinor: num(r.recovered_minor),
    openedAt: str(r.opened_at) ?? new Date(0).toISOString(),
    closedAt: str(r.closed_at),
    recoveryClosedAt: str(r.recovery_closed_at),
  };
}

/** What is still owed on a lost case: the amount less the cumulative total recovered. */
export function outstandingMinor(row: Pick<ChargebackBase, "state" | "recoveryState" | "amountMinor" | "recoveredMinor">): number {
  if (row.state !== "lost" || row.recoveryState !== "owed") return 0;
  return Math.max(0, row.amountMinor - row.recoveredMinor);
}

/**
 * A payment the payout rule is holding for this lister (migration cbh01): a
 * protected payment Vallo would release to them, or a Rewards Balance
 * payout Vallo would send them, or (migration fm02) a Vallo Guarantee claim
 * a person would pay them by bank transfer. Finance overrides one at a time.
 */
export type HeldSubject = {
  kind: "arrangement" | "rewards_payout" | "guarantee_claim";
  id: string;
  reference: string;
  amountMinor: number;
  status: string;
  /** A finance override is already on the audit log for this one. */
  overridden: boolean;
};

/** Escrow statuses with money still held for the lister, and payout statuses not yet sent. */
export const HELD_ARRANGEMENT_STATUSES = ["protected", "release_requested", "disputed"] as const;
export const HELD_PAYOUT_STATUSES = ["under_review", "processing"] as const;
/** Guarantee claims not yet paid: to decide, or approved and waiting for the transfer. */
export const HELD_CLAIM_STATUSES = ["submitted", "approved"] as const;

/**
 * A Guarantee claim row (id, status, requested_minor, approved_minor) as a
 * held subject's raw shape: a claim has no processor reference, so the claim
 * id is its reference, and what is held is the approved amount once there is
 * one, or what the claim asks for until then.
 */
export function claimAsHeldRow(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const approved = r.approved_minor === null || r.approved_minor === undefined ? null : Number(r.approved_minor);
  return { id: r.id, reference: r.id, status: r.status, amount_minor: approved ?? r.requested_minor };
}

/** Rows read on the service client, shaped; anything malformed is dropped. */
export function heldSubjectsFrom(
  arrangements: unknown[],
  payouts: unknown[],
  overriddenIds: ReadonlySet<string>,
  claims: unknown[] = [],
): HeldSubject[] {
  const shape = (kind: HeldSubject["kind"], raw: unknown): HeldSubject | null => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.reference !== "string" || typeof r.status !== "string") return null;
    const amount = Number(r.amount_minor);
    if (!Number.isFinite(amount)) return null;
    return { kind, id: r.id, reference: r.reference, amountMinor: amount, status: r.status, overridden: overriddenIds.has(r.id) };
  };
  return [
    ...arrangements.map((r) => shape("arrangement", r)),
    ...payouts.map((r) => shape("rewards_payout", r)),
    ...claims.map((r) => shape("guarantee_claim", claimAsHeldRow(r))),
  ].filter((x): x is HeldSubject => x !== null);
}

/** The payout rule, as `public.lister_chargeback_hold` reads it: lost and still owed. */
export function holdsPayouts(row: Pick<ChargebackBase, "state" | "recoveryState">): boolean {
  return row.state === "lost" && row.recoveryState === "owed";
}

/* ----------------------------------------------------------------- moves */

export const MOVE_KEYS = [
  "request_evidence",
  "submit_evidence",
  "won",
  "lost",
  "reverse_to_won",
  "reopen_lost",
  "record_recovery",
  "mark_recovered",
  "write_off",
  "reopen_recovery",
] as const;
export type MoveKey = (typeof MOVE_KEYS)[number];

export function isMoveKey(value: unknown): value is MoveKey {
  return typeof value === "string" && (MOVE_KEYS as readonly string[]).includes(value);
}

export type MoveTone = "primary" | "secondary" | "danger";

export type MoveOffer = {
  key: MoveKey;
  tone: MoveTone;
  /** The sheet asks for the partner's evidence deadline (optional). */
  asksDeadline?: boolean;
  /** The sheet asks how much came back this time (required). */
  asksRecovered?: boolean;
  /** The sheet offers "the partner already took the full amount". */
  offersAlreadyRecovered?: boolean;
};

/**
 * The next moves a case offers, in the order the buttons are drawn: the
 * likely move first, the reversals last. Mirrors the desk grid and the
 * recovery rules in `public.chargeback_move`:
 *
 *   opened             -> evidence_requested | evidence_submitted | won | lost
 *   evidence_requested -> evidence_submitted | won | lost
 *   evidence_submitted -> evidence_requested | won | lost
 *   won                -> lost (reopened, reason)
 *   lost, owed         -> recovered total up, recovered, written_off;
 *                         won (reason) only while nothing was recovered
 *   lost, written_off  -> owed again (reason)
 *   lost, recovered    -> nothing (won is refused once money came back)
 */
export function movesFor(row: Pick<ChargebackBase, "state" | "recoveryState" | "recoveredMinor" | "amountMinor">): MoveOffer[] {
  switch (row.state) {
    case "opened":
      return [
        { key: "request_evidence", tone: "primary", asksDeadline: true },
        { key: "submit_evidence", tone: "secondary" },
        { key: "won", tone: "secondary" },
        { key: "lost", tone: "danger", offersAlreadyRecovered: true },
      ];
    case "evidence_requested":
      return [
        { key: "submit_evidence", tone: "primary" },
        { key: "won", tone: "secondary" },
        { key: "lost", tone: "danger", offersAlreadyRecovered: true },
      ];
    case "evidence_submitted":
      return [
        { key: "won", tone: "primary" },
        { key: "lost", tone: "danger", offersAlreadyRecovered: true },
        { key: "request_evidence", tone: "secondary", asksDeadline: true },
      ];
    case "won":
      return [{ key: "reopen_lost", tone: "danger" }];
    case "lost": {
      if (row.recoveryState === "owed") {
        const offers: MoveOffer[] = [];
        if (row.recoveredMinor < row.amountMinor) offers.push({ key: "record_recovery", tone: "primary", asksRecovered: true });
        offers.push({ key: "mark_recovered", tone: "secondary" }, { key: "write_off", tone: "danger" });
        if (row.recoveredMinor === 0) offers.push({ key: "reverse_to_won", tone: "secondary" });
        return offers;
      }
      if (row.recoveryState === "written_off") return [{ key: "reopen_recovery", tone: "danger" }];
      return [];
    }
  }
}

/** The arguments `public.chargeback_move` is called with, besides the id and the note. */
export type MoveArgs = {
  p_to_state?: ChargebackState;
  p_recovery?: RecoveryState;
  p_recovered_total_minor?: number;
  p_evidence_due_at?: string;
};

export type MoveInput = {
  key: MoveKey;
  /** For record_recovery: the cumulative total after this recovery, in kobo. */
  recoveredTotalMinor?: number;
  /** For lost: the partner already debited the lister in full. */
  alreadyRecovered?: boolean;
  /** For request_evidence: an ISO instant. */
  evidenceDueAt?: string;
};

/**
 * What a move sends. `amountMinor` is the case's amount, for "lost and
 * already recovered", which sends the full cumulative total so the function
 * closes the recovery itself (`owed -> recovered when the cumulative total
 * reaches the amount`).
 */
export function moveArgs(input: MoveInput, amountMinor: number): MoveArgs {
  switch (input.key) {
    case "request_evidence":
      return { p_to_state: "evidence_requested", ...(input.evidenceDueAt ? { p_evidence_due_at: input.evidenceDueAt } : {}) };
    case "submit_evidence":
      return { p_to_state: "evidence_submitted" };
    case "won":
    case "reverse_to_won":
      return { p_to_state: "won" };
    case "lost":
    case "reopen_lost":
      return input.alreadyRecovered && input.key === "lost"
        ? { p_to_state: "lost", p_recovered_total_minor: amountMinor }
        : { p_to_state: "lost" };
    case "record_recovery":
      return { p_recovered_total_minor: input.recoveredTotalMinor ?? 0 };
    case "mark_recovered":
      return { p_recovery: "recovered" };
    case "write_off":
      return { p_recovery: "written_off" };
    case "reopen_recovery":
      return { p_recovery: "owed" };
  }
}

/** Is this move on offer for this row? The action refuses one that is not, before the database is asked. */
export function moveOffered(row: Parameters<typeof movesFor>[0], key: MoveKey): boolean {
  return movesFor(row).some((offer) => offer.key === key);
}

/* --------------------------------------------------------------- results */

export const MOVE_STATUSES = [
  "ok",
  "noop",
  "forbidden",
  "gone",
  "bad_input",
  "illegal",
  "reason_needed",
  "illegal_recovery",
  "recovery_not_open",
  "bad_recovered",
  "recovered_must_be_full",
  "evidence_closed",
] as const;
export type MoveStatus = (typeof MOVE_STATUSES)[number];

export const OPEN_STATUSES = [
  "ok",
  "duplicate",
  "forbidden",
  "bad_input",
  "bad_amount",
  "no_such_charge",
  "provider_mismatch",
  "conflict",
  "not_settled",
  "over_charge",
] as const;
export type OpenStatus = (typeof OPEN_STATUSES)[number];

/** The `status` of a function's jsonb answer, or "" when there is none. */
export function statusOf(data: unknown): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const status = (data as Record<string, unknown>).status;
    return typeof status === "string" ? status : "";
  }
  return "";
}

/** PostgREST's "no such function": a draft (cb01) that is not applied yet. */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

export function field(data: unknown, key: string): unknown {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>)[key] : undefined;
}

/* ---------------------------------------------------------------- query */

export const AGE_BUCKETS = ["week", "month", "older"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export type ChargebackQuery = {
  /** A state, or "owed" for lost and still owed. */
  state: ChargebackState | "owed" | null;
  /** Whole naira, as typed. */
  min: number | null;
  max: number | null;
  age: AgeBucket | null;
  booking: string | null;
  q: string | null;
};

export const EMPTY_QUERY: ChargebackQuery = { state: null, min: null, max: null, age: null, booking: null, q: null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function naira(value: string): number | null {
  const clean = value.replace(/[,\s]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

/** The desk's filters from the address. Anything unreadable is dropped, so a hand-edited link never errors. */
export function readChargebackQuery(params: Record<string, string | string[] | undefined>): ChargebackQuery {
  const state = one(params.state);
  const age = one(params.age);
  const booking = one(params.booking).toLowerCase();
  const q = one(params.q).slice(0, 120);
  return {
    state: state === "owed" || isChargebackState(state) ? state : null,
    min: naira(one(params.min)),
    max: naira(one(params.max)),
    age: (AGE_BUCKETS as readonly string[]).includes(age) ? (age as AgeBucket) : null,
    booking: UUID_RE.test(booking) ? booking : null,
    q: q.length > 0 ? q : null,
  };
}

export function isNarrowed(query: ChargebackQuery): boolean {
  return Object.values(query).some((v) => v !== null);
}

export const DAY_MS = 86_400_000;

/** Whole days since the case opened. */
export function ageDays(openedAt: string, now: number): number {
  const at = Date.parse(openedAt);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}

export function ageBucket(openedAt: string, now: number): AgeBucket {
  const days = ageDays(openedAt, now);
  if (days <= 7) return "week";
  if (days <= 30) return "month";
  return "older";
}

/** The rows a query keeps, in the order they came (the RPC's: work first). */
export function narrowChargebacks<T extends ChargebackRow>(rows: readonly T[], query: ChargebackQuery, now: number): T[] {
  const needle = query.q?.toLowerCase() ?? null;
  return rows.filter((row) => {
    if (query.state === "owed" ? !holdsPayouts(row) : query.state && row.state !== query.state) return false;
    if (query.min !== null && row.amountMinor < Math.round(query.min * 100)) return false;
    if (query.max !== null && row.amountMinor > Math.round(query.max * 100)) return false;
    if (query.age && ageBucket(row.openedAt, now) !== query.age) return false;
    if (query.booking && row.bookingId !== query.booking) return false;
    if (needle && !row.reference.toLowerCase().includes(needle) && !row.providerDisputeId.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export type ChargebackCounts = Record<ChargebackState, number> & { all: number; owed: number; undecided: number };

export function countChargebacks(rows: readonly Pick<ChargebackBase, "state" | "recoveryState">[]): ChargebackCounts {
  const counts: ChargebackCounts = {
    opened: 0,
    evidence_requested: 0,
    evidence_submitted: 0,
    won: 0,
    lost: 0,
    all: rows.length,
    owed: 0,
    undecided: 0,
  };
  for (const row of rows) {
    counts[row.state] += 1;
    if (holdsPayouts(row)) counts.owed += 1;
    if (isUndecided(row.state)) counts.undecided += 1;
  }
  return counts;
}

/** A desk address with this query, one field changed. */
export function chargebacksHref(base: string, query: ChargebackQuery, patch: Partial<ChargebackQuery> = {}): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.state) params.set("state", next.state);
  if (next.min !== null) params.set("min", String(next.min));
  if (next.max !== null) params.set("max", String(next.max));
  if (next.age) params.set("age", next.age);
  if (next.booking) params.set("booking", next.booking);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The evidence deadline against now: none, upcoming or passed (only while undecided). */
export function deadlineOf(row: Pick<ChargebackBase, "state" | "evidenceDueAt">, now: number): "none" | "due" | "overdue" {
  if (!row.evidenceDueAt || !isUndecided(row.state)) return "none";
  return Date.parse(row.evidenceDueAt) < now ? "overdue" : "due";
}

/* ------------------------------------------------------------- timeline */

export type TimelineEntry = {
  id: string;
  kind: "opened" | "transition" | "status_only" | "refreshed" | "note";
  from: ChargebackState | null;
  to: ChargebackState;
  recovery: RecoveryState | null;
  recoveredMinor: number | null;
  evidenceDueAt: string | null;
  actorId: string | null;
  actorName: string | null;
  note: string | null;
  hasRaw: boolean;
  at: string;
};

const KINDS = ["opened", "transition", "status_only", "refreshed", "note"] as const;

/** One row of the draft `staff_chargeback_events`. */
export function entryFromEvent(raw: unknown): TimelineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id || !isChargebackState(r.to_state)) return null;
  const kind = (KINDS as readonly string[]).includes(r.kind as string) ? (r.kind as TimelineEntry["kind"]) : "transition";
  return {
    id,
    kind,
    from: isChargebackState(r.from_state) ? r.from_state : null,
    to: r.to_state,
    recovery: isRecoveryState(r.recovery) ? r.recovery : null,
    recoveredMinor: typeof r.recovered_minor === "number" ? r.recovered_minor : null,
    evidenceDueAt: str(r.evidence_due_at),
    actorId: str(r.actor_id),
    actorName: null,
    note: str(r.note),
    hasRaw: r.has_raw === true,
    at: str(r.created_at) ?? new Date(0).toISOString(),
  };
}

/**
 * One `audit_log` row written by the chargeback functions, read as a timeline
 * entry. The fallback while the draft read is not applied: the audit row
 * carries the states and the totals but not the note.
 */
export function entryFromAudit(raw: unknown, current: ChargebackState): TimelineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const action = str(r.action);
  if (!id || !action) return null;
  const meta = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as Record<string, unknown>;
  const base = { id, actorId: str(r.actor_id), actorName: null, note: null, hasRaw: false, at: str(r.created_at) ?? new Date(0).toISOString() };
  if (action === "chargeback.opened") {
    return { ...base, kind: "opened", from: null, to: "opened", recovery: "none", recoveredMinor: null, evidenceDueAt: null };
  }
  if (action === "chargeback.moved") {
    const to = isChargebackState(meta.to) ? meta.to : current;
    const from = isChargebackState(meta.from) ? meta.from : null;
    const recoveredTo = typeof meta.recovered_to === "number" ? meta.recovered_to : null;
    const recoveredFrom = typeof meta.recovered_from === "number" ? meta.recovered_from : null;
    const kind = meta.kind === "status_only" ? "status_only" : "transition";
    return {
      ...base,
      kind,
      from,
      to,
      recovery: isRecoveryState(meta.recovery_to) ? meta.recovery_to : null,
      recoveredMinor: recoveredTo !== null && recoveredTo !== recoveredFrom ? recoveredTo : null,
      evidenceDueAt: str(meta.evidence_due_at),
    };
  }
  if (action === "chargeback.refreshed") {
    return { ...base, kind: "refreshed", from: current, to: current, recovery: null, recoveredMinor: null, evidenceDueAt: str(meta.evidence_due_at) };
  }
  if (action === "chargeback.noted") {
    return { ...base, kind: "note", from: current, to: current, recovery: null, recoveredMinor: null, evidenceDueAt: null };
  }
  return null;
}

/* -------------------------------------------------------------- notices */

export type NoticeKey = "opened" | "evidence" | "won" | "lost" | "lostRecovered" | "cleared" | "reowed" | "payerDecided";

export type NoticePlan = { to: "lister" | "payer"; key: NoticeKey };

/**
 * Who is told what after a move landed, from the state before and the
 * function's answer after. Undecided steps tell nobody except a request for
 * evidence, which the lister may be asked to help with. A decision tells the
 * lister, and the payer when it is the first decision (a reversal between won
 * and lost is the desk's business with the lister). A recovery that closes
 * tells the lister the hold lifted; one reopened tells them it returned.
 */
export function noticesForMove(
  before: { state: ChargebackState; recoveryState: RecoveryState },
  after: { state: ChargebackState; recoveryState: RecoveryState },
): NoticePlan[] {
  const plans: NoticePlan[] = [];
  if (after.state !== before.state) {
    if (after.state === "evidence_requested") plans.push({ to: "lister", key: "evidence" });
    if (after.state === "won") {
      plans.push({ to: "lister", key: "won" });
      if (isUndecided(before.state)) plans.push({ to: "payer", key: "payerDecided" });
    }
    if (after.state === "lost") {
      plans.push({ to: "lister", key: after.recoveryState === "recovered" ? "lostRecovered" : "lost" });
      if (isUndecided(before.state)) plans.push({ to: "payer", key: "payerDecided" });
    }
    return plans;
  }
  if (after.recoveryState !== before.recoveryState) {
    if (after.recoveryState === "recovered" || after.recoveryState === "written_off") plans.push({ to: "lister", key: "cleared" });
    if (after.recoveryState === "owed" && before.recoveryState === "written_off") plans.push({ to: "lister", key: "reowed" });
  }
  return plans;
}

/** Where a notice sends its reader. */
export const LISTER_NOTICE_HREF = "/payouts#chargeback";
export function payerNoticeHref(bookingId: string | null): string {
  return bookingId ? `/bookings/${bookingId}` : "/payments";
}
