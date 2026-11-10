"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { raiseEscalation, resolveEscalation } from "@/lib/admin/overview/actions";
import { ESCALATION_SOURCE_DESKS, ESCALATION_SOURCE_DESK_LABEL } from "@/lib/admin/overview/types";
import type { CooEscalation } from "@/lib/admin/overview/reads";

/**
 * "Take escalations from the team leads, and decide what they cannot"
 * (JOB_DESCRIPTIONS.coo). A plain list of what is open, oldest first (the
 * one waiting longest is the one most likely to be forgotten), a form to
 * raise one, and a resolved history underneath.
 */
export function EscalationBoard({ escalations, canResolve }: { escalations: CooEscalation[]; canResolve: boolean }) {
  const open = escalations.filter((e) => e.status !== "resolved");
  const resolved = escalations.filter((e) => e.status === "resolved").slice(0, 20);

  return (
    <div className="grid gap-sm" data-testid="escalation-board">
      <RaiseEscalationForm />
      {open.length === 0 ? (
        <p className="nf-body text-[var(--nf-content-secondary)]">No open escalations.</p>
      ) : (
        <ul className="nf-admin-queue">
          {open.map((e) => (
            <EscalationRow key={e.id} escalation={e} canResolve={canResolve} />
          ))}
        </ul>
      )}
      {resolved.length > 0 ? (
        <details className="nf-body">
          <summary>Resolved ({resolved.length})</summary>
          <ul className="nf-admin-queue mt-row">
            {resolved.map((e) => (
              <li key={e.id} className="nf-admin-queue-row">
                <p className="font-semibold">
                  {e.subject}
                  <span className="nf-caption text-[var(--nf-content-secondary)]"> · {ESCALATION_SOURCE_DESK_LABEL[(e.sourceDesk as keyof typeof ESCALATION_SOURCE_DESK_LABEL) ?? "other"] ?? e.sourceDesk}</span>
                </p>
                {e.resolutionNote ? <p className="nf-body text-[var(--nf-content-secondary)]">{e.resolutionNote}</p> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function RaiseEscalationForm() {
  const [sourceDesk, setSourceDesk] = useState<string>(ESCALATION_SOURCE_DESKS[0]);
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [pending, start] = useSafeTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const result = await raiseEscalation({ sourceDesk, subject, detail });
      if (!result.ok) {
        banner.error(result.error);
        return;
      }
      banner.success("Raised to the COO.");
      setSubject("");
      setDetail("");
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-xs"
      data-testid="raise-escalation-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-xs sm:grid-cols-2">
        <label className="grid gap-2xs nf-body">
          <span>Which desk</span>
          <select className="nf-field" value={sourceDesk} onChange={(e) => setSourceDesk(e.target.value)}>
            {ESCALATION_SOURCE_DESKS.map((d) => (
              <option key={d} value={d}>
                {ESCALATION_SOURCE_DESK_LABEL[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2xs nf-body">
          <span>What this is about</span>
          <input className="nf-field" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
      </div>
      <label className="grid gap-2xs nf-body">
        <span>What you need decided</span>
        <textarea className="nf-field" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </label>
      <Button type="submit" variant="primary" loading={pending} data-testid="raise-escalation-submit">
        Raise to the COO
      </Button>
    </form>
  );
}

function EscalationRow({ escalation, canResolve }: { escalation: CooEscalation; canResolve: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useSafeTransition();

  function move(status: "in_progress" | "resolved") {
    start(async () => {
      const result = await resolveEscalation({ id: escalation.id, status, note });
      if (!result.ok) banner.error(result.error);
      else {
        banner.success(status === "resolved" ? "Resolved." : "Marked in progress.");
        router.refresh();
      }
    });
  }

  return (
    <li className="nf-admin-queue-row" data-testid="escalation-row">
      <p className="font-semibold">
        {escalation.subject}
        <span className="nf-caption text-[var(--nf-content-secondary)]"> · {ESCALATION_SOURCE_DESK_LABEL[(escalation.sourceDesk as keyof typeof ESCALATION_SOURCE_DESK_LABEL) ?? "other"] ?? escalation.sourceDesk} · {escalation.status === "in_progress" ? "In progress" : "Open"}</span>
      </p>
      <p className="nf-body text-[var(--nf-content-secondary)]">{escalation.detail}</p>
      {canResolve ? (
        <div className="flex flex-wrap items-end gap-xs mt-row">
          <label className="grid gap-2xs nf-body">
            <span>Resolution note</span>
            <input className="nf-field" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {escalation.status !== "in_progress" ? (
            <Button type="button" variant="glass" size="sm" disabled={pending} onClick={() => move("in_progress")}>
              Mark in progress
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => move("resolved")}>
            Resolve
          </Button>
        </div>
      ) : null}
    </li>
  );
}
