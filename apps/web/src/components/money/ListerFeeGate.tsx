"use client";

import { useId } from "react";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { Checkbox } from "@/components/ui/Check";
import {
  ESCROW_PROTECTION_WHEN,
  FEE_ACCEPT_LABEL,
  FEE_ACCEPT_RECORD,
  FEE_GATE_TITLE,
  FEE_NEEDS_FIGURE,
  FEE_PREVIEW_NOTE,
  FEE_UNREADABLE_BODY,
  FEE_UNREADABLE_BODY_OPEN,
  FEE_UNREADABLE_TITLE,
  LISTER_FIGURE_LABEL,
  LISTER_RECEIVE_LABEL,
  PLATFORM_FEE_LABEL,
  PROCESSOR_FEE_LABEL,
  PROCESSOR_FEE_WHEN,
  escrowProtectionLabel,
  feeRangeText,
  rangeUpperText,
  listerBearsFeesSentence,
  receiveRangeNote,
  renterSeesSentence,
  upToText,
  valloFeeLabel,
  type ListerFigureKind,
} from "@/lib/money/copy";
import {
  acceptanceMatches,
  acceptanceOf,
  listerFeeFigures,
  listerFeeShown,
  type ListerFeeAcceptance,
  type ListerFeePolicy,
} from "@/lib/money/lister-fee";
import "@/app/css/money-layer.css";

/**
 * THE LISTER SEES WHAT THEY WILL RECEIVE BEFORE PUBLISHING (D51, D60, D61).
 *
 *   Rent you set                          1,800,000
 *   Platform fee                     36,000 to 72,000
 *     Vallo, 2%                           36,000
 *     Escrow protection, 2%
 *     when a buyer pays into escrow       36,000
 *   You receive                   1,728,000 to 1,764,000
 *
 * A RANGE, BECAUSE THE RAIL IS NOT KNOWN AT ACCEPTANCE (D61): it is chosen per
 * booking by how the buyer pays. The worst case is the headline, the largest
 * figure in full ink; the top of the range is set small beside it. The second
 * fee is named as escrow protection, which is the escrow partner's and applies
 * only when a buyer pays into escrow, never as a Vallo fee. When the policy
 * says the lister bears the processor's fee on a direct payment (the split's
 * bearer is the lister today), that is its own line, "up to" its cap, and the
 * top of the range already has it taken off. No "you keep N percent" and no
 * comparison with what anybody else charges: the naira is the point.
 *
 * TWO MODES, ONE SCREEN (D60). `blocking` is the `lister_fee_gate_blocking`
 * flag, read fail closed by the page. Off (its state with no row), the screen
 * is drawn in full and says plainly that nothing is recorded and that sending
 * for review does not wait for it: there is no checkbox, because ticking a box
 * that records nothing would pretend an acceptance was stored. On, the
 * explicit checkbox is the only accept; the wizard sends the acceptance to be
 * recorded before the listing, and a price edit, a new rate or new terms void
 * it on the next render because `acceptanceMatches` compares every figure.
 *
 * THE ESCROW ROW IS DRAWN ONLY WHILE THE PROTECTED RAIL IS LIVE (9 November
 * 2026, sweep items 7 to 9). The server's answer travels on the policy
 * (`escrowShown`); without it the screen draws the card rail alone
 * (`listerFeeShown`). The acceptance still records every rate in force,
 * because `lister_fee_accept` re-derives the figures from them and refuses
 * anything else; its worst case is never above the figure drawn.
 *
 * Honest states: no policy read (the gate says so, and says whether publishing
 * waits), and no price yet (a sentence, never a zero).
 */
export type ListerFeeGateProps = {
  kind: ListerFigureKind;
  /** The lister's own figure in kobo, or null before one is typed. */
  priceMinor: number | null;
  /** The rates in force from the server read, or null when they could not be read. */
  policy: ListerFeePolicy | null;
  locale: Locale;
  /** Whether sending for review waits on an acceptance (the fail-closed flag). */
  blocking: boolean;
  accepted: ListerFeeAcceptance | null;
  onAcceptedChange: (next: ListerFeeAcceptance | null) => void;
};

