"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { changeStage, logActivity, setNextFollowUp } from "@/lib/admin/business-development/actions";
import { BD_CATEGORY_LABEL, BD_STAGES, BD_STAGE_LABEL, type BdProspect } from "@/lib/admin/business-development/types";

/**
 * The pipeline itself: a flat list filterable by stage, with the controls a
 * Business Development Director actually uses all day: move the stage, set
 * or clear the next follow-up date, and log a contact (with its outcome), a
 * follow-up, or a plain note. No kanban board, no drag and drop: a list a
 * phone can scroll is the real job here.
 */
export function ProspectBoard({ prospects }: { prospects: BdProspect[] }) {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () => (stageFilter === "all" ? prospects : prospects.filter((p) => p.stage === stageFilter)),
    [prospects, stageFilter],
  );

  return (
    <div className="grid gap-sm" data-testid="prospect-board">
      <label className="grid gap-2xs nf-body max-w-xs">
        <span>Filter by stage</span>
        <select className="nf-field" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">Every stage ({prospects.length})</option>
          {BD_STAGES.map((s) => (
            <option key={s} value={s}>
              {BD_STAGE_LABEL[s]} ({prospects.filter((p) => p.stage === s).length})
            </option>
          ))}
        </select>
      </label>
      {rows.length === 0 ? (
        <p className="nf-body text-[var(--nf-content-secondary)]">Nothing at this stage yet.</p>
      ) : (
        <ul className="nf-admin-queue">
          {rows.map((p) => (
            <ProspectRow key={p.id} prospect={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProspectRow({ prospect, open, onToggle }: { prospect: BdProspect; open: boolean; onToggle: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState(prospect.stage);
  const [follow, setFollow] = useState(prospect.nextFollowUpAt ?? "");
  const [kind, setKind] = useState<"contact" | "follow_up" | "note">("contact");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const [pending, start] = useSafeTransition();

  function saveStage(next: string) {
    setStage(next as typeof stage);
    start(async () => {
      const result = await changeStage({ prospectId: prospect.id, stage: next });
      if (!result.ok) {
        banner.error(result.error);
        setStage(prospect.stage);
        return;
      }
      router.refresh();
    });
  }

  function saveFollow() {
    start(async () => {
      const result = await setNextFollowUp({ prospectId: prospect.id, date: follow || null });
      if (!result.ok) banner.error(result.error);
      else {
        banner.success("Follow-up date saved.");
        router.refresh();
      }
    });
  }

  function logIt() {
    if (!body.trim()) {
      banner.error("Write what happened.");
      return;
    }
    if (kind === "contact" && !outcome.trim()) {
      banner.error("Record the outcome of the contact.");
      return;
    }
    start(async () => {
      const result = await logActivity({ prospectId: prospect.id, kind, body, outcome: kind === "contact" ? outcome : undefined });
      if (!result.ok) banner.error(result.error);
      else {
        banner.success("Logged.");
        setBody("");
        setOutcome("");
        router.refresh();
      }
    });
  }

  return (
    <li className="nf-admin-queue-row" data-testid="prospect-row">
      <p className="font-semibold">
        {prospect.businessName}
        <span className="nf-caption text-[var(--nf-content-secondary)]">
          {" · "}
          {BD_CATEGORY_LABEL[prospect.category]}
          {prospect.location ? ` · ${prospect.location}` : ""}
        </span>
      </p>
      <p className="nf-body text-[var(--nf-content-secondary)]">
        {prospect.contactName}
        {prospect.email ? ` · ${prospect.email}` : ""}
        {prospect.phone ? ` · ${prospect.phone}` : ""}
      </p>
      {prospect.onboardedAt ? (
        <p className="nf-caption" data-testid="onboarded-mark">
          Onboarded. {prospect.listingId ? "A listing is linked to this business." : "No listing linked yet."}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-xs mt-row">
        <label className="grid gap-2xs nf-body">
          <span>Stage</span>
          <select className="nf-field" value={stage} onChange={(e) => saveStage(e.target.value)} disabled={pending}>
            {BD_STAGES.map((s) => (
              <option key={s} value={s}>
                {BD_STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2xs nf-body">
          <span>Next follow-up</span>
          <input className="nf-field" type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
        </label>
        <Button type="button" variant="glass" size="sm" onClick={saveFollow} disabled={pending}>
          Save date
        </Button>
        <Button type="button" variant="glass" size="sm" onClick={onToggle}>
          {open ? "Close" : "Log activity"}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-xs mt-row" data-testid="activity-form">
          <label className="grid gap-2xs nf-body max-w-xs">
            <span>Kind</span>
            <select className="nf-field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="contact">Contact (with outcome)</option>
              <option value="follow_up">Follow-up</option>
              <option value="note">Note</option>
            </select>
          </label>
          <label className="grid gap-2xs nf-body">
            <span>What happened</span>
            <textarea className="nf-field" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
          </label>
          {kind === "contact" ? (
            <label className="grid gap-2xs nf-body">
              <span>Outcome</span>
              <input className="nf-field" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Interested, wants a call next week" />
            </label>
          ) : null}
          <Button type="button" variant="primary" size="sm" onClick={logIt} loading={pending}>
            Save
          </Button>
        </div>
      ) : null}
    </li>
  );
}
