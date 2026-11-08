"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { Switch } from "@/components/ui/Switch";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { feedback } from "@/lib/ui/feedback";
import { banner } from "@/lib/ui/toast";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

import { actOnRoommates, decideRoommateVerification, verificationDocumentLink } from "@/lib/admin/cases/actions";

import { addInstitution, saveMatchWeights, setInstitutionDomains, setInstitutionEmailCheck } from "./actions";

/**
 * THE ROOMMATES DESK'S CONTROLS (FE-B). English, like the rest of the console
 * (R-107). Nothing is optimistic: each decision waits for the server, says
 * its outcome in the banner (the founder's "banner everywhere", admin too),
 * and refreshes. A refusal or a removal always carries the reason.
 */

type Outcome = { ok: true; data: { note?: string | null } & Record<string, unknown> } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function useDesk() {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const run = (task: () => Promise<Outcome>, done: string, after?: (r: Outcome & { ok: true }) => void, onFail?: (f: Record<string, string>) => void) =>
    start(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          onFail?.(result.fieldErrors ?? {});
          banner.error(result.error, { retry: () => run(task, done, after, onFail) });
          return;
        }
        feedback("confirm");
        if (result.data.note) banner.warning(result.data.note);
        else banner.success(done);
        after?.(result);
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  return { pending, run };
}

function Reason({ id, value, onChange, placeholder, problem }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; problem?: string }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Reason
      </label>
      <textarea
        id={id}
        className="nf-field min-h-[64px] w-full resize-y text-[length:var(--nf-text-body-sm)]"
        value={value}
        maxLength={300}
        placeholder={placeholder}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldProblem id={`${id}-problem`} message={problem} />
    </>
  );
}

type Act = { action: string; label: string; done: string; danger?: boolean };

/**
 * One row's decisions on a roommate post, profile or group, through the Trust
 * and Safety layer (`actOnRoommates`, the staff member's own session). Every
 * action needs a reason of five characters or more: it goes to the audit
 * trail and, where the member is told, to them.
 */
