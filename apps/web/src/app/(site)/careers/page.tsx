import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import { Reveal } from "@/components/site/Reveal";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { SUPPORT_HREF } from "@/lib/support-email";
import { SUPPLY_DOOR_HREF } from "@/lib/supply/roles";
import { IconPlate } from "@/components/ui/IconPlate";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("careers");
}

/**
 * Careers page.
 *
 * Culture first, then an honest empty state for open roles: there are none
 * listed yet, so instead of fake vacancies the page invites speculative
 * applications through the one support channel and says exactly what to send.
 * It used to name careers@vallo.com, a mailbox on a dead working
 * name's domain, so every application sent to it went nowhere while the
 * sender believed they had applied.
 */
export default function CareersPage() {
  const culture: { icon: BrandIconName; title: string; body: string }[] = [
    {
      icon: "house-sparkle",
      title: "Nigeria is the brief",
      body: "We design for NEPA outages, bank transfer receipts and four languages, not for an imagined user in another country. Local knowledge counts for more here than anything on a CV.",
    },
    {
      icon: "shield-check",
      title: "Trust is the product",
      body: "Verification, payments that leave a reference, and reviews attached to stays that happened are not compliance chores. They are the whole point, and everyone on the team owns them.",
    },
    {
      icon: "chat",
      title: "Small team, big ownership",
      body: "You will ship things users touch in your first weeks. Clear writing, kind disagreement and finished work matter more than titles.",
    },
    {
      icon: "luggage-check",
      title: "Craft over churn",
      body: "We would rather build one screen properly than five screens roughly. Design, engineering and support sit in the same conversations.",
    },
  ];

  const wanted = [
    "Engineers who care about performance on mid-range Android phones",
    "Designers who can make trust visible in an interface",
    "Operations and support people who love untangling real problems",
    "Writers and translators fluent in Yorùbá, Hausa or Igbo",
  ];

  return (
    <>
      <SiteHead
        plate="tower-entrance-dusk"
        icon="reviews"
        chip="Careers at Vallo"
        title="Build Nigeria's property marketplace"
        lede="We are a small team building one app with two sides: Property for renting, buying and selling, and Vallo Stays for hotels, apartments, guest houses, resorts and restaurant tables. One account, one inbox, four languages, and every real listing put up by a person we approved. If that sounds like your kind of problem, we want to hear from you."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ----------------------------------------------- how we work */}
        <Reveal as="section" className="mt-section">
          <h2 className="nf-overline text-center">How we work</h2>
          <div className="mt-group grid gap-heading sm:grid-cols-2">
            {culture.map((c, i) => (
              <Reveal key={c.title} delay={(i % 2) * 80} className="h-full">
                <div className="nf-panel nf-panel--card flex h-full flex-col gap-row p-card">
                  <IconPlate size="md">
                    <UiIcon name={lineGlyphFor(c.icon)} size={20} />
                  </IconPlate>
                  <span className="font-semibold">{c.title}</span>
                  <span className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
                    {c.body}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        {/* -------------------------------------- open roles, empty state */}
        <Reveal as="section" className="mt-section">
          <h2 className="nf-overline text-center">Open roles</h2>
          {/* The empty state is the page's one subject, so it is its one Island
              (Session 3, W1b), and the list of what to send is a Plate row inside
              it, not a second card: one edge per container. */}
          <div className="nf-island mt-group p-card text-center-lg">
            <IconPlate size="lg" className="mx-auto">
              <UiIcon name="search" size={24} />
            </IconPlate>
            <h3 className="nf-h3 mx-auto mt-group max-w-[26ch]">
              No advertised openings right now
            </h3>
            <p className="mx-auto mt-row max-w-[52ch] text-[length:var(--nf-text-row)] leading-relaxed text-[var(--nf-content-secondary)]">
              We hire in small, deliberate waves, and the next one has not been posted
              yet. But we always read speculative applications, and several people on
              the team arrived exactly that way.
            </p>

            {/* On the card, not a second card inside it: a hairline sets the list
                apart (pass 3, no box inside a box). */}
            <div className="mx-auto mt-heading block max-w-md border-t border-[var(--nf-divider)] pt-group text-left">
              <p className="nf-overline">Send us</p>
              <ul className="mt-inline space-y-inline text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                <li className="flex items-start gap-inline">
                  <UiIcon name="arrow-right" size={16} className="mt-inline-tight shrink-0 text-[var(--nf-brand-primary)]" />
                  A short note on what you would improve about Vallo
                </li>
                <li className="flex items-start gap-inline">
                  <UiIcon name="arrow-right" size={16} className="mt-inline-tight shrink-0 text-[var(--nf-brand-primary)]" />
                  A CV, portfolio or links to work you are proud of
                </li>
                <li className="flex items-start gap-inline">
                  <UiIcon name="arrow-right" size={16} className="mt-inline-tight shrink-0 text-[var(--nf-brand-primary)]" />
                  The kind of role you are looking for
                </li>
              </ul>
            </div>

            <div className="mt-heading">
              <ButtonLink
                href={SUPPORT_HREF}
                variant="primary"
                size="lg"
                trailingIcon="arrow-right"
              >
                {/* Was `Email <address>` wherever a mailbox existed, which
                    sent an applicant straight out of the site. The form takes
                    the application and the mailbox is offered on it. */}
                Send your application
              </ButtonLink>
            </div>
            <p className="mt-row text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
              We reply to every serious application, usually within a week.
            </p>
          </div>
        </Reveal>

        {/* ---------------------------------------------- who we look for */}
        <Reveal as="section" className="mt-section">
          <h2 className="nf-overline text-center">People we are always curious about</h2>
          <ul className="mt-group space-y-row">
            {wanted.map((w, i) => (
              <Reveal key={w} as="li" delay={i * 60}>
                <div className="nf-panel nf-panel--card flex flex-row items-center gap-group p-card-sm">
                  <IconPlate size="md" className="shrink-0">
                    <UiIcon name="user-check" size={20} />
                  </IconPlate>
                  <span className="text-[length:var(--nf-text-row)] font-semibold leading-snug">{w}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </Reveal>

        {/* ------------------------------------------------- cross links */}
        <Reveal as="section" className="mt-section">
          <div className="nf-panel nf-panel--card block p-card text-center-lg">
            {/* NOT "BECOME AN AGENT". Most of the supply this platform wants
                is owners who are not agents and never will be, and the one door
                we offered them was marked with somebody else's job title. The
                destination is the chooser, which offers all three doors and
                puts the owner first. */}
            <p className="text-[length:var(--nf-text-row)] text-[var(--nf-content-secondary)]">
              Not looking for a job, but want to earn on Vallo?
            </p>
            <div className="mt-group flex justify-center">
              <ButtonLink href={SUPPLY_DOOR_HREF} variant="secondary">
                List your property instead
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
    </>
  );
}
