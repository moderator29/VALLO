import { KpiTile } from "@/components/ui/KpiTile";
import { ACCEPTANCE_DEFINITION, METRICS, NO_REVENUE_NOTE, RESPONSE_DEFINITION, type OffersOverview } from "./model";
import "@/components/app/offers/offers.css";

/** The overview strip: every figure carries its definition, and there is no money total. */
export function OverviewStrip({ overview }: { overview: OffersOverview }) {
  const rate = overview.acceptance && overview.acceptance.answered > 0 ? Math.round((overview.acceptance.agreed / overview.acceptance.answered) * 100) : null;
  return (
    <div className="grid gap-md" data-testid="offers-overview">
      <div className="nf-ofr-metrics">
        {METRICS.map((m) => (
          <KpiTile key={m.key} label={m.label} value={overview.counts[m.key]} sub={m.definition.replace("{days}", String(overview.windowDays))} />
        ))}
        <KpiTile
          label="Median response"
          value={overview.medianResponseHours ?? 0}
          unit={overview.medianResponseHours === null ? undefined : " hours"}
          sub={overview.medianResponseHours === null ? "No seller has responded yet in this window." : RESPONSE_DEFINITION}
        />
        <KpiTile
          label="Acceptance rate"
          value={rate ?? 0}
          unit={rate === null ? undefined : "%"}
          sub={rate === null || !overview.acceptance ? "Nothing has reached an answer yet in this window." : `${overview.acceptance.agreed} of ${overview.acceptance.answered}. ${ACCEPTANCE_DEFINITION}`}
        />
      </div>
      <p className="nf-body-sm text-[var(--nf-content-muted)]">{NO_REVENUE_NOTE}</p>
    </div>
  );
}
