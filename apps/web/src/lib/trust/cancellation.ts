/**
 * The cancellation policy, as data rather than as a paragraph.
 *
 * One schedule governs every stay on the platform. It lives here, client-safe,
 * so the listing, the booking, the safety centre and the admin refund desk all
 * read the same three numbers and none of them can drift into telling somebody
 * a different story about their own money.
 *
 * Two rules that are easy to lose sight of and are the whole point:
 *
 * 1. Nothing has been taken until a stay is paid for. An unpaid hold can be
 *    let go at any hour for nothing, and the calendar reopens.
 * 2. Money is integer kobo. A refund is computed here, in kobo, and never by a
 *    percentage typed into a form somewhere.
 */

/** The three refund outcomes, most generous first. */
export type RefundTier = "full" | "half" | "none";

export type CancellationStop = {
  tier: RefundTier;
  /**
   * How many whole hours before check-in this stop closes. `null` means the
   * stop runs from check-in onwards and never closes.
   */
  closesHoursBeforeCheckIn: number | null;
  /** Basis points of the stay refunded, out of 10,000. Integer arithmetic. */
  refundBasisPoints: number;
  label: string;
  /** The line under the label, written for the guest, not for a lawyer. */
  detail: string;
};

/**
 * 72 hours, not 24. A Lagos guest cancelling a Friday stay on Wednesday
 * evening still leaves the agent a whole working day to re-let the nights,
 * which is the only thing that makes a full refund fair to both sides.
 */
export const FULL_REFUND_HOURS = 72;

/** The schedule, in the order a person meets it. */
export const CANCELLATION_STOPS: CancellationStop[] = [
  {
    tier: "full",
    closesHoursBeforeCheckIn: FULL_REFUND_HOURS,
    refundBasisPoints: 10_000,
    label: "Everything back",
    detail:
      "Cancel more than 72 hours before check-in and the full amount you paid goes back to the card or account you paid with. Support decides within five Nigerian business days of your ask.",
  },
  {
    tier: "half",
    closesHoursBeforeCheckIn: 0,
    refundBasisPoints: 5_000,
    label: "Half back",
    detail:
      "Inside the last 72 hours, half comes back to you. The other half stays with the agent, whose nights are now very hard to re-let.",
  },
  {
    tier: "none",
    closesHoursBeforeCheckIn: null,
    refundBasisPoints: 0,
    label: "Nothing back",
    detail:
      "Once check-in day has started the stay is the agent's to keep. If you never got in, or the place was not what was listed, do not cancel: report it, and a person looks at the booking.",
  },
];

/** Hours between now and check-in. Negative once check-in has passed. */
function hoursUntil(checkInIso: string, now: Date): number {
  // A check-in date with no time is 15:00 in Lagos, the platform's standard
  // arrival hour. Written as a fixed offset because Nigeria does not observe
  // daylight saving and never has.
  const stamp = checkInIso.length <= 10 ? `${checkInIso}T15:00:00+01:00` : checkInIso;
  const checkIn = new Date(stamp).getTime();
  if (Number.isNaN(checkIn)) return 0;
  return (checkIn - now.getTime()) / 3_600_000;
}

export type RefundOutcome = {
  tier: RefundTier;
  stop: CancellationStop;
  /** What returns to the guest, in kobo. */
  refundMinor: number;
  /** What stays with the agent, in kobo. Always `paidMinor - refundMinor`. */
  retainedMinor: number;
  hoursBeforeCheckIn: number;
};

/**
 * What a cancellation is worth right now.
 *
 * `paidMinor` is what the guest actually settled, in kobo. An unpaid hold
 * passes zero and correctly gets a zero refund of a zero payment, which is the
 * honest answer rather than a special case.
 */
export function refundForCancellation(
  paidMinor: number,
  checkInIso: string,
  now: Date = new Date(),
): RefundOutcome {
  const hours = hoursUntil(checkInIso, now);

  const stop =
    CANCELLATION_STOPS.find(
      (candidate) =>
        candidate.closesHoursBeforeCheckIn !== null &&
        hours > candidate.closesHoursBeforeCheckIn,
    ) ?? CANCELLATION_STOPS[CANCELLATION_STOPS.length - 1]!;

  const paid = Math.max(0, Math.trunc(paidMinor));
  const refundMinor = Math.round((paid * stop.refundBasisPoints) / 10_000);

  return {
    tier: stop.tier,
    stop,
    refundMinor,
    retainedMinor: paid - refundMinor,
    hoursBeforeCheckIn: hours,
  };
}

/**
 * The refund a stop is worth against a given total, in kobo. Used by the
 * timeline to show real figures for a real listing rather than percentages.
 */
export function refundAtStop(stop: CancellationStop, totalMinor: number): number {
  const total = Math.max(0, Math.trunc(totalMinor));
  return Math.round((total * stop.refundBasisPoints) / 10_000);
}

