"use client";

import { useState } from "react";

import { CopyButton } from "@/components/docs/CopyButton";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { approveEntry, createEntry, reopenEntry, restoreEntry, retireEntry, sendBackEntry, setEntryDone, submitEntry, updateEntry } from "@/lib/admin/desk-entries/actions";
import {
  EMPTY_ENTRY_INPUT,
  ENTRY_STATUS_LABEL,
  checkCounts,
  entryCopyText,
  entryRef,
  isEntryEditable,
  isEntryOverdue,
  kindDef,
  stepsOf,
  type Entry,
  type EntryInput,
  type KindDef,
} from "@/lib/admin/desk-entries/model";

import { useDesk } from "./useDesk";

/**
 * ONE TOOL OF A STAFF DESK, DRAWN FROM ITS KIND (marketing, content,
 * technical, support lead). The form, the cards, the Copy buttons and the
 * banners come from the kind's definition in `lib/admin/desk-entries/model`,
 * so every small tool on the four desks looks and behaves the same. Every
 * outcome is the one top banner; Undo appears only where a real inverse
 * exists (retiring, marking done).
 */

export type ToolPerson = { id: string; name: string };

type BadgeTone = "success" | "pending" | "error" | "info";
function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`nf-admin-badge nf-admin-badge--${tone}`}>{children}</span>;
}

const TONE: Record<string, BadgeTone> = { open: "info", done: "success", draft: "info", submitted: "pending", approved: "success", sent_back: "error", retired: "info" };

function Labelled({ label, problem, children }: { label: string; problem?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="grid gap-3xs">
      <span className="nf-caption text-[var(--nf-content-secondary)]">{label}</span>
      {children}
      <FieldProblem id={`${label.replace(/\W+/g, "-").toLowerCase()}-problem`} message={problem} />
    </label>
  );
}

function fromEntry(e: Entry): EntryInput {
  return { title: e.title, body: e.body, dueOn: e.dueOn ?? "", linkUrl: e.linkUrl ?? "", subjectUser: e.subjectUser ?? "", fields: { ...e.fields } };
}

