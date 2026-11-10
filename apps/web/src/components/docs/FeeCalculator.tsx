"use client";

import { useState } from "react";
import { formatMoney } from "@vallo/i18n/core";
import { NairaField } from "@/components/ui/NairaField";
import { bpsAsPercentText } from "@/lib/money/percent";
import "./docs-kit.css";

/**
 * THE FEE CALCULATOR (client half). It does arithmetic on the rates it is
 * handed and nothing else: `FeeCalculatorSection` reads those rates from the
 * same table the payment split reads, so this cannot drift from the product.
 * It carries no rate of its own.
 *
 * Integer kobo throughout, `floor(amount * bps / 10000)` exactly as the split
 * rounds, in BigInt so a land price cannot lose a digit.
 *
 * What it does NOT show is stated under the figures: the payment partner's own
 * processing cost depends on how the payer pays and is shown to a lister on
 * their own listing, so it is not guessed here.
 */
export type CalculatorRates = {
  commissionBps: number;
  commissionFlatMinor: number;
  listingFeeBps: number;
  listingFeeFlatMinor: number;
};

function share(amountMinor: bigint, bps: number, flat: number): bigint {
  return (amountMinor * BigInt(bps)) / BigInt(10_000) + BigInt(flat);
}

export function FeeCalculator({ rates }: { rates: CalculatorRates }) {
  const [typed, setTyped] = useState("");
  const naira = typed === "" ? null : Number(typed);
  const valid = naira !== null && Number.isSafeInteger(naira) && naira > 0 && naira <= 50_000_000_000;
  const priceMinor = valid ? BigInt(naira) * BigInt(100) : null;

  const commission = priceMinor === null ? null : share(priceMinor, rates.commissionBps, rates.commissionFlatMinor);
  const listing = priceMinor === null ? null : share(priceMinor, rates.listingFeeBps, rates.listingFeeFlatMinor);
  const receive = priceMinor === null || commission === null || listing === null ? null : priceMinor - commission - listing;
  const money = (minor: bigint) => formatMoney(Number(minor));

  return (
    <div className="nf-dk-calc">
      <NairaField
        label="Price you set (naira)"
        value={typed}
        onValueChange={setTyped}
        hint="A rent, a nightly rate or a sale price."
        placeholder="1,800,000"
      />
      {priceMinor !== null && commission !== null && listing !== null && receive !== null ? (
        <dl className="nf-dk-calc__lines" aria-live="polite">
          <div className="nf-dk-calc__line">
            <dt>A renter, buyer or guest pays</dt>
            <dd>{money(priceMinor)}</dd>
          </div>
          <div className="nf-dk-calc__line">
            <dt>Vallo commission ({bpsAsPercentText(rates.commissionBps)} percent{rates.commissionFlatMinor > 0 ? ` plus ${formatMoney(rates.commissionFlatMinor)}` : ""})</dt>
            <dd>{money(commission)}</dd>
          </div>
          <div className="nf-dk-calc__line">
            <dt>Listing fee ({bpsAsPercentText(rates.listingFeeBps)} percent{rates.listingFeeFlatMinor > 0 ? ` plus ${formatMoney(rates.listingFeeFlatMinor)}` : ""})</dt>
            <dd>{money(listing)}</dd>
          </div>
          <div className="nf-dk-calc__line" data-strong="true">
            <dt>You receive, before the payment partner&apos;s own cost</dt>
            <dd>{money(receive)}</dd>
          </div>
        </dl>
      ) : (
        <p className="nf-dk-actions__note">Type a price to see the figures.</p>
      )}
      <p className="nf-dk-actions__note">
        These are the rates in force today, read from the same place the payment split reads them. The renter, buyer or
        guest never pays them on top. The payment partner&apos;s own processing cost depends on how the payer pays, and
        is shown to a lister on their listing before they publish.
      </p>
    </div>
  );
}
