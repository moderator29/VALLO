import { requireAdmin } from "@/lib/admin/guard";
import { lagosTime, strCasesFrom, strPrefill, strRegisterFrom, strReleasesFrom, type StrCase } from "@/lib/admin/str";
import type { ComplianceLane, ComplianceLaneProps } from "./lane";
import { StrApproveRelease, StrCaseControls, StrOpenForm, type StrSlideWords } from "./StrControls";
import { DocHead, DocRow, DocRows, DocSection, DocumentSheet } from "@/components/app/money/DocumentSheet";

/**
 * SCUML item 6: SUSPICIOUS TRANSACTION REPORTS TO THE NFIU (with item 19,
 * the second person, and item 11, five years).
 *
 * "Consider an STR" opens a case here, from a person, a transaction, a risk
 * alert, an upheld report, or a sanctions, PEP or threshold hit (other console
 * screens link in with `considerStrHref`). A case carries its grounds, its
 * linked transactions and people, a file or do not file decision with reasons,
 * and a second staff member's approval; an approved filing is recorded with
 * the officer's goAML reference in the register below. Everything is read
 * through `public.str_cases()` and `public.str_register()`, definer functions
 * that answer staff only, and every row behind them is append-only.
 *
 * NO TIPPING OFF. Nothing here changes what the person sees. The only lever on
 * money is "Hold their money", placed by staff on purpose.
 *
 * States: a failed read says the cases could not be read (never "none open"),
 * an empty list says so plainly, and the page's own loading.tsx covers the
 * wait.
 */

type RpcCaller = { rpc(fn: string): Promise<{ data: unknown; error: unknown }> };

