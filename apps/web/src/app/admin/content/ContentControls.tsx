"use client";

import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import {
  approveItem,
  createItem,
  markPublished,
  restoreRetiredItem,
  retireItem,
  sendBackItem,
  submitItem,
  updateItem,
} from "@/lib/admin/content/actions";
import { BODY_MAX, KINDS, KIND_LABEL, needsPublishedUrl, type ContentItem, type ItemInput } from "@/lib/admin/content/model";

import { useDesk, type Reversible } from "../_components/useDesk";

/**
 * THE CONTENT DESK'S CONTROLS. English throughout, one banner for every
 * outcome, Undo only for retiring (its real inverse restores a draft).
 */

const EMPTY: ItemInput = { kind: "guide", title: "", summary: "", body: "", plannedFor: "", linkUrl: "" };

function fromItem(i: ContentItem): ItemInput {
  return { kind: i.kind, title: i.title, summary: i.summary, body: i.body, plannedFor: i.plannedFor ?? "", linkUrl: i.linkUrl ?? "" };
}

function Labelled({ label, problem, children }: { label: string; problem?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="grid gap-3xs">
      <span className="nf-caption text-[var(--nf-content-secondary)]">{label}</span>
      {children}
      <FieldProblem id={`${label.replace(/\W+/g, "-").toLowerCase()}-problem`} message={problem} />
    </label>
  );
}

/** Create an item, or edit a draft. The body is Markdown, kept as text. */
export function ItemForm({ editing, onDone }: { editing?: ContentItem | null; onDone?: () => void }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<ItemInput>(editing ? fromItem(editing) : EMPTY);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) => setInput((v) => ({ ...v, [key]: value }));
  const save = () =>
    run(
      () => (editing ? updateItem(editing.id, input) : createItem(input)),
      editing ? "Draft saved" : "Draft created",
      () => {
        if (!editing) setInput(EMPTY);
        setProblems({});
        onDone?.();
      },
      setProblems,
    );
  return (
    <div className="grid gap-sm" data-testid="content-item-form">
      <div className="grid gap-sm sm:grid-cols-2">
        <Labelled label="Kind" problem={problems.kind}>
          <select className="nf-field" value={input.kind} onChange={(e) => set("kind", e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Planned for" problem={problems.plannedFor}>
          <input type="date" className="nf-field" value={input.plannedFor} onChange={(e) => set("plannedFor", e.target.value)} />
        </Labelled>
      </div>
      <Labelled label="Title" problem={problems.title}>
        <input className="nf-field" maxLength={200} value={input.title} onChange={(e) => set("title", e.target.value)} aria-invalid={problems.title ? true : undefined} />
      </Labelled>
      <Labelled label="Summary">
        <textarea className="nf-field min-h-[64px] resize-y" maxLength={1000} value={input.summary} onChange={(e) => set("summary", e.target.value)} placeholder="One or two sentences on what this is for." />
      </Labelled>
      <Labelled label={`Text (Markdown, up to ${BODY_MAX.toLocaleString("en-NG")} characters)`} problem={problems.body}>
        <textarea className="nf-field min-h-[180px] resize-y font-mono" maxLength={BODY_MAX} value={input.body} onChange={(e) => set("body", e.target.value)} />
      </Labelled>
      <Labelled label="Link (for a brand note or a source document)" problem={problems.linkUrl}>
        <input className="nf-field" inputMode="url" value={input.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://" aria-invalid={problems.linkUrl ? true : undefined} />
      </Labelled>
      <div className="flex flex-wrap gap-xs">
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={save}>
          {editing ? "Save draft" : "Create draft"}
        </button>
        {editing && onDone ? (
          <button type="button" className="nf-btn nf-btn--glass" onClick={onDone}>Close</button>
        ) : null}
      </div>
    </div>
  );
}

const RETIRED = (id: string): Reversible => ({
  message: "Item retired. It is under Retired.",
  undo: () => restoreRetiredItem(id),
  undone: "Item restored as a draft. It needs approval again.",
});

/** What the writer can do with an item in its current state. */
export function MakerActions({ item }: { item: ContentItem }) {
  const { pending, run } = useDesk();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [day, setDay] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-xs">
      <div className="flex flex-wrap gap-xs">
        {item.status === "draft" ? (
          <>
            <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => submitItem(item.id), "Sent for approval")}>
              Send for approval
            </button>
            <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
              {editing ? "Close editor" : "Edit"}
            </button>
          </>
        ) : null}
        {item.status === "draft" || item.status === "published" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => retireItem(item.id), RETIRED(item.id))}>
            Retire
          </button>
        ) : null}
        {item.status === "retired" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => restoreRetiredItem(item.id), "Restored as a draft")}>
            Restore as draft
          </button>
        ) : null}
      </div>
      {item.status === "approved" ? (
        <div className="grid gap-xs">
          <Labelled label={needsPublishedUrl(item.kind) ? "Where it is now live (link)" : "Where it is now live (link, optional)"} problem={problems.url}>
            <input className="nf-field" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-invalid={problems.url ? true : undefined} />
          </Labelled>
          <Labelled label="Date it went live (optional)" problem={problems.publishedAt}>
            <input type="date" className="nf-field" value={day} onChange={(e) => setDay(e.target.value)} />
          </Labelled>
          <div>
            <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => markPublished(item.id, { url, publishedAt: day }), "Recorded as published", undefined, setProblems)}>
              Mark as published
            </button>
          </div>
        </div>
      ) : null}
      {editing && item.status === "draft" ? <ItemForm editing={item} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}

/** Approve, or send back with a reason: the COO and admins. */
export function ApproverActions({ item }: { item: ContentItem }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <div className="grid gap-xs">
      {item.status === "in_review" ? (
        <div>
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => approveItem(item.id), "Approved")}>
            Approve
          </button>
        </div>
      ) : null}
      <label htmlFor={`reason-${item.id}`} className="nf-caption text-[var(--nf-content-secondary)]">Send back with a reason</label>
      <textarea id={`reason-${item.id}`} className="nf-field min-h-[56px] resize-y" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is going back, at least five characters." aria-invalid={problem ? true : undefined} />
      <FieldProblem id={`reason-${item.id}-problem`} message={problem} />
      <div>
        <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => sendBackItem(item.id, reason), "Sent back", () => setReason(""), (fe) => setProblem(fe.reason))}>
          Send back
        </button>
      </div>
    </div>
  );
}