export function EntryForm({ def, editing, agents, onDone }: { def: KindDef; editing?: Entry | null; agents: readonly ToolPerson[]; onDone?: () => void }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<EntryInput>(editing ? fromEntry(editing) : EMPTY_ENTRY_INPUT);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) => setInput((v) => ({ ...v, [key]: value }));
  const setField = (key: string, value: string) => setInput((v) => ({ ...v, fields: { ...v.fields, [key]: value } }));
  const save = () =>
    run(
      () => (editing ? updateEntry(editing.id, input) : createEntry(def.kind, input)),
      editing ? `${def.label} saved` : `${def.label} added`,
      () => {
        if (!editing) setInput(EMPTY_ENTRY_INPUT);
        setProblems({});
        onDone?.();
      },
      setProblems,
    );
  return (
    <div className="grid gap-sm" data-testid={`entry-form-${def.kind}`}>
      <Labelled label={def.titleLabel} problem={problems.title}>
        <input className="nf-field" maxLength={200} value={input.title} onChange={(e) => set("title", e.target.value)} placeholder={def.titlePlaceholder} aria-invalid={problems.title ? true : undefined} />
      </Labelled>
      <Labelled label={def.bodyLabel} problem={problems.body}>
        <textarea className="nf-field min-h-[96px] resize-y" maxLength={def.bodyMax ?? 8000} value={input.body} onChange={(e) => set("body", e.target.value)} placeholder={def.bodyPlaceholder} aria-invalid={problems.body ? true : undefined} />
      </Labelled>
      {def.subject ? (
        <Labelled label={def.subject.label} problem={problems.subjectUser}>
          <select className="nf-field" value={input.subjectUser} onChange={(e) => set("subjectUser", e.target.value)}>
            <option value="">Choose…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Labelled>
      ) : null}
      <div className="grid gap-sm sm:grid-cols-2">
        {def.due ? (
          <Labelled label={def.due.label} problem={problems.dueOn}>
            <input type="date" className="nf-field" value={input.dueOn} onChange={(e) => set("dueOn", e.target.value)} />
          </Labelled>
        ) : null}
        {def.link ? (
          <Labelled label={def.link.label} problem={problems.linkUrl}>
            <input className="nf-field" inputMode="url" value={input.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://" />
          </Labelled>
        ) : null}
        {def.fields.filter((f) => f.type !== "check").map((f) => (
          <Labelled key={f.key} label={f.label} problem={problems[`fields.${f.key}`]}>
            {f.type === "select" ? (
              <select className="nf-field" value={input.fields[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)}>
                <option value="">Choose…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : f.type === "long" ? (
              <textarea className="nf-field min-h-[72px] resize-y" maxLength={f.max ?? 1500} value={input.fields[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />
            ) : (
              <input className="nf-field" type={f.type === "date" ? "date" : "text"} maxLength={f.max ?? 300} value={input.fields[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.placeholder} />
            )}
          </Labelled>
        ))}
      </div>
      {def.fields.some((f) => f.type === "check") ? (
        <fieldset className="grid gap-xs">
          <legend className="nf-caption text-[var(--nf-content-secondary)]">Checklist</legend>
          {def.fields.filter((f) => f.type === "check").map((f) => (
            <label key={f.key} className="flex items-start gap-xs nf-body-sm">
              <input type="checkbox" className="mt-3xs" checked={input.fields[f.key] === "yes"} onChange={(e) => setField(f.key, e.target.checked ? "yes" : "")} />
              <span>{f.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-xs">
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={save}>{editing ? "Save" : `Add ${def.label.toLowerCase()}`}</button>
        {editing && onDone ? <button type="button" className="nf-btn nf-btn--glass" onClick={onDone}>Close</button> : null}
      </div>
    </div>
  );
}

function ApproverBar({ entry }: { entry: Entry }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <div className="grid gap-xs">
      <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => approveEntry(entry.id), "Approved")}>Approve</button>
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Reason, if you send it back</span>
        <input className="nf-field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} aria-invalid={problem ? true : undefined} />
        <FieldProblem id={`reason-${entry.id}`} message={problem} />
      </label>
      <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => sendBackEntry(entry.id, reason), "Sent back", () => setReason(""), (fe) => setProblem(fe.reason))}>Send back</button>
    </div>
  );
}

function Card({ entry, def, canMake, canApprove, agents, names }: { entry: Entry; def: KindDef; canMake: boolean; canApprove: boolean; agents: readonly ToolPerson[]; names: Readonly<Record<string, string>> }) {
  const { pending, run } = useDesk();
  const [editing, setEditing] = useState(false);
  const counts = checkCounts(def, entry.fields);
  const overdue = isEntryOverdue(entry);
  const editable = canMake && isEntryEditable(def, entry.status);
  const shown = def.fields.filter((f) => f.type !== "check" && entry.fields[f.key]);
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="entry-card">
      <div className="flex flex-wrap items-center gap-xs">
        <span className="font-semibold text-[var(--nf-content-primary)] break-words">{entry.title}</span>
        <Badge tone={TONE[entry.status] ?? "info"}>{ENTRY_STATUS_LABEL[entry.status]}</Badge>
        {overdue ? <Badge tone="error">Overdue</Badge> : null}
      </div>
      <p className="nf-caption mt-3xs flex flex-wrap items-center gap-xs text-[var(--nf-content-secondary)]">
        <span>{entryRef(entry.kind, entry.id)}</span>
        <CopyButton text={entryRef(entry.kind, entry.id)} label="Reference" />
        {def.due && entry.dueOn ? <span>{def.due.label}: {entry.dueOn}</span> : null}
        {entry.subjectUser ? <span>About {names[entry.subjectUser] ?? "a colleague"}</span> : null}
      </p>
      {entry.body ? (
        def.steps ? (
          <ol className="nf-body-sm mt-xs grid list-decimal gap-3xs pl-md">
            {stepsOf(entry.body).map((s, i) => (
              <li key={i} className="break-words">{s}</li>
            ))}
          </ol>
        ) : (
          <p className="nf-body-sm mt-xs whitespace-pre-wrap break-words">{entry.body}</p>
        )
      ) : null}
      {shown.length > 0 || counts.total > 0 ? (
        <dl className="mt-sm grid gap-xs sm:grid-cols-2">
          {shown.map((f) => (
            <div key={f.key}>
              <dt className="nf-caption text-[var(--nf-content-secondary)]">{f.label}</dt>
              <dd className="nf-body-sm whitespace-pre-wrap break-words">{f.type === "select" ? (f.options?.find((o) => o.value === entry.fields[f.key])?.label ?? entry.fields[f.key]) : entry.fields[f.key]}</dd>
            </div>
          ))}
          {counts.total > 0 ? (
            <div className="sm:col-span-2">
              <dt className="nf-caption text-[var(--nf-content-secondary)]">Checklist: {counts.done} of {counts.total} ticked</dt>
              <dd>
                <ul className="nf-body-sm grid gap-3xs">
                  {def.fields.filter((f) => f.type === "check").map((f) => (
                    <li key={f.key}>{entry.fields[f.key] === "yes" ? "Done" : "Not yet"}: {f.label}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {entry.linkUrl ? (
        <p className="nf-caption mt-xs flex flex-wrap items-center gap-xs break-words">
          <a className="font-semibold text-[var(--nf-content-link)] hover:underline" href={entry.linkUrl} target="_blank" rel="noreferrer noopener">{entry.linkUrl}</a>
          <CopyButton text={entry.linkUrl} label="Link" icon="link" />
        </p>
      ) : null}
      {entry.status === "sent_back" && entry.reviewNote ? <p className="nf-caption mt-xs" role="note">Sent back: {entry.reviewNote}</p> : null}
      {entry.approvedAt && entry.status === "approved" ? <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">Approved on {entry.approvedAt.slice(0, 10)}{entry.approvedBy && names[entry.approvedBy] ? ` by ${names[entry.approvedBy]}` : ""}</p> : null}
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        <CopyButton text={entryCopyText(def, entry)} label={def.label} />
        {canMake && def.flow === "plain" && entry.status === "open" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => setEntryDone(entry.id, true), { message: `${def.doneLabel ?? "Marked done"}.`, undo: () => setEntryDone(entry.id, false), undone: "Put back as open." })}>{def.doneLabel ?? "Mark done"}</button>
        ) : null}
        {canMake && def.flow === "plain" && entry.status === "done" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => setEntryDone(entry.id, false), { message: "Opened again.", undo: () => setEntryDone(entry.id, true), undone: "Marked done again." })}>Open again</button>
        ) : null}
        {canMake && def.flow === "approval" && (entry.status === "draft" || entry.status === "sent_back") ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => submitEntry(entry.id), "Sent for approval")}>Send for approval</button>
        ) : null}
        {canMake && def.flow === "approval" && entry.status === "approved" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => reopenEntry(entry.id), "Back to draft. It needs approval again.")}>Edit again</button>
        ) : null}
        {editable ? <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" onClick={() => setEditing((v) => !v)}>{editing ? "Close" : "Edit"}</button> : null}
        {canMake && entry.status !== "retired" && entry.status !== "submitted" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => retireEntry(entry.id), { message: `${def.label} retired.`, undo: () => restoreEntry(entry.id), undone: "Put back." })}>Retire</button>
        ) : null}
        {canMake && entry.status === "retired" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => restoreEntry(entry.id), { message: "Put back.", undo: () => retireEntry(entry.id), undone: "Retired again." })}>Put back</button>
        ) : null}
      </div>
      {canApprove && entry.status === "submitted" ? <div className="mt-sm"><ApproverBar entry={entry} /></div> : null}
      {editing && editable ? <div className="mt-sm"><EntryForm def={def} editing={entry} agents={agents} onDone={() => setEditing(false)} /></div> : null}
    </li>
  );
}

