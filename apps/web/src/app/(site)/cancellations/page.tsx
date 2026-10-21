import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CancellationTimeline } from "@/lib/trust/CancellationTimeline";
import { FULL_REFUND_HOURS } from "@/lib/trust/cancellation";
import { PRESET_ORDER } from "@/lib/host/cancellation-presets";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
/* Every money sentence on this page is lib/money/copy.ts's (C6, the route sweep). */
import {
  CANCEL_AFTER_PAID,
  CANCEL_BEFORE_PAID,
  CANCEL_BY_AGENT,
  CANCEL_LEDE,
  CANCEL_NO_ENTRY,
  CANCEL_NOT_AS_LISTED,
  CANCEL_TABLE,
  NO_CUSTODY_SENTENCE,
  REFUND_NO_BALANCE,
  REFUND_ROUTE,
} from "@/lib/money/copy";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import "@/components/site/guides/policy-sheet.css";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("cancellations");
}

/**
 * The cancellation policy.
 *
 * Two kinds of stay, said plainly. A stay listed by an owner or agent follows
 * the platform schedule, drawn by `CancellationTimeline` from
 * `lib/trust/cancellation.ts`. A hotel, shortlet or serviced apartment run as
 * a business picks one of four presets, Flexible, Moderate, Firm or Strict
 * (`lib/host/cancellation-presets.ts`), and the guest sees that policy's tiers
 * on the stay page and at checkout. Either way the terms are frozen on the
 * booking when it is paid, and the refund follows the booked terms.
 */

export default function CancellationPolicyPage() {
  return (
    <>
      <SiteHead
        plate="bedroom-02"
        icon="calendar-clock"
        chip="Cancellations"
        title="Cancelling a stay, and what comes back"
        /* THE LEDE IS THE PROMISE, NOT THE EXCEPTIONS. A2.
           It ran to four sentences and drew NINE CENTRED LINES at 390px, which
           is a wall rather than an opening, and two of those sentences were
           exclusions the page already answers in full further down. The hero
           keeps the promise; the exclusions have their own sections, where
           somebody looking for one will actually find it. */
        lede={CANCEL_LEDE}
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* THE POLICY ON PAPER (D28.1; Session 3, W1b): one document sheet in the
            reader's theme, sections separated by a hairline, the cards the parts
            used to be now rows (policy-sheet.css). Every word is as it was. */}
        <DocumentSheet kind="document" printable className="nf-policy mt-block">
        {/* ------------------------------------------------- the timeline */}
        <section aria-labelledby="the-schedule">
          <h2 id="the-schedule" className="sr-only">
            The schedule
          </h2>
          <CancellationTimeline headingLevel="h3" />
        </section>

        {/* ------------------------------------------- a host's own policy */}
        <section aria-labelledby="host-policies">
          <h2 id="host-policies">
            When the host picks the policy
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              A hotel, shortlet or serviced apartment run as a business picks one of four
              policies: {PRESET_ORDER.map((code) => code.charAt(0).toUpperCase() + code.slice(1)).join(", ")}.
              Its refund steps are shown on the stay before you book and again at checkout, and
              the refund follows the policy on your booking.{" "}
              <Link
                href="/docs/refunds-and-cancellations#which-policy"
                className="font-semibold text-[var(--nf-content-link)] hover:underline"
              >
                The four policies, step by step
              </Link>
              .
            </p>
            <p className="mt-row text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              Every deadline is counted in Lagos time from the stay&apos;s check-in time. A
              caution deposit is always returned under the rules listed with it, whatever the
              policy.
            </p>
          </div>
        </section>

        {/* ----------------------------------------------- before you pay */}
        <section aria-labelledby="before-you-pay">
          <h2 id="before-you-pay">
            Before you have paid
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              {CANCEL_BEFORE_PAID}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ after you pay */}
        <section aria-labelledby="after-you-pay">
          <h2 id="after-you-pay">
            After you have paid
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              {CANCEL_AFTER_PAID}
            </p>
            <p className="mt-row text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
              Cancellation requests are answered{" "}
              <span className="font-semibold text-[var(--nf-content-primary)]">
                {RESPONSE_COMMITMENTS.standard.label.toLowerCase()}
              </span>
              , and sooner when your check-in is close.
            </p>
            <div className="mt-group flex flex-wrap gap-row">
              <ButtonLink href="/bookings" variant="primary" size="md">
                Open your bookings
              </ButtonLink>
              <ButtonLink href="/contact" variant="secondary" size="md">
                Contact support
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* ------------------------------------------- when it is not you */}
        <section aria-labelledby="not-your-fault">
          <h2 id="not-your-fault">
            When the cancellation is not your doing
          </h2>
          <ul className="nf-policy__list mt-group">
            <li className="nf-policy__item">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                The agent cancels
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {CANCEL_BY_AGENT.split("{hours}").map((part, i) => (
                  <span key={i}>
                    {i > 0 ? <span className="nf-numeric">{FULL_REFUND_HOURS}</span> : null}
                    {part}
                  </span>
                ))}
              </p>
            </li>
            <li className="nf-policy__item">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                The place is not what was listed
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {CANCEL_NOT_AS_LISTED}
              </p>
            </li>
            <li className="nf-policy__item">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                You could not get in
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                {CANCEL_NO_ENTRY}
              </p>
            </li>
          </ul>
        </section>

        {/* --------------------------------------------- restaurant tables */}
        <section aria-labelledby="tables">
          <h2 id="tables">
            A restaurant table is different
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              {CANCEL_TABLE}
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ refund route */}
        <section aria-labelledby="refund-route">
          <h2 id="refund-route">
            Where a refund actually goes
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              {REFUND_ROUTE} {NO_CUSTODY_SENTENCE} {REFUND_NO_BALANCE}
            </p>
          </div>
        </section>

        {/* ------------------------------------------- tenancies and sales */}
        {/* THE ONE EXCLUSION THAT HAD NO SECTION. A2. The lede said a tenancy
            is settled in its own agreement and then the page never mentioned
            it again, so the only place that answer existed was a sentence in
            the hero nobody scrolls back up to. */}
        <section aria-labelledby="tenancies">
          <h2 id="tenancies">
            A tenancy, a sale or a lease is different again
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              The schedule above is for stays: a room, a flat or a house taken by
              the night. A year&apos;s rent, a purchase or a commercial lease is
              settled in the agreement you sign with the agent, and the terms in
              that agreement are the ones that apply. Vallo keeps the
              conversation, the inspection and the record of what was paid, and it
              does not overwrite what the two of you agreed.
            </p>
          </div>
        </section>

        </DocumentSheet>

        <p className="mt-block text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          Read this next to the{" "}
          <Link
            href="/safety"
            className="font-semibold text-[var(--nf-content-secondary)] hover:underline"
          >
            safety centre
          </Link>{" "}
          and the{" "}
          <Link
            href="/standards"
            className="font-semibold text-[var(--nf-content-secondary)] hover:underline"
          >
            trust and safety standards
          </Link>
          .
        </p>
      </div>
    </div>
    </>
  );
}
