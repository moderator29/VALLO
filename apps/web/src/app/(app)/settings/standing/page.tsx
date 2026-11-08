import type { Metadata } from "next";

import { PageFrame } from "@/components/app/PageFrame";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { CATEGORY_LABEL, RESTRICTION_LABEL, caseNumber, type CaseCategory } from "@/lib/admin/cases/model";
import { readMyStanding } from "@/lib/features/standing/queries";
import { dateLabel } from "@/lib/format/when";

import { AppealButton } from "./AppealButton";

export const metadata: Metadata = { title: "Account standing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /settings/standing: the member's own record with Vallo Trust and Safety.
 * Any restriction says what it limits, why, and until when, with an appeal;
 * each report they made says how it ended, in outcome words only.
 */
export default async function StandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const focus = typeof params.case === "string" ? Number(params.case) : null;
  const standing = await readMyStanding();

  return (
    <PageFrame title="Account standing" subtitle="Restrictions on your account, your appeals and your reports" fallback="/settings" width="narrow">
      {standing.state !== "ok" ? (
        <EmptyState
          icon="shield-check"
          title="Account standing"
          body={standing.state === "signed-out" ? "Sign in to see your account standing." : "Account standing is not open on this server yet."}
          action={standing.state === "signed-out" ? <ButtonLink href="/sign-in?next=/settings/standing" variant="primary">Sign in</ButtonLink> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-section" data-testid="standing">
          <section className="flex flex-col gap-group" aria-labelledby="standing-restrictions">
            <h2 id="standing-restrictions" className="nf-h3">
              Restrictions
            </h2>
            {standing.restrictions.length === 0 ? (
              <p className="nf-panel nf-panel--card p-card nf-body text-[var(--nf-content-secondary)]">
                Your account is in good standing. Nothing is restricted.
              </p>
            ) : (
              <ul className="flex flex-col gap-row">
                {standing.restrictions.map((r) => (
                  <li key={r.id} className="nf-panel nf-panel--card flex flex-col gap-inline p-card" data-active={r.active ? "true" : "false"}>
                    <div className="flex items-center justify-between gap-inline">
                      <span className="nf-body font-semibold">{RESTRICTION_LABEL[r.kind]}</span>
                      <span className="nf-caption text-[var(--nf-content-secondary)]">
                        {r.liftedAt ? "Lifted" : r.kind === "warning" ? "Warning" : r.active ? (r.endsAt ? `Until ${dateLabel(r.endsAt)}` : "Until lifted") : "Ended"}
                      </span>
                    </div>
                    <p className="nf-body-sm">{r.reason}</p>
                    <p className="nf-caption text-[var(--nf-content-secondary)]">From {dateLabel(r.startsAt)}</p>
                    {r.appeal ? (
                      <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                        {r.appeal.status === "open"
                          ? "Your appeal is with our team. Someone who did not make the decision will review it."
                          : r.appeal.status === "overturned"
                            ? `Appeal accepted. ${r.appeal.decisionNote ?? ""}`
                            : `Appeal reviewed. ${r.appeal.decisionNote ?? ""}`}
                      </p>
                    ) : (r.active || r.kind === "warning") && !r.liftedAt ? (
                      <AppealButton restrictionId={r.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-group" aria-labelledby="standing-reports">
            <h2 id="standing-reports" className="nf-h3">
              Your reports
            </h2>
            {standing.reports.length === 0 ? (
              <p className="nf-body-sm text-[var(--nf-content-secondary)]">Reports you make from the last six months show here, with how they ended.</p>
            ) : (
              <ul className="flex flex-col gap-row">
                {standing.reports.map((r) => (
                  <li
                    key={`${r.number}-${r.createdAt}`}
                    className="nf-panel nf-panel--card flex items-center justify-between gap-inline p-card"
                    data-focus={focus === r.number ? "true" : "false"}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="nf-body-sm font-semibold">{CATEGORY_LABEL[(r.category ?? "other") as CaseCategory] ?? "Report"}</span>
                      <span className="nf-caption text-[var(--nf-content-secondary)]">
                        {caseNumber(r.number)} · {dateLabel(r.createdAt)}
                      </span>
                    </div>
                    <span className="nf-caption font-semibold">
                      {r.outcome === "action_taken" ? "Action taken" : r.outcome === "no_action" ? "Reviewed" : "With our team"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageFrame>
  );
}