async function StrLaneView({ t, params }: ComplianceLaneProps) {
  const copy = t.complianceStr;
  const slide: StrSlideWords = {
    slideApprove: t.experienceAdmin.compliance.slideApprove,
    confirming: t.experienceUi.confirming,
    confirmed: t.experienceUi.confirmed,
    error: t.experienceAdmin.compliance.refused,
    decisionBar: t.experienceAdmin.compliance.decisionBar,
    slideApproveRelease: t.experienceAdmin.compliance.slideApproveRelease,
  };
  const access = await requireAdmin("compliance");
  let cases: StrCase[] | null = null;
  let register: ReturnType<typeof strRegisterFrom> = null;
  let releases: ReturnType<typeof strReleasesFrom> = null;
  if (access.state === "admin") {
    const db = access.userClient as unknown as RpcCaller;
    const [c, r, rel] = await Promise.all([db.rpc("str_cases"), db.rpc("str_register"), db.rpc("str_pending_releases")]);
    releases = rel.error ? null : strReleasesFrom(rel.data);
    cases = c.error ? null : strCasesFrom(c.data);
    register = r.error ? null : strRegisterFrom(r.data);
  }

  return (
    <div className="grid gap-section" data-testid="str-lane">
      <p className="nf-body text-[var(--nf-content-secondary)]">{copy.lede}</p>

      <section aria-labelledby="str-open-title" className="nf-panel nf-panel--card p-card">
        <h2 id="str-open-title" className="nf-h3">{copy.openTitle}</h2>
        <div className="mt-row">
          <StrOpenForm copy={copy} prefill={strPrefill(params)} />
        </div>
      </section>

      <section aria-labelledby="str-cases-title">
        <h2 id="str-cases-title" className="nf-h3">{copy.casesTitle}</h2>
        {cases === null ? (
          <p role="alert" className="mt-row nf-body text-[var(--nf-state-error)]" data-testid="str-failed">
            {copy.failed}
          </p>
        ) : cases.length === 0 ? (
          <p className="mt-row nf-body text-[var(--nf-content-secondary)]" data-testid="str-empty">
            {copy.empty}
          </p>
        ) : (
          <ul className="mt-row grid gap-row">
            {cases.map((c) => (
              <li key={c.id} className="nf-panel nf-panel--card p-card" data-testid="str-case">
                <div className="flex flex-wrap items-baseline justify-between gap-inline">
                  <p className="nf-body font-semibold text-[var(--nf-content-primary)]">
                    {copy.sources[c.sourceKind]} <span className="nf-caption">{c.sourceId}</span>
                  </p>
                  <p className={`nf-body-sm ${c.overdue ? "text-[var(--nf-state-error)] font-semibold" : "text-[var(--nf-content-secondary)]"}`}>
                    {c.overdue ? `${copy.overdue}. ` : ""}
                    {copy.due.replace("{due}", lagosTime(c.dueAt))}
                  </p>
                </div>
                <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-secondary)]">{copy.states[c.state]}</p>
                <p className="nf-caption mt-inline-tight">{copy.openedOn.replace("{date}", lagosTime(c.openedAt))}</p>
                <p className="nf-body-sm mt-row"><span className="font-semibold">{copy.groundsLabel}: </span>{c.grounds}</p>
                {c.links.length > 0 && (
                  <p className="nf-caption mt-inline [overflow-wrap:anywhere]">
                    {copy.linksLabel}: {c.links.map((l) => `${l.kind} ${l.ref}`).join(", ")}
                  </p>
                )}
                {c.decision && (
                  <p className="nf-body-sm mt-row">
                    <span className="font-semibold">
                      {copy.decided.replace("{decision}", c.decision.decision === "file" ? copy.decisionFile : copy.decisionNoFile)}.{" "}
                    </span>
                    {c.decision.reasons}
                  </p>
                )}
                <StrCaseControls copy={copy} c={c} words={slide} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SCUML items 6 and 19: a hold is ended by a second person, and only
          when it is still this desk's alone (20260924173200). */}
      {releases === null ? (
        <p role="alert" className="nf-body text-[var(--nf-state-error)]">{copy.releasesFailed}</p>
      ) : releases.length > 0 ? (
        <section aria-labelledby="str-releases-title">
          <h2 id="str-releases-title" className="nf-h3">{copy.releasesTitle}</h2>
          <ul className="mt-row grid gap-inline" data-testid="str-releases">
            {releases.map((rel) => (
              <li key={rel.releaseId} className="nf-panel nf-panel--card p-card nf-body-sm">
                <p>{rel.note}</p>
                <p className="nf-caption mt-inline-tight">
                  {copy.releaseAsked.replace("{date}", lagosTime(rel.requestedAt))}. {copy.registerCase}: {rel.caseId.slice(0, 8)}
                </p>
                <StrApproveRelease copy={copy} releaseId={rel.releaseId} words={slide} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* THE REGISTER IS A RECORD, so it is the one thing on this lane drawn as
          a document: what was filed, when, and by whom, on paper, append-only.
          The cases above it are controls, so they stay in the console's own
          material (D28.1). */}
      <section aria-labelledby="str-register-title">
        {register === null ? (
          <>
            <h2 id="str-register-title" className="nf-h3">{copy.registerTitle}</h2>
            <p role="alert" className="mt-row nf-body text-[var(--nf-state-error)]">{copy.registerFailed}</p>
          </>
        ) : register.length === 0 ? (
          <>
            <h2 id="str-register-title" className="nf-h3">{copy.registerTitle}</h2>
            <p className="mt-row nf-body text-[var(--nf-content-secondary)]">{copy.registerEmpty}</p>
          </>
        ) : (
          <DocumentSheet aria-labelledby="str-register-title" data-testid="str-register">
            <DocHead title={copy.registerTitle} id="str-register-title" />
            {register.map((f) => (
              <DocSection key={f.caseId} title={`${copy.registerRef}: ${f.goamlReference}`}>
                <DocRows>
                  <DocRow label={copy.registerFiled} numeric>
                    {lagosTime(f.filedAt)}
                  </DocRow>
                  <DocRow label={copy.registerCase} numeric>
                    {f.caseId.slice(0, 8)}
                  </DocRow>
                  <DocRow label={copy.registerPeople} numeric>
                    {f.decidedBy.slice(0, 8)}
                    {f.approverId ? `, ${f.approverId.slice(0, 8)}` : ""}
                  </DocRow>
                </DocRows>
              </DocSection>
            ))}
          </DocumentSheet>
        )}
      </section>
    </div>
  );
}

/** SCUML item 6. */
export const StrLane: ComplianceLane = {
  key: "str",
  items: [6, 19],
  title: (t) => t.complianceStr.tab,
  Lane: StrLaneView,
};
