import Link from "next/link";
import { PageFrame } from "@/components/app/PageFrame";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DocumentSheet } from "@/components/app/money/DocumentSheet";
import { SUPPORT_HREF, SUPPORT_LABEL } from "@/lib/support-email";
import "@/app/css/system.css";

/**
 * A legal document, read from inside the product: a designed reading
 * surface rather than a card of paragraphs.
 *
 * The same text as the marketing page and a different frame, which is the
 * whole point. Tapping Privacy in the side navigation used to hand a
 * signed-in person to `(site)/privacy`: a different shell, a different
 * header, and no way back into the product except the browser's own back
 * button. So the document comes to them. `PageFrame` (over `PageHeader`) carries the platform
 * back flow already, so a person reading the refund rules from a checkout
 * screen lands back on that checkout screen.
 *
 * THE ANATOMY. The header with its back control stays the product's own,
 * on the member's theme. Everything that is the document is on PAPER, the
 * shared `DocumentSheet` the public `/terms`, `/privacy` and `/disclaimer`
 * already use (R3-03): one release, one material for one legal text, and the
 * sheet prints on its own. On the paper: the last-updated line, the contents
 * as a numbered index (every section a 44px row, anchored to the section),
 * then the sections as measured prose with hairlines between them and a
 * quiet way back to the contents under each. The way out (the sibling
 * document and support) is product chrome again, under the sheet.
 *
 * The content itself lives in `lib/legal/`, imported by both routes, because
 * a legal text that says two different things in two places is not a legal
 * text. The registered name of the operator appears only inside that text,
 * where the document is legal text (rule 14); everything this frame draws
 * says Vallo.
 */
export function LegalDocument({
  title,
  intro,
  updated,
  sections,
  otherHref,
  otherLabel,
  also,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: { title: string; body: React.ReactNode }[];
  /** The sibling document, linked to its IN-PRODUCT route, never the site one. */
  otherHref: string;
  otherLabel: string;
  /**
   * A third document in the set. The in-app disclaimer had no way in at all
   * (ROUTE-AUDIT.md, 7 October 2026): Terms and Privacy pointed at each other
   * and nothing pointed at it, so Terms names it here.
   */
  also?: { href: string; label: string };
}) {
  return (
    <PageFrame title={title} subtitle={intro} fallback="/settings">
      <div className="pb-3xl">
      <DocumentSheet kind="document" printable aria-label={title} className="nf-legal">
        <p className="nf-legal__meta">
          <span>Last updated</span>
          <time>{updated}</time>
        </p>

        <nav id="legal-contents" aria-labelledby="legal-contents-title" className="nf-legal__toc">
          <p id="legal-contents-title" className="nf-overline nf-legal__toc-title">
            Contents
          </p>
          <ol>
            {sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#${anchor(section.title)}`}>
                  <NumberedTitle title={section.title} index={index} />
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="nf-legal__body">
          {sections.map((section, index) => (
            <section
              key={section.title}
              id={anchor(section.title)}
              aria-labelledby={`${anchor(section.title)}-title`}
              className="nf-legal__section"
            >
              <h2 id={`${anchor(section.title)}-title`} className="nf-h3 nf-legal__heading">
                <NumberedTitle title={section.title} index={index} />
              </h2>
              <div className="nf-legal__prose">{section.body}</div>
              <a href="#legal-contents" className="nf-legal__top nf-tap">
                <UiIcon name="arrow-up" size={16} />
                Contents
              </a>
            </section>
          ))}
        </div>
      </DocumentSheet>

      {/* Both links stay inside the product. Sending somebody to /terms from
          here would undo the entire reason this page exists. */}
      <p className="nf-legal__foot">
        See also our <Link href={otherHref}>{otherLabel}</Link>
        {also ? (
          <>
            , our <Link href={also.href}>{also.label}</Link>
          </>
        ) : null}
        , or{" "}
        <Link href={SUPPORT_HREF}>{SUPPORT_LABEL}</Link>{" "}
        with any question.
      </p>
      </div>
    </PageFrame>
  );
}

/**
 * A section's number and title, the number printed ONCE (C6, the route
 * sweep). The legal texts number their own titles ("1. About these terms"),
 * and this frame printed its index number beside them, so every row and
 * heading read "1  1. About these terms". The title's own number is now the
 * one set in the brand ink, and the words follow; a title with no number of
 * its own takes its place in the list. The legal text is untouched: a screen
 * reader still hears "1. About these terms" whole (the visible number is
 * hidden from it, the text's own "1. " is visually hidden), and the anchors
 * are still built from the full title, so no link to a section breaks.
 */
function NumberedTitle({ title, index }: { title: string; index: number }) {
  const own = /^(\d+)\.\s+(.*)$/s.exec(title);
  return (
    <>
      <span className="nf-legal__num" aria-hidden="true">
        {own ? own[1] : index + 1}
      </span>
      <span>
        {own ? <span className="sr-only">{`${own[1]}. `}</span> : null}
        {own ? own[2] : title}
      </span>
    </>
  );
}

/** A stable fragment id from a section title: lowercase, hyphenated, ASCII. */
function anchor(title: string): string {
  return (
    "s-" +
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