/* ------------------------------------------------------------------------- */
/*  Why a stay was cancelled, and what that does to the schedule              */
/* ------------------------------------------------------------------------- */

/**
 * The four cases /cancellations actually names.
 *
 * Three of them override the schedule to a full refund, because the page says
 * in plain words that they do: an agent cancelling, a place that is not what was
 * listed, and a guest who could not get in. The schedule only ever governs a
 * cancellation the guest chose.
 *
 * These four strings are also the check constraint on `booking_refunds.reason`
 * in the database, so a reason that is not one of them cannot be recorded at
 * all. Keep the two in step.
 */
export const CANCELLATION_REASONS = [
  {
    code: "guest_choice",
    label: "The guest is cancelling",
    detail:
      "The published schedule decides the amount: everything back more than 72 hours out, half inside that, nothing once check-in day has started.",
    overridesToFull: false,
  },
  {
    code: "host_cancelled",
    label: "The agent cancelled",
    detail:
      "Everything comes back, whatever the hour. The schedule never applies to a cancellation the guest did not choose.",
    overridesToFull: true,
  },
  {
    code: "not_as_listed",
    label: "The place was not what was listed",
    detail:
      "A standards matter rather than a cancellation. Full refund once a person has looked at it, which is what this decision is.",
    overridesToFull: true,
  },
  {
    code: "no_access",
    label: "The guest could not get in",
    detail:
      "A gate that would not open, an estate with no record of them, a key nobody brought. Full refund once it is confirmed.",
    overridesToFull: true,
  },
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]["code"];

/** The four codes on their own, for a schema to validate against. */
export const CANCELLATION_REASON_CODES = CANCELLATION_REASONS.map(
  (reason) => reason.code,
) as unknown as readonly [CancellationReason, ...CancellationReason[]];

export function cancellationReason(code: CancellationReason) {
  return CANCELLATION_REASONS.find((reason) => reason.code === code) ?? CANCELLATION_REASONS[0];
}

/**
 * What a cancellation is worth given WHY it is happening.
 *
 * This is the one function the refund desk calls, so the console can never
 * compute a figure the published policy does not already promise. It can be
 * more generous than the schedule, in the three cases the page names and only
 * those, and it can never be less generous than the schedule: there is no code
 * path here that returns below `refundForCancellation`.
 */
export function refundForReason(
  reason: CancellationReason,
  paidMinor: number,
  checkInIso: string,
  now: Date = new Date(),
): RefundOutcome {
  const scheduled = refundForCancellation(paidMinor, checkInIso, now);
  if (!cancellationReason(reason).overridesToFull) return scheduled;

  const paid = Math.max(0, Math.trunc(paidMinor));
  const full = CANCELLATION_STOPS[0]!;
  return {
    tier: "full",
    stop: full,
    refundMinor: paid,
    retainedMinor: 0,
    hoursBeforeCheckIn: scheduled.hoursBeforeCheckIn,
  };
}

/* ------------------------------------------------------------------------- */
/*  V-20: the terms that priced a stay, as data, and frozen at payment        */
/* ------------------------------------------------------------------------- */

/**
 * One window of a cancellation schedule: while there are MORE than
 * `closesHoursBefore` hours to check-in, `refundBps` of what was paid comes
 * back. The first open window decides; after the last one nothing does.
 */
export type CancellationTier = { closesHoursBefore: number; refundBps: number };

/**
 * The exact terms a booking was priced under. `source` is
 * "platform_schedule_v1" or "policy:<cancellation_policies.id>".
 *
 * WHY THIS EXISTS. The platform schedule above is a code constant and the
 * per-property policies are an editable table, so either a deploy or a host's
 * edit could quietly change the refund on a stay already paid for. Terms are
 * therefore written onto the booking at payment
 * (`public.booking_cancellation_terms`, migration 20260924140200) and every
 * refund is computed from that row. Twin of
 * `private.platform_cancellation_terms_v1()`, held equal by a test.
 */
export type CancellationTerms = {
  source: string;
  checkInHour: number;
  tiers: CancellationTier[];
};

export const PLATFORM_TERMS_V1: CancellationTerms = {
  source: "platform_schedule_v1",
  checkInHour: 15,
  tiers: CANCELLATION_STOPS.filter(
    (stop): stop is CancellationStop & { closesHoursBeforeCheckIn: number } =>
      stop.closesHoursBeforeCheckIn !== null,
  ).map((stop) => ({ closesHoursBefore: stop.closesHoursBeforeCheckIn, refundBps: stop.refundBasisPoints })),
};

function isBps(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10_000;
}

