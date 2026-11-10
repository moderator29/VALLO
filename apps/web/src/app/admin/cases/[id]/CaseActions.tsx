"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { plural } from "@vallo/i18n/core";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import {
  actOnCase,
  addCaseEvidence,
  addCaseNote,
  assignCase,
  caseEvidenceLink,
  closeCase,
  escalateCase,
  liftRestriction,
  messageCaseMember,
  reopenCase,
  resolveCase,
  restrictMember,
  setCaseStatus,
} from "@/lib/admin/cases/actions";
import {
  ACTION_LABEL,
  CASE_ACTIONS,
  CASE_RESOLUTIONS,
  RESOLUTION_LABEL,
  RESTRICTION_DAYS,
  RESTRICTION_KINDS,
  RESTRICTION_LABEL,
  restrictionIsHeavy,
  type CaseCan,
  type CaseStatus,
  type RestrictionKind,
} from "@/lib/admin/cases/model";
import type { PersonRef } from "@/lib/features/roommates/model";
import type { ActionResult } from "@/lib/actions/envelope";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { bannerWithUndo } from "@/lib/ui/undo-banner";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type SheetKind = "note" | "escalate" | "message" | "act" | "restrict" | "resolve" | "reopen" | null;

/**
 * The case's actions. Each button is offered only when `can` (the database's
 * answer for this person and this case) says so, and the database checks it
 * again when the action runs. Every outcome is a banner; every sensitive
 * action asks for its reason in a sheet first.
 */
