"use client";

import type { AccountCopy } from "@/components/app/account/settings-copy";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, formatMoney, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { clearPacks } from "@/lib/offline/pack-store";
import { clearShelf } from "@/lib/offline/shelf-store";
import { clearOutbox } from "@/lib/offline/outbox";
import { forgetWidget } from "@/lib/native/widget";
import { clearAllInflight } from "@/lib/offline/inflight";
import {
  DELETE_CONFIRM_PHRASE,
  DELETION_NOTE_MAX,
  DELETION_REASONS,
  GRACE_WINDOW_DAYS,
  type DeletionReason,
} from "@/lib/account-deletion/constants";
import type { Blocker } from "@/lib/account-deletion/preconditions";
import {
  cancelDeletion,
  sendDeletionCode,
  startDeletionAction,
} from "@/lib/account-deletion/actions";
import type { ActionResult } from "@/lib/actions/envelope";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * The deletion control, and everything behind it.
 *
 * WHAT CHANGED AND WHY. This used to be a two-step drawer that ended in
 * `admin.auth.admin.deleteUser`, which aborts on the first row whose foreign
 * key is `on delete restrict`: every booking, every wallet. So the people it
 * failed for were exactly the people who had paid for something, and they were
 * told to email support. App Store Review guideline 5.1.1(v) names that as the
 * rejection case. See `docs/design/audits/r3/findings.md` F-17.
 *
 * NO DARK PATTERNS, AND THAT IS A DESIGN CONSTRAINT RATHER THAN A SENTIMENT.
 * The control sits in Account where somebody would look for it, it is not
 * buried behind a support link, and the copy is exactly as alarming as the
 * truth and no more. The two lists are given equal weight: what is destroyed,
 * and what is kept and why. A precondition that blocks says what it is and
 * carries the control that clears it, because a refusal with no route out is
 * how a product tells somebody to give up.
 *
 * THREE STATES, drawn in this order of precedence:
 *
 *   SCHEDULED   the window is running. The panel leads with the date and the
 *               restore control, and the delete button is gone, because there
 *               is nothing left to press.
 *   BLOCKED     something of theirs is still here. The blockers are listed
 *               with their routes out and the delete button is disabled with
 *               the reason beside it, never hidden.
 *   READY       the drawer opens.
 */

export type DeletePanelProps = {
  t: AccountCopy;
  locale: Locale;
  /** How the account proves it is still them. */
  method: "password" | "email-code";
  blockers: Blocker[];
  /** Set when a deletion is already running. ISO timestamp. */
  purgeAfter: string | null;
  daysLeft: number;
  /** True when the preconditions could not be read at all. */
  unavailable: boolean;
};

/** "{a} {b}" filling, the same shape every other settings row uses. */
function phrase(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value),
    template,
  );
}

function blockerCopy(
  t: AccountCopy,
  locale: Locale,
  blocker: Blocker,
): { line: string; cta: string } {
  const copy = t.settings.delete;
  const count = String(blocker.amount);
  const amount = formatMoney(blocker.amount, locale);
  const many = blocker.amount !== 1;

  switch (blocker.kind) {
    case "partner-held":
      return { line: phrase(copy.blockerPartnerHeld, { amount }), cta: copy.blockerPartnerHeldCta };
    case "rewards-balance":
      return { line: phrase(copy.blockerRewardsBalance, { amount }), cta: copy.blockerRewardsBalanceCta };
    case "rewards-payouts":
      return {
        line: phrase(many ? copy.blockerRewardsPayoutsPlural : copy.blockerRewardsPayouts, { count }),
        cta: copy.blockerRewardsPayoutsCta,
      };
    case "rent-refunds-owed":
      return { line: phrase(copy.blockerRentRefundsOwed, { amount }), cta: copy.blockerRentRefundsCta };
    case "rent-refunds-due":
      return { line: phrase(copy.blockerRentRefundsDue, { amount }), cta: copy.blockerRentRefundsCta };
    case "active-bookings":
      return {
        line: phrase(
          many ? copy.blockerActiveBookingsPlural : copy.blockerActiveBookings,
          { count },
        ),
        cta: copy.blockerActiveBookingsCta,
      };
    case "active-reservations":
      return {
        line: phrase(
          many ? copy.blockerActiveReservationsPlural : copy.blockerActiveReservations,
          { count },
        ),
        cta: copy.blockerActiveReservationsCta,
      };
    case "published-listings":
      return {
        line: phrase(
          many ? copy.blockerPublishedListingsPlural : copy.blockerPublishedListings,
          { count },
        ),
        cta: copy.blockerPublishedListingsCta,
      };
    /*
     * A BUSINESS MAY NEVER BE ORPHANED. The link goes to /host/transfer, which
     * carries both doors: hand it to another Vallo account, which is an offer
     * they have to accept, or close it. Neither is an address to email, which
     * is the rule the whole precondition list is built on.
     */
    case "owned-businesses":
      return {
        line: phrase(
          many ? copy.blockerOwnedBusinessesPlural : copy.blockerOwnedBusinesses,
          { count },
        ),
        cta: copy.blockerOwnedBusinessesCta,
      };
  }
}

