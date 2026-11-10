import type { Dictionary } from "@vallo/i18n/core";
import { DocButtons } from "@/components/docs/DocButton";
import { WasThisHelpful } from "@/components/docs/WasThisHelpful";
import type { DocDestinationId } from "@/lib/docs/destinations";
import { ButtonLink } from "@/components/ui/Button";
import { IconPlate, type IconPlateTone } from "@/components/ui/IconPlate";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { DisclosureInline } from "@/components/app/DisclosureInline";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { type Guide, type GuideBlock, readingMinutes } from "@/lib/guides/articles";
import { GuideToc } from "./GuideToc";
import "./docs-type.css";

type GuideCopy = Dictionary["publicDoors"]["guides"];
type Callout = Extract<GuideBlock, { callout: string }>;

const CALLOUT: Record<Callout["tone"], { icon: UiIconName; tone: IconPlateTone }> = {
  vallo: { icon: "shield-check", tone: "brand" },
  rule: { icon: "scale", tone: "info" },
  warn: { icon: "alert-triangle", tone: "warning" },
};

/**
 * A14. ONE GUIDE, SET TO READ (the front-door re-audit, 30 September).
 *
 *   the head      the Guide label (the site's round back button above it
 *                 goes to all guides), the title, the lede, and
 *                 the meta line: "Last reviewed" on its own tinted capsule
 *                 with a tick (the date a person read it against the product
 *                 and the sources), then the reading time;
 *   contents      on a phone, one folded "On this page" card; from 64rem, a
 *                 sticky column beside the text that marks where you are;
 *   the text      a reading measure of about 68 characters, 17px on 1.75
 *                 from 40rem, section heads in the display face, brand dots
 *                 for bullets, pull-quotes (a sentence the guide already
 *                 says, set large on a brand rule) and callouts (a round
 *                 tinted plate and a short aside: what Vallo does, a
 *                 published rule, or a step not to skip);
 *   the foot      the sources, the next step on its own card, more guides.
 *
 * Server-rendered; only the wide contents column carries script.
 */
export function GuideArticle({
  guide,
  others,
  copy,
  reviewed,
  englishNote,
}: {
  guide: Guide;
  others: readonly Guide[];
  copy: GuideCopy;
  /** The review date, already formatted in the reader's language. */
  reviewed: string;
  /** Shown outside English: the guide is in English for now. */
  englishNote: boolean;
}) {
  const sections = guide.sections.map(({ id, title }) => ({ id, title }));
  return (
    <div className="nf-shell pb-section">
      <div className="nf-guide">
        <article className="nf-guide__article" lang="en" aria-labelledby="guide-title">
          <header className="nf-guide__head">
            <p className="nf-section-label nf-guide__kind">{copy.kind}</p>
            <h1 id="guide-title" className="nf-guide__title">
              {guide.title}
            </h1>
            <p className="nf-guide__lede">{guide.description}</p>
            <p className="nf-guide__meta">
              <span className="nf-guide__reviewed">
                <UiIcon name="circle-check" size={16} aria-hidden />
                <time dateTime={guide.reviewed}>{copy.reviewed.replace("{date}", reviewed)}</time>
              </span>
              <span className="nf-guide__time">
                <UiIcon name="clock" size={16} aria-hidden />
                {copy.readTime.replace("{minutes}", String(readingMinutes(guide)))}
              </span>
            </p>
            {englishNote && <p className="nf-guide__note">{copy.englishOnly}</p>}
          </header>

          {/* The phone's contents: one folded card, so the text starts in the first screen. */}
          <div className="nf-guide__toc-fold">
            <ListGroup>
              <li className="nf-list-item">
                <DisclosureInline title={copy.onThisPage} titleClassName="nf-faq-q" className="nf-faq-item">
                  <ol className="nf-guide__toc-fold-list" role="list">
                    {sections.map((section, index) => (
                      <li key={section.id}>
                        <a href={`#${section.id}`} className="nf-guide-toc__link">
                          <span className="nf-guide__toc-n nf-numeric" aria-hidden="true">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </DisclosureInline>
              </li>
            </ListGroup>
          </div>

          <div className="nf-guide__body">
            {guide.sections.map((section) => (
              <section key={section.id} id={section.id} className="nf-guide__section" aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} />
                ))}
              </section>
            ))}
          </div>

          {guide.sources.length > 0 && (
            <div className="nf-guide__sources">
              <p className="nf-section-label">{copy.sources}</p>
              <ol>
                {guide.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="nf-pd-card nf-guide__next">
            <p className="nf-section-label">{copy.nextLabel}</p>
            <ButtonLink href={guide.next.href} variant="primary" size="lg" full trailingIcon="arrow-right">
              {guide.next.label}
            </ButtonLink>
          </div>

          <DocButtons items={GUIDE_BUTTONS[guide.slug] ?? ["search-homes"]} title="Go straight to it" foot />
          <WasThisHelpful path={`/guides/${guide.slug}`} title={guide.title} />
          <nav className="nf-guide__more" aria-label={copy.more}>
            <ListGroup label={copy.more}>
              {others.map((other) => (
                <ListRow
                  key={other.slug}
                  href={`/guides/${other.slug}`}
                  leading={
                    <IconPlate size="sm" shape="round" tone="brand">
                      <UiIcon name="file-text" size={20} />
                    </IconPlate>
                  }
                  title={other.title}
                  sub={copy.readTime.replace("{minutes}", String(readingMinutes(other)))}
                  chevron
                />
              ))}
            </ListGroup>
          </nav>
        </article>

        <div className="nf-guide__aside">
          <GuideToc label={copy.onThisPage} sections={sections} />
        </div>
      </div>
    </div>
  );
}

/** Where each guide's reader most likely wants to go next. */
const GUIDE_BUTTONS: Record<string, DocDestinationId[]> = {
  "avoiding-rental-scams": ["report-safety", "search-homes", "ask-support"],
  "what-a-move-in-total-includes": ["move-in-cost", "price-check"],
  "renting-in-lagos": ["search-homes", "price-check"],
  "renting-in-abuja": ["search-homes", "price-check"],
  "how-stays-work-on-vallo": ["search-stays", "open-bookings"],
};

function Block({ block }: { block: GuideBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block) {
    return (
      <ul role="list">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if ("quote" in block) {
    return (
      <figure className="nf-guide__quote">
        <blockquote>
          <p>{block.quote}</p>
        </blockquote>
      </figure>
    );
  }
  const look = CALLOUT[block.tone];
  return (
    <div className="nf-guide__callout" data-tone={block.tone} role="note">
      <IconPlate size="sm" shape="round" tone={look.tone}>
        <UiIcon name={look.icon} size={20} />
      </IconPlate>
      <div>
        <p className="nf-guide__callout-title">{block.title}</p>
        <p className="nf-guide__callout-body">{block.callout}</p>
      </div>
    </div>
  );
}
