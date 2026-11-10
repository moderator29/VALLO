import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { formatDate } from "@vallo/i18n/core";
import "./docs-kit.css";

/**
 * AN ARTICLE OPENS BY TELLING YOU WHAT IT WILL SAY: a category pill (glyph and
 * label), the title, the date it was last updated, and one intro paragraph that
 * states the scope in plain words. A visible recent date reads as maintained;
 * a page with none reads as abandoned. It is optional only so a page nobody
 * has re-read against the code does not claim a date it has not earned;
 * `DOCS_COVERAGE.md` lists every page that still has none.
 *
 * `updated` is an ISO date (YYYY-MM-DD) written by whoever last checked the
 * page against the code. It is not the build date.
 */
export function DocHeader({
  category,
  categoryIcon = "file-text",
  title,
  updated,
  children,
}: {
  category: string;
  categoryIcon?: UiIconName;
  title: string;
  updated?: string | undefined;
  /** The intro paragraph, and the inline links to sibling documents. */
  children?: ReactNode;
}) {
  const date = updated ? new Date(`${updated}T12:00:00+01:00`) : null;
  return (
    <header className="nf-dk-header">
      <span className="nf-dk-pill">
        <UiIcon name={categoryIcon} size={16} />
        {category}
      </span>
      <h1 className="nf-h1 nf-dk-header__title">{title}</h1>
      {updated && date ? (
        <p className="nf-dk-header__meta">
          Last updated{" "}
          <time dateTime={updated}>{formatDate(date, "en", { day: "numeric", month: "long", year: "numeric" })}</time>
        </p>
      ) : null}
      {children ? <div className="nf-dk-header__intro">{children}</div> : null}
    </header>
  );
}
