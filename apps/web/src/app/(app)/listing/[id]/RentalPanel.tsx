import { getDictionary, type Locale } from "@vallo/i18n";
import { DetailGlyph } from "@/components/app/listing/DetailGlyph";
import { ButtonLink } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { TYPE } from "@/components/app/Screen";
import { RequestInspection } from "@/components/app/inspections/RequestInspection";
import { readOpenInspectionFor } from "@/lib/inspections/queries";
import type { RentPeriod } from "@/lib/listings/pricing";
import { TenancyTerm } from "./TenancyTerm";

/**
 * The panel for rental listings, the serious rent market.
 *
 * Annual tenancies carry NO Reserve and NO Check availability control by
 * design (docs/HYBRID_INVENTORY.md sections 1 and 4): the path is message the
 * agent inside the platform, inspect the property, then pay. The price in the
 * term the row states, the three steps stated plainly, and the canonical safety
 * wording from section 6 word for word.
 *
 * It serves SALES as well as tenancies, which is easy to miss and was the cause
 * of one of the two price bugs this file used to carry. See `period` below.
 *
 * ---------------------------------------------------------------------------
 * STEP TWO IS NOW A CONTROL RATHER THAN A SENTENCE.
 * ---------------------------------------------------------------------------
 *
 * This panel has always listed "Inspect the property" as the middle step of
 * three and then offered exactly one thing to press: message the agent. So the
 * step that decides every rental in this market was prose, and the arrangement
 * lived in a chat thread that both sides had to scroll to reconstruct.
 *
 * `RequestInspection` files a real request against a real time, which appears
 * as a row with a state on the agent's own home screen and on the asker's
 * bookings screen. Messaging stays, beside it and below it, because an inspection
 * needs a conversation around it - what changed is that the conversation is no
 * longer the only place the arrangement exists.
 *
 * Still a server component, and it reads whether this person already has a
 * live request so the control can say where that one stands instead of quietly
 * filing a second identical one.
 */


/** A minimum stated in months, in this listing's own unit. */
const MONTHS_PER_TERM: Record<RentPeriod, number> = { month: 1, quarter: 3, year: 12 };

export async function RentalPanel({
  listingId,
  priceMinor,
  currency,
  locale,
  period = "year",
  minimumTenancyMonths,
}: {
  listingId: string;
  priceMinor: number;
  currency: string;
  locale: Locale;
  /**
   * What the figure above is, from the row rather than assumed.
   *
   * The panel printed "/ year" flat and it is rendered for TWO intents, so it
   * was wrong in two different ways at once. A listing the database said was
   * priced monthly showed its monthly rent labelled as a year's - on the same
   * screen where the hero above it, which resolves the period properly, said
   * "per month". And a property FOR SALE, which also lands on this panel,
   * printed its asking price as though it were annual rent.
   */
  period?: RentPeriod | "sale";
  /** What the agent set as the shortest tenancy they will take, in months. */
  minimumTenancyMonths?: number | undefined;
}) {
  const existing = await readOpenInspectionFor(listingId);
  const forSale = period === "sale";
  const t = getDictionary(locale);
  const w = t.memberFlows.rental;
  const steps = [
    { label: w.steps.message, detail: w.steps.messageDetail },
    { label: w.steps.inspect, detail: w.steps.inspectDetail },
    { label: w.steps.pay, detail: w.steps.payDetail },
  ];

  /* Months into terms, rounding UP: a listing priced yearly with an 18 month
     minimum takes two years, not one. Rounding down would offer a tenancy
     shorter than the one the agent said they would accept. */
  const minimumTerms =
    !forSale && minimumTenancyMonths
      ? Math.max(1, Math.ceil(minimumTenancyMonths / MONTHS_PER_TERM[period]))
      : 1;

  return (
    <div className="nf-panel nf-panel--card isolate p-lg" data-testid="rental-panel">
      <p>
        <Amount
          minorUnits={priceMinor}
          locale={locale}
          currency={currency}
          suffix={forSale ? t.agentListings.pricing.period.sale : t.experienceLabels.periodSlash[period]}
          className="nf-h3 leading-none tracking-tight text-[var(--nf-content-primary)]"
          secondaryClassName="text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-muted)]"
        />
      </p>
      <p className={`mt-2xs ${TYPE.rowMeta}`}>
        {forSale ? w.saleTerms : period === "year" ? w.annualTerms : w.tenancyTerms}
      </p>

      {/* A sale has no term to lengthen. Nothing is bought by the year. */}
      {!forSale && (
        <TenancyTerm
          priceMinor={priceMinor}
          period={period}
          currency={currency}
          locale={locale}
          minimumTerms={minimumTerms}
          copy={w}
        />
      )}

      <ol className="mt-md space-y-sm border-t border-[var(--nf-panel-hair)] pt-md">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-start gap-sm">
            {/* KEPT ROUND: an ordinal marker in an <ol>, not a control. */}
            <span className="nf-numeric nf-caption mt-3xs grid h-6 w-6 shrink-0 place-items-center rounded-[var(--nf-radius-xs)] border border-[var(--nf-panel-edge)] font-bold text-[var(--nf-content-secondary)]">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block ${TYPE.rowTitle}`}>{step.label}</span>
              <span className={`block ${TYPE.rowMeta}`}>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      {/*
        TWO CONTROLS, IN THE ORDER THE STEPS ARE IN.

        Message is the primary because step one is still step one: most people
        want to ask something before they name a Saturday. The inspection
        request is the secondary directly under it, which is the first time
        step two has had anything to press at all.
      */}
      <ButtonLink
        href={`/messages/new?listing=${listingId}`}
        variant="primary"
        full
        className="mt-md"
        leadingIcon="chat-bubble"
      >
        {w.message}
      </ButtonLink>

      <div className="mt-xs">
        <RequestInspection listingId={listingId} existing={existing} locale={locale} copy={t.visit.entry} zone={t.visit.tiles.lagos} />
      </div>

      {/* The trust block: the plated shield, the same line glyph on the same
          plate as every other row on the detail page (29 September 2026). */}
      <div className="mt-md flex items-start gap-sm border-t border-[var(--nf-panel-hair)] pt-md">
        {/* Advice, so a neutral glyph: the shield means an earned check (A9). */}
        <DetailGlyph name="info" />
        <p className={TYPE.rowMeta}>
          {w.keepInside}
        </p>
      </div>
    </div>
  );
}
