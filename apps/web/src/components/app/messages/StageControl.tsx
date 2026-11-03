"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import "@/components/workspace/dashboard/dashboard.css";
import { Button } from "@/components/ui/Button";
import { setEnquiryStage } from "@/lib/enquiry/actions";
import { setEnquiryFollowup } from "@/lib/enquiry/followup-actions";
import { addDays, FOLLOWUP_MAX_DAYS, FOLLOWUP_NOTE_MAX } from "@/lib/enquiry/followup";
import { LOST_REASONS, STAGES, type DeskStage, type LostReason, type Stage } from "@/lib/enquiry/stage";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * V-72: THE STAGE, AT THE TOP OF A LISTING THREAD, FOR THE LISTER ONLY.
 *
 * Shows where the enquiry stands and whether an event proved it or the lister
 * set it, and lets the lister move it. Choosing Lost asks for exactly one
 * reason before it can be saved. Every state is drawn: resting, choosing,
 * choosing a reason, saving, and a failed save that says nothing changed.
 * The renter never sees this; the page draws it only for the thread's lister.
 */

type Copy = Dictionary["frontDoor"]["desk"];

export function stageText(stage: DeskStage, copy: Copy): string {
  if (stage.stage === "lost" && stage.lostReason) {
    return copy.lostWithReason.replace("{reason}", copy.reasons[stage.lostReason]);
  }
  return copy.stages[stage.stage];
}

type FollowupCopy = Dictionary["workspaceDash"]["followup"];

/**
 * AGENT-01: THE FOLLOW-UP DATE AND NOTE, BESIDE THE STAGE.
 *
 * "Follow up on <date>" with a short note. On that morning the lister gets
 * one notice that opens this thread. The date runs from today to a year
 * ahead (the input's own min and max, then the server action's rule, then the
 * database's); clearing sends no date and drops the note. Every state is
 * drawn: none set, set, editing, saving, and a failed save that says nothing
 * changed.
 */
function FollowupRow({
  conversationId,
  followup,
  today,
  copy,
  locale,
}: {
  conversationId: string;
  followup: { dueOn: string | null; note: string | null };
  today: string;
  copy: FollowupCopy;
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dueOn, setDueOn] = useState(followup.dueOn ?? "");
  const [note, setNote] = useState(followup.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function send(nextDue: string | null, nextNote: string | null) {
    setError(null);
    start(async () => {
      try {
        const result = await setEnquiryFollowup({ conversationId, dueOn: nextDue, note: nextNote });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        if (nextDue === null) {
          setDueOn("");
          setNote("");
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  const max = addDays(today, FOLLOWUP_MAX_DAYS);
  const dateWords = followup.dueOn
    ? formatDate(new Date(`${followup.dueOn}T12:00:00Z`), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <div className="wsd-followup" data-testid="enquiry-followup" aria-live="polite">
      <div className="wsd-followup__row">
        <div className="min-w-0">
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.label}</p>
          <p className="mt-3xs nf-body-sm font-semibold" data-testid="enquiry-followup-now">
            {followup.dueOn ? copy.set.replace("{date}", dateWords ?? followup.dueOn) : copy.none}
          </p>
          {followup.dueOn && followup.note ? <p className="nf-caption text-[var(--nf-content-muted)]">{followup.note}</p> : null}
        </div>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {copy.change}
          </Button>
        )}
      </div>
      {open && (
        <div className="wsd-followup__form">
          <label className="block">
            <span className="nf-label">{copy.label}</span>
            <input
              className="nf-field"
              type="date"
              min={today}
              max={max}
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              data-testid="enquiry-followup-date"
            />
          </label>
          <label className="block">
            <span className="nf-label">{copy.noteLabel}</span>
            <textarea
              className="nf-field"
              rows={2}
              maxLength={FOLLOWUP_NOTE_MAX}
              placeholder={copy.notePlaceholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="enquiry-followup-note"
            />
          </label>
          <div className="flex flex-wrap gap-sm">
            <Button variant="primary" loading={pending} disabled={dueOn === ""} onClick={() => send(dueOn, note)}>
              {copy.save}
            </Button>
            {followup.dueOn ? (
              <Button variant="secondary" disabled={pending} onClick={() => send(null, null)}>
                {copy.clear}
              </Button>
            ) : null}
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function StageControl({
  conversationId,
  stage,
  copy,
  followup,
  today,
  followupCopy,
  locale,
}: {
  conversationId: string;
  stage: DeskStage;
  copy: Copy;
  /** AGENT-01: the thread's follow-up (nulls when none is set). Absent draws no follow-up row. */
  followup?: { dueOn: string | null; note: string | null };
  /** Today in Lagos, `YYYY-MM-DD`: the earliest date the input offers. */
  today?: string;
  followupCopy?: FollowupCopy;
  locale?: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<Stage>(stage.stage);
  const [reason, setReason] = useState<LostReason | null>(stage.lostReason);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  function save() {
    setError(null);
    start(async () => {
      try {
        const result = await setEnquiryStage({
          conversationId,
          stage: next,
          ...(next === "lost" && reason ? { reason } : {}),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <section className="nf-panel nf-panel--card mx-md my-sm p-card-sm" data-testid="enquiry-stage" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div className="min-w-0">
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.stageLabel}</p>
          <p className="mt-3xs">
            <span className={`nf-badge ${stage.stage === "lost" ? "nf-badge--warning" : "nf-badge--info"}`} data-testid="enquiry-stage-now">
              {stageText(stage, copy)}
            </span>
          </p>
          <p className="mt-3xs nf-caption text-[var(--nf-content-muted)]">{stage.source === "proven" ? copy.proven : copy.manual}</p>
        </div>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {copy.move}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-row flex flex-col gap-row">
          <label className="block">
            <span className="nf-label">{copy.move}</span>
            <select
              className="nf-field"
              value={next}
              onChange={(e) => {
                const value = e.target.value as Stage;
                setNext(value);
                if (value !== "lost") setReason(null);
              }}
              data-testid="enquiry-stage-select"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {copy.stages[s]}
                </option>
              ))}
            </select>
          </label>
          {next === "lost" && (
            <fieldset>
              <legend className="nf-label">{copy.lostPrompt}</legend>
              <div className="mt-inline flex flex-col gap-xs">
                {LOST_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-sm nf-body-sm text-[var(--nf-content-primary)]">
                    <input type="radio" name={`lost-${conversationId}`} value={r} checked={reason === r} onChange={() => setReason(r)} />
                    {copy.reasons[r]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-sm">
            <Button variant="primary" loading={pending} disabled={next === "lost" && reason === null} onClick={save}>
              {copy.save}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-inline nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}

      {followup && today && followupCopy ? (
        <FollowupRow
          conversationId={conversationId}
          followup={followup}
          today={today}
          copy={followupCopy}
          locale={locale ?? "en"}
        />
      ) : null}
    </section>
  );
}
