"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { answerStillAvailable } from "@/lib/availability/actions";
import { laterWindow, type AvailabilityAnswer, type AvailabilityCheck } from "@/lib/availability/check";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-14: THE "STILL AVAILABLE?" CARD at the top of a listing thread.
 *
 * The lister sees the question and three one-tap answers: Yes, book a viewing;
 * Yes, from a later date (one date field, then send); No, it has been let. The
 * renter sees that the question is waiting, then the answer. Each answer
 * writes the row and sends the reply as an ordinary message in the lister's
 * name, so the chat reads naturally and the notification is the usual one.
 *
 * Every state is drawn: open for the lister, open for the renter, answered
 * (for both), a date being chosen, sending, and a failed send, which says
 * nothing changed.
 */

type Copy = Dictionary["frontDoor"]["available"];

function day(iso: string, locale: Locale): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00+01:00`) : new Date(iso);
  return formatDate(date, locale, { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

export function AvailabilityCard({
  check,
  copy,
  locale,
  today,
}: {
  check: AvailabilityCheck;
  copy: Copy;
  locale: Locale;
  /** Lagos today, `YYYY-MM-DD`, from the server so the date field agrees with it. */
  today: string;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const range = laterWindow(today);

  function answer(value: AvailabilityAnswer, date?: string) {
    setError(null);
    start(async () => {
      const result = await answerStillAvailable({ checkId: check.id, answer: value, ...(date ? { from: date } : {}) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPicking(false);
      router.refresh();
    });
  }

  const shown =
    check.answer === "available"
      ? copy.shownYes
      : check.answer === "let"
        ? copy.shownLet
        : check.answer === "available_later" && check.availableFrom
          ? copy.shownLater.replace("{date}", day(check.availableFrom, locale))
          : null;

  return (
    <section className="nf-panel nf-panel--card mx-md my-sm p-card-sm" data-testid="availability-card" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.cardTitle}</h2>
        <span className="nf-caption text-[var(--nf-content-muted)]">
          {shown && check.answeredAt
            ? copy.answered.replace("{when}", day(check.answeredAt, locale))
            : copy.askedOn.replace("{when}", day(check.askedAt, locale))}
        </span>
      </div>

      {shown ? (
        <p className="mt-inline nf-badge nf-badge--info inline-block" data-testid="availability-answer">
          {shown}
        </p>
      ) : check.viewer === "asker" ? (
        <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.waiting}</p>
      ) : picking ? (
        <div className="mt-row flex flex-col gap-row">
          <label className="block">
            <span className="nf-label">{copy.laterLabel}</span>
            <input
              type="date"
              className="nf-field"
              min={range.min}
              max={range.max}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="availability-from"
            />
          </label>
          <Button variant="primary" full loading={pending} disabled={from === ""} onClick={() => answer("available_later", from)}>
            {copy.laterSend}
          </Button>
        </div>
      ) : (
        <div className="mt-row flex flex-col gap-row" data-testid="availability-answers">
          <Button variant="primary" full loading={pending} onClick={() => answer("available")}>
            {copy.answerYes}
          </Button>
          <Button variant="secondary" full disabled={pending} onClick={() => setPicking(true)}>
            {copy.answerLater}
          </Button>
          <Button variant="ghost" full disabled={pending} onClick={() => answer("let")}>
            {copy.answerLet}
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-inline nf-body-sm font-semibold text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