/** The whole tool: its entries as cards, newest first, retired ones folded away, and the add form. */
export function EntryTool({ kind, entries, canMake, canApprove, agents = [], names = {}, readable = true }: { kind: string; entries: readonly Entry[]; canMake: boolean; canApprove: boolean; agents?: readonly ToolPerson[]; names?: Readonly<Record<string, string>>; readable?: boolean }) {
  const def = kindDef(kind);
  if (!def) return null;
  const mine = entries.filter((e) => e.kind === kind);
  const live = mine.filter((e) => e.status !== "retired");
  const retired = mine.filter((e) => e.status === "retired");
  return (
    <div className="grid gap-md" data-testid={`entry-tool-${kind}`}>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{def.blurb}</p>
      {live.length === 0 && readable ? (
        <p className="nf-admin-calm nf-admin-calm--info nf-body-sm" role="note">
          No {def.plural.toLowerCase()} yet. {canMake ? "Add the first one below." : "They appear here as they are added."}
        </p>
      ) : (
        <ul className="grid gap-sm">
          {live.map((e) => (
            <Card key={e.id} entry={e} def={def} canMake={canMake} canApprove={canApprove} agents={agents} names={names} />
          ))}
        </ul>
      )}
      {retired.length > 0 ? (
        <details>
          <summary className="nf-body-sm cursor-pointer text-[var(--nf-content-secondary)]">Retired ({retired.length})</summary>
          <ul className="mt-sm grid gap-sm">
            {retired.map((e) => (
              <Card key={e.id} entry={e} def={def} canMake={canMake} canApprove={canApprove} agents={agents} names={names} />
            ))}
          </ul>
        </details>
      ) : null}
      {canMake ? (
        <div>
          <h3 className="nf-body-sm mb-xs font-semibold">New {def.label.toLowerCase()}</h3>
          <EntryForm def={def} agents={agents} />
        </div>
      ) : null}
    </div>
  );
}
