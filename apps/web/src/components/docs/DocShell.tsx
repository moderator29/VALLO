import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DocSearchButton } from "./DocSearchSheet";
import "./docs-kit.css";

/**
 * THE DOCUMENTATION SHELL.
 *
 * One frame for every written page: the brand glyph, the name of the section
 * the reader is in (Docs, Guides, Help, Legal, Staff manual), a search control
 * on the right, and a breadcrumb back up. It works as a page inside the app
 * and as a standalone page a shared link lands on, because it asks nothing of
 * the surrounding chrome: no session, no navigation state.
 *
 * `home` is where the glyph goes. Pass the section's own index so a reader who
 * lands from a link can see everything else in it.
 */
export type DocCrumb = { label: string; href?: string };

export function DocShell({
  section,
  home,
  crumbs,
  children,
  search = true,
}: {
  section: string;
  home: string;
  crumbs?: readonly DocCrumb[];
  children: ReactNode;
  /** The staff manual sits behind the console and keeps its own search. */
  search?: boolean;
}) {
  return (
    <div className="nf-dk-layout">
      <div>
        <div className="nf-dk-shell-bar">
          <Link href={home} className="nf-dk-shell-bar__brand" aria-label={`Vallo ${section}`}>
            <UiIcon name="house-heart" size={20} />
            <span>Vallo</span>
          </Link>
          <span className="nf-dk-shell-bar__sep" aria-hidden="true">
            /
          </span>
          <span className="nf-dk-shell-bar__section">{section}</span>
          <span className="nf-dk-shell-bar__grow" />
          {search ? <DocSearchButton /> : null}
        </div>
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="nf-dk-crumbs">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
                  {index < crumbs.length - 1 ? <span aria-hidden="true"> / </span> : null}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
      {children}
    </div>
  );
}
