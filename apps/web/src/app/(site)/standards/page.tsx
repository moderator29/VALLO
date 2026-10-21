import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import {
  NO_FEES_LINE,
  RESPONSE_COMMITMENTS,
  RESPONSE_ORDER,
} from "@/lib/trust/standards";
import { TIER_NAME, VERIFICATION_ORDER } from "@/lib/trust/verification";
import { RankingExplained } from "@/components/site/RankingExplained";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import "@/components/site/guides/policy-sheet.css";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("standards");
}

/**
 * Trust and safety standards.
 *
 * A standards page is worth exactly as much as the slowest promise on it, so
 * the response times printed here are the same three numbers the admin console
 * computes a due time from: `RESPONSE_COMMITMENTS` in `lib/trust/standards.ts`
 * is imported by both. Changing what we promise changes what staff are held to,
 * in one edit, which is the only arrangement where a published clock stays
 * honest.
 *
 * Nothing here describes a control that does not exist. The scanner, the hold,
 * the queues, the audit line and the appeal are all live today.
 */

const NOT_ALLOWED: { title: string; body: string }[] = [
  {
    title: "Asking anyone to pay outside Vallo",
    body: "Sending an account number, asking for a transfer, moving the conversation to WhatsApp to arrange money, or asking for cash at an inspection. This is the most serious thing on the platform and it ends an account.",
  },
  {
    title: "Charging a fee we do not charge",
    body: `${NO_FEES_LINE} An inspection fee, an agency fee, a holding fee or a caution fee presented as ours is a lie, and an account that presents one is removed.`,
  },
  {
    title: "Listing a place you do not control",
    body: "Somebody else's photographs, an address that is not yours to let, a property that has already gone, or a hotel, guest house or restaurant you do not run. If you recognise photographs from somewhere else, report the listing; a person reads every report.",
  },
  {
    title: "Misrepresenting a property or a stay",
    body: "Photographs that are not of the place, a size or an address that is wrong, or amenities that do not exist. Light, water and gate access are the three that matter most on the Property side, and getting them wrong is not a small thing. On Vallo Stays it is the room, what it sleeps, the check-in hour and the house rules.",
  },
  {
    title: "Charging at the door what was not listed",
    body: "A host may ask at the door only for a charge listed on the place before the guest booked: a caution deposit, power, cleaning, an extra guest or a visitor, each with its amount and its reason. Anything else, or more than was listed, is not allowed, and the guest can report it.",
  },
  {
    title: "Harassment, threats or discrimination",
    body: "Refusing a guest or an agent on the grounds of ethnicity, religion, state of origin, gender, marital status or disability. Anything that makes a person unsafe, in a property or in a message.",
  },
  {
    title: "Fake accounts and manufactured reputation",
    body: "More than one account for one person, reviews written for a stay that did not happen, and utility reports filed to flatter an area you are selling in. Standing on Vallo is earned or it is worth nothing.",
  },
];

const ENFORCEMENT: { title: string; body: string }[] = [
  {
    title: "The scanner reads first, and it does not sleep",
    body: "Every message, post, story, listing description, review and profile is scanned as it is written. An account number or payment wording raises a flag, and on the public surfaces it holds the content before anyone else can see it. That happens at three in the morning exactly as it happens at three in the afternoon, because it is a database rule rather than a person on shift.",
  },
  {
    title: "A person decides, always",
    body: "The scanner holds, it never bans. Every hold, flag, alert and report lands in a queue that a member of staff works through by hand, oldest first, and a person makes the decision to release it or to take it down.",
  },
  {
    title: "Serious things are escalated, not merely closed",
    body: "A report that somebody was asked to pay off-platform, or that somebody has already lost money, opens a risk alert that stays open until a person writes down what was done about it. Closing it without a note is not possible.",
  },
  {
    title: "Every decision is written down and cannot be rewritten",
    body: "Each action a member of staff takes writes a line naming who did it, what they did and when. Those lines cannot be edited or deleted by anybody, including us. A record staff can quietly change proves nothing to you, to a regulator or in a dispute.",
  },
];

const CONSEQUENCES: { title: string; body: string }[] = [
  {
    title: "Content removed",
    body: "The post, listing, review or photograph comes down and the author is told why.",
  },
  {
    title: "Listing unpublished",
    body: "The property or the stay leaves search while we look at it. Existing bookings and reservations are handled with the guest directly, never silently cancelled.",
  },
  {
    title: "Account suspended",
    body: "Sign-in continues to work so the person can read the decision and appeal, but they cannot list, message or book.",
  },
  {
    title: "Account removed and referred",
    body: "For fraud, for asking a person to pay off-platform after a warning, or for anything that put somebody in danger. Where money has been taken we will co-operate with the person's bank and with the police.",
  },
];

