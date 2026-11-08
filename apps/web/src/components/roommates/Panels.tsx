import type { CSSProperties } from "react";

import { Money } from "@/components/ui/Money";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { MATCH_PARTS, moveInCost, type MatchView, type Period } from "@/lib/features/roommates/model";

import { fill, LOCALE, type RoommatesCopy } from "./format";
import { MatchReasons, MatchRing } from "./Marks";
import "./roommates-kit.css";

/**
 * VALLO ROOMMATES, THE TWO PANELS. Server safe.
 *
 *   MatchPanel     the compatibility figure, one bar per part that could be
 *                  compared (a part either side left blank is not drawn),
 *                  the reasons, and the honest line under it
 *   CostBreakdown  what one person pays to move in, from the lister's own
 *                  figures through `moveInCost`, then the monthly utilities
 *                  estimate and the note to confirm everything in writing
 */

export function MatchPanel({ match, t, title }: { match: MatchView | null; t: RoommatesCopy; title?: string }) {
  const score = match?.score ?? null;
  const parts = MATCH_PARTS.filter((p) => typeof match?.parts[p] === "number");
  return (
    <section className="nf-rm-panel nf-rm-match" aria-labelledby="rm-match-title" data-testid="roommates-match">
      <div className="nf-rm-match__head">
        <MatchRing score={score} size="lg" label={score === null ? t.match.thin : fill(t.match.percent, { n: Math.round(score) })} />
        <div className="nf-rm-match__words">
          <h2 id="rm-match-title" className="nf-rm-panel__title">
            {title ?? t.match.label}
          </h2>
          <p className="nf-rm-panel__sub">{score === null ? t.match.thin : fill(t.match.percent, { n: Math.round(score) })}</p>
        </div>
      </div>
      {score !== null && parts.length ? (
        <ul className="nf-rm-bars">
          {parts.map((p, i) => {
            const v = Math.round((match?.parts[p] ?? 0) * 100);
            return (
              <li key={p} className="nf-rm-bar">
                <span className="nf-rm-bar__label">{t.match.parts[p]}</span>
                <span className="nf-rm-bar__track" aria-hidden="true">
                  <span className="nf-rm-bar__fill" style={{ "--nf-rm-fill": v / 100, "--nf-rm-i": i } as CSSProperties} />
                </span>
                <span className="nf-rm-bar__n">{fill(t.ui.profile.outOf, { n: v })}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {score !== null ? <MatchReasons match={match} t={t} max={5} /> : null}
      <p className="nf-rm-note">
        <UiIcon name="info" size={16} />
        {t.match.honest}
      </p>
    </section>
  );
}

type CostInput = {
  kind: "room_offer" | "roommate_wanted" | "together";
  rentMinor: number | null;
  rentPeriod: Period;
  shareMinor: number | null;
  depositMinor: number | null;
  agencyFeeMinor: number | null;
  legalFeeMinor: number | null;
  serviceChargeMinor: number | null;
  utilitiesMonthlyMinor: number | null;
};

export function CostBreakdown({ cost, t, title }: { cost: CostInput; t: RoommatesCopy; title?: string }) {
  const L = t.listing;
  const total = moveInCost(cost);
  const per = t.perPeriod[cost.rentPeriod];
  if (!total) {
    return (
      <section className="nf-rm-panel" aria-labelledby="rm-cost-title" data-testid="roommates-cost">
        <h2 id="rm-cost-title" className="nf-rm-panel__title">
          {title ?? L.cost}
        </h2>
        <p className="nf-rm-panel__sub">{t.ui.listing.noCosts}</p>
      </section>
    );
  }
  const rows: { key: string; label: string; minor: number; suffix?: string }[] = [];
  if (cost.shareMinor !== null && cost.rentMinor !== null) rows.push({ key: "whole", label: t.ui.listing.wholeRent, minor: cost.rentMinor, suffix: per });
  rows.push({ key: "rent", label: cost.shareMinor !== null ? L.yourShare : L.rent, minor: total.rentMinor, suffix: per });
  if (total.depositMinor) rows.push({ key: "deposit", label: L.deposit, minor: total.depositMinor });
  if (total.agencyMinor) rows.push({ key: "agency", label: L.agency, minor: total.agencyMinor });
  if (total.legalMinor) rows.push({ key: "legal", label: L.legal, minor: total.legalMinor });
  if (total.serviceMinor) rows.push({ key: "service", label: L.service, minor: total.serviceMinor });
  return (
    <section className="nf-rm-panel nf-rm-cost" aria-labelledby="rm-cost-title" data-testid="roommates-cost">
      <h2 id="rm-cost-title" className="nf-rm-panel__title">
        {title ?? L.cost}
      </h2>
      <dl className="nf-rm-cost__rows">
        {rows.map((r) => (
          <div key={r.key} className="nf-rm-cost__row" data-muted={r.key === "whole" || undefined}>
            <dt>{r.label}</dt>
            <dd>
              <Money minor={r.minor} locale={LOCALE} mode="full" {...(r.suffix ? { suffix: r.suffix } : {})} />
            </dd>
          </div>
        ))}
        <div className="nf-rm-cost__row nf-rm-cost__row--total">
          <dt>{L.moveInTotal}</dt>
          <dd>
            <Money minor={total.totalMinor} locale={LOCALE} mode="full" />
          </dd>
        </div>
        {cost.utilitiesMonthlyMinor ? (
          <div className="nf-rm-cost__row">
            <dt>{L.utilities}</dt>
            <dd>
              <Money minor={cost.utilitiesMonthlyMinor} locale={LOCALE} mode="full" suffix={t.perPeriod.month} />
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="nf-rm-note">
        <UiIcon name="info" size={16} />
        {L.costNote}
      </p>
    </section>
  );
}
