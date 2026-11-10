"use client";

import { useState } from "react";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { declareIncident, postIncidentUpdate, reopenIncident, resolveIncidentWith } from "@/lib/admin/technical/actions";
import { INCIDENT_STATUS_LABEL, SEVERITIES, SEVERITY_LABEL, nextIncidentStatuses, type Incident } from "@/lib/admin/technical/model";

import { useDesk } from "../_components/useDesk";

/**
 * THE INCIDENT LOG'S CONTROLS. English throughout; every outcome is the one top
 * banner, with Undo on resolving (its inverse reopens the incident). The forms
 * say plainly that a key, token or password never belongs in the log.
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

export function DeclareIncident() {
  const { pending, run } = useDesk();
  const [v, setV] = useState({ title: "", severity: "sev3", summary: "" });
  const [problems, setProblems] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-sm" data-testid="technical-declare">
      <Labelled label="Title" problem={problems.title}>
        <input className="nf-field" maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Bookings slow to confirm" aria-invalid={problems.title ? true : undefined} />
      </Labelled>
      <Labelled label="Severity" problem={problems.severity}>
        <select className="nf-field" value={v.severity} onChange={(e) => setV({ ...v, severity: e.target.value })}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
          ))}
        </select>
      </Labelled>
      <Labelled label="What you know so far" problem={problems.summary}>
        <textarea className="nf-field min-h-[96px] resize-y" maxLength={4000} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} placeholder="What is wrong, who is affected, since when. Do not paste a key, token or password." aria-invalid={problems.summary ? true : undefined} />
      </Labelled>
      <div>
        <button type="button" className="nf-btn nf-btn--primary" disabled={pending} onClick={() => run(() => declareIncident(v), "Incident declared and logged", () => { setV({ title: "", severity: "sev3", summary: "" }); setProblems({}); }, setProblems)}>
          Declare incident
        </button>
      </div>
    </div>
  );
}

export function IncidentActions({ incident }: { incident: Incident }) {
  const { pending, run } = useDesk();
  const [body, setBody] = useState("");
  const [after, setAfter] = useState("");
  const [summary, setSummary] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});
  if (incident.status === "resolved") {
    return (
      <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => reopenIncident(incident.id), { message: "Incident reopened.", undo: () => resolveIncidentWith(incident.id, incident.resolutionSummary ?? "Resolved again after the reopening was undone."), undone: "Resolved again." })}>
        Reopen
      </button>
    );
  }
  return (
    <div className="grid gap-sm">
      <Labelled label="Post an update" problem={problems.body}>
        <textarea className="nf-field min-h-[64px] resize-y" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed since the last update." aria-invalid={problems.body ? true : undefined} />
      </Labelled>
      <Labelled label="Move the incident to (optional)" problem={problems.statusAfter}>
        <select className="nf-field" value={after} onChange={(e) => setAfter(e.target.value)}>
          <option value="">Leave as {INCIDENT_STATUS_LABEL[incident.status].toLowerCase()}</option>
          {nextIncidentStatuses(incident.status).filter((s) => s !== "resolved").map((s) => (
            <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </Labelled>
      <div>
        <button type="button" className="nf-btn nf-btn--sm nf-btn--primary" disabled={pending} onClick={() => run(() => postIncidentUpdate(incident.id, body, after), "Update posted", () => { setBody(""); setAfter(""); setProblems({}); }, setProblems)}>
          Post update
        </button>
      </div>
      <Labelled label="Resolve with a summary" problem={problems.summary}>
        <textarea className="nf-field min-h-[64px] resize-y" maxLength={4000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What happened and what was done." aria-invalid={problems.summary ? true : undefined} />
      </Labelled>
      <div>
        <button type="button" className="nf-btn nf-btn--sm nf-btn--glass" disabled={pending} onClick={() => run(() => resolveIncidentWith(incident.id, summary), { message: "Incident resolved.", undo: () => reopenIncident(incident.id), undone: "Incident reopened." }, () => { setSummary(""); setProblems({}); }, setProblems)}>
          Resolve incident
        </button>
      </div>
    </div>
  );
}
