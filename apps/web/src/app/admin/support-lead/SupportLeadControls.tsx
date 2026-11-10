"use client";

import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import {
  approvePolicyNote,
  assignTicket,
  createPolicyNote,
  createQaReview,
  restorePolicyNote,
  retirePolicyNote,
  updatePolicyNote,
  withdrawPolicyApproval,
} from "@/lib/admin/support-lead/actions";
import { SCORE_HELP, SCORE_KEYS, SCORE_LABEL, type PolicyNote } from "@/lib/admin/support-lead/model";

import { useDesk } from "../_components/useDesk";
import type { ToolPerson } from "../_components/EntryTool";

/**
 * THE SUPPORT LEAD'S CONTROLS. English throughout; every outcome is the one
 * top banner, with Undo on retiring a policy note and on taking approval back.
 * Nothing here messages a member.
 */

function Labelled({ label, problem, children }: { label: string; problem?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="grid gap-3xs">
      <span className="nf-caption text-[var(--nf-content-secondary)]">{label}</span>
      {children}
      <FieldProblem id={`${label.replace(/\W+/g, "-").toLowerCase()}-problem`} message={problem} />
    </label>
  );
}

export function AssignControl({ ticketId, agents }: { ticketId: string; agents: readonly ToolPerson[] }) {
  const { pending, run } = useDesk();
  const [to, setTo] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-xs">
      <select className="nf-field" aria-label="Hand this ticket to" value={to} onChange={(e) => setTo(e.target.value)}>
        <option value="">Hand to…</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending || !to} onClick={() => run(() => assignTicket(ticketId, to), "Ticket handed over", () => setTo(""))}>
        Assign
      </button>
    </div>
  );
}

const EMPTY_QA = { ticketRef: "", agentId: "", tone: "", accuracy: "", speed: "", policy: "", notes: "" };

export function QaForm({ agents }: { agents: readonly ToolPerson[] }) {
  const { pending, run } = useDesk();
  const [v, setV] = useState(EMPTY_QA);
  const [problems, setProblems] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-sm" data-testid="support-lead-qa-form">
      <div className="grid gap-sm sm:grid-cols-2">
        <Labelled label="Ticket reference" problem={problems.ticketRef}>
          <input className="nf-field" maxLength={64} value={v.ticketRef} onChange={(e) => setV({ ...v, ticketRef: e.target.value })} placeholder="The reference printed on the ticket" aria-invalid={problems.ticketRef ? true : undefined} />
        </Labelled>
        <Labelled label="Agent whose answer you reviewed" problem={problems.agentId}>
          <select className="nf-field" value={v.agentId} onChange={(e) => setV({ ...v, agentId: e.target.value })}>
            <option value="">Choose…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Labelled>
      </div>
      <div className="grid gap-sm sm:grid-cols-4">
        {SCORE_KEYS.map((k) => (
          <Labelled key={k} label={`${SCORE_LABEL[k]} (1 to 5)`} problem={problems[k]}>
            <select className="nf-field" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-describedby={`score-help-${k}`}>
              <option value="">Score…</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <span id={`score-help-${k}`} className="nf-caption text-[var(--nf-content-secondary)]">{SCORE_HELP[k]}</span>
          </Labelled>
        ))}
      </div>
      <Labelled label="What would have been better">
        <textarea className="nf-field min-h-[72px] resize-y" maxLength={2000} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} placeholder="About the answer, not the person. Do not copy the member's words here." />
      </Labelled>
      <div>
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={() => run(() => createQaReview(v), "Review saved", () => { setV(EMPTY_QA); setProblems({}); }, setProblems)}>
          Save review
        </button>
      </div>
    </div>
  );
}

export function PolicyForm({ editing, onDone }: { editing?: PolicyNote | null; onDone?: () => void }) {
  const { pending, run } = useDesk();
  const [v, setV] = useState({ title: editing?.title ?? "", body: editing?.body ?? "" });
  const [problems, setProblems] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-sm" data-testid="support-lead-policy-form">
      <Labelled label="Title" problem={problems.title}>
        <input className="nf-field" maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} aria-invalid={problems.title ? true : undefined} />
      </Labelled>
      <Labelled label="Policy" problem={problems.body}>
        <textarea className="nf-field min-h-[140px] resize-y" maxLength={8000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What the team does and says, and when to escalate. Plain words." aria-invalid={problems.body ? true : undefined} />
      </Labelled>
      <div className="flex flex-wrap gap-xs">
        <button
          type="button"
          className="nf-btn nf-btn--primary"
          disabled={pending}
          onClick={() => run(() => (editing ? updatePolicyNote(editing.id, v) : createPolicyNote(v)), editing ? "Draft saved" : "Draft saved. It is waiting for approval.", () => { if (!editing) setV({ title: "", body: "" }); setProblems({}); onDone?.(); }, setProblems)}
        >
          {editing ? "Save draft" : "Save draft policy note"}
        </button>
        {editing && onDone ? <button type="button" className="nf-btn nf-btn--glass" onClick={onDone}>Close</button> : null}
      </div>
    </div>
  );
}

export function PolicyActions({ note, canMake, canApprove }: { note: PolicyNote; canMake: boolean; canApprove: boolean }) {
  const { pending, run } = useDesk();
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <div className="grid gap-xs">
      <div className="flex flex-wrap gap-xs">
        {canApprove && note.status === "draft" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => approvePolicyNote(note.id), "Approved. The team may now work from it.")}>Approve</button>
        ) : null}
        {canMake && note.status === "draft" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" onClick={() => setEditing((x) => !x)} aria-expanded={editing}>{editing ? "Close editor" : "Edit"}</button>
        ) : null}
        {canMake && note.status !== "retired" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => retirePolicyNote(note.id), { message: "Policy note retired.", undo: () => restorePolicyNote(note.id), undone: "Put back as a draft. It needs approval again." })}>Retire</button>
        ) : null}
        {canMake && note.status === "retired" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => restorePolicyNote(note.id), "Put back as a draft. It needs approval again.")}>Put back</button>
        ) : null}
      </div>
      {(canMake || canApprove) && note.status === "approved" ? (
        <div className="grid gap-xs">
          <Labelled label="Take back to draft (give the reason)" problem={problem}>
            <input className="nf-field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={problem ? true : undefined} />
          </Labelled>
          <div>
            <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => withdrawPolicyApproval(note.id, reason), { message: "Taken back to draft.", undo: () => approvePolicyNote(note.id), undone: "Approved again." }, () => setReason(""), (fe) => setProblem(fe.reason))}>Take back to draft</button>
          </div>
        </div>
      ) : null}
      {editing && canMake && note.status === "draft" ? <PolicyForm editing={note} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}
