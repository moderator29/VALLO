"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { isCurrent, type NavSection } from "@/components/app/nav-model";

/**
 * THE WORKSPACE SIDEBAR (plan item 20, spec 8.3, reference 38).
 *
 * One sidebar for the three desks: the host, the agent and, in its own
 * frame, the console. Each desk hands over its own navigation as data (the
 * same `NavSection[]` its phone drawer draws, so the two cannot drift) and
 * this draws it the clean way:
 *
 *   - the desk switcher at the top: a plate, the desk's name, the business
 *     or firm under it;
 *   - groups under a section label (MAIN, OPERATIONS, ACCOUNT, or whatever
 *     the desk's own sections are called), the first one named "Main" when
 *     the model leaves it unheaded;
 *   - a row is the bold 20px nav glyph, a 14/500 label and a count badge only
 *     when the count is real and above zero (the model already drops a zero);
 *   - the current row is the filled glyph, the brand label at 600 and a 4px
 *     dot, with NO container behind it: the dock's law, not reference 38's
 *     grey tint;
 *   - the person block sits at the foot (`foot`).
 *
 * Shown from 1024px (`lg`); below that each desk keeps the phone navigation it
 * already has (lane C owns that breakpoint).
 */
export type DeskSwitcher = {
  /** The desk: "Host workspace", "Agent workspace". */
  name: string;
  /** The business or firm this desk is for, when there is one. */
  org?: string | null;
  icon: UiIconName;
  href?: string;
};

export function DeskSidebar({
  label,
  switcher,
  sections,
  active,
  mainLabel,
  foot,
  className = "",
}: {
  /** The navigation's accessible name. */
  label: string;
  switcher: DeskSwitcher;
  sections: NavSection[];
  /** The current path. Read from the router when a desk does not pass it. */
  active?: string;
  /** The heading for an unheaded first section. */
  mainLabel: string;
  foot?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const here = active ?? pathname;

  const head = (
    <>
      <span className="nf-desk-side__plate" aria-hidden="true">
        <UiIcon name={switcher.icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="nf-desk-side__desk">{switcher.name}</span>
        {switcher.org ? <span className="nf-desk-side__org">{switcher.org}</span> : null}
      </span>
    </>
  );

  return (
    <aside className={`nf-desk-side ${className}`} aria-label={label}>
      {switcher.href ? (
        <Link href={switcher.href} className="nf-desk-side__switch">
          {head}
        </Link>
      ) : (
        <div className="nf-desk-side__switch">{head}</div>
      )}

      <nav className="nf-desk-side__scroll" aria-label={label}>
        {sections.map((section, index) => (
          <div key={section.heading ?? `main-${index}`} className="nf-desk-side__group">
            <h2 className="nf-desk-side__heading">{section.heading ?? mainLabel}</h2>
            <ul>
              {section.items.map((item) => {
                const current = isCurrent(item.href, here, null);
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className="nf-desk-side__row"
                    >
                      <UiIcon name={item.icon} size={20} filled={current} className="nf-desk-side__glyph" />
                      <span className="nf-desk-side__label">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="nf-desk-side__count nf-numeric">{item.badge}</span>
                      ) : null}
                      {current ? <span className="nf-desk-side__dot" aria-hidden="true" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {foot ? <div className="nf-desk-side__foot">{foot}</div> : null}
    </aside>
  );
}

/** The person at the sidebar's foot: a round avatar, the name and a line. */
export function DeskPerson({
  name,
  line,
  avatarUrl,
  href,
}: {
  name: string;
  line?: string | null;
  avatarUrl?: string | null;
  href?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "V";
  const body = (
    <>
      <span className="nf-desk-person__avatar" aria-hidden="true">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a 32px avatar from the account's own storage.
          <img src={avatarUrl} alt="" width={32} height={32} loading="lazy" decoding="async" />
        ) : (
          initial
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="nf-desk-person__name">{name}</span>
        {line ? <span className="nf-desk-person__line">{line}</span> : null}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="nf-desk-person">
      {body}
    </Link>
  ) : (
    <div className="nf-desk-person">{body}</div>
  );
}
