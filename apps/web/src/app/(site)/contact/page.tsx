import { SUPPORT_EMAIL, SUPPORT_MAILBOX } from "@/lib/support-email";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import Link from "next/link";
import { Reveal } from "@/components/site/Reveal";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";
import { ContactForm } from "./ContactForm";
import { ButtonLink } from "@/components/ui/Button";
import { CONTACT_TOPICS, DEFAULT_CONTACT_TOPIC, type ContactTopic } from "./topics";
import { SUPPLY_DOOR_HREF } from "@/lib/supply/roles";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { SocialLinks } from "@/components/ui/SocialLinks";
import "@/app/css/site.css";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("contact");
}


/**
 * Contact page.
 *
 * The support email is the hero object, with a plain response-time promise
 * next to it. The form below files a real support ticket and hands back its
 * VAL-SUP reference, and the help centre is offered first for the questions
 * that already have written answers.
 */

/**
 * `?topic=safety` arrives from the safety centre's report control, so the
 * person who has just read that nobody should ask them to pay outside Vallo
 * does not then have to find the right option in a select. Anything else in
 * that parameter is ignored rather than trusted into the form.
 */
function topicFrom(value: string | string[] | undefined): ContactTopic {
  const first = Array.isArray(value) ? value[0] : value;
  return CONTACT_TOPICS.find((topic) => topic === first) ?? DEFAULT_CONTACT_TOPIC;
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const defaultTopic = topicFrom((await searchParams).topic);

  return (
    <>
      <SiteHead
        plate="living-room-day"
        icon="chat"
        chip="Contact us"
        title="Talk to a human"
        lede="A tenancy, a stay, a table you are waiting on, a payment, a listing or something odd you spotted: whichever side of Vallo it is, the fastest route to a fix is below."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ------------------------------------------------ the promise */}
        <Reveal as="section" className="mt-section">
          <div className="nf-island p-card text-center-lg">
            {/*
              The hero used to be a large mailto to support@rentme.ng, a
              mailbox that does not exist, sitting directly above a form that
              works. It offered a dead route in the largest type on the page
              and the live one underneath it in the smallest.

              The address returns here on its own the moment
              NEXT_PUBLIC_SUPPORT_EMAIL names a real one. Until then the
              promise is the hero, because the promise is the true part.
            */}
            {SUPPORT_MAILBOX ? (
              <>
                <p className="nf-overline">Support email</p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="nf-tap mt-inline inline-block break-all text-[length:var(--nf-text-h4)] font-bold text-[var(--nf-content-link)] hover:underline sm:text-[length:var(--nf-text-h3)]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </>
            ) : (
              <>
                <p className="nf-overline">Talk to a person</p>
                <p className="mt-inline text-[length:var(--nf-text-h4)] font-bold text-[var(--nf-content-primary)] sm:text-[length:var(--nf-text-h3)]">
                  Send us a message
                </p>
              </>
            )}
            {/*
              THIS SCREEN MADE TWO DIFFERENT PROMISES AND KEPT NEITHER ON PAPER.
              The paragraph said one business day, Monday to Saturday, and the
              chip below it said 24 hours, which are not the same promise, and
              there is no rota, no queue and no measured response time behind
              either of them. A support promise you have not staffed is a
              complaint waiting to be quoted back at you.

              What is left is what is true: a person reads every message, and
              the ones where somebody is standing outside a door are answered
              before the ones that can wait.
            */}
            <p className="mx-auto mt-group max-w-[48ch] text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              A person reads every message that arrives here. Urgent problems, a
              payment that has gone wrong or a door you cannot get through today,
              are answered before anything else.
            </p>
            <div className="mt-heading flex flex-wrap items-center justify-center gap-inline">
              <span className="nf-site-badge">Answered by a person</span>
              <span className="nf-site-badge">English, Yorùbá, Hausa, Igbo</span>
            </div>
          </div>
        </Reveal>

        {/* --------------------------------------------- help centre first */}
        <Reveal as="section" className="mt-heading">
          <div className="nf-panel nf-panel--card flex flex-col items-start gap-group p-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-group">
              <IconPlate size="md" className="shrink-0">
                <UiIcon name="headset" size={20} />
              </IconPlate>
              <p className="text-[length:var(--nf-text-row)] leading-snug text-[var(--nf-content-secondary)]">
                Many questions already have written answers: the switch between
                the two sides, booking a stay, holding a table, payments, refunds
                and listing.
              </p>
            </div>
            <ButtonLink href="/help" variant="secondary" className="shrink-0">
              Browse the help centre
            </ButtonLink>
          </div>
        </Reveal>

        {/* ------------------------------------------------ safety first */}
        <Reveal as="section" className="mt-heading">
          <div className="nf-panel nf-panel--card flex flex-col items-start gap-group p-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-group">
              <IconPlate size="md" className="shrink-0">
                <UiIcon name="shield-check" size={20} />
              </IconPlate>
              <p className="text-[length:var(--nf-text-row)] leading-snug text-[var(--nf-content-secondary)]">
                Asked to pay into an account, or to move the conversation off
                Vallo? Say so in the form below and we answer within{" "}
                <span className="nf-numeric">{RESPONSE_COMMITMENTS.urgent.hours}</span>{" "}
                hours.
              </p>
            </div>
            <Link href="/safety" className="nf-btn nf-btn--glass shrink-0">
              Safety centre
            </Link>
          </div>
        </Reveal>

        {/* -------------------------------------------------------- form */}
        <Reveal as="section" className="mt-section">
          <h2 className="nf-overline text-center">Or write to us here</h2>
          <div className="nf-panel nf-panel--card block mt-group p-card">
            <ContactForm defaultTopic={defaultTopic} />
          </div>
        </Reveal>

        {/* ------------------------------------------------ find us */}
        <Reveal as="section" className="mt-section">
          <div className="nf-panel nf-panel--card flex flex-col items-start gap-group p-card sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[length:var(--nf-text-row)] leading-snug text-[var(--nf-content-secondary)]">
              News, new places and what is happening on Vallo. For a problem with a booking or a payment, use the form above: a message
              on a social network is not a support ticket.
            </p>
            <SocialLinks heading="Follow Vallo" size="lg" />
          </div>
        </Reveal>

        {/* ------------------------------------------------ other routes */}
        <Reveal as="section" className="mt-section">
          <div className="grid gap-heading sm:grid-cols-2">
            <div className="nf-panel nf-panel--card block p-card">
              <p className="nf-overline">Careers</p>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                Applications and anything hiring related go through the form
                above. Put Careers in the topic and it reaches the same queue.
              </p>
            </div>
            <div className="nf-panel nf-panel--card block p-card">
              {/* OWNERS FIRST, AND THE HEADING SAYS SO. "Agents and hosts"
                  left out the largest group this product now wants, and sent
                  every one of them to a page marked with an agent's job title.
                  The chooser is the door and it offers all three. */}
              <p className="nf-overline">Listing with us</p>
              <p className="mt-inline text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                Listing a property you own, working as an agent, running a firm,
                or letting a place by the night? Start at{" "}
                <Link href={SUPPLY_DOOR_HREF} className="font-semibold text-[var(--nf-content-link)] hover:underline">
                  Add a workspace
                </Link>
                . Checking on an application you already sent is in your profile.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
    </>
  );
}
