import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { CancellationTimeline } from "@/lib/trust/CancellationTimeline";
import { NEVER_ASK, NO_FEES_LINE, RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import { REPORT_CATEGORY_COPY, REPORT_CATEGORY_ORDER } from "@/lib/reports/schema";
/* Every money sentence on this page is lib/money/copy.ts's (C6, the route sweep). */
import {
  NO_CUSTODY_SENTENCE,
  NO_INSPECTION_FEE,
  OFF_PLATFORM_SENTENCE,
  PAYMENT_GATE_SENTENCE,
  RAIL_COPY,
  REFUND_NO_BALANCE,
  REFUND_ROUTE,
  SAFETY_NO_ACCOUNT_NUMBER,
  SAFETY_OUTSIDE_NOT_RECOVERABLE,
  SAFETY_PAY_THROUGH_VALLO,
  SAFETY_PAYMENT_RECORD,
  SAFETY_PRICE_IS_WHOLE,
  SAFETY_TABLE_NOT_A_PAYMENT,
} from "@/lib/money/copy";
import { LIVE_RAIL } from "@/lib/money/rails";
import { DEFAULT_LOCALE, getDictionary } from "@vallo/i18n";
import { e164 } from "@/lib/notify/whatsapp";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("safety");
}

/**
 * The safety centre.
 *
 * The platform's most important rule is that Vallo charges no fees and that
 * nobody should ever be asked to pay outside it. Until this page existed that
 * rule was enforced in three places nobody can see: a database trigger that
 * flags account numbers in messages, a scanner that holds posts and listings
 * naming one, and an admin queue where staff act on both. The person actually
 * being asked for money had nowhere to read any of it.
 *
 * So this page says it in the plainest words available, before anyone needs
 * it. Every claim on it is something the platform genuinely does today: no
 * promise that Vallo holds money it never holds, no response time the console cannot
 * keep, and no refund window that the cancellation schedule does not compute.
 */

const PAYING_STEPS: { title: string; body: string }[] = [
  {
    title: "You never pay a person directly, you pay through Vallo",
    body: `${NO_CUSTODY_SENTENCE} ${SAFETY_PAY_THROUGH_VALLO}`,
  },
  {
    title: "The price you agree is the price you pay",
    /* The rule card above prints NO_FEES_LINE word for word, so this step no
       longer opens with it a second time (C6, the route sweep). */
    body: SAFETY_PRICE_IS_WHOLE,
  },
  {
    title: "There is a record, permanently",
    body: SAFETY_PAYMENT_RECORD,
  },
  {
    title: "A refund goes back the way it came",
    /* "Vallo keeps no balance for you, so there is nothing to withdraw" was
       untrue beside the Rewards Balance (D51); the refund's own sentence is. */
    body: `${REFUND_ROUTE} ${REFUND_NO_BALANCE}`,
  },
  {
    title: "What stands behind a payment",
    body: RAIL_COPY[LIVE_RAIL].standing,
  },
  {
    title: "A table costs nothing to hold",
    body: SAFETY_TABLE_NOT_A_PAYMENT,
  },
];

const INSPECTION_STEPS: { title: string; body: string }[] = [
  {
    title: "Message first",
    body: "Open the listing and message whoever put it up, whether that is an owner, an agent or a host. Ask about light, water, the road, the gate and anything else that matters to you. Keep the whole conversation on Vallo: it is scanned for account numbers and payment wording, and it is the record if there is ever a dispute.",
  },
  {
    title: "Then inspect",
    body: "For a rental or a sale, view the property before any money moves, in person or on a video call. Bring somebody with you if you can, and go in daylight. Anybody who will not let you inspect before paying is telling you something. A stay is the other way round, because you cannot inspect a hotel room in Enugu from Lagos: there you pay on Vallo first, and the cancellation policy on your booking and the report route are what protect you instead.",
  },
  {
    title: "Submit the inspection report",
    body: "The inspection report is eight items with photographs: the outside, the inside, the kitchen, the bathrooms, the utilities, the appliances, safety and an overall verdict. You submit it from the inspection itself. It is the record of what the place was like, and it is what any later question about the place is compared with.",
  },
  {
    title: "Both of you confirm the agreement",
    body: `From the report an agreement is drawn up with the figures from the listing. You and the owner or agent each confirm the same version. ${PAYMENT_GATE_SENTENCE} Both of you are told by email and in the app.`,
  },
  {
    title: "Only then, pay on Vallo",
    body: `Rent is message, inspect, agree, then pay. There is no reserve button on a rental for exactly that reason. Never hand over cash at an inspection. ${NO_INSPECTION_FEE} ${OFF_PLATFORM_SENTENCE}`,
  },
];

