"use client";

import { useId, useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  CARD_CHOOSE_CTA,
  CARD_OPTION_LINE,
  CARD_OPTION_NOTE,
  CARD_OPTION_TITLE,
  PROTECTED_CHOOSE_CONDITIONS,
  PROTECTED_CHOOSE_CTA,
  PROTECTED_CHOOSE_EYEBROW,
  PROTECTED_CHOOSE_TITLE,
  PROTECTED_FEE_NOTE,
  PROTECTED_OPTION_RECOMMENDED,
  PROTECTED_OPTION_TITLE,
  PROTECTED_ROW_FEE,
  PROTECTED_ROW_FEE_LISTER_PAYS,
  PROTECTED_ROW_METHOD,
  PROTECTED_ROW_METHOD_VALUE,
  PROTECTED_ROW_TOTAL,
  PROTECTED_UNAVAILABLE_AGREEMENT,
  PROTECTED_UNAVAILABLE_FEE,
  PROTECTED_UNAVAILABLE_SERVICE,
} from "@/lib/money/copy";
import { PROTECTED_FUNDS_WORDING_SHORT, THIRD_PARTIES_LINE } from "@/lib/money/protected-wording";
import type { ProtectedQuote } from "@/lib/money/protected-fees";
import { DetailRows, PlaceCard, ScreenHead, money } from "./kit";
import { PartnerMark } from "./PartnerMark";
import type { ProtectedDeal } from "./types";

/** Why the protected option is not drawn, when it is not. */
export type ProtectedOffer =
  | { state: "offered"; quote: ProtectedQuote }
  /** No approved category or the rail is off: the option is simply absent (spec copy rules). */
  | { state: "absent" }
  | { state: "fee_failed" }
  | { state: "service_down" }
  | { state: "agreement_invalid" };

/**
 * SCREEN 1, CHOOSE HOW TO PAY (spec two; reference R72). The honest side by
 * side before the member commits: the protected transfer with every fee and
 * the total, and card with what it does and does not include. Card is never
 * called unsafe; "free protection" is never said. Nothing is charged here.
 */
export function ChooseHowToPay({
  deal,
  offer,
  cardAllowed,
  locale,
  onContinue,
  partnerMark = false,
}: {
  deal: Pick<ProtectedDeal, "amountMinor" | "place">;
  /** The partner mark beside the pay button, read on the server (`partnerMarkOn`). */
  partnerMark?: boolean;
  offer: ProtectedOffer;
  cardAllowed: boolean;
  locale: Locale;
  onContinue: (rail: "protected" | "card") => void;
}) {
  const offered = offer.state === "offered";
  const [rail, setRail] = useState<"protected" | "card" | null>(offered ? "protected" : cardAllowed ? "card" : null);
  const name = useId();
  const problem =
    offer.state === "fee_failed"
      ? PROTECTED_UNAVAILABLE_FEE
      : offer.state === "service_down"
        ? PROTECTED_UNAVAILABLE_SERVICE
        : offer.state === "agreement_invalid"
          ? PROTECTED_UNAVAILABLE_AGREEMENT
          : null;

  return (
    <div className="nf-pp-screen" data-testid="pp-choose">
      <ScreenHead eyebrow={PROTECTED_CHOOSE_EYEBROW} title={PROTECTED_CHOOSE_TITLE} />
      <PlaceCard place={deal.place} amount={money(deal.amountMinor, locale)} />

      {problem ? (
        <p className="nf-pp-notice" role="status" data-testid="pp-choose-problem">
          <UiIcon name="info" size={18} weight="lean" />
          {problem}
        </p>
      ) : null}

      <div role="radiogroup" aria-label={PROTECTED_CHOOSE_TITLE} className="nf-pp-options">
        {offered ? (
          <label className="nf-pp-option" data-on={rail === "protected" || undefined} data-testid="pp-option-protected">
            <input type="radio" name={name} className="sr-only" checked={rail === "protected"} onChange={() => setRail("protected")} />
            <span className="nf-pp-option__head">
              <span className="nf-pp-option__plate" aria-hidden="true">
                <UiIcon name="shield-check" size={22} weight="lean" />
              </span>
              <span className="nf-pp-option__name">{PROTECTED_OPTION_TITLE}</span>
              <span className="nf-pp-chip">{PROTECTED_OPTION_RECOMMENDED}</span>
              <span className="nf-pp-option__radio" aria-hidden="true" />
            </span>
            <span className="nf-pp-option__promise">{PROTECTED_FUNDS_WORDING_SHORT}</span>
            <DetailRows
              sunken
              rows={[
                { label: PROTECTED_ROW_METHOD, value: PROTECTED_ROW_METHOD_VALUE },
                {
                  label: PROTECTED_ROW_FEE,
                  value:
                    offer.quote.payer === "seller"
                      ? `${money(offer.quote.moneyInFeeMinor, locale)}, ${PROTECTED_ROW_FEE_LISTER_PAYS.toLowerCase()}`
                      : money(offer.quote.moneyInFeeMinor, locale),
                },
                { label: PROTECTED_ROW_TOTAL, value: money(offer.quote.buyerPaysMinor, locale), strong: true },
              ]}
            />
            <span className="nf-pp-option__note">{PROTECTED_FEE_NOTE}</span>
          </label>
        ) : null}

        {cardAllowed ? (
          <label className="nf-pp-option" data-on={rail === "card" || undefined} data-testid="pp-option-card">
            <input type="radio" name={name} className="sr-only" checked={rail === "card"} onChange={() => setRail("card")} />
            <span className="nf-pp-option__head">
              <span className="nf-pp-option__plate" aria-hidden="true">
                <UiIcon name="credit-card" size={22} weight="lean" />
              </span>
              <span className="nf-pp-option__name">{CARD_OPTION_TITLE}</span>
              <span className="nf-pp-option__radio" aria-hidden="true" />
            </span>
            <span className="nf-pp-option__line">
              {money(deal.amountMinor, locale)} · {CARD_OPTION_LINE}
            </span>
            <span className="nf-pp-option__note">{CARD_OPTION_NOTE}</span>
          </label>
        ) : null}
      </div>

      <p className="nf-pp-fine">{PROTECTED_CHOOSE_CONDITIONS}</p>
      {offered ? <p className="nf-pp-fine">{THIRD_PARTIES_LINE}</p> : null}

      {rail ? (
        <div className="nf-pp-actions">
          <Button variant="primary" size="lg" full onClick={() => onContinue(rail)} data-testid="pp-choose-continue">
            {rail === "protected" ? PROTECTED_CHOOSE_CTA : CARD_CHOOSE_CTA}
          </Button>
          {rail === "protected" ? <PartnerMark on={partnerMark} /> : null}
        </div>
      ) : null}
    </div>
  );
}