export default function StandardsPage() {
  return (
    <>
      <SiteHead
        plate="villa-exterior-sunset"
        icon="shield-home"
        chip="Trust and safety"
        title="What we do not allow, and how quickly we answer"
        lede="These are the standards every person on Vallo agrees to, on both sides of the product, the way we enforce them, and the response times we hold ourselves to. If we miss one, tell us and quote your reference."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* THE STANDARDS ON PAPER (D28.1; Session 3, W1b): one document sheet in
            the reader's theme; the cards the parts used to be are rows, and the
            ranking section's own cards are rowed by policy-sheet.css. Every word
            is as it was. */}
        <DocumentSheet kind="document" printable className="nf-policy mt-block">
        {/* ------------------------------------------- response times first */}
        <section aria-labelledby="response-times">
          <h2 id="response-times">
            How long we take
          </h2>
          <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            Measured from the moment your report is filed, not from the moment
            somebody opens it. The console our staff work in puts the same clock
            on every row and marks it late when it passes, so these are numbers
            we are held to internally and not a line of marketing.
          </p>
          <ul className="nf-policy__list mt-group">
            {RESPONSE_ORDER.map((grade) => {
              const commitment = RESPONSE_COMMITMENTS[grade];
              return (
                <li key={grade} className="nf-policy__item">
                  <div className="flex flex-wrap items-baseline gap-x-row gap-y-inline-tight">
                    <span className="nf-numeric text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
                      {commitment.label}
                    </span>
                  </div>
                  <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                    {commitment.covers}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-row text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            Answering does not always mean finishing. It means a person has read
            it, told you what is happening, and taken any step that stops harm
            continuing while the rest is worked out.
          </p>
        </section>

        {/* ------------------------------------------------- not allowed */}
        <section aria-labelledby="not-allowed">
          <h2 id="not-allowed">
            What is not allowed
          </h2>
          <ul className="nf-policy__list mt-group">
            {NOT_ALLOWED.map((item) => (
              <li key={item.title} className="nf-policy__item">
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

        {/* ------------------------------------------------- enforcement */}
        <section aria-labelledby="enforcement">
          <h2 id="enforcement">
            How we enforce it
          </h2>
          <ol className="nf-policy__list mt-group">
            {ENFORCEMENT.map((item, index) => (
              <li key={item.title} className="nf-policy__item">
                <span className="nf-overline">
                  Step <span className="nf-numeric">{index + 1}</span>
                </span>
                <h3 className="mt-inline-tight text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                  {item.title}
                </h3>
                <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------ consequences */}
        <section aria-labelledby="consequences">
          <h2 id="consequences">
            What happens when a standard is broken
          </h2>
          <ul className="nf-policy__list mt-group">
            {CONSEQUENCES.map((item) => (
              <li key={item.title} className="nf-policy__item">
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

        {/* --------------------------------------------- the agent ladder */}
        <section aria-labelledby="agent-ladder">
          <h2 id="agent-ladder">
            How far the person behind a listing has been checked
          </h2>
          <p className="mt-inline text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
            Approval is where somebody starts, not where they finish. Four checks
            sit above it, in this order, and each one is a decision a named member
            of our team recorded. Nobody skips a step: passing the last one while
            the first is outstanding counts for nothing. One ladder governs all of
            them, an agent acting for owners, an owner letting their own place, a
            host who lets rooms by the night and a restaurant that takes tables,
            because it is the person being checked and not the product.
          </p>
          <ol className="nf-policy__list mt-group">
            {VERIFICATION_ORDER.map((rung) => (
              <li key={rung.kind} className="nf-policy__item">
                <div className="flex flex-wrap items-baseline gap-x-row gap-y-inline-tight">
                  <span className="nf-overline">
                    Level <span className="nf-numeric">{rung.step}</span>
                  </span>
                  <span className="text-[length:var(--nf-text-row)] font-semibold text-[var(--nf-content-primary)]">
                    {TIER_NAME[rung.step]}
                  </span>
                </div>
                <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                  {rung.meaning}
                </p>
                <p className="mt-inline text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
                  What we look at: {rung.evidence}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-row text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
            A level can go down as well as up. If something stops checking out, the
            check is recorded as failed, the level drops to the step below it, and
            the agent is told why.
          </p>
        </section>

        {/* ------------------------- V-06: Recommended, and no paid placement */}
        <RankingExplained />

        {/* ---------------------------------------------------- appeals */}
        <section aria-labelledby="appeals">
          <h2 id="appeals">
            If you think we got it wrong
          </h2>
          <div className="mt-group">
            <p className="text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              Every decision can be appealed, and an appeal is read by somebody
              who did not make the original call. Write to support with what was
              removed and why you think the decision was wrong. Appeals are
              answered{" "}
              <span className="font-semibold text-[var(--nf-content-primary)]">
                {RESPONSE_COMMITMENTS.routine.label.toLowerCase()}
              </span>
              . An account suspended pending an appeal can still sign in and
              read, so nobody is locked out of their own case.
            </p>
            <div className="mt-group flex flex-wrap gap-row">
              <ButtonLink href="/contact" variant="primary" size="md">
                Appeal a decision
              </ButtonLink>
              <ButtonLink href="/safety" variant="secondary" size="md">
                Safety centre
              </ButtonLink>
            </div>
          </div>
        </section>

        </DocumentSheet>

        <p className="mt-block text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          These standards sit alongside the{" "}
          <Link
            href="/terms"
            className="font-semibold text-[var(--nf-content-secondary)] hover:underline"
          >
            terms of service
          </Link>{" "}
          and the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-[var(--nf-content-secondary)] hover:underline"
          >
            privacy notice
          </Link>
          . Where they disagree, the stricter one applies.
        </p>
      </div>
    </div>
    </>
  );
}
