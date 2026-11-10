"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { addProofLink, removeProof, saveWeeklyReportDraft, submitWeeklyReport, uploadProofFile } from "@/lib/admin/weekly-reports/actions";
import { FORM_HELP, LIMITS, canRemoveProof, canSubmit, type NumberRow, type ReportStatus } from "@/lib/admin/weekly-reports/model";
import { ProofList, type ProofView } from "@/lib/admin/weekly-reports/ReportView";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { Badge } from "../../_components/panels";

/**
 * THE WEEKLY REPORT FORM. English throughout, a banner for every outcome,
 * nothing optimistic. Every call goes to `lib/admin/weekly-reports/actions`,
 * which checks the caller and the rules again; what this form hides is a
 * courtesy, not the lock.
 */

type Outcome = { ok: true; data: { note?: string | null; late?: boolean } & Record<string, unknown> } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function useAction() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = (task: () => Promise<Outcome>, done: string | ((data: { late?: boolean }) => string), after?: () => void, onFail?: (f: Record<string, string>) => void) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          onFail?.(result.fieldErrors ?? {});
          banner.error(result.error, { retry: () => run(task, done, after, onFail) });
          return;
        }
        feedback("confirm");
        if (result.data.note) banner.warning(result.data.note);
        else banner.success(typeof done === "string" ? done : done(result.data));
        after?.();
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}

type Row = { label: string; value: string; target: string; source: "desk" | "typed"; deskValue: number | null };

const toRow = (n: NumberRow): Row => ({ label: n.label, value: String(n.value), target: n.target === null ? "" : String(n.target), source: n.source, deskValue: n.deskValue });

export type FormProps = {
  week: string;
  /** null when nothing is saved for the week yet. */
  status: ReportStatus | null;
  accomplishments: string;
  blockers: string;
  nextWeek: string;
  numbers: NumberRow[];
  /** Fresh desk counts, for "Refresh the desk counts". */
  deskRows: NumberRow[];
  proofs: ProofView[];
  isLate: boolean;
  reviewNote: string | null;
};

