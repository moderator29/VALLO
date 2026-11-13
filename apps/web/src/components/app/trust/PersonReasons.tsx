import type { TrustCheck, TrustStat } from "@/lib/trust/checks";
import { TrustChecks, type TrustCheckLabels } from "./TrustChecks";
import "./trust-checks.css";

/**
 * "REASONS TO TRUST <NAME>", ON A PERSON'S PAGE (13 November 2026).
 *
 * A row of real numbers, then the person's dated checks, each of which opens
 * (`TrustChecks`). Both are built by `lib/trust/checks.ts`; this component
 * only lays them out.
 *
 * IT DRAWS NOTHING RATHER THAN SOMETHING THIN. With no dated check, and
 * fewer than two numbers, the whole section is absent: a heading over one
 * lonely figure promises reasons it does not have, and the page's header
 * already says when the person joined. A check that has not happened is never
 * listed against a person, here or anywhere.
 */

/** A row of one number is not a row: the stats draw from two cells up. */
const MIN_STATS = 2;

export function PersonReasons({
  title,
  lede,
  stats,
  checks,
  labels,
  testId = "person-reasons",
}: {
  title: string;
  lede: string;
  stats: TrustStat[];
  checks: TrustCheck[];
  labels: TrustCheckLabels;
  testId?: string;
}) {
  const cells = stats.length >= MIN_STATS ? stats : [];
  if (checks.length === 0 && cells.length === 0) return null;
  return (
    <section className="nf-reasons-person" aria-labelledby={`${testId}-title`} data-testid={testId}>
      <div>
        <h2 id={`${testId}-title`} className="nf-reasons-person__title">
          {title}
        </h2>
        {checks.length > 0 ? <p className="nf-reasons-person__lede mt-3xs">{lede}</p> : null}
      </div>
      {cells.length > 0 ? (
        <div className="nf-list-group nf-reasons-stats-card">
          <dl className="nf-reasons-stats" data-testid={`${testId}-stats`}>
            {cells.map((stat) => (
              <div key={stat.key} className="nf-reasons-stats__cell" data-testid={`${testId}-stat-${stat.key}`}>
                <dt className="nf-reasons-stats__label">{stat.label}</dt>
                <dd className="nf-reasons-stats__value">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {checks.length > 0 ? (
        <TrustChecks groups={[{ key: "person", rows: checks }]} labels={labels} testId={`${testId}-checks`} />
      ) : null}
    </section>
  );
}
