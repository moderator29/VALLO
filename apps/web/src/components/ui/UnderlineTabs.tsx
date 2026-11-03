import Link from "next/link";
import "./underline-tabs.css";

export type UnderlineTab = { key: string; label: string; href: string; count?: number | null };

/**
 * TABS AS AN UNDERLINE (founder, 1 November 2026: "this kind of tab", the
 * sports app's Home, Games, Stats, Media row). One row of words, the current
 * one bold in the primary ink with a short brand bar under it, the rest
 * muted; the row scrolls sideways on a phone and never wraps. Every tab is a
 * real address, so back, share and a reload all keep the tab.
 */
export function UnderlineTabs({
  items,
  active,
  label,
  className,
  itemTestIdPrefix,
  "data-testid": testId,
}: {
  items: readonly UnderlineTab[];
  active: string;
  /** The row's accessible name. */
  label: string;
  className?: string;
  /** Each tab's test id is this plus its key. */
  itemTestIdPrefix?: string;
  "data-testid"?: string;
}) {
  return (
    <nav aria-label={label} className={["nf-utabs", className ?? ""].filter(Boolean).join(" ")} data-testid={testId}>
      <ul className="nf-utabs__row" role="list">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="nf-utabs__tab"
              aria-current={item.key === active ? "page" : undefined}
              data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}${item.key}` : undefined}
              scroll={false}
            >
              {item.label}
              {typeof item.count === "number" ? <span className="nf-utabs__count nf-numeric">{item.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
