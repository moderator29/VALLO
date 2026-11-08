"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { putBlockedTerm, retireBlockedTerm } from "@/lib/admin/blocked-terms-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

type Option = { value: string; label: string };

type TermCopy = {
  termLabel: string;
  categoryLabel: string;
  actionLabel: string;
  severityLabel: string;
  reasonLabel: string;
  reasonHint: string;
  refusalLabel: string;
  submit: string;
  saved: string;
};

/**
 * Add a term, change a live one, or bring a retired one back: one form, the
 * database function decides which. The schema the action checks
 * (`blocked-terms-rules.ts`) is the same one the function enforces, so a
 * bad shape is a sentence here and never a constraint name.
 */
export function TermForm({
  copy,
  categories,
  actions,
  severities,
}: {
  copy: TermCopy;
  categories: Option[];
  actions: Option[];
  severities: Option[];
}) {
  const router = useRouter();
  const id = useId();
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState(categories[0]?.value ?? "");
  const [action, setAction] = useState("hold");
  const [severity, setSeverity] = useState("medium");
  const [reason, setReason] = useState("");
  const [refusalReason, setRefusalReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useSafeTransition();

  function save() {
    start(async () => {
      try {
        const result = await putBlockedTerm({
          term,
          category,
          action,
          severity,
          reason,
          ...(action === "refuse" ? { refusalReason } : {}),
        });
        if (!result.ok) {
          /* Each field's word stays under its field; the sentence for the
             whole refusal goes to the banner (a retry only when no field
             needs changing first). */
          const fields = result.fieldErrors ?? {};
          setErrors(fields);
          banner.error(result.error, Object.keys(fields).length === 0 ? { retry: save } : undefined);
          return;
        }
        banner.success(copy.saved);
        setTerm("");
        setReason("");
        setRefusalReason("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)] gap-row sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});
        save();
      }}
    >
      <div className="sm:col-span-2">
        <label className="nf-label" htmlFor={`${id}-term`}>
          {copy.termLabel}
        </label>
        <input id={`${id}-term`} className="nf-field" value={term} maxLength={100} onChange={(e) => setTerm(e.target.value)} aria-invalid={errors["term"] ? true : undefined} aria-describedby={errors["term"] ? `${id}-term-problem` : undefined} />
        <FieldProblem id={`${id}-term-problem`} message={errors["term"]} />
      </div>
      <Select id={`${id}-category`} label={copy.categoryLabel} value={category} options={categories} onChange={setCategory} />
      <Select id={`${id}-action`} label={copy.actionLabel} value={action} options={actions} onChange={setAction} error={errors["action"]} />
      <Select id={`${id}-severity`} label={copy.severityLabel} value={severity} options={severities} onChange={setSeverity} />
      <div className="sm:col-span-2">
        <label className="nf-label" htmlFor={`${id}-reason`}>
          {copy.reasonLabel}
        </label>
        <textarea id={`${id}-reason`} className="nf-field" rows={2} maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={errors["reason"] ? true : undefined} aria-describedby={errors["reason"] ? `${id}-reason-problem` : undefined} />
        <p className="nf-caption mt-xs">{copy.reasonHint}</p>
        <FieldProblem id={`${id}-reason-problem`} message={errors["reason"]} />
      </div>
      {action === "refuse" && (
        <div className="sm:col-span-2">
          <label className="nf-label" htmlFor={`${id}-refusal`}>
            {copy.refusalLabel}
          </label>
          <textarea id={`${id}-refusal`} className="nf-field" rows={2} maxLength={400} value={refusalReason} onChange={(e) => setRefusalReason(e.target.value)} aria-invalid={errors["refusalReason"] ? true : undefined} aria-describedby={errors["refusalReason"] ? `${id}-refusal-problem` : undefined} />
          <FieldProblem id={`${id}-refusal-problem`} message={errors["refusalReason"]} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-inline sm:col-span-2">
        <Button type="submit" variant="primary" loading={pending} disabled={term.trim().length < 2 || reason.trim().length < 12}>
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}

function Select({
  id,
  label,
  value,
  options,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  return (
    <div>
      <label className="nf-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="nf-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-problem` : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* The select keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={`${id}-problem`} message={error} />
    </div>
  );
}

type RetireCopy = {
  retire: string;
  retireTitle: string;
  retireBody: string;
  retireReasonLabel: string;
  retireConfirm: string;
  retired: string;
  reasonHint: string;
  cancel: string;
};

export function RetireTerm({ term, copy }: { term: string; copy: RetireCopy }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useSafeTransition();

  function retire() {
    start(async () => {
      try {
        const result = await retireBlockedTerm({ term, reason });
        if (!result.ok) {
          const about = result.fieldErrors?.["reason"];
          if (about) setError(about);
          else banner.error(result.error, { retry: retire });
          return;
        }
        setDone(true);
        banner.success(copy.retired);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /* Retired: the banner says so and the refresh takes the row off the list. */
  if (done) return null;
  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {copy.retire}
      </Button>
    );
  }
  return (
    <form
      className="basis-full rounded-[var(--nf-radius-md)] border border-[color-mix(in_oklab,var(--nf-state-error)_45%,transparent)] p-card-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        retire();
      }}
    >
      <p className="nf-body font-semibold text-content">{copy.retireTitle}</p>
      <p className="nf-body-sm mt-row text-content-2">{copy.retireBody}</p>
      <label className="nf-label mt-row block" htmlFor={`${id}-why`}>
        {copy.retireReasonLabel}
      </label>
      <textarea
        id={`${id}-why`}
        className="nf-field"
        rows={2}
        maxLength={400}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-why-problem` : undefined}
      />
      <p className="nf-caption mt-xs">{copy.reasonHint}</p>
      <div className="mt-row flex flex-wrap gap-inline">
        <Button type="submit" variant="danger" size="sm" loading={pending} disabled={reason.trim().length < 12}>
          {copy.retireConfirm}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          {copy.cancel}
        </Button>
      </div>
      {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
      <FieldProblem id={`${id}-why-problem`} message={error} />
    </form>
  );
}