export default function SafetyCentrePage() {
  /* V-96: the one WhatsApp number, printed only once it is configured. A
     number that is not set renders nothing, never a placeholder. */
  const whatsapp = e164(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
  return (
    <>
      <SiteHead
        plate="villa-exterior-gate"
        icon="shield-check"
        chip="Safety centre"
        title="Nobody on Vallo should ever ask you to pay outside it"
        lede="How payments work here on both sides, how inspections work before a tenancy, what a stay is protected by instead, what we will never ask you for, and what to do the moment somebody asks you for money off the platform."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ------------------------------------------------- the one rule */}
        <section className="nf-panel nf-panel--card block mt-section p-card" aria-labelledby="one-rule">
          <span className="nf-overline">The rule that matters most</span>
          <h2 id="one-rule" className="nf-h2 mt-inline text-[length:var(--nf-text-h3)]">
            {NO_FEES_LINE}
          </h2>
          <p className="mt-row text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            {SAFETY_NO_ACCOUNT_NUMBER}
          </p>
          {whatsapp && (
            <p className="nf-body-sm mt-row font-semibold text-[var(--nf-content-primary)]" data-testid="safety-whatsapp">
              {getDictionary(DEFAULT_LOCALE).platform.whatsapp.safetyLine.replace("{number}", whatsapp)}
            </p>
          )}
          <div className="mt-group flex flex-wrap gap-row">
            <ButtonLink href="/contact?topic=safety" variant="primary" size="md">
              Report someone
            </ButtonLink>
            <ButtonLink href="/standards" variant="secondary" size="md">
              Our standards and response times
            </ButtonLink>
          </div>
        </section>

        {/* -------------------------------------- what we never ask you for */}
        <section className="mt-section" aria-labelledby="never-ask">
          <h2 id="never-ask" className="nf-h2 text-[length:var(--nf-text-h3)]">
            What Vallo will never ask you for
          </h2>
          <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            Four things. If a message, a call or an email asks you for any of
            them, it is not us, whatever it looks like.
          </p>
          <ul className="mt-group space-y-row">
            {NEVER_ASK.map((item) => (
              <li key={item.title} className="nf-panel nf-panel--card block p-card-sm">
                <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                  {item.title}
                </h3>
                <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* -------------------------------------------- how payments work */}
        <section className="mt-section" aria-labelledby="how-payments">
          <h2 id="how-payments" className="nf-h2 text-[length:var(--nf-text-h3)]">
            How paying on Vallo works
          </h2>
          <ol className="mt-group space-y-row">
            {PAYING_STEPS.map((step, index) => (
              <li key={step.title} className="nf-panel nf-panel--card block p-card-sm">
                <span className="nf-overline">
                  Step <span className="nf-numeric">{index + 1}</span>
                </span>
                <h3 className="mt-inline-tight text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                  {step.title}
                </h3>
                <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ----------------------------------------- how inspections work */}
        <section className="mt-section" aria-labelledby="how-inspections">
          <h2 id="how-inspections" className="nf-h2 text-[length:var(--nf-text-h3)]">
            How inspections work
          </h2>
          <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            Renting a place you have never seen is how most people lose money in
            this market. The order below is the whole defence on the Property
            side, and it costs nothing.
          </p>
          <ol className="mt-group space-y-row">
            {INSPECTION_STEPS.map((step, index) => (
              <li key={step.title} className="nf-panel nf-panel--card block p-card-sm">
                <span className="nf-overline">
                  Step <span className="nf-numeric">{index + 1}</span>
                </span>
                <h3 className="mt-inline-tight text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                  {step.title}
                </h3>
                <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ----------------------------------------------- cancellations */}
        <section className="mt-section" aria-labelledby="cancelling">
          <h2 id="cancelling" className="nf-h2 text-[length:var(--nf-text-h3)]">
            If your plans change
          </h2>
          <div className="mt-group">
            <CancellationTimeline headingLevel="h3" />
          </div>
          <p className="mt-row text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            This is the schedule for a stay listed by an owner or agent. A hotel,
            shortlet or serviced apartment run as a business shows its own policy
            instead. Either way the terms are shown before you book and on your
            booking, against your own dates and your own total.{" "}
            <Link
              href="/cancellations"
              className="font-semibold text-[var(--nf-content-secondary)] hover:underline"
            >
              Read the full cancellation policy
            </Link>
            .
          </p>
        </section>

        {/* --------------------------------------------- how to report */}
        <section className="mt-section" aria-labelledby="how-to-report">
          <h2 id="how-to-report" className="nf-h2 text-[length:var(--nf-text-h3)]">
            How to report something
          </h2>
          <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            Every listing carries a report control, and the contact form reaches
            the same queue. You do not need proof and you will not be charged
            for being wrong. These are the reasons you can choose from, and they
            are the same words the queue is sorted by.
          </p>
          <ul className="mt-group space-y-inline">
            {REPORT_CATEGORY_ORDER.map((category) => (
              <li key={category} className="nf-panel nf-panel--card block p-card-sm">
                <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                  {REPORT_CATEGORY_COPY[category].label}
                </h3>
                <p className="mt-inline-tight text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {REPORT_CATEGORY_COPY[category].hint}
                </p>
              </li>
            ))}
          </ul>

          <div className="nf-panel nf-panel--card block mt-heading p-card">
            <span className="nf-overline">What happens next</span>
            <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              A report about being asked to pay outside Vallo, or about anything
              unsafe, is answered{" "}
              <span className="font-semibold text-[var(--nf-content-primary)]">
                {RESPONSE_COMMITMENTS.urgent.label.toLowerCase()}
              </span>
              . Everything else is answered{" "}
              <span className="font-semibold text-[var(--nf-content-primary)]">
                {RESPONSE_COMMITMENTS.standard.label.toLowerCase()}
              </span>
              . A listing can be taken out of search while we look at it, and the
              person who reported it is never named to the person reported.
            </p>
            <div className="mt-group flex flex-wrap gap-row">
              <ButtonLink href="/contact?topic=safety" variant="primary" size="md">
                Report it now
              </ButtonLink>
              <ButtonLink href="/standards" variant="secondary" size="md">
                What we promise
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* --------------------------------- if you already paid outside */}
        <section className="mt-section" aria-labelledby="already-paid">
          <h2 id="already-paid" className="nf-h2 text-[length:var(--nf-text-h3)]">
            If you have already paid someone outside Vallo
          </h2>
          <ol className="mt-group space-y-row">
            <li className="nf-panel nf-panel--card block p-card-sm">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                Tell your bank today, not tomorrow
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                A Nigerian bank can sometimes place a lien on a receiving account
                if you report a fraudulent transfer quickly. Call your bank first,
                before anything else, and ask them to raise a dispute on the
                transfer.
              </p>
            </li>
            <li className="nf-panel nf-panel--card block p-card-sm">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                Then report it here
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                Send us the listing link, the account details you were given and
                the messages. {SAFETY_OUTSIDE_NOT_RECOVERABLE}
              </p>
            </li>
            <li className="nf-panel nf-panel--card block p-card-sm">
              <h3 className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                Keep everything
              </h3>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                Screenshots, the account number, the phone number, the transfer
                receipt. Do not delete the conversation. If the police or your
                bank ask, that is the file.
              </p>
            </li>
          </ol>
        </section>

        {/* ------------------------------------------------------- close */}
        <div className="nf-panel nf-panel--card mt-section-tight flex flex-col items-start gap-group p-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-group">
            <IconPlate size="md" className="shrink-0">
              <UiIcon name="headset" size={20} />
            </IconPlate>
            <p className="text-[length:var(--nf-text-row)] leading-snug text-[var(--nf-content-secondary)]">
              Not sure whether something is a scam? Ask us before you pay, not
              after.
            </p>
          </div>
          <ButtonLink href="/contact" variant="primary" size="md" className="shrink-0">
            Contact support
          </ButtonLink>
        </div>
      </div>
    </div>
    </>
  );
}