export function CaseActions({
  caseId,
  status,
  can,
  targetType,
  subject,
  reporters,
}: {
  caseId: string;
  status: CaseStatus;
  can: CaseCan;
  targetType: string;
  subject: PersonRef | null;
  reporters: PersonRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<SheetKind>(null);
  const [pending, start] = useSafeTransition();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [kind, setKind] = useState<RestrictionKind>("warning");
  const [tell, setTell] = useState(true);
  const [to, setTo] = useState<string>(subject?.userId ?? reporters[0]?.userId ?? "");

  const closed = status === "resolved" || status === "closed";
  const actions = (CASE_ACTIONS as Record<string, readonly string[]>)[targetType] ?? [];
  const recipients: PersonRef[] = [...(subject ? [subject] : []), ...reporters.filter((r) => r.userId !== subject?.userId)].filter(
    (p, i, all) => all.findIndex((q) => q.userId === p.userId) === i,
  );

  /* `reversible` is the real inverse, for the moves that have one (a status
     change, a close). Undo says its own outcome and refreshes the case. */
  const run = (
    fn: () => Promise<ActionResult<unknown>>,
    success: string,
    reversible?: { undo: () => Promise<ActionResult<unknown>>; undone: string },
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        feedback("confirm");
        if (reversible) bannerWithUndo(success, { ...reversible, onUndone: () => router.refresh() });
        else banner.success(success);
        setOpen(null);
        setText("");
        router.refresh();
      } else {
        feedback("error");
        banner.error(res.error, { retry: () => run(fn, success, reversible) });
      }
    });

  const sheet = (k: Exclude<SheetKind, null>, preset?: () => void) => {
    setText("");
    preset?.();
    setOpen(k);
  };

  const heavy = restrictionIsHeavy(kind, kind === "warning" ? 0 : days);

  return (
    <section className="nf-panel nf-panel--card nf-admin-card flex flex-col gap-sm p-lg" aria-label="Case actions" data-testid="case-actions">
      <h2 className="text-[length:var(--nf-text-body)] font-semibold">Actions</h2>
      {!closed ? (
        <div className="flex flex-wrap gap-xs">
          {can.assign ? (
            <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => assignCase({ caseId }), "The case is yours.")}>
              Take this case
            </Button>
          ) : null}
          {can.note ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("note")}>
              Add note
            </Button>
          ) : null}
          {can.status && status !== "awaiting_info" ? (
            <Button size="sm" variant="secondary" onClick={() => run(() => setCaseStatus({ caseId, status: "awaiting_info" }), "Marked as awaiting information.", {
              undo: () => setCaseStatus({ caseId, status: "under_review" }),
              undone: "Back under review.",
            })}>
              Awaiting information
            </Button>
          ) : null}
          {can.status && status === "awaiting_info" ? (
            <Button size="sm" variant="secondary" onClick={() => run(() => setCaseStatus({ caseId, status: "under_review" }), "Back under review.", {
              undo: () => setCaseStatus({ caseId, status: "awaiting_info" }),
              undone: "Marked as awaiting information again.",
            })}>
              Back to review
            </Button>
          ) : null}
          {can.message && recipients.length ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("message")}>
              Message a member
            </Button>
          ) : null}
          {can.escalate && status !== "escalated" ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("escalate")}>
              Escalate
            </Button>
          ) : null}
          {can.resolve && actions.length ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("act", () => setChoice(actions[0] ?? ""))}>
              Act on the content
            </Button>
          ) : null}
          {(can.restrict || can.suspend) && subject ? (
            <Button size="sm" variant="dangerQuiet" onClick={() => sheet("restrict", () => setKind("warning"))}>
              Restrict member
            </Button>
          ) : null}
          {can.resolve ? (
            <Button size="sm" variant="primary" onClick={() => sheet("resolve", () => setChoice("no_action"))}>
              Resolve
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-xs">
          {can.resolve && status === "resolved" ? (
            <Button size="sm" variant="secondary" onClick={() => run(() => closeCase({ caseId }), "Case closed. It stays on record under Closed.", {
              undo: () => reopenCase({ caseId, reason: "Closed by mistake. Reopened from the banner." }),
              undone: "Case reopened.",
            })}>
              Close case
            </Button>
          ) : null}
          {can.resolve ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("reopen")}>
              Reopen
            </Button>
          ) : null}
          {can.note ? (
            <Button size="sm" variant="secondary" onClick={() => sheet("note")}>
              Add note
            </Button>
          ) : null}
        </div>
      )}
      {!can.resolve ? <p className="nf-caption text-[var(--nf-content-muted)]">Your role can view, note and escalate this case. Decisions sit with its module&apos;s moderators and Trust and Safety.</p> : null}

      <ActionSheet open={open === "note"} onClose={() => setOpen(null)} title="Internal note" description="Only staff see notes." apply="Add note" pending={pending} disabled={text.trim().length < 2}
        onApply={() => run(() => addCaseNote({ caseId, body: text }), "Note added.")}>
        <Area value={text} onChange={setText} label="Note" />
      </ActionSheet>

      <ActionSheet open={open === "escalate"} onClose={() => setOpen(null)} title="Escalate to Trust and Safety" description="It moves to the top of the queue with a 24 hour deadline." apply="Escalate" pending={pending} disabled={text.trim().length < 5}
        onApply={() => run(() => escalateCase({ caseId, reason: text }), "Escalated to Trust and Safety.")}>
        <Area value={text} onChange={setText} label="Why does it need escalating?" />
      </ActionSheet>

      <ActionSheet open={open === "message"} onClose={() => setOpen(null)} title="Message a member" description="Arrives in their notifications from Vallo Trust and Safety. Never mention who reported whom." apply="Send" pending={pending} disabled={text.trim().length < 5 || !to}
        onApply={() => run(() => messageCaseMember({ caseId, to, body: text }), "Message sent.")}>
        <Select label="To" value={to} onChange={setTo} options={recipients.map((p) => ({ value: p.userId, label: `${p.name}${p.userId === subject?.userId ? " (reported)" : " (reported it)"}` }))} />
        <Area value={text} onChange={setText} label="Message" />
      </ActionSheet>

      <ActionSheet open={open === "act"} onClose={() => setOpen(null)} title="Act on the content" description="Every action can be reversed from this case, and the reason is kept in the timeline." apply="Apply" pending={pending} disabled={text.trim().length < 5 || !choice}
        onApply={() => run(() => actOnCase({ caseId, action: choice, reason: text }), "Done. Recorded on the case.")}>
        <Select label="Action" value={choice} onChange={setChoice} options={actions.map((a) => ({ value: a, label: ACTION_LABEL[a as keyof typeof ACTION_LABEL] ?? a }))} />
        <Area value={text} onChange={setText} label="Reason" />
      </ActionSheet>

      <ActionSheet open={open === "restrict"} onClose={() => setOpen(null)} title={`Restrict ${subject?.name ?? "the member"}`}
        description="The member is told at once, with your reason, and can appeal. A suspension, or anything longer than 30 days, needs Trust and Safety."
        apply="Apply restriction" pending={pending} disabled={text.trim().length < 10 || (heavy && !can.suspend)}
        onApply={() => run(() => restrictMember({ userId: subject!.userId, kind, days: kind === "warning" ? 0 : days, reason: text, caseId }), "Restriction applied. The member has been told.")}>
        <Select label="Restriction" value={kind} onChange={(v) => setKind(v as RestrictionKind)} options={RESTRICTION_KINDS.filter((k) => k !== "suspended" || can.suspend).map((k) => ({ value: k, label: RESTRICTION_LABEL[k] }))} />
        {kind !== "warning" ? (
          <Select
            label="For how long"
            value={days === null ? "none" : String(days)}
            onChange={(v) => setDays(v === "none" ? null : Number(v))}
            options={RESTRICTION_DAYS.filter((d) => can.suspend || (d !== null && d <= 30)).map((d) => ({ value: d === null ? "none" : String(d), label: d === null ? "Until lifted" : plural(d, { one: "{count} day", other: "{count} days" }) }))}
          />
        ) : null}
        <Area value={text} onChange={setText} label="Reason the member will read" />
      </ActionSheet>

      <ActionSheet open={open === "resolve"} onClose={() => setOpen(null)} title="Resolve the case" description="Reports on the case close with it. Reporters hear the outcome in plain words, never the details." apply="Resolve" pending={pending} disabled={text.trim().length < 5}
        onApply={() => run(() => resolveCase({ caseId, resolution: choice, note: text, tellReporters: tell }), "Case resolved.")}>
        <Select label="Outcome" value={choice} onChange={setChoice} options={CASE_RESOLUTIONS.map((r) => ({ value: r, label: RESOLUTION_LABEL[r] }))} />
        <Area value={text} onChange={setText} label="Decision note" />
        <Switch checked={tell} onCheckedChange={setTell} label="Tell the people who reported it" />
      </ActionSheet>

      <ActionSheet open={open === "reopen"} onClose={() => setOpen(null)} title="Reopen the case" apply="Reopen" pending={pending} disabled={text.trim().length < 5}
        onApply={() => run(() => reopenCase({ caseId, reason: text }), "Case reopened.")}>
        <Area value={text} onChange={setText} label="Why reopen it?" />
      </ActionSheet>
    </section>
  );
}

