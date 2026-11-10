"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { reopenReport, reviewReport } from "@/lib/admin/weekly-reports/actions";
import { LIMITS, type ReportStatus } from "@/lib/admin/weekly-reports/model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Outcome = { ok: true; data: { note?: string | null } } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * The reviewer's two buttons on one report: mark it reviewed, or reopen it
 * for the author. English, a banner for every outcome, nothing optimistic.
 * The actions check the caller again; hiding a button here is a courtesy.
 */
export function ReviewControls({ reportId, status, ownReport }: { reportId: string; status: ReportStatus; ownReport: boolean }) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});

  const run = (task: () => Promise<Outcome>, done: string) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          setProblems(result.fieldErrors ?? {});
          banner.error(result.error, { retry: () => run(task, done) });
          return;
        }
        feedback("confirm");
        if (result.data.note) banner.warning(result.data.note);
        else banner.success(done);
        setNote("");
        setProblems({});
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const canReview = status === "submitted" && !ownReport;
  const canReopen = status === "submitted" || status === "reviewed";
  if (!canReview && !canReopen) {
    return <p className="nf-caption text-[var(--nf-content-secondary)]">{status === "reopened" ? "Waiting for the author to submit again." : "A draft cannot be reviewed yet."}</p>;
  }
  return (
    <div className="grid gap-sm" data-testid="review-controls">
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Note for the author (needed to reopen, optional to mark reviewed)</span>
        <textarea
          className="nf-field"
          rows={3}
          maxLength={LIMITS.reviewNote}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={problems.note ? true : undefined}
          aria-describedby={problems.note ? "review-note-problem" : undefined}
        />
        <FieldProblem id="review-note-problem" message={problems.note} />
      </label>
      <div className="flex flex-wrap gap-xs">
        {canReview ? (
          <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={() => run(() => reviewReport(reportId, note), "Marked reviewed")}>
            Mark reviewed
          </button>
        ) : null}
        {canReopen ? (
          <button type="button" className="nf-btn nf-btn--secondary" disabled={pending} onClick={() => run(() => reopenReport(reportId, note), "Reopened for the author")}>
            Reopen
          </button>
        ) : null}
      </div>
      {ownReport ? <p className="nf-caption text-[var(--nf-content-secondary)]">This is your own report, so another reviewer marks it reviewed.</p> : null}
    </div>
  );
}
