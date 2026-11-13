"use client";

import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { banner } from "@/lib/ui/toast";
import {
  approveCampaign,
  createCampaign,
  logResult,
  restoreCancelledCampaign,
  saveCampaignUtm,
  sendBackCampaign,
  setCampaignStatus,
  submitCampaign,
  unvoidResult,
  updateCampaign,
  voidResult,
} from "@/lib/admin/marketing/actions";
import {
  CAMPAIGN_STATUS_LABEL,
  CHANNELS,
  CHANNEL_LABEL,
  METRICS,
  METRIC_LABEL,
  buildUtmLink,
  nextStatuses,
  type Campaign,
  type CampaignInput,
} from "@/lib/admin/marketing/model";

import { useDesk, type Reversible } from "../_components/useDesk";

/**
 * THE MARKETING DESK'S CONTROLS. English throughout; every outcome is said by
 * the one top banner, with Undo only where a real inverse exists (cancelling a
 * campaign, removing a logged number). Nothing here contacts an ad platform.
 */

const EMPTY: CampaignInput = {
  name: "", objective: "", channel: "social", audience: "", startsOn: "", endsOn: "", budget: "", notes: "",
  utmBase: "", utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "",
};

function fromCampaign(c: Campaign): CampaignInput {
  return {
    name: c.name, objective: c.objective, channel: c.channel, audience: c.audience, startsOn: c.startsOn ?? "", endsOn: c.endsOn ?? "",
    budget: c.budgetKobo === null ? "" : String(c.budgetKobo / 100), notes: c.notes,
    utmBase: c.utmBase ?? "", utmSource: c.utmSource ?? "", utmMedium: c.utmMedium ?? "", utmCampaign: c.utmCampaign ?? "",
    utmContent: c.utmContent ?? "", utmTerm: c.utmTerm ?? "",
  };
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

/** Create a campaign, or edit one that has not ended. */
export function CampaignForm({ editing, onDone }: { editing?: Campaign | null; onDone?: () => void }) {
  const { pending, run } = useDesk();
  const [input, setInput] = useState<CampaignInput>(editing ? fromCampaign(editing) : EMPTY);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = <K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) => setInput((v) => ({ ...v, [key]: value }));
  const save = () =>
    run(
      () => (editing ? updateCampaign(editing.id, input) : createCampaign(input)),
      editing ? "Campaign saved. If it was approved, it needs approval again." : "Campaign created as a draft",
      () => {
        if (!editing) setInput(EMPTY);
        setProblems({});
        onDone?.();
      },
      setProblems,
    );
  return (
    <div className="grid gap-sm" data-testid="marketing-campaign-form">
      <div className="grid gap-sm sm:grid-cols-2">
        <Labelled label="Name" problem={problems.name}>
          <input className="nf-field" maxLength={140} value={input.name} onChange={(e) => set("name", e.target.value)} aria-invalid={problems.name ? true : undefined} placeholder="e.g. December shortlet push" />
        </Labelled>
        <Labelled label="Channel" problem={problems.channel}>
          <select className="nf-field" value={input.channel} onChange={(e) => set("channel", e.target.value)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Starts" problem={problems.startsOn}>
          <input type="date" className="nf-field" value={input.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
        </Labelled>
        <Labelled label="Ends" problem={problems.endsOn}>
          <input type="date" className="nf-field" value={input.endsOn} onChange={(e) => set("endsOn", e.target.value)} aria-invalid={problems.endsOn ? true : undefined} />
        </Labelled>
        <Labelled label="Audience" problem={problems.audience}>
          <input className="nf-field" maxLength={500} value={input.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who this is for" />
        </Labelled>
        <Labelled label="Budget in naira (optional)" problem={problems.budget}>
          <input className="nf-field" inputMode="decimal" value={input.budget} onChange={(e) => set("budget", e.target.value)} aria-invalid={problems.budget ? true : undefined} placeholder="e.g. 250000" />
        </Labelled>
      </div>
      <Labelled label="Objective">
        <textarea className="nf-field min-h-[72px] resize-y" maxLength={1000} value={input.objective} onChange={(e) => set("objective", e.target.value)} placeholder="What this campaign should achieve, in a sentence or two." />
      </Labelled>
      <Labelled label="Notes">
        <textarea className="nf-field min-h-[72px] resize-y" maxLength={4000} value={input.notes} onChange={(e) => set("notes", e.target.value)} />
      </Labelled>
      <div className="flex flex-wrap gap-xs">
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={save}>
          {editing ? "Save campaign" : "Create campaign"}
        </button>
        {editing && onDone ? (
          <button type="button" className="nf-btn nf-btn--glass" onClick={onDone}>Close</button>
        ) : null}
      </div>
    </div>
  );
}

const CANCELLED = (id: string): Reversible => ({
  message: "Campaign cancelled. It is under Cancelled.",
  undo: () => restoreCancelledCampaign(id),
  undone: "Campaign restored as a draft. It needs approval again.",
});

/** The buttons a campaign's state offers the person who makes it. */
export function MakerActions({ campaign }: { campaign: Campaign }) {
  const { pending, run } = useDesk();
  const [editing, setEditing] = useState(false);
  const moves = nextStatuses(campaign.status).filter((s) => s !== "cancelled");
  const canSubmit = campaign.status === "draft" && (campaign.approval === "none" || campaign.approval === "sent_back");
  const canCancel = campaign.status === "draft" || campaign.status === "planned" || campaign.status === "paused";
  return (
    <div className="grid gap-xs">
      <div className="flex flex-wrap gap-xs">
        {canSubmit ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => submitCampaign(campaign.id), "Sent for approval")}>
            Send for approval
          </button>
        ) : null}
        {moves.map((s) => (
          <button key={s} type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => setCampaignStatus(campaign.id, s), `Campaign ${CAMPAIGN_STATUS_LABEL[s].toLowerCase()}`)}>
            {s === "live" ? (campaign.status === "paused" ? "Resume" : "Go live") : s === "paused" ? "Pause" : "Mark ended"}
          </button>
        ))}
        {campaign.status !== "ended" && campaign.status !== "cancelled" ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? "Close editor" : "Edit"}
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" className="nf-btn nf-btn--sm nf-btn--quiet" disabled={pending} onClick={() => run(() => setCampaignStatus(campaign.id, "cancelled"), CANCELLED(campaign.id))}>
            Cancel campaign
          </button>
        ) : null}
      </div>
      {editing ? <CampaignForm editing={campaign} onDone={() => setEditing(false)} /> : null}
    </div>
  );
}

