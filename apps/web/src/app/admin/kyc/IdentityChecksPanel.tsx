import { Panel } from "../_review/parts";
import type { IdentityCheckView } from "@/lib/admin/identity-checks";
import { IdentityCheckDecision } from "./IdentityCheckDecision";

/**
 * DOJAH SELFIE CHECKS ON THE KYC DESK.
 *
 * Only what the machine could not settle waits here: a name that did not
 * match, a weak face score, a proxy, an AML result, or a NIN already on
 * another account. Clean matches pass on their own and appear under
 * "recently decided" so a reviewer can still look. The reviewer sees the
 * selfie beside the ID image, both names, the scores and Dojah's own reasons,
 * and decides. Files stream from our origin (`/api/identity-checks/...`);
 * the NIN and BVN are never here, not even hashed.
 */

const STATUS_WORD: Record<string, string> = {
  review: "Needs a person",
  retry: "Dojah could not finish",
  waiting: "Still with Dojah",
  passed: "Passed by Dojah",
  approved: "Approved by review",
  refused: "Refused by review",
};

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="nf-caption text-[var(--nf-content-muted)]">{label}</dt>
      <dd className="nf-body-sm text-[var(--nf-content-primary)]">{value ?? "Not returned"}</dd>
    </div>
  );
}

function CheckBody({ check, decidable }: { check: IdentityCheckView; decidable: boolean }) {
  const file = (key: keyof IdentityCheckView["files"]) => (check.files[key] ? `/api/identity-checks/${check.id}/${key}` : null);
  const selfie = file("selfie");
  const front = file("idFront");
  const back = file("idBack");
  const report = file("report");
  return (
    <div className="grid gap-md">
      {check.reasons.length > 0 && (
        <ul className="grid gap-inline-tight" aria-label="Why this needs a person">
          {check.reasons.map((reason) => (
            <li key={reason} className="nf-body-sm text-[var(--nf-content-primary)]">
              {reason}
            </li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-row sm:grid-cols-3">
        <Fact label="Name on the government record" value={check.legalName} />
        <Fact label="Name given to Vallo" value={check.valloName} />
        <Fact label="Date of birth on the record" value={check.dateOfBirth} />
        <Fact label="Checked with" value={check.idType} />
        <Fact label="Face match" value={check.selfieMatch === null ? null : `${check.selfieMatch} of 100`} />
        <Fact label="Liveness" value={check.liveness === null ? null : `${check.liveness} of 100`} />
        <Fact label="ID document" value={check.documentType} />
        <Fact label="Taken from" value={[check.country, check.proxy ? "through a proxy or VPN" : null].filter(Boolean).join(", ") || null} />
        <Fact
          label="AML screening"
          value={
            check.aml
              ? check.aml.error
                ? `Did not run (${check.aml.error})`
                : `${check.aml.match_status ?? "No status"}${check.aml.risk_level ? `, risk ${check.aml.risk_level}` : ""}`
              : "Not screened"
          }
        />
      </dl>
      {check.aml?.results && check.aml.results.length > 0 && (
        <ul className="grid gap-inline-tight" aria-label="AML results">
          {check.aml.results.map((r, i) => (
            <li key={`${r.name}-${i}`} className="nf-body-sm text-[var(--nf-content-secondary)]">
              {r.name ?? "Unnamed"} ({r.source_type ?? "list"})
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        {[
          ["Selfie", selfie],
          ["ID, front", front],
          ["ID, back", back],
        ].map(([label, src]) =>
          src ? (
            <figure key={label} className="grid gap-inline-tight">
              {/* eslint-disable-next-line @next/next/no-img-element -- streamed from our own origin behind staff auth, never optimised or cached */}
              <img src={src} alt={`${label} for this check`} className="w-full rounded-[var(--nf-radius-card)] object-cover" loading="lazy" />
              <figcaption className="nf-caption text-[var(--nf-content-muted)]">{label}</figcaption>
            </figure>
          ) : null,
        )}
      </div>
      <p className="nf-body-sm flex flex-wrap gap-inline">
        {report && (
          <a href={report} target="_blank" rel="noreferrer" className="underline">
            Dojah report (PDF)
          </a>
        )}
        {check.dashboardUrl && (
          <a href={check.dashboardUrl} target="_blank" rel="noreferrer" className="underline">
            Open on the Dojah dashboard
          </a>
        )}
        {check.dojahReference && <span className="text-[var(--nf-content-muted)]">Reference {check.dojahReference}</span>}
        {check.environment === "sandbox" && <span className="font-semibold text-[var(--nf-state-error)]">Sandbox: test data, not a real person</span>}
      </p>
      {check.decisionNote && <p className="nf-body-sm text-[var(--nf-content-secondary)]">Reviewer said: {check.decisionNote}</p>}
      {decidable && (check.status === "review" || check.status === "retry") && (
        <IdentityCheckDecision checkId={check.id} canApprove={check.legalName !== null} />
      )}
    </div>
  );
}

export function IdentityChecksPanel({ waiting, decided }: { waiting: IdentityCheckView[]; decided: IdentityCheckView[] }) {
  if (waiting.length === 0 && decided.length === 0) return null;
  const row = (check: IdentityCheckView, decidable: boolean) => (
    <details key={check.id} className="nf-rv-rows__row" data-testid="identity-check-row">
      <summary style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
        <span className="nf-rv-rows__cell">{check.name ?? check.legalName ?? "No display name"}</span>
        <span className="nf-rv-rows__cell nf-rv-table__muted">{STATUS_WORD[check.status] ?? check.status}</span>
      </summary>
      <div className="nf-rv-detail__body">
        <CheckBody check={check} decidable={decidable} />
      </div>
    </details>
  );
  return (
    <div className="mb-block grid gap-block">
      {waiting.length > 0 && (
        <Panel title={`Selfie checks waiting (${waiting.length})`} labelledBy="rv-kyc-dojah-waiting">
          <div className="nf-rv-rows">{waiting.map((check) => row(check, true))}</div>
        </Panel>
      )}
      {decided.length > 0 && (
        <Panel title="Selfie checks recently decided" labelledBy="rv-kyc-dojah-decided">
          <div className="nf-rv-rows">{decided.map((check) => row(check, false))}</div>
        </Panel>
      )}
    </div>
  );
}
