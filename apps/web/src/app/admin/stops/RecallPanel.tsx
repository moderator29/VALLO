"use client";

import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { previewRecall, sendRecall } from "@/lib/admin/recall-actions";
import { recallReason, reportRef, willTell, type RecallPreview } from "@/lib/admin/recall";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/**
 * V-60 ON THE STOPS DESK: recall a standing stop for fraud.
 *
 * Two deliberate steps, because this is loud: count who would be told ("This
 * will tell 14 people", with the reason the upheld reports give), then
 * confirm. There is no choosing why: without an upheld fraud report against
 * the account the panel says so and offers nothing. Nothing is sent until the
 * third press. A stop already recalled shows when and to how many, and a
 * lifted stop cannot be recalled at all. The desk reads English.
 */
/* The desk's own words arrive as a prop from the server page (./page.tsx),
   so this client file never imports the dictionary. */
type Desk = Dictionary["trustVisible"]["desk"];

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(
    new Date(iso),
  );
}

export function RecallPanel({ suspensionId, desk }: { suspensionId: string; desk: Desk }) {
  const [preview, setPreview] = useState<RecallPreview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useSafeTransition();

  function count() {
    setMessage(null);
    startTransition(async () => {
      const result = await previewRecall({ suspensionId });
      if (result.ok) setPreview(result.data);
      else setMessage({ ok: false, text: result.error });
    });
  }

  function send() {
    setMessage(null);
    startTransition(async () => {
      /* The report the desk was shown: the database sends only on it. */
      const reportId = preview?.report?.id;
      if (!reportId) return;
      const result = await sendRecall({ suspensionId, reportId });
      if (result.ok) {
        const today = day(new Date().toISOString());
        setMessage({
          ok: true,
          text:
            result.data.recipients === 1
              ? desk.recallSentOne.replace("{date}", today)
              : desk.recallSent.replace("{count}", String(result.data.recipients)).replace("{date}", today),
        });
        setPreview(null);
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  const sent = preview?.sent ?? null;

  return (
    <section className="mt-block" data-testid="recall-panel" aria-label={desk.recallTitle}>
      <h4 className="nf-overline text-[var(--nf-content-muted)]">{desk.recallTitle}</h4>
      <p className="mt-inline-tight nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">{desk.recallLede}</p>

      {sent ? (
        <p role="status" className="mt-row nf-body-sm text-[var(--nf-content-primary)]">
          {(sent.to === 1 ? desk.recallSentOne : desk.recallSent.replace("{count}", String(sent.to))).replace("{date}", day(sent.at))}
        </p>
      ) : preview?.lifted ? (
        <p role="status" className="mt-row nf-body-sm text-[var(--nf-content-secondary)]">
          {desk.recallLifted}
        </p>
      ) : (
        <div className="mt-row grid gap-xs">
          {preview && preview.category === null ? (
            <p role="status" className="nf-body-sm text-[var(--nf-content-secondary)]" data-testid="recall-no-report">
              {desk.recallNoReport}
            </p>
          ) : preview && preview.category ? (
            <>
              <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                {desk.recallBecause.replace("{reason}", recallReason(preview.category, desk))}
                {preview.report ? (
                  <>
                    {" "}
                    <span data-testid="recall-report">
                      {desk.recallReport
                        .replace("{ref}", reportRef(preview.report.id))
                        .replace("{date}", day(preview.report.resolvedAt))}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="nf-body-sm font-semibold text-[var(--nf-content-primary)]" data-testid="recall-count">
                {willTell(preview.audience, desk)}
              </p>
              {preview.audience > 0 && preview.report && (
                <Button variant="danger" size="sm" type="button" onClick={send} disabled={pending}>
                  {pending ? desk.recallSending : desk.recallConfirm}
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" size="sm" type="button" onClick={count} disabled={pending}>
              {pending ? desk.recallCounting : desk.recallCount}
            </Button>
          )}
        </div>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-inline nf-body-sm ${message.ok ? "text-[var(--nf-content-primary)]" : "text-[var(--nf-state-error)]"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
