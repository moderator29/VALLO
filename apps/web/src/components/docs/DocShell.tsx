import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { LogoMark } from "@/design-system/brand/Logo";
import { DocSearchSheet } from "./DocSearchSheet";
import "@/app/css/docs-kit.css";

/**
 * THE DOCUMENTATION SHELL (DOCS_AND_PRESENCE_UPGRADE.md 2.1 and 4.1). Every
 * written page carries the same head: the Vallo mark, the section name (Help
 * centre, Guides, Legal, Staff manual), the search sheet on the right, and a
 * way back into the product. It works inside the app shell and as a page a
 * shared link lands on, because members share these links.
 *
 * A server component: the only client part is the search button.
 */
export type DocSectionName = "Help centre" | "Guides" | "Legal" | "Documentation" | "Staff manual";

export function DocShell({
  section,
  sectionHref,
  back,
  children,
  wide = false,
}: {
  section: DocSectionName;
  /** Where the section name leads: its own index. */
  sectionHref: string;
  /**
   * The way back into the product, labelled. Defaults to home. `false` where
   * the surrounding frame already draws Back (the public site's back bar), so
   * a page never shows two.
   */
  back?: { href: string; label: string } | false;
  children: ReactNode;
  /** A wider column for an index of cards or a manual with a rail. */
  wide?: boolean;
}) {
  const home = back === false ? null : (back ?? { href: "/", label: "Back to Vallo" });
  return (
    <div className="nf-doc-shell" data-width={wide ? "wide" : undefined}>
      <div className="nf-doc-shell__bar">
        {home ? (
          <Link href={home.href} className="nf-doc-shell__back nf-tap" aria-label={home.label}>
            <UiIcon name="arrow-left" size={20} />
          </Link>
        ) : null}
        <Link href={sectionHref} className="nf-doc-shell__section">
          <LogoMark size={26} className="nf-doc-shell__mark" />
          <span>{section}</span>
        </Link>
        <DocSearchSheet />
      </div>
      <div className="nf-doc-shell__body">{children}</div>
    </div>
  );
}

/** "Still have questions?": the panel under every index that leads to a person. */
export function DocHelpPanel({ href = "/support", label = "Contact support" }: { href?: string; label?: string }) {
  return (
    <aside className="nf-doc-help" aria-label="Still have questions?">
      <span className="nf-doc-card__icon" aria-hidden="true">
        <UiIcon name="headset" size={22} />
      </span>
      <div className="nf-doc-help__text">
        <p className="nf-doc-help__title">Still have questions?</p>
        <p className="nf-doc-help__body">A person on our team reads every message, and the assistant answers at any hour.</p>
      </div>
      <Link href={href} className="nf-doc-help__action nf-tap">
        {label}
      </Link>
    </aside>
  );
}