export function ListerFeeGate({ kind, priceMinor, policy, locale, blocking, accepted, onAcceptedChange }: ListerFeeGateProps) {
  const headingId = useId();
  const figures = listerFeeFigures(priceMinor, policy);
  const mode = blocking ? "blocking" : "preview";

  if (policy === null) {
    return (
      <section className="nf-panel nf-panel--card nf-feegate" aria-labelledby={headingId} data-testid="fee-gate" data-state="unreadable" data-mode={mode}>
        <h3 id={headingId} className="nf-body font-semibold text-[var(--nf-content-primary)]">
          {FEE_UNREADABLE_TITLE}
        </h3>
        <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">
          {blocking ? FEE_UNREADABLE_BODY : FEE_UNREADABLE_BODY_OPEN}
        </p>
      </section>
    );
  }

  if (figures === null) {
    return (
      <section className="nf-panel nf-panel--card nf-feegate" aria-labelledby={headingId} data-testid="fee-gate" data-state="no-figure" data-mode={mode}>
        <h3 id={headingId} className="nf-overline text-[var(--nf-content-muted)]">
          {FEE_GATE_TITLE}
        </h3>
        <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{FEE_NEEDS_FIGURE}</p>
      </section>
    );
  }

  const money = (minor: number) => formatMoney(minor, locale);
  const isAccepted = blocking && acceptanceMatches(accepted, figures, policy);
  const shown = listerFeeShown(figures, policy);
  const priceText = money(figures.priceMinor);
  const ranged = shown.receiveLowMinor !== shown.receiveHighMinor;
  const bears = listerBearsFeesSentence(shown.showEscrow, figures.processorUpToMinor > 0);
  const state = !blocking ? "preview" : isAccepted ? "accepted" : "open";

  return (
    <section className="nf-panel nf-panel--card nf-feegate" aria-labelledby={headingId} data-testid="fee-gate" data-state={state} data-mode={mode}>
      <h3 id={headingId} className="nf-overline text-[var(--nf-content-muted)]">
        {FEE_GATE_TITLE}
      </h3>
      <dl className="nf-feegate__rows">
        <div className="nf-feegate__row">
          <dt>{LISTER_FIGURE_LABEL[kind]}</dt>
          <dd data-testid="fee-gate-price">{priceText}</dd>
        </div>
        <div className="nf-feegate__row">
          <dt>{PLATFORM_FEE_LABEL}</dt>
          <dd data-testid="fee-gate-fee">{feeRangeText(money(shown.platformFeeLowMinor), money(shown.platformFeeHighMinor))}</dd>
        </div>
        <div className="nf-feegate__row nf-feegate__row--part">
          <dt>{valloFeeLabel(figures.valloPercentText, figures.valloCapped)}</dt>
          <dd data-testid="fee-gate-vallo">{money(figures.valloMinor)}</dd>
        </div>
        {shown.showEscrow && (
          <div className="nf-feegate__row nf-feegate__row--part">
            <dt>
              {escrowProtectionLabel(figures.escrowProtectionPercentText)}
              <span className="nf-feegate__when">{ESCROW_PROTECTION_WHEN}</span>
            </dt>
            <dd data-testid="fee-gate-escrow">{money(figures.escrowProtectionMinor)}</dd>
          </div>
        )}
        {figures.processorUpToMinor > 0 && (
          <div className="nf-feegate__row nf-feegate__row--part">
            <dt>
              {PROCESSOR_FEE_LABEL}
              <span className="nf-feegate__when">{PROCESSOR_FEE_WHEN}</span>
            </dt>
            <dd data-testid="fee-gate-processor">{upToText(money(figures.processorUpToMinor))}</dd>
          </div>
        )}
        <div className="nf-feegate__row nf-feegate__row--total">
          <dt>{LISTER_RECEIVE_LABEL}</dt>
          <dd data-testid="fee-gate-receive">
            <span className="nf-feegate__headline">{money(shown.receiveLowMinor)}</span>
            {ranged && <span className="nf-feegate__upper"> {rangeUpperText(money(shown.receiveHighMinor))}</span>}
          </dd>
        </div>
      </dl>

      {ranged && (
        <p className="nf-body-sm mt-row text-[var(--nf-content-secondary)]" data-testid="fee-gate-range-note">
          {receiveRangeNote(shown.escrowIsLowest)}
        </p>
      )}
      {bears && (
        <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]" data-testid="fee-gate-bearer">
          {bears}
        </p>
      )}
      <p className="nf-body-sm mt-inline text-[var(--nf-content-secondary)]">{renterSeesSentence(priceText)}</p>

      {blocking ? (
        <>
          <Checkbox
            className="mt-row"
            checked={isAccepted}
            data-testid="fee-gate-accept"
            onChange={(event) => onAcceptedChange(event.currentTarget.checked ? acceptanceOf(figures, policy) : null)}
          >
            {FEE_ACCEPT_LABEL}
          </Checkbox>
          <p className="nf-caption mt-inline text-[var(--nf-content-muted)]">{FEE_ACCEPT_RECORD}</p>
        </>
      ) : (
        <p className="nf-caption mt-row text-[var(--nf-content-muted)]" role="note" data-testid="fee-gate-preview">
          {FEE_PREVIEW_NOTE}
        </p>
      )}
    </section>
  );
}
