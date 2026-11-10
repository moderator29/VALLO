import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { SupportChat } from "@/components/app/account/SupportChat";
import { HelpSearch } from "./HelpSearch";
import { topicGlyph, topicId } from "./topics";
import { aiConsentForViewer } from "@/lib/ai/consent-server";
import { FAQS, TRUST_LINKS } from "@/lib/support/help-articles";
import { JsonLd } from "@/components/site/JsonLd";
import { faqLd } from "@/lib/site/structured-data";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
import { DocHelpPanel, DocShell } from "@/components/docs/DocShell";
import { PopularTopics } from "./PopularTopics";
import { CopyButton } from "@/components/docs/CopyButton";
import { DocHelpfulSlot } from "@/components/docs/DocHelpfulSlot";
import { FeeCalculatorSection } from "../docs/fee-calculator/FeeCalculatorSection";
import { SUPPORT_EMAIL } from "@/lib/support-email";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("help");
}

/**
 * THE HELP CENTRE, on the documentation kit (DOCS_AND_PRESENCE_UPGRADE.md
 * 2.1, 2.2 and 2.6; R95, R100).
 *
 * In the order a worried reader needs it: the shell (the Vallo mark, "Help
 * centre", the search sheet), one short paragraph of what is here, the
 * search field that answers on the device, the popular topics as chips for
 * somebody who cannot name their problem, the topics as cards, the other
 * written surfaces as cards, every answer grouped by topic, the assistant,
 * and a person.
 *
 * Every answer and every anchor the page had is still here: the topic
 * anchors (`#help-<topic>`) and the short ones the search sheet's chips use
 * (`#bookings`, `#verification`, `#refunds`, `#payouts`, `#inspections`,
 * `#account`, see `HELP_ANCHORS`). The answers live in
 * `lib/support/help-articles.ts`, which the in-app support home reads too.
 */
export default async function HelpPage() {
  const dictionary = getDictionary(await getLocale());
  const x = dictionary.experienceLanding.docs;
  /* The topics in the order the articles first mention them. */
  const topics = FAQS.reduce<{ category: string; first: string; count: number }[]>((acc, faq) => {
    const seen = acc.find((topic) => topic.category === faq.category);
    if (seen) seen.count += 1;
    else acc.push({ category: faq.category, first: faq.q, count: 1 });
    return acc;
  }, []);

  const browse = (
    <div className="mt-block grid gap-block">
      <PopularTopics id="help-popular" />

      <section aria-labelledby="help-topics" className="grid gap-sm">
        <h2 id="help-topics" className="nf-h3">
          {x.help.topics}
        </h2>
        <DocCardGrid label={x.help.topics}>
          {topics.map((topic) => (
            <DocCard
              key={topic.category}
              href={`#${topicId(topic.category)}`}
              icon={topicGlyph(topic.category)}
              title={topic.category}
              description={topic.first}
              meta={topic.count === 1 ? x.help.answerOne : x.help.answers.replace("{count}", String(topic.count))}
            />
          ))}
        </DocCardGrid>
      </section>

      <section aria-labelledby="help-policies" className="grid gap-sm">
        <h2 id="help-policies" className="nf-h3">
          {x.help.policies}
        </h2>
        <DocCardGrid label={x.help.policies}>
          {[
            ...TRUST_LINKS.map((link) => (
              <DocCard key={link.href} href={link.href} icon={lineGlyphFor(link.icon)} title={link.title} description={link.body} />
            )),
            <DocCard
              key="/legal"
              href="/legal"
              icon="scale"
              title="Legal and policies"
              description="The terms, the privacy policy and every other policy, each one dated."
            />,
            <DocCard
              key="/guides"
              href="/guides"
              icon="file-text"
              title="Guides"
              description="Longer reads: listing a property, avoiding scams, move-in costs and how stays work."
            />,
            <DocCard
              key="/docs"
              href="/docs"
              icon="document"
              title="Documentation"
              description="How every part of Vallo works, chapter by chapter."
            />,
          ]}
        </DocCardGrid>
      </section>
    </div>
  );

  return (
    <>
      {/* A13: the page is questions and answers, so it says so to a crawler. */}
      <JsonLd data={faqLd(FAQS.map((faq) => ({ q: faq.q, a: faq.a })))} />
      <DocShell section="Help centre" sectionHref="/help" back={false} wide>
        <header className="grid gap-sm">
          <h1 className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-title-lg)] font-bold leading-tight">
            How can we help?
          </h1>
          <p className="max-w-measure-body text-[length:var(--nf-text-body)] leading-relaxed text-[var(--nf-content-secondary)]">
            Straight answers about both sides of Vallo: booking a stay, holding a table, renting and buying, payments
            and refunds, listing, verification, and your account and data. Search, pick a popular topic, or browse
            by topic below.
          </p>
        </header>

        {/* The on-device search: Help, Docs, Guides and the legal pages,
            answered with no round trip. While somebody types, results
            replace everything under the field. */}
        <HelpSearch
          faqs={FAQS}
          browse={browse}
          answersLabel="Every answer, by topic"
          extras={{ "Payments and refunds": <FeeCalculatorSection /> }}
          feet={Object.fromEntries(
            topics.map((topic) => [
              topic.category,
              <div key={topic.category} className="mt-row grid gap-2xs">
                <div className="flex items-center gap-2xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                  <CopyButton text={`/help#${topicId(topic.category)}`} label="Link" icon="link" />
                  <span>Copy a link to {topic.category}</span>
                </div>
                <DocHelpfulSlot page={`/help#${topicId(topic.category)}`} />
              </div>,
            ]),
          )}
        />

        {/* The assistant, with the button through to a person. */}
        <SupportChat aiConsented={await aiConsentForViewer()} assistantCopy={dictionary.experienceInbox.assistant} />

        {/* The one address, with a copy control, for somebody writing from
            their own mail (DOCS_AND_PRESENCE_UPGRADE.md section 9). */}
        <p className="flex flex-wrap items-center gap-2xs text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
          <span>Or email us at</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="nf-doc-xlink">
            {SUPPORT_EMAIL}
          </a>
          <CopyButton text={SUPPORT_EMAIL} label="Email address" />
        </p>
        <DocHelpPanel href="/contact" />
      </DocShell>
    </>
  );
}
