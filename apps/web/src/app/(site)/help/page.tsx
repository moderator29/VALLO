import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { SiteHead } from "@/components/site/SiteHead";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { IndexRows } from "@/components/site/guides/IndexRows";
import { SupportChat } from "@/components/app/account/SupportChat";
import { HelpSearch } from "./HelpSearch";
import { topicGlyph, topicId } from "./topics";
import { ButtonLink } from "@/components/ui/Button";
import { aiConsentForViewer } from "@/lib/ai/consent-server";
import { FAQS, TRUST_LINKS } from "@/lib/support/help-articles";
import { JsonLd } from "@/components/site/JsonLd";
import { faqLd } from "@/lib/site/structured-data";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { IconPlate } from "@/components/ui/IconPlate";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("help");
}

/**
 * Help centre.
 *
 * A searchable FAQ, grouped by topic. The answers are the real rules of the
 * platform written in plain language, not marketing copy, and anything the
 * page cannot answer routes to the contact page. The articles and the trust
 * links live in `lib/support/help-articles.ts`, which the in-app support home
 * reads as well.
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
  return (
    <>
      {/* A13: the page is questions and answers, so it says so to a crawler. */}
      <JsonLd data={faqLd(FAQS.map((faq) => ({ q: faq.q, a: faq.a })))} />
      <SiteHead
        plate="living-room-dusk"
        icon="support-chat"
        chip="Help centre"
        title="How can we help?"
        lede="Straight answers about both sides of Vallo: what the platform is for, the switch, booking a stay, holding a table, payments, refunds, listing, verification, Around, and your account and data. Search below, or browse by topic."
      />
    <div className="nf-shell pb-section">
      <div className="mx-auto max-w-3xl">

        {/* ------------------------------------------------------ topics */}
        {/* THE INDEX (reference 7086): a Plate row per topic, its glyph, its
            name, the first question it answers and how many it holds. Each
            jumps to its section in the list below. */}
        <section className="mt-block" aria-labelledby="help-topics">
          <h2 id="help-topics" className="nf-section-label">
            {x.help.topics}
          </h2>
          <IndexRows
            label={x.help.topics}
            className="mt-xs"
            items={topics.map((topic) => ({
              href: `#${topicId(topic.category)}`,
              icon: topicGlyph(topic.category),
              title: topic.category,
              line: topic.first,
              meta: topic.count === 1 ? x.help.answerOne : x.help.answers.replace("{count}", String(topic.count)),
            }))}
          />
        </section>

        {/* ------------------------------------------------ trust surfaces */}
        <section className="mt-block" aria-labelledby="help-policies">
          <h2 id="help-policies" className="nf-section-label">
            {x.help.policies}
          </h2>
          <IndexRows
            label={x.help.policies}
            className="mt-xs"
            items={TRUST_LINKS.map((link) => ({
              href: link.href,
              icon: lineGlyphFor(link.icon),
              title: link.title,
              line: link.body,
            }))}
          />
        </section>

        {/* --------------------------------------------- searchable list */}
        <div className="nf-rise mt-block" style={{ animationDelay: "100ms" }}>
          <HelpSearch faqs={FAQS} />
        </div>

        {/* ------------------------------------------- ask the agent */}
        {/* 100ms, with the list above it: at 160ms its 520ms rise ended at
            680ms, past the 620ms entrance budget (C6, the route sweep). */}
        <div className="nf-rise mt-block" style={{ animationDelay: "100ms" }}>
          <SupportChat aiConsented={await aiConsentForViewer()} assistantCopy={dictionary.experienceInbox.assistant} />
        </div>

        {/* ------------------------------------------------ still stuck */}
        <div className="nf-panel nf-panel--card mt-section-tight flex flex-col items-start gap-group p-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-group">
            <IconPlate size="md" className="shrink-0">
              <UiIcon name="chat-bubble" size={20} />
            </IconPlate>
            <p className="text-[length:var(--nf-text-row)] leading-snug text-[var(--nf-content-secondary)]">
              Still stuck? A person replies within one business day.
            </p>
          </div>
          <ButtonLink href="/contact" variant="primary" className="shrink-0">
            Contact support
          </ButtonLink>
        </div>
      </div>
    </div>
    </>
  );
}