export function TargetActions({ targetType, targetId, actions }: { targetType: "roommate_listing" | "roommate_profile" | "roommate_group"; targetId: string; actions: Act[] }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const id = `rm-act-${targetId}`;
  if (actions.length === 0) return null;
  return (
    <div className="mt-sm grid gap-xs">
      <Reason id={id} value={reason} onChange={setReason} placeholder="The reason, at least five characters. Kept in the audit trail." problem={problem} />
      <div className="flex flex-wrap gap-xs">
        {actions.map((a) => (
          <Button
            key={a.action}
            variant={a.danger ? "danger" : "secondary"}
            size="sm"
            disabled={pending}
            onClick={() => {
              if (reason.trim().length < 5) {
                setProblem("Give the reason for this action, at least five characters.");
                return;
              }
              setProblem(undefined);
              run(
                async () => {
                  const r = await actOnRoommates({ targetType, targetId, action: a.action, reason });
                  return r.ok ? { ok: true as const, data: {} } : r;
                },
                a.done,
                () => setReason(""),
              );
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A check waiting for a decision: the five-minute document link, then approve, reject or ask for more. */
export function VerificationDecision({ id, hasDocument }: { id: string; hasDocument: boolean }) {
  const { pending, run } = useDesk();
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [opening, startOpen] = useSafeTransition();
  const decide = (decision: "approve" | "reject" | "more_info", done: string) => {
    if (reason.trim().length < 5) {
      setProblem(decision === "approve" ? "Note what you checked, at least five characters." : "Tell the member what to fix, at least five characters.");
      return;
    }
    setProblem(undefined);
    run(
      async () => {
        const r = await decideRoommateVerification({ id, decision, reason });
        return r.ok ? { ok: true as const, data: {} } : r;
      },
      done,
      () => setReason(""),
    );
  };
  return (
    <div className="mt-sm grid gap-xs">
      {hasDocument ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon="eye"
            loading={opening}
            onClick={() =>
              startOpen(async () => {
                try {
                  const r = await verificationDocumentLink({ id });
                  if (!r.ok) return void banner.error(r.error);
                  banner.info("The link works for five minutes. This opening is in the audit log.");
                  window.open(r.data, "_blank", "noopener,noreferrer");
                } catch (error) {
                  if (!tapFailedOffline(error)) throw error;
                }
              })
            }
          >
            Open document
          </Button>
        </div>
      ) : null}
      <Reason id={`rm-verify-${id}`} value={reason} onChange={setReason} placeholder="What you checked, or what the member should fix. They read a rejection." problem={problem} />
      <div className="flex flex-wrap gap-xs">
        <Button variant="primary" size="sm" disabled={pending} onClick={() => decide("approve", "Approved for one year")}>
          Approve
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => decide("more_info", "Asked the member for more")}>
          Ask for more
        </Button>
        <Button variant="danger" size="sm" disabled={pending} onClick={() => decide("reject", "Rejected")}>
          Reject
        </Button>
      </div>
    </div>
  );
}

export function InstitutionControls({ id, on, domains }: { id: string; on: boolean; domains: string[] }) {
  const { pending, run } = useDesk();
  const [value, setValue] = useState(domains.join(", "));
  const [problem, setProblem] = useState<string | undefined>();
  return (
    <div className="mt-xs grid gap-xs">
      <Switch
        checked={on}
        disabled={pending || (domains.length === 0 && !on)}
        label="School email check"
        description={domains.length === 0 ? "Add a domain first." : undefined}
        onCheckedChange={(next) => run(() => setInstitutionEmailCheck({ id, on: next }), next ? "Email check on" : "Email check off")}
      />
      <div className="flex flex-wrap items-end gap-xs">
        <label className="grid min-w-0 flex-1 gap-3xs">
          <span className="nf-label">Email domains</span>
          <input
            className="nf-field w-full"
            value={value}
            placeholder="unilag.edu.ng, live.unilag.edu.ng"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `rm-dom-${id}-problem` : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setInstitutionDomains({ id, domains: value }), "Domains saved", undefined, (f) => setProblem(f.domains))}>
          Save domains
        </Button>
      </div>
      <FieldProblem id={`rm-dom-${id}-problem`} message={problem} />
    </div>
  );
}

export function AddInstitutionForm() {
  const { pending, run } = useDesk();
  const [f, setF] = useState({ name: "", shortName: "", kind: "university", stateCode: "", city: "", domains: "" });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const aria = (k: string) => ({ "aria-invalid": problems[k] ? true : undefined, "aria-describedby": problems[k] ? `rm-inst-${k}-problem` : undefined });
  return (
    <form
      className="nf-panel nf-panel--card nf-admin-card grid gap-sm p-md"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addInstitution(f),
          "School added",
          () => {
            setProblems({});
            setF({ name: "", shortName: "", kind: "university", stateCode: "", city: "", domains: "" });
          },
          setProblems,
        );
      }}
    >
      <h3 className="nf-h4">Add a school</h3>
      <div className="grid gap-sm sm:grid-cols-2">
        <label className="grid gap-3xs">
          <span className="nf-label">Full name</span>
          <input className="nf-field" value={f.name} maxLength={140} {...aria("name")} onChange={(e) => set({ name: e.target.value })} />
          <FieldProblem id="rm-inst-name-problem" message={problems.name} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-label">Short name</span>
          <input className="nf-field" value={f.shortName} maxLength={30} onChange={(e) => set({ shortName: e.target.value })} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-label">Kind</span>
          <select className="nf-field" value={f.kind} {...aria("kind")} onChange={(e) => set({ kind: e.target.value })}>
            <option value="university">University</option>
            <option value="polytechnic">Polytechnic</option>
            <option value="college">College</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="grid gap-3xs">
          <span className="nf-label">State code</span>
          <input className="nf-field" value={f.stateCode} maxLength={2} placeholder="LA" onChange={(e) => set({ stateCode: e.target.value.toUpperCase() })} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-label">City</span>
          <input className="nf-field" value={f.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} />
        </label>
        <label className="grid gap-3xs">
          <span className="nf-label">Email domains</span>
          <input className="nf-field" value={f.domains} placeholder="unilag.edu.ng" {...aria("domains")} onChange={(e) => set({ domains: e.target.value })} />
          <FieldProblem id="rm-inst-domains-problem" message={problems.domains} />
        </label>
      </div>
      <p className="nf-body-sm text-content-2">Check each domain on the school&apos;s own website before you add it. The email check stays off until you turn it on.</p>
      <div>
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Add school
        </Button>
      </div>
    </form>
  );
}

const PARTS = [
  ["budget", "Budget"],
  ["location", "Location"],
  ["move_in", "Move-in"],
  ["lifestyle", "Lifestyle"],
  ["accommodation", "Accommodation"],
] as const;

export function WeightsForm({ initial }: { initial: Record<(typeof PARTS)[number][0], number> }) {
  const { pending, run } = useDesk();
  const [w, setW] = useState(initial);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const total = Object.values(w).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return (
    <form
      className="nf-panel nf-panel--card nf-admin-card grid gap-sm p-md"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveMatchWeights(w), "Weights saved", undefined, setProblems);
      }}
    >
      <div className="grid gap-sm sm:grid-cols-5">
        {PARTS.map(([key, label]) => (
          <label key={key} className="grid gap-3xs">
            <span className="nf-label">{label}</span>
            <input
              className="nf-field nf-numeric"
              inputMode="numeric"
              value={String(w[key])}
              aria-invalid={problems[key] ? true : undefined}
              aria-describedby={problems[key] ? `rm-w-${key}-problem` : undefined}
              onChange={(e) => setW((x) => ({ ...x, [key]: Number(e.target.value.replace(/\D/g, "").slice(0, 3) || 0) }))}
            />
            <FieldProblem id={`rm-w-${key}-problem`} message={problems[key]} />
          </label>
        ))}
      </div>
      <p className="nf-body-sm nf-numeric text-content-2">{`Total ${total}. Each part counts in proportion to the total, so they need not add up to 100.`}</p>
      <div>
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save weights
        </Button>
      </div>
    </form>
  );
}