/** Approve, or send back with a reason: the COO and admins. */
export function ApproverActions({ campaign }: { campaign: Campaign }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <div className="grid gap-xs">
      <div className="flex flex-wrap gap-xs">
        <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => approveCampaign(campaign.id), "Approved. The campaign is now planned.")}>
          Approve
        </button>
      </div>
      <label htmlFor={`reason-${campaign.id}`} className="nf-caption text-[var(--nf-content-secondary)]">Send back with a reason</label>
      <textarea id={`reason-${campaign.id}`} className="nf-field min-h-[56px] resize-y" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is going back, at least five characters." aria-invalid={problem ? true : undefined} />
      <FieldProblem id={`reason-${campaign.id}-problem`} message={problem} />
      <div>
        <button
          type="button"
          className="nf-btn nf-btn--sm nf-btn--glass"
          disabled={pending}
          onClick={() => run(() => sendBackCampaign(campaign.id, reason), "Sent back", () => setReason(""), (fe) => setProblem(fe.reason))}
        >
          Send back
        </button>
      </div>
    </div>
  );
}

/** Log a number against a campaign. Spend is typed in naira. */
export function ResultForm({ campaigns }: { campaigns: Pick<Campaign, "id" | "name" | "status">[] }) {
  const { pending, run } = useDesk();
  const open = campaigns.filter((c) => c.status !== "cancelled");
  const [form, setForm] = useState({ campaignId: open[0]?.id ?? "", recordedOn: "", metric: "clicks", value: "", note: "" });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  if (open.length === 0) return <p className="nf-body-sm text-[var(--nf-content-secondary)]">Create a campaign first, then log its numbers here.</p>;
  return (
    <div className="grid gap-sm" data-testid="marketing-result-form">
      <div className="grid gap-sm sm:grid-cols-2">
        <Labelled label="Campaign" problem={problems.campaignId}>
          <select className="nf-field" value={form.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
            {open.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Labelled>
        <Labelled label="What you are logging" problem={problems.metric}>
          <select className="nf-field" value={form.metric} onChange={(e) => set("metric", e.target.value)}>
            {METRICS.map((m) => (
              <option key={m} value={m}>{METRIC_LABEL[m]}</option>
            ))}
          </select>
        </Labelled>
        <Labelled label="For the date" problem={problems.recordedOn}>
          <input type="date" className="nf-field" value={form.recordedOn} onChange={(e) => set("recordedOn", e.target.value)} />
        </Labelled>
        <Labelled label={form.metric === "spend_kobo" ? "Amount in naira" : "Number"} problem={problems.value}>
          <input className="nf-field" inputMode="decimal" value={form.value} onChange={(e) => set("value", e.target.value)} aria-invalid={problems.value ? true : undefined} />
        </Labelled>
      </div>
      <Labelled label="Where the number came from">
        <input className="nf-field" maxLength={500} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="e.g. the platform's own dashboard, 9 to 15 November" />
      </Labelled>
      <div>
        <button
          type="button"
          className="nf-btn nf-btn--primary"
          disabled={pending}
          onClick={() => run(() => logResult(form), "Number logged", () => { setForm((v) => ({ ...v, value: "", note: "" })); setProblems({}); }, setProblems)}
        >
          Log number
        </button>
      </div>
    </div>
  );
}

/** Remove a logged number from every total; Undo puts it back. */
export function VoidResult({ id }: { id: string }) {
  const { pending, run } = useDesk();
  return (
    <button
      type="button"
      className="nf-btn nf-btn--sm nf-btn--quiet"
      disabled={pending}
      onClick={() => run(() => voidResult(id), { message: "Entry removed from the totals.", undo: () => unvoidResult(id), undone: "Entry put back." })}
    >
      Remove
    </button>
  );
}

/** The tracked-link builder. Pure on the screen; saving writes the tags onto the chosen campaign. */
export function UtmBuilder({ campaigns }: { campaigns: Pick<Campaign, "id" | "name" | "status" | "utmBase" | "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm">[] }) {
  const { pending, run } = useDesk();
  const editable = campaigns.filter((c) => c.status !== "ended" && c.status !== "cancelled");
  const [campaignId, setCampaignId] = useState("");
  const [v, setV] = useState({ base: "", source: "", medium: "", campaign: "", content: "", term: "" });
  const set = (key: keyof typeof v, value: string) => setV((x) => ({ ...x, [key]: value }));
  const chosen = editable.find((c) => c.id === campaignId);
  const pick = (id: string) => {
    setCampaignId(id);
    const c = editable.find((x) => x.id === id);
    if (c) setV({ base: c.utmBase ?? "", source: c.utmSource ?? "", medium: c.utmMedium ?? "", campaign: c.utmCampaign ?? "", content: c.utmContent ?? "", term: c.utmTerm ?? "" });
  };
  const built = buildUtmLink(v);
  const touched = Object.values(v).some((x) => x.trim().length > 0);
  const copy = async () => {
    if (!built.ok) return;
    try {
      await navigator.clipboard.writeText(built.url);
      banner.success("Link copied");
    } catch {
      banner.error("Copying did not work here. Select the link and copy it by hand.");
    }
  };
  return (
    <div className="grid gap-sm" data-testid="marketing-utm-builder">
      <Labelled label="Campaign (to save the tags on)">
        <select className="nf-field" value={campaignId} onChange={(e) => pick(e.target.value)}>
          <option value="">Not saved to a campaign</option>
          {editable.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Labelled>
      <div className="grid gap-sm sm:grid-cols-2">
        <Labelled label="Page the link points to"><input className="nf-field" inputMode="url" value={v.base} onChange={(e) => set("base", e.target.value)} placeholder="https://" /></Labelled>
        <Labelled label="Source (where it is placed)"><input className="nf-field" value={v.source} onChange={(e) => set("source", e.target.value)} placeholder="instagram" /></Labelled>
        <Labelled label="Medium (kind of channel)"><input className="nf-field" value={v.medium} onChange={(e) => set("medium", e.target.value)} placeholder="social" /></Labelled>
        <Labelled label="Campaign name"><input className="nf-field" value={v.campaign} onChange={(e) => set("campaign", e.target.value)} placeholder="december-shortlets" /></Labelled>
        <Labelled label="Content (optional)"><input className="nf-field" value={v.content} onChange={(e) => set("content", e.target.value)} /></Labelled>
        <Labelled label="Term (optional)"><input className="nf-field" value={v.term} onChange={(e) => set("term", e.target.value)} /></Labelled>
      </div>
      <div className="nf-panel nf-panel--card nf-admin-card p-md" aria-live="polite">
        <p className="nf-caption text-[var(--nf-content-secondary)]">{built.ok ? "Your tracked link" : "The link appears here once the required fields are filled in"}</p>
        {/* Stays `overflow-wrap: anywhere` on purpose: the built link is one token and must wrap inside the panel (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
        <p className="nf-body-sm mt-3xs [overflow-wrap:anywhere]" data-testid="utm-output">{built.ok ? built.url : touched ? built.error : "Fill in the page, source, medium and campaign."}</p>
      </div>
      <div className="flex flex-wrap gap-xs">
        <button type="button" className="nf-btn nf-btn--primary" disabled={!built.ok} onClick={copy}>Copy link</button>
        <button
          type="button"
          className="nf-btn nf-btn--glass"
          disabled={pending || !chosen || !built.ok}
          onClick={() => chosen && run(() => saveCampaignUtm(chosen.id, v), "Tags saved on the campaign")}
        >
          Save tags to campaign
        </button>
      </div>
    </div>
  );
}
