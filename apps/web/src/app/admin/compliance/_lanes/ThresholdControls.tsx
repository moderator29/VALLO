"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { approveThresholdDecision, decideThresholdEvent } from "@/lib/compliance/threshold-actions";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["complianceThreshold"];

function useRun() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? null);
          return;
        }
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  };
  return { pending, error, run };
}

/** SCUML item 7: the officer records the filing (reference and date) or why it is not reportable. */
export function DecideThreshold({ eventId, today, copy }: { eventId: string; today: string; copy: Copy }) {
  const { pending, error, run } = useRun();
  const [decision, setDecision] = useState<"reported" | "not_reportable">("reported");
  const [reference, setReference] = useState("");
  const [reportedOn, setReportedOn] = useState(today);
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-sm"
      data-testid="threshold-decide"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => decideThresholdEvent({ eventId, decision, reference, reportedOn, note }));
      }}
    >
      <div className="flex flex-wrap gap-sm" role="radiogroup">
        <label className="flex min-h-[44px] items-center gap-xs">
          <input type="radio" checked={decision === "reported"} onChange={() => setDecision("reported")} />
          <span className="nf-body-sm">{copy.decide.reported}</span>
        </label>
        <label className="flex min-h-[44px] items-center gap-xs">
          <input type="radio" checked={decision === "not_reportable"} onChange={() => setDecision("not_reportable")} />
          <span className="nf-body-sm">{copy.decide.notReportable}</span>
        </label>
      </div>
      {decision === "reported" ? (
        <div className="grid gap-sm sm:grid-cols-2">
          <Field label={copy.decide.reference}>
            {(control) => (
              <input {...control} className="nf-field" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
            )}
          </Field>
          <Field label={copy.decide.reportedOn}>
            {(control) => (
              <input {...control} className="nf-field" type="date" max={today} value={reportedOn} onChange={(e) => setReportedOn(e.target.value)} />
            )}
          </Field>
        </div>
      ) : (
        <Field label={copy.decide.reason}>
          {(control) => (
            <textarea {...control} className="nf-field min-h-[5rem]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>
      )}
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending} disabled={pending}>
        {copy.decide.record}
      </Button>
    </form>
  );
}

/** SCUML item 19: a second member of staff approves or rejects the recorded decision. */
export function ApproveThreshold({ decisionId, copy }: { decisionId: string; copy: Copy }) {
  const { pending, error, run } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-sm" data-testid="threshold-approve">
      <Field label={copy.approve.note}>
        {(control) => (
          <input {...control} className="nf-field" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
      </Field>
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          loading={pending}
          disabled={pending}
          onClick={() => run(() => approveThresholdDecision({ decisionId, verdict: "approved", note }))}
        >
          {copy.approve.approve}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => approveThresholdDecision({ decisionId, verdict: "rejected", note }))}
        >
          {copy.approve.reject}
        </Button>
      </div>
    </div>
  );
}
