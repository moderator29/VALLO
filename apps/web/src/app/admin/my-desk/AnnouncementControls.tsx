"use client";

import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import {
  markAllAnnouncementsRead,
  markAnnouncementRead,
  postAnnouncement,
  setAnnouncementPinned,
  type AnnouncementInput,
} from "@/lib/admin/my-desk/actions";

import { useDesk } from "./useDesk";
import type { DeskOption } from "./TaskControls";

/** MY DESK'S ANNOUNCEMENT CONTROLS. Every outcome is a banner; the server re-checks who may post. */

const EMPTY: AnnouncementInput = { title: "", body: "", audience: "all", pinned: false };

export function PostAnnouncementForm({ desks }: { desks: DeskOption[] }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<AnnouncementInput>(EMPTY);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) => setInput((v) => ({ ...v, [key]: value }));
  return (
    <form
      className="grid gap-sm"
      data-testid="my-desk-post-announcement"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => postAnnouncement(input), "Announcement posted", () => { setInput(EMPTY); setProblems({}); }, setProblems);
      }}
    >
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Title</span>
        <input className="nf-field" maxLength={140} value={input.title} onChange={(e) => set("title", e.target.value)} aria-invalid={problems.title ? true : undefined} aria-describedby={problems.title ? "ann-title-problem" : undefined} />
        <FieldProblem id="ann-title-problem" message={problems.title} />
      </label>
      <label className="grid gap-3xs">
        <span className="nf-caption text-[var(--nf-content-secondary)]">Message</span>
        <textarea className="nf-field" rows={4} maxLength={4000} value={input.body} onChange={(e) => set("body", e.target.value)} aria-invalid={problems.body ? true : undefined} aria-describedby={problems.body ? "ann-body-problem" : undefined} />
        <FieldProblem id="ann-body-problem" message={problems.body} />
      </label>
      <div className="flex flex-wrap items-end gap-sm">
        <label className="grid gap-3xs">
          <span className="nf-caption text-[var(--nf-content-secondary)]">Who it is for</span>
          <select className="nf-field" value={input.audience} onChange={(e) => set("audience", e.target.value)}>
            <option value="all">All staff</option>
            {desks.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <FieldProblem id="ann-audience-problem" message={problems.audience} />
        </label>
        <label className="flex items-center gap-xs">
          <input type="checkbox" checked={input.pinned} onChange={(e) => set("pinned", e.target.checked)} />
          <span className="nf-body-sm">Pin to the top</span>
        </label>
      </div>
      <div>
        <button type="submit" className="nf-btn nf-btn--primary nf-btn--sm" disabled={pending}>
          Post announcement
        </button>
      </div>
    </form>
  );
}

export function MarkRead({ id }: { id: string }) {
  const { pending, run } = useDesk();
  return (
    <button type="button" className="nf-btn nf-btn--glass nf-btn--sm" disabled={pending} onClick={() => run(() => markAnnouncementRead(id), "Marked as read")}>
      Mark as read
    </button>
  );
}

export function MarkAllRead() {
  const { pending, run } = useDesk();
  return (
    <button type="button" className="nf-btn nf-btn--glass nf-btn--sm" disabled={pending} onClick={() => run(() => markAllAnnouncementsRead(), "All marked as read")}>
      Mark all as read
    </button>
  );
}

export function PinToggle({ id, pinned }: { id: string; pinned: boolean }) {
  const { pending, run } = useDesk();
  return (
    <button
      type="button"
      className="nf-btn nf-btn--glass nf-btn--sm"
      disabled={pending}
      onClick={() => run(() => setAnnouncementPinned(id, !pinned), pinned ? "Unpinned" : "Pinned")}
    >
      {pinned ? "Unpin" : "Pin to the top"}
    </button>
  );
}