function isHours(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Read a frozen terms row defensively. A jsonb the database shaped is still
 * somebody else's payload until it has been read; anything malformed answers
 * null, and the caller falls back to the platform schedule, which is what
 * every catalogue booking has been priced under.
 */
export function readCancellationTerms(source: unknown, raw: unknown): CancellationTerms | null {
  if (typeof source !== "string" || source.length === 0) return null;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const hour = record.check_in_hour;
  if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Array.isArray(record.tiers)) return null;
  const tiers: CancellationTier[] = [];
  for (const entry of record.tiers) {
    if (typeof entry !== "object" || entry === null) return null;
    const tier = entry as Record<string, unknown>;
    if (!isHours(tier.closes_hours_before) || !isBps(tier.refund_bps)) return null;
    tiers.push({ closesHoursBefore: tier.closes_hours_before, refundBps: tier.refund_bps });
  }
  return { source, checkInHour: hour, tiers: normaliseTiers(tiers) };
}

/** Most generous window first, the order a person meets them in. */
function normaliseTiers(tiers: CancellationTier[]): CancellationTier[] {
  return [...tiers].sort((a, b) => b.closesHoursBefore - a.closesHoursBefore);
}

/**
 * A property's policy (`cancellation_policies.rules`, `[{refund_bps,
 * hours_before}]`) as terms. The rules are what is computed from; the
 * policy's summary sentence is shown verbatim and is not parsed.
 */
export function termsFromPolicyRules(policyId: string, rules: unknown, checkInHour = 15): CancellationTerms | null {
  if (!Array.isArray(rules)) return null;
  const tiers: CancellationTier[] = [];
  for (const entry of rules) {
    if (typeof entry !== "object" || entry === null) return null;
    const rule = entry as Record<string, unknown>;
    if (!isHours(rule.hours_before) || !isBps(rule.refund_bps)) return null;
    tiers.push({ closesHoursBefore: rule.hours_before, refundBps: rule.refund_bps });
  }
  return { source: `policy:${policyId}`, checkInHour, tiers: normaliseTiers(tiers) };
}