export function WeeklyReportForm(props: FormProps) {
  const { week, status } = props;
  const { pending, run } = useAction();
  const [accomplishments, setAccomplishments] = useState(props.accomplishments);
  const [blockers, setBlockers] = useState(props.blockers);
  const [nextWeek, setNextWeek] = useState(props.nextWeek);
  const [rows, setRows] = useState<Row[]>(props.numbers.map(toRow));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const [fileCaption, setFileCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const input = () => ({
    week,
    accomplishments,
    blockers,
    nextWeek,
    numbers: rows.map((r) => ({
      label: r.label,
      value: r.value.trim() === "" ? null : Number(r.value),
      target: r.target.trim() === "" ? null : Number(r.target),
      source: r.source,
      deskValue: r.deskValue,
    })),
  });

  const setRow = (index: number, patch: Partial<Row>) => setRows((all) => all.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const refreshDesk = () => setRows((all) => [...props.deskRows.map(toRow), ...all.filter((r) => r.source !== "desk")]);
  const mark = (key: string) => (problems[key] ? { "aria-invalid": true as const, "aria-describedby": `weekly-${key}-problem` } : {});
  const submitted = status === "submitted";
  const proofsRemovable = canRemoveProof(status);

  return (
    <div className="grid gap-md" data-testid="weekly-report-form">
      <label className="grid gap-3xs">
        <span className="nf-body font-semibold">{FORM_HELP.accomplishments.title}</span>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{FORM_HELP.accomplishments.help}</span>
        <textarea className="nf-field" rows={6} maxLength={LIMITS.accomplishments} value={accomplishments} onChange={(e) => setAccomplishments(e.target.value)} {...mark("accomplishments")} />
        <FieldProblem id="weekly-accomplishments-problem" message={problems.accomplishments} />
      </label>

      <section className="grid gap-xs" aria-labelledby="weekly-numbers-title">
        <div className="grid gap-3xs">
          <h3 id="weekly-numbers-title" className="nf-body font-semibold">
            {FORM_HELP.numbers.title}
          </h3>
          <p className="nf-caption text-[var(--nf-content-secondary)]">{FORM_HELP.numbers.help}</p>
        </div>
        {rows.length === 0 ? <p className="nf-body-sm text-[var(--nf-content-secondary)]">No rows yet. Add one for each figure you want to report.</p> : null}
        <ul className="grid gap-sm">
          {rows.map((r, i) => (
            <li key={i} className="grid gap-xs sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end" data-testid="weekly-number-row">
              <label className="grid gap-3xs">
                <span className="nf-caption text-[var(--nf-content-secondary)]">Figure</span>
                <input className="nf-field" value={r.label} maxLength={LIMITS.label} onChange={(e) => setRow(i, { label: e.target.value })} {...mark("numbers")} />
              </label>
              <label className="grid gap-3xs">
                <span className="nf-caption text-[var(--nf-content-secondary)]">Number</span>
                <input className="nf-field" inputMode="decimal" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} {...mark("numbers")} />
              </label>
              <label className="grid gap-3xs">
                <span className="nf-caption text-[var(--nf-content-secondary)]">Target (optional)</span>
                <input className="nf-field" inputMode="decimal" value={r.target} onChange={(e) => setRow(i, { target: e.target.value })} {...mark("numbers")} />
              </label>
              <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>
                Remove
              </button>
              {r.source === "desk" ? (
                <p className="sm:col-span-4">
                  <Badge tone="info">Prefilled from the desk</Badge>
                  {r.deskValue !== null && String(r.deskValue) !== r.value.trim() ? (
                    <span className="nf-caption ml-xs text-[var(--nf-content-secondary)]">The desk counted {r.deskValue}.</span>
                  ) : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <FieldProblem id="weekly-numbers-problem" message={problems.numbers} />
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            className="nf-btn nf-btn--sm nf-btn--glass"
            disabled={rows.length >= LIMITS.numberRows}
            onClick={() => setRows((all) => [...all, { label: "", value: "", target: "", source: "typed", deskValue: null }])}
          >
            Add a row
          </button>
          {props.deskRows.length > 0 ? (
            <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" onClick={refreshDesk}>
              Refresh the desk counts
            </button>
          ) : null}
        </div>
      </section>

      <label className="grid gap-3xs">
        <span className="nf-body font-semibold">{FORM_HELP.blockers.title}</span>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{FORM_HELP.blockers.help}</span>
        <textarea className="nf-field" rows={4} maxLength={LIMITS.blockers} value={blockers} onChange={(e) => setBlockers(e.target.value)} {...mark("blockers")} />
        <FieldProblem id="weekly-blockers-problem" message={problems.blockers} />
      </label>

      <label className="grid gap-3xs">
        <span className="nf-body font-semibold">{FORM_HELP.nextWeek.title}</span>
        <span className="nf-caption text-[var(--nf-content-secondary)]">{FORM_HELP.nextWeek.help}</span>
        <textarea className="nf-field" rows={4} maxLength={LIMITS.nextWeek} value={nextWeek} onChange={(e) => setNextWeek(e.target.value)} {...mark("nextWeek")} />
        <FieldProblem id="weekly-nextWeek-problem" message={problems.nextWeek} />
      </label>

      <section className="grid gap-sm" aria-labelledby="weekly-proof-title" data-testid="weekly-proofs">
        <div className="grid gap-3xs">
          <h3 id="weekly-proof-title" className="nf-body font-semibold">
            {FORM_HELP.proofs.title}
          </h3>
          <p className="nf-caption text-[var(--nf-content-secondary)]">{FORM_HELP.proofs.help}</p>
        </div>
        <ProofList proofs={props.proofs} />
        {proofsRemovable && props.proofs.length > 0 ? (
          <ul className="flex flex-wrap gap-xs">
            {props.proofs.map((p) => (
              <li key={p.id}>
                <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => removeProof(week, p.id), "Proof removed")}>
                  {`Remove ${p.kind === "link" ? "link" : (p.name ?? "file")}`}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {submitted ? <p className="nf-caption text-[var(--nf-content-secondary)]">Proof you add now is kept. Removing proof is possible only while the report is a draft or has been reopened.</p> : null}

        <div className="grid gap-xs sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">Link (https)</span>
            <input className="nf-field" type="url" inputMode="url" placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} {...mark("url")} />
            <FieldProblem id="weekly-url-problem" message={problems.url} />
          </label>
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">What it shows</span>
            <input className="nf-field" value={linkCaption} maxLength={LIMITS.caption} onChange={(e) => setLinkCaption(e.target.value)} />
          </label>
          <button
            type="button"
            className="nf-btn nf-btn--sm nf-btn--glass"
            disabled={pending}
            onClick={() => run(() => addProofLink(week, { url: linkUrl, caption: linkCaption }), "Link added", () => { setLinkUrl(""); setLinkCaption(""); setProblems({}); }, setProblems)}
          >
            Add link
          </button>
        </div>

        <div className="grid gap-xs sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">File (image or PDF up to 10MB, video up to 100MB)</span>
            <input ref={fileRef} className="nf-field" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime,video/webm" />
          </label>
          <label className="grid gap-3xs">
            <span className="nf-caption text-[var(--nf-content-secondary)]">What it shows</span>
            <input className="nf-field" value={fileCaption} maxLength={LIMITS.caption} onChange={(e) => setFileCaption(e.target.value)} />
          </label>
          <button
            type="button"
            className="nf-btn nf-btn--sm nf-btn--glass"
            disabled={pending}
            onClick={() => {
              const file = fileRef.current?.files?.[0];
              if (!file) {
                banner.error("Choose a file first.");
                return;
              }
              const data = new FormData();
              data.set("week", week);
              data.set("file", file);
              data.set("caption", fileCaption);
              run(() => uploadProofFile(data), "File added", () => { setFileCaption(""); if (fileRef.current) fileRef.current.value = ""; });
            }}
          >
            Upload file
          </button>
        </div>
      </section>

      {props.reviewNote && status === "reopened" ? (
        <p className="nf-body-sm" role="note">
          Sent back by a reviewer: {props.reviewNote}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-xs">
        <button
          type="button"
          className="nf-btn nf-btn--glass"
          disabled={pending}
          onClick={() => run(() => saveWeeklyReportDraft(input()), submitted ? "Changes saved" : "Draft saved", undefined, setProblems)}
        >
          {submitted ? "Save changes" : "Save draft"}
        </button>
        {canSubmit(status) ? (
          <button
            type="button"
            className="nf-btn nf-btn--primary"
            disabled={pending}
            onClick={() =>
              run(
                () => submitWeeklyReport(input()),
                (d) => (d.late ? "Report submitted. It is marked late." : "Report submitted"),
                undefined,
                setProblems,
              )
            }
          >
            Submit report
          </button>
        ) : null}
        {props.isLate ? <Badge tone="pending">Late</Badge> : null}
      </div>
    </div>
  );
}
