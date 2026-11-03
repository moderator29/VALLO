"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { clearWeightWithheld } from "@/lib/admin/desk-reads/weight-withheld-actions";
import { fill } from "../_components/copy";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type ClearCopy = {
  clearAction: string;
  clearTitle: string;
  clearBody: string;
  noteLabel: string;
  noteHint: string;
  confirm: string;
  cleared: string;
  cancel: string;
  kind: Record<string, string | undefined>;
};

/**
 * Clearing one stamp. The note is the whole safeguard (the function refuses
 * without one, the console asks for twelve characters), so the box opens
 * only when the operator asks and says what clearing does before it does it.
 */
export function ClearStamp({ kind, subject, copy }: { kind: "review" | "report"; subject: string; copy: ClearCopy }) {
  const router = useRouter();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="nf-body-sm font-semibold text-[var(--nf-state-success)]" role="status">
        {copy.cleared}
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {copy.clearAction}
      </Button>
    );
  }

  return (
    <form
      className="basis-full rounded-[var(--nf-radius-md)] border border-[color-mix(in_oklab,var(--nf-state-warning)_45%,transparent)] p-card-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          try {
            const result = await clearWeightWithheld({ kind, subject, note });
            if (!result.ok) {
              setError(result.fieldErrors?.["note"] ?? result.error);
              return;
            }
            setDone(true);
            router.refresh();
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <p className="nf-body font-semibold text-content">
        {fill(copy.clearTitle, { kind: (copy.kind[kind] ?? kind).toLowerCase() })}
      </p>
      <p className="nf-body-sm mt-row text-content-2">{copy.clearBody}</p>
      <label className="nf-label mt-row block" htmlFor={noteId}>
        {copy.noteLabel}
      </label>
      <textarea
        id={noteId}
        className="nf-field"
        rows={2}
        maxLength={400}
        value={note}
        aria-describedby={`${noteId}-hint`}
        onChange={(event) => setNote(event.target.value)}
      />
      <p id={`${noteId}-hint`} className="nf-caption mt-xs">
        {copy.noteHint}
      </p>
      <div className="mt-row flex flex-wrap gap-inline">
        <Button type="submit" variant="primary" size="sm" loading={pending} disabled={note.trim().length < 12}>
          {copy.confirm}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
          {copy.cancel}
        </Button>
      </div>
      {error && (
        <p role="alert" className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
          {error}
        </p>
      )}
    </form>
  );
}
