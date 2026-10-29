import Link from "next/link";
import { State } from "@/components/ui/State";
import type { Dictionary } from "@vallo/i18n/core";
import type { LostByArea } from "@/lib/enquiry/queries";
import { STAGES, type Stage } from "@/lib/enquiry/stage";

/**
 * V-72: THE DESK'S TWO PANELS ON ANALYTICS.
 *
 * `EnquiryFunnel` is the lister's own enquiries by stage, each count a link
 * to that stage on the inbox. `LostByArea` is why enquiries were lost, by
 * area, across every lister, only where five were lost in that area (the
 * database applies the threshold) and never naming anybody.
 *
 * Both draw three states: could not be read, nothing yet, and the figures.
 */

type Copy = Dictionary["frontDoor"]["desk"];

export function EnquiryFunnel({ counts, copy }: { counts: Record<Stage, number> | null; copy: Copy }) {
  const total = counts ? STAGES.reduce((sum, s) => sum + counts[s], 0) : 0;
  return (
    <section className="nf-panel nf-panel--card mt-lg p-card-sm" aria-labelledby="enquiry-funnel-title" data-testid="enquiry-funnel">
      <h2 id="enquiry-funnel-title" className="nf-h4 text-[var(--nf-content-primary)]">
        {copy.funnelTitle}
      </h2>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.funnelNote}</p>
      {counts === null ? (
        <p className="mt-group nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>
      ) : total === 0 ? (
        <State compact kind="empty" icon="report-stats" title={copy.funnelEmpty} className="mt-group" />
      ) : (
        <ul className="mt-group grid grid-cols-1 gap-xs">
          {STAGES.map((s) => (
            <li key={s}>
              <Link
                href={`/agent/messages?stage=${s}`}
                className="flex items-center justify-between gap-sm py-2xs nf-body-sm text-[var(--nf-content-primary)]"
              >
                <span>{copy.stages[s]}</span>
                <span className="nf-numeric font-semibold">{counts[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LostByAreaPanel({ areas, copy }: { areas: LostByArea[] | null | "approved_only"; copy: Copy }) {
  return (
    <section className="nf-panel nf-panel--card mt-lg p-card-sm" aria-labelledby="lost-by-area-title" data-testid="lost-by-area">
      <h2 id="lost-by-area-title" className="nf-h4 text-[var(--nf-content-primary)]">
        {copy.lostTitle}
      </h2>
      <p className="mt-inline nf-body-sm text-[var(--nf-content-secondary)]">{copy.lostNote}</p>
      {areas === "approved_only" ? (
        <p className="mt-group nf-body-sm text-[var(--nf-content-muted)]">{copy.lostApprovedOnly}</p>
      ) : areas === null ? (
        <p className="mt-group nf-body-sm text-[var(--nf-content-muted)]">{copy.unreachable}</p>
      ) : areas.length === 0 ? (
        <State compact kind="empty" icon="report-stats" title={copy.lostEmpty} className="mt-group" />
      ) : (
        <ul className="mt-group flex flex-col gap-row">
          {areas.map((area) => (
            <li
              key={`${area.stateCode ?? ""}-${area.area}`}
              className="border-t border-[var(--nf-border-subtle)] pt-row first:border-t-0 first:pt-0"
            >
              <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{area.area}</p>
              <ul className="mt-inline-tight flex flex-col gap-3xs">
                {area.reasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-sm nf-body-sm text-[var(--nf-content-secondary)]">
                    <span>{copy.reasons[r.reason]}</span>
                    <span className="nf-numeric">
                      {copy.lostRow.replace("{count}", String(r.count)).replace("{total}", String(area.total))}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
