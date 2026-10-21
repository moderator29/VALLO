import Link from "next/link";
import { formatDate, intlTag } from "@vallo/i18n/core";
import { readBeneficialOwnershipDesk } from "@/lib/compliance/beneficial-ownership-queries";
import { readActingForParams } from "@/lib/compliance/beneficial-ownership";
import { ActingFor, ActingForLookup } from "../../_components/ActingFor";
import { fill } from "../../_components/copy";
import { requestNow } from "@/lib/format/when";
import { CountUp } from "@/components/motion/CountUp";
import { panelClass } from "@/components/ui/Panel";
import type { ComplianceLane, ComplianceLaneProps } from "./lane";

/**
 * SCUML item 17: BENEFICIAL OWNERSHIP. "Acting for".
 *
 * The lane shows, for agent and firm listings, how many are live with a
 * current mandate and how many without, the listings still missing one (in
 * the grace window or already taken down), and the lookup: given any
 * transaction, booking, rent payment or listing, who the lister was acting
 * for. Examples are left out of every count.
 *
 * States: the counts and list, an honest empty ("every live listing has a
 * mandate"), and a failure that says the read did not run. A failed read is
 * never drawn as zero.
 */
async function BeneficialOwnership({ t, locale, params }: ComplianceLaneProps) {
  const copy = t.complianceBeneficialOwnership.lane;
  const desk = await readBeneficialOwnershipDesk();
  const acting = readActingForParams(params, "transaction");
  const graceOpen = desk?.graceEnds ? requestNow() < Date.parse(desk.graceEnds) : true;
  const day = (iso: string) =>
    formatDate(new Date(iso), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

  return (
    <div className="grid gap-group" data-testid="lane-beneficial-ownership">
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{copy.lede}</p>

      {desk === null ? (
        <p className="nf-body-sm" role="alert" style={{ color: "var(--nf-state-error)" }} data-testid="bo-failed">
          {copy.failed}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-sm sm:grid-cols-6" data-testid="bo-counts">
            {(
              [
                ["live", desk.counts.liveIntermediary],
                ["withMandate", desk.counts.liveWithMandate],
                ["withoutMandate", desk.counts.liveWithoutMandate],
                ["awaiting", desk.counts.awaitingDecision],
                ["takenDown", desk.counts.takenDown],
                ["waiting", desk.counts.mandatesWaiting],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className={panelClass({ variant: "card", className: "nf-panel--figure nf-admin-figure nf-admin-figure--count" })}>
                <dt className="nf-admin-figure__label">{copy.counts[key]}</dt>
                {/* An exact count from the desk's own read, counting up once. */}
                <dd className="nf-admin-figure__value">
                  {value > 0 ? <CountUp value={value} tag={intlTag[locale]} eager /> : <span className="nf-numeric">0</span>}
                </dd>
              </div>
            ))}
          </dl>
          {desk.graceEnds && (
            <p className="nf-caption">
              {fill(graceOpen ? copy.grace : copy.graceOver, { date: day(desk.graceEnds) })}
            </p>
          )}

          <section aria-labelledby="bo-needs">
            <h3 className="nf-h4" id="bo-needs">
              {copy.needsTitle}
            </h3>
            {desk.counts.awaitingDecision > 0 && (
              <p className="nf-caption mt-xs" data-testid="bo-awaiting">
                {fill(copy.awaitingNote, { count: desk.counts.awaitingDecision })}
              </p>
            )}
            {desk.needs.length === 0 ? (
              <p className="nf-body-sm mt-xs" data-testid="bo-empty">
                {copy.needsEmpty}
              </p>
            ) : (
              <ul className="mt-xs grid gap-xs" data-testid="bo-needs-list">
                {desk.needs.map((row) => (
                  <li
                    key={row.id}
                    className="nf-admin-case flex flex-wrap items-baseline justify-between gap-x-md px-sm py-xs nf-body-sm"
                  >
                    <span className="min-w-0">
                      <Link className="text-[var(--nf-content-link)]" href={`/admin/listings/${row.id}`}>
                        {row.reference ?? row.title}
                      </Link>
                      {row.agentName ? <span className="text-[var(--nf-content-secondary)]"> · {row.agentName}</span> : null}
                    </span>
                    <span className="text-[var(--nf-content-secondary)]">
                      {row.status === "PUBLISHED" ? (graceOpen ? copy.live : copy.liveAfterGrace) : row.since ? fill(copy.takenDownSince, { date: day(row.since) }) : row.status}
                      {" · "}
                      {copy.lastMandate[row.lastMandate ?? "none"]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="nf-caption mt-xs">
              <Link className="text-[var(--nf-content-link)]" href="/admin/listings">
                {copy.decideOn}
              </Link>
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="bo-lookup" className="grid gap-sm">
        <h3 className="nf-h4" id="bo-lookup">
          {copy.lookupTitle}
        </h3>
        <p className="nf-caption">{copy.lookupHint}</p>
        <ActingForLookup
          action="/admin/compliance"
          kind={acting.kind}
          id={acting.id}
          locale={locale}
          extra={{ tab: beneficialOwnershipLane.key }}
        />
        {acting.id.length > 0 && <ActingFor kind={acting.kind} id={acting.id} locale={locale} />}
      </section>
    </div>
  );
}

export const beneficialOwnershipLane: ComplianceLane = {
  key: "acting-for",
  items: [17],
  title: (t) => t.complianceBeneficialOwnership.lane.tab,
  Lane: BeneficialOwnership,
};