function ActionSheet({
  open,
  onClose,
  title,
  description,
  apply,
  onApply,
  pending,
  disabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  apply: string;
  onApply: () => void;
  pending: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())} title={title} description={description} apply={{ label: apply, onClick: onApply, disabled: disabled || pending, loading: pending }}>
      <div className="flex flex-col gap-sm">{children}</div>
    </Sheet>
  );
}

function Area({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-col gap-2xs">
      <span className="nf-label">{label}</span>
      <textarea className="nf-field min-h-[7rem]" value={value} onChange={(e) => onChange(e.target.value)} maxLength={4000} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-2xs">
      <span className="nf-label">{label}</span>
      <select className="nf-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Lift a restriction from the member panel, with a reason the member reads. */
export function LiftButton({ restrictionId, caseId }: { restrictionId: string; caseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useSafeTransition();
  const go = () =>
    start(async () => {
      const res = await liftRestriction({ restrictionId, reason, caseId });
      if (res.ok) {
        feedback("confirm");
        banner.success("Restriction lifted. The member has been told.");
        setOpen(false);
        router.refresh();
      } else {
        feedback("error");
        banner.error(res.error, { retry: go });
      }
    });
  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        Lift
      </Button>
      <ActionSheet open={open} onClose={() => setOpen(false)} title="Lift this restriction" apply="Lift" pending={pending} disabled={reason.trim().length < 5} onApply={go}>
        <Area value={reason} onChange={setReason} label="Reason the member will read" />
      </ActionSheet>
    </>
  );
}

/** Open one evidence file through a five minute private link. */
export function EvidenceOpen({ caseId, evidenceId }: { caseId: string; evidenceId: string }) {
  const [pending, start] = useSafeTransition();
  return (
    <Button
      size="sm"
      variant="quiet"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await caseEvidenceLink({ caseId, evidenceId });
          if (res.ok) window.open(res.data, "_blank", "noopener,noreferrer");
          else banner.error(res.error);
        })
      }
    >
      Open
    </Button>
  );
}

/** Add a screenshot or document to the case. Stored privately; staff open it through a short link. */
export function EvidenceUpload({ caseId }: { caseId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useSafeTransition();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
        className="sr-only"
        aria-label="Add evidence"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const form = new FormData();
          form.set("caseId", caseId);
          form.set("file", file);
          form.set("note", file.name.slice(0, 120));
          start(async () => {
            const res = await addCaseEvidence(form);
            if (res.ok) {
              feedback("confirm");
              banner.success("Evidence added to the case.");
              router.refresh();
            } else {
              feedback("error");
              banner.error(res.error);
            }
            if (input.current) input.current.value = "";
          });
        }}
      />
      <Button size="sm" variant="secondary" loading={pending} onClick={() => input.current?.click()}>
        Add file
      </Button>
    </>
  );
}