/** The check-in instant the hours are measured to, in Lagos (UTC+1, no DST). */
export function checkInInstant(checkInIso: string, checkInHour = 15): Date | null {
  const hour = String(Math.max(0, Math.min(23, Math.trunc(checkInHour)))).padStart(2, "0");
  const stamp = checkInIso.length <= 10 ? `${checkInIso}T${hour}:00:00+01:00` : checkInIso;
  const at = new Date(stamp);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The share that comes back if cancelled at `now`, in basis points. */
export function refundBpsUnderTerms(terms: CancellationTerms, checkInIso: string, now: Date = new Date()): number {
  const checkIn = checkInInstant(checkInIso, terms.checkInHour);
  if (!checkIn) return 0;
  const hours = (checkIn.getTime() - now.getTime()) / 3_600_000;
  const open = terms.tiers.find((tier) => hours > tier.closesHoursBefore);
  return open ? open.refundBps : 0;
}

/** What comes back under frozen terms, in kobo. Integer arithmetic, never below zero. */
export function refundUnderTerms(
  paidMinor: number,
  checkInIso: string,
  terms: CancellationTerms,
  now: Date = new Date(),
): { refundMinor: number; retainedMinor: number; refundBps: number } {
  const paid = Math.max(0, Math.trunc(paidMinor));
  const refundBps = refundBpsUnderTerms(terms, checkInIso, now);
  const refundMinor = Math.round((paid * refundBps) / 10_000);
  return { refundMinor, retainedMinor: paid - refundMinor, refundBps };
}

/**
 * The schedule as dated windows for one booking: "Until Wed 14 Oct, 3pm:
 * everything back", then each later window, then "From check-in: nothing".
 * `until` null means the window runs to check-in and beyond. The screens
 * render these through `formatMoneyDate`; no screen does the arithmetic.
 */
export type TermsWindow = { refundBps: number; from: Date | null; until: Date | null };

export function termsWindows(terms: CancellationTerms, checkInIso: string): TermsWindow[] {
  const checkIn = checkInInstant(checkInIso, terms.checkInHour);
  if (!checkIn) return [];
  const windows: TermsWindow[] = [];
  let from: Date | null = null;
  for (const tier of terms.tiers) {
    const until = new Date(checkIn.getTime() - tier.closesHoursBefore * 3_600_000);
    windows.push({ refundBps: tier.refundBps, from, until });
    from = until;
  }
  windows.push({ refundBps: 0, from: from ?? checkIn, until: null });
  // Two adjacent windows with the same share are one window to a reader.
  return windows.reduce<TermsWindow[]>((merged, window) => {
    const last = merged[merged.length - 1];
    if (last && last.refundBps === window.refundBps) {
      merged[merged.length - 1] = { ...last, until: window.until };
    } else {
      merged.push(window);
    }
    return merged;
  }, []);
}

/** The instant a full refund stops being available, or null when it never is. */
export function freeToCancelUntil(terms: CancellationTerms, checkInIso: string): Date | null {
  const first = termsWindows(terms, checkInIso)[0];
  if (!first || first.refundBps < 10_000 || first.until === null) return null;
  return first.until;
}

/** True when nothing ever comes back under these terms. */
export function isNonRefundable(terms: CancellationTerms): boolean {
  return terms.tiers.every((tier) => tier.refundBps === 0);
}

/**
 * `refundForReason` with the booking's frozen terms. The three overriding
 * reasons still return everything; a guest's own choice is priced by the
 * terms the booking was paid under, not by today's schedule.
 */
export function refundForReasonUnderTerms(
  reason: CancellationReason,
  paidMinor: number,
  checkInIso: string,
  terms: CancellationTerms | null,
  now: Date = new Date(),
): RefundOutcome {
  const scheduled = refundForReason(reason, paidMinor, checkInIso, now);
  if (!terms || cancellationReason(reason).overridesToFull) {
    return scheduled;
  }
  const priced = refundUnderTerms(paidMinor, checkInIso, terms, now);
  const tier: RefundTier = priced.refundBps >= 10_000 ? "full" : priced.refundBps <= 0 ? "none" : "half";
  const stop = CANCELLATION_STOPS.find((candidate) => candidate.tier === tier) ?? scheduled.stop;
  return {
    tier,
    stop,
    refundMinor: priced.refundMinor,
    retainedMinor: priced.retainedMinor,
    hoursBeforeCheckIn: scheduled.hoursBeforeCheckIn,
  };
}

/**
 * What cancelling is worth FROM NOW, in one of three sentences: free until a
 * date still ahead, a share back, or nothing back. A free window that has
 * already closed is never printed as a promise; from that moment the rate is
 * priced by the next tier.
 */
export type CancelStanding =
  | { kind: "free"; until: Date }
  | { kind: "share"; refundBps: number }
  | { kind: "none" };

export function cancelStanding(terms: CancellationTerms, checkInIso: string, now: Date = new Date()): CancelStanding {
  const until = freeToCancelUntil(terms, checkInIso);
  if (until && until.getTime() > now.getTime()) return { kind: "free", until };
  const bps = refundBpsUnderTerms(terms, checkInIso, now);
  if (bps <= 0) return { kind: "none" };
  return { kind: "share", refundBps: bps };
}

/**
 * Refundable in the sense a guest means it: the first window gives everything
 * back, and (given a check-in) that window is still open now.
 */
export function freeCancellationOpen(
  terms: CancellationTerms,
  checkInIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const first = terms.tiers[0];
  if (!first || first.refundBps < 10_000) return false;
  if (!checkInIso) return true;
  const until = freeToCancelUntil(terms, checkInIso);
  return until !== null && until.getTime() > now.getTime();
}

/* ------------------------------------------------------------------------- */
/*  What is still refundable, after refunds already made against the booking  */
/* ------------------------------------------------------------------------- */

/**
 * A booking can be part-refunded without being cancelled: a goodwill gesture
 * on a stay that goes ahead, a duplicate charge handed back
 * (`refundBookingAsAdmin`). If that booking is later cancelled, the schedule
 * is still applied to what the guest PAID, because that is the figure the
 * published terms are written against, and the result is then bounded by what
 * is actually still refundable.
 *
 * WITHOUT THIS BOUND THE CANCELLATION CANNOT HAPPEN AT ALL. The database
 * refuses any refund above `paid - already refunded`
 * (`private.refund_and_cancel_booking`, status `over_refund`), so an
 * unbounded full refund on a booking that had any part refunded is rejected,
 * the booking stays live, and the operator is told to call engineering. The
 * bound is also the honest amount: a guest promised "everything back" who has
 * already had a third of it back is owed the other two thirds, not the lot
 * again.
 *
 * Integer kobo, never below zero, and never above the schedule's own figure.
 *
 * ONLY THE REFUND MOVES. `retainedMinor` stays `paid - refund`, which is what
 * `private.refund_and_cancel_booking` writes onto `booking_refunds` and what
 * the guest's email prints, so the figure previewed is the figure recorded. A
 * refund made earlier is its own row on the booking, with its own line.
 */
export function boundedByRefundable(
  outcome: RefundOutcome,
  paidMinor: number,
  alreadyRefundedMinor: number,
): RefundOutcome {
  const paid = Math.max(0, Math.trunc(paidMinor));
  const already = Math.max(0, Math.trunc(alreadyRefundedMinor));
  const refundable = Math.max(0, paid - already);
  const refundMinor = Math.min(Math.max(0, Math.trunc(outcome.refundMinor)), refundable);
  return { ...outcome, refundMinor, retainedMinor: paid - refundMinor };
}