export function DeleteAccountPanel({
  t,
  locale,
  method,
  blockers,
  purgeAfter,
  daysLeft,
  unavailable,
}: DeletePanelProps) {
  const copy = t.settings.delete;
  const [drawer, setDrawer] = useState(false);

  if (purgeAfter) {
    return <ScheduledPanel t={t} locale={locale} purgeAfter={purgeAfter} daysLeft={daysLeft} />;
  }

  return (
    <>
      {blockers.length > 0 && (
        <div className="nf-panel nf-panel--card mt-sm block p-md">
          <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{copy.blockedTitle}</p>
          <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
            {copy.blockedBody}
          </p>
          <ul className="mt-sm space-y-xs">
            {blockers.map((blocker) => {
              const words = blockerCopy(t, locale, blocker);
              return (
                <li
                  key={blocker.kind}
                  className="flex flex-wrap items-center justify-between gap-sm text-[length:var(--nf-text-body-sm)]"
                >
                  <span className="text-[var(--nf-content-secondary)]">{words.line}</span>
                  <Link
                    href={blocker.href}
                    className="font-semibold text-[var(--nf-content-link)] hover:underline"
                    data-testid={`delete-blocker-${blocker.kind}`}
                  >
                    {words.cta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {unavailable && (
        <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          {copy.unavailable}
        </p>
      )}

      <div className="mt-sm">
        <Button
          variant="dangerQuiet"
          full
          data-testid="delete-open"
          disabled={blockers.length > 0 || unavailable}
          onClick={() => setDrawer(true)}
        >
          {t.settings.account.deleteAccount}
        </Button>
      </div>

      {drawer && <DeleteDrawer t={t} method={method} onClose={() => setDrawer(false)} />}
    </>
  );
}

/* --------------------------------------------------------- the open window */

function ScheduledPanel({
  t,
  locale,
  purgeAfter,
  daysLeft,
}: {
  t: AccountCopy;
  locale: Locale;
  purgeAfter: string;
  daysLeft: number;
}) {
  const copy = t.settings.delete;
  const router = useRouter();
  const [busy, start] = useSafeTransition();
  /* Restored: the button goes while the page refreshes; the banner says it. */
  const [done, setDone] = useState(false);

  const when = formatDate(new Date(purgeAfter), locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });

  const restore = () => {
    start(async () => {
      try {
        const result = await cancelDeletion();
        if (!result.ok) {
          banner.error(result.error, { retry: restore });
          return;
        }
        setDone(true);
        banner.success(copy.restored, { "data-testid": "delete-restored" });
        router.refresh();
      } catch {
        banner.error("We could not reach Vallo. Check your connection and try again.", { retry: restore });
      }
    });
  };

  return (
    <div
      className="mt-sm nf-panel nf-panel--card block border-[color-mix(in_oklab,var(--nf-state-error)_55%,transparent)] p-md"
      data-testid="delete-scheduled"
    >
      <p className="flex items-center gap-xs text-[length:var(--nf-text-body-sm)] font-semibold">
        <UiIcon name="close" size={20} className="shrink-0 text-[var(--nf-state-error)]" />
        {copy.scheduledTitle}
      </p>
      <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
        {phrase(copy.scheduledBody, { date: when, days: String(daysLeft) })}
      </p>
      {done ? null : (
        <div className="mt-md">
          <Button
            variant="primary"
            full
            onClick={restore}
            loading={busy}
            data-testid="delete-restore"
          >
            {busy ? copy.restoring : copy.restore}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ drawer */

type StartResult = ActionResult<{ purgeAfter: string; graceDays: number }> | null;

function DeleteDrawer({
  t,
  method,
  onClose,
}: {
  t: AccountCopy;
  method: "password" | "email-code";
  onClose: () => void;
}) {
  const router = useRouter();
  const copy = t.settings.delete;
  const [step, setStep] = useState<"explain" | "reason" | "confirm">("explain");
  const [reason, setReason] = useState<DeletionReason | null>(null);
  const [reasonNote, setReasonNote] = useState("");
  const noteId = useId();
  const [phraseValue, setPhraseValue] = useState("");
  const [sending, startSending] = useSafeTransition();
  const phraseId = useId();
  const proofId = useId();

  const [state, formAction, pending] = useActionState<StartResult, FormData>(
    startDeletionAction,
    null,
  );

  /* Escape, Back, the focus trap and return, the scroll lock and drag or
     flick down to close are the platform's `Sheet` in its page shape. This
     was a hand-built full-page panel with its own copy of the first four and
     no gesture. */

  // The window is open and the session is gone with it, so there is nothing
  // behind this drawer to return to.
  useEffect(() => {
    if (!state?.ok) return;
    /* The banner lives in the root layout's host, so it survives the move to
       the home page below: the person lands signed out and is told so. */
    banner.info(copy.scheduledBanner, { durationMs: 9000, "data-testid": "delete-scheduled-banner" });
    /* V-35, V-77: the account is going, so its gate codes, unsent
       check-ins and shortlist copy leave this phone now. */
    void clearPacks();
    void clearShelf();
    void clearOutbox();
    void forgetWidget();
    clearAllInflight();
    const timer = window.setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [state, router, copy.scheduledBanner]);

  const ready = phraseValue.trim() === DELETE_CONFIRM_PHRASE;
  const refusal = state && !state.ok ? (state.fieldErrors?.confirmPhrase ?? state.fieldErrors?.password ?? state.error) : null;

  /* Sent or refused, said by the one banner at the top of the screen
     (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
  const askForCode = () => {
    startSending(async () => {
      try {
        const result = await sendDeletionCode();
        if (!result.ok) {
          banner.error(result.error, { retry: askForCode });
          return;
        }
        banner.success(copy.codeSent);
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.title}
      closeLabel={copy.close}
      fullPage
      testId="delete-drawer"
    >
        <div className="mx-auto max-w-lg">
          {state?.ok ? (
            <div className="nf-panel nf-panel--card block p-lg" data-testid="delete-done">
              <p className="flex items-center gap-xs text-[length:var(--nf-text-body-lg)] font-semibold">
                <UiIcon
                  name="verified"
                  size={20}
                  className="shrink-0 text-[var(--nf-state-success)]"
                />
                {copy.doneTitle}
              </p>
              <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {copy.doneBody}
              </p>
            </div>
          ) : step === "explain" ? (
            <div className="nf-panel nf-panel--card block p-lg">
              <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{copy.permanentTitle}</p>

              <p className="mt-sm text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-link)]">
                {phrase(copy.graceTitle, { days: String(GRACE_WINDOW_DAYS) })}
              </p>
              <p className="mt-2xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {phrase(copy.graceBody, { days: String(GRACE_WINDOW_DAYS) })}
              </p>

              <p className="nf-label mt-md">
                {phrase(copy.destroyedTitle, { days: String(GRACE_WINDOW_DAYS) })}
              </p>
              <ul className="mt-xs space-y-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {[
                  copy.losesProfile,
                  copy.losesContent,
                  copy.losesDevices,
                  copy.losesFiles,
                  copy.losesEvents,
                ].map(
                  (line) => (
                    <li key={line} className="flex gap-sm">
                      <span
                        aria-hidden="true"
                        className="mt-xs h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nf-state-error)]"
                      />
                      {line}
                    </li>
                  ),
                )}
              </ul>

              <p className="nf-label mt-md">{copy.keptTitle}</p>
              <ul className="mt-xs space-y-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {[copy.keepsBookings, copy.keepsMessages, copy.keepsReviews].map((line) => (
                  <li key={line} className="flex gap-sm">
                    <span
                      aria-hidden="true"
                      className="mt-xs h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nf-content-muted)]"
                    />
                    {line}
                  </li>
                ))}
              </ul>

              <p className="mt-md text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                {copy.talkFirst}
              </p>
              <div className="mt-md grid gap-sm sm:grid-cols-2">
                <Button variant="primary" full onClick={onClose}>
                  {copy.keep}
                </Button>
                <Button
                  variant="dangerQuiet"
                  full
                  data-testid="delete-continue"
                  onClick={() => setStep("reason")}
                >
                  {t.common.continue}
                </Button>
              </div>
            </div>
          ) : step === "reason" ? (
            <div className="nf-panel nf-panel--card block p-lg" data-testid="delete-reason-step">
              <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{copy.reasonTitle}</p>
              <p className="mt-2xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
                {copy.reasonHint}
              </p>
              <div role="radiogroup" aria-label={copy.reasonTitle} className="mt-md grid gap-xs">
                {DELETION_REASONS.map((code) => {
                  const chosen = reason === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      data-testid={`delete-reason-${code}`}
                      onClick={() => setReason(code)}
                      className={
                        "flex min-h-[48px] items-center gap-sm rounded-[var(--nf-radius-control)] border px-md text-left text-[length:var(--nf-text-body-sm)] " +
                        (chosen
                          ? "border-[var(--nf-content-link)] bg-[var(--nf-brand-tint-1)] font-semibold"
                          : "border-[var(--nf-border-default)]")
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                          (chosen ? "border-[var(--nf-content-link)]" : "border-[var(--nf-border-default)]")
                        }
                      >
                        {chosen ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--nf-content-link)]" />
                        ) : null}
                      </span>
                      {copy.reasons[code]}
                    </button>
                  );
                })}
              </div>
              <label htmlFor={noteId} className="nf-label mb-2xs mt-md block">
                {copy.reasonNoteLabel}
              </label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={DELETION_NOTE_MAX}
                value={reasonNote}
                onChange={(event) => setReasonNote(event.target.value)}
                className="nf-field"
                data-testid="delete-reason-note"
              />
              <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                {phrase(copy.reasonNoteHint, { max: String(DELETION_NOTE_MAX) })}
              </p>
              <div className="mt-md grid gap-sm sm:grid-cols-2">
                <Button variant="secondary" full onClick={() => setStep("explain")}>
                  {copy.reasonBack}
                </Button>
                <Button
                  variant="dangerQuiet"
                  full
                  data-testid="delete-reason-continue"
                  disabled={reason === null}
                  onClick={() => setStep("confirm")}
                >
                  {copy.reasonContinue}
                </Button>
              </div>
            </div>
          ) : (
            <form action={formAction} className="nf-panel nf-panel--card block p-lg">
              <input type="hidden" name="reason" value={reason ?? ""} />
              <input type="hidden" name="reasonNote" value={reasonNote} />
              <p className="text-[length:var(--nf-text-body-sm)] font-semibold">{copy.confirmTitle}</p>

              {method === "password" ? (
                <>
                  <label htmlFor={proofId} className="nf-label mb-2xs mt-sm block">
                    {copy.passwordLabel}
                  </label>
                  <input
                    id={proofId}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    className="nf-field"
                    data-testid="delete-password"
                  />
                  <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                    {copy.passwordHint}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
                    {copy.codeHint}
                  </p>
                  <div className="mt-sm">
                    <Button
                      variant="secondary"
                      full
                      onClick={askForCode}
                      loading={sending}
                      data-testid="delete-send-code"
                    >
                      {sending ? copy.sendingCode : copy.sendCode}
                    </Button>
                  </div>
                  <label htmlFor={proofId} className="nf-label mb-2xs mt-sm block">
                    {copy.codeLabel}
                  </label>
                  <input
                    id={proofId}
                    name="emailCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="nf-field"
                    data-testid="delete-code"
                  />
                </>
              )}

              <label htmlFor={phraseId} className="nf-label mb-2xs mt-md block">
                {copy.typeToConfirm.replace("{phrase}", DELETE_CONFIRM_PHRASE)}
              </label>
              <input
                id={phraseId}
                name="confirmPhrase"
                data-testid="delete-phrase"
                type="text"
                value={phraseValue}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(event) => setPhraseValue(event.target.value)}
                className="nf-field"
                aria-invalid={state && !state.ok && state.fieldErrors?.confirmPhrase ? true : undefined}
                aria-describedby={refusal ? `${phraseId}-problem` : undefined}
              />
              <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
                {copy.capitals}
              </p>

              {/* A refusal is said by the one banner; the phrase keeps its red
                  edge when it is the phrase that was refused. */}
              <FieldProblem id={`${phraseId}-problem`} message={refusal} when={state} />

              <div className="mt-md grid gap-sm sm:grid-cols-2">
                <Button variant="primary" full onClick={onClose}>
                  {copy.keep}
                </Button>
                <Button
                  type="submit"
                  variant="dangerQuiet"
                  full
                  data-testid="delete-confirm"
                  disabled={!ready}
                  loading={pending}
                >
                  {copy.confirm}
                </Button>
              </div>
            </form>
          )}
        </div>
    </Sheet>
  );
}
