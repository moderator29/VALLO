"use client";

import { isIdentifier } from "@/lib/admin/lookup-classify";
import { PersonTier } from "./PersonTier";
import type { PersonTier as PersonTierValue } from "@/lib/admin/reads/shapes";
import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useOverlay } from "@/lib/ui/use-overlay";
import { NavIcon } from "./AdminGlyph";
import { searchBase } from "./palette";
import "./admin-material.css";
import {
  ADMIN_GROUPS,
  ADMIN_NAV,
  ADMIN_SETTINGS,
  activeGroupKey,
  activeItemKey,
  countFor,
  currentDestination,
  groupItems,
  isSectionActive,
  countLabelFor,
  labelFor,
  type ShellCopy,
  type AdminDestination,
} from "./nav";

type NavCopy = Dictionary["admin"]["nav"];

/**
 * The console rail, drawn the way the four admin renders draw it: twelve line
 * glyph rows, the open one a lit blue rounded rectangle, Settings on its own
 * above the operator at the foot. One definition (`nav.ts`) serves the
 * desktop rail and the phone drawer, so the two cannot come to disagree.
 */
function Row({
  item,
  counts,
  shell,
  active,
  child = false,
  lede,
}: {
  item: AdminDestination;
  counts: Record<string, number>;
  shell?: ShellCopy;
  active: boolean;
  child?: boolean;
  /** The desk's one line, drawn under its name in the phone menu (reference 7086). */
  lede?: string;
}) {
  const count = countFor(item, counts);
  const label = labelFor(item, shell);
  const counted = countLabelFor(item, shell);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`nf-admin-nav__row${child ? " nf-admin-nav__row--child" : ""}${active ? " nf-admin-nav__row--on" : ""}`}
    >
      <NavIcon icon={item.icon} size={child ? 16 : 20} />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {label}
        {lede ? <span className="nf-admin-drawer__lede">{lede}</span> : null}
      </span>
      {count > 0 && (
        <span
          className="nf-admin-nav__count"
          title={`${count} ${counted}`}
          aria-label={`${count} ${counted}`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

/**
 * The rail, grouped the way the founder's brief draws it (Overview, My Desk,
 * Staff and Access, Operations, Departments, Intelligence, Knowledge Centre,
 * Settings). Each group is an expandable category: it opens by itself while
 * one of its desks is the open page, and a badge on the closed group sums
 * the queues its desks carry so waiting work is seen with the group shut.
 * Every destination in `nav.ts` is in exactly one group, so no desk is an
 * orphan and the old "All desks" list is no longer needed.
 */
export function AdminRail({
  counts,
  navLabel,
  shell,
  ledes,
}: {
  counts: Record<string, number>;
  labels?: NavCopy;
  navLabel: string;
  shell?: ShellCopy;
  /** Desk key to its one line. Passed by the phone drawer only. */
  ledes?: Readonly<Record<string, string | undefined>>;
}) {
  const pathname = usePathname() ?? "/admin";
  const openGroup = activeGroupKey(pathname);
  const litKey = activeItemKey(pathname);
  return (
    <nav aria-label={navLabel} className="nf-admin-nav">
      <ul className="nf-admin-nav__list">
        {ADMIN_GROUPS.map((group) => {
          const items = groupItems(group);
          const waiting = [...new Set(items.flatMap((item) => item.countKeys ?? []))].reduce(
            (total, key) => total + (counts[key] ?? 0),
            0,
          );
          const open = group.key === openGroup || group.key === "g-overview" || group.key === "g-my-desk";
          return (
            <li key={group.key}>
              <details className="nf-admin-nav__group" open={open || undefined} data-group={group.key}>
                <summary className="nf-admin-nav__row">
                  <NavIcon icon={group.icon} size={20} />
                  <span className="min-w-0 flex-1">{group.label}</span>
                  {waiting > 0 && (
                    <span className="nf-admin-nav__count" title={`${waiting} waiting`} aria-label={`${waiting} waiting`}>
                      {waiting}
                    </span>
                  )}
                  <UiIcon name="chevron-down" size={16} className="nf-admin-nav__more-chev shrink-0" />
                </summary>
                <div className="nf-admin-nav__children">
                  {group.sections.map((section) => (
                    <div key={section.key}>
                      {section.label ? <p className="nf-admin-nav__section">{section.label}</p> : null}
                      <ul className="grid gap-[2px]">
                        {section.items.map((item) => (
                          <li key={item.key}>
                            <Row
                              item={item}
                              counts={counts}
                              shell={shell}
                              active={item.key === litKey}
                              child
                              lede={ledes?.[item.key]}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type AdminIdentity = {
  name: string;
  role: string;
  initial: string;
  avatarUrl: string | null;
  /** The operator's published badge tier (`public.person_badge`), for the shared slot. */
  tier?: PersonTierValue | null;
};

export function IdentityBlock({ identity, compact = false }: { identity: AdminIdentity; compact?: boolean }) {
  return (
    <span className={`nf-admin-id${compact ? " nf-admin-id--compact" : ""}`}>
      <span className="nf-admin-id__avatar" aria-hidden="true">
        {identity.avatarUrl ? (
          // A person's own uploaded picture, sized by CSS; next/image would need
          // every storage host allow-listed for a 36px circle.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.avatarUrl} alt="" />
        ) : (
          <UiIcon name="user" size={20} />
        )}
      </span>
      <span className="nf-admin-id__text">
        <span className="nf-admin-id__name">
          {identity.name}
          <PersonTier tier={identity.tier} size="sm" />
        </span>
        <span className="nf-admin-id__role">{identity.role}</span>
      </span>
    </span>
  );
}

/** Settings and the operator, which the renders pin to the rail's foot. */
export function AdminRailFoot({
  identity,
  counts = {},
  shell,
}: {
  identity: AdminIdentity;
  counts?: Record<string, number>;
  shell?: ShellCopy;
}) {
  const pathname = usePathname() ?? "/admin";
  return (
    <div className="nf-admin-rail__foot">
      <Row item={ADMIN_SETTINGS} counts={counts} shell={shell} active={isSectionActive(pathname, ADMIN_SETTINGS)} />
      <Link href="/profile" className="nf-admin-rail__me">
        <IdentityBlock identity={identity} />
        <UiIcon name="chevron-right" size={16} className="shrink-0 text-[var(--nf-content-muted)]" />
      </Link>
    </div>
  );
}

/**
 * The console search field. Enter searches the desk under the cursor through
 * that desk's own `?q=`; on a page with no desk of its own (the overview, the
 * charts) it searches the unified queue. Control K or Command K no longer
 * focuses this field: it opens the command palette (`ConsolePalette`), which
 * does everything this does and finds desks too. The hint says so. With
 * scripts off this stays an ordinary search form.
 */
export function ConsoleSearch({
  label,
  placeholder,
  hint,
}: {
  label: string;
  placeholder: string;
  /** The key hint at the field's end ("Ctrl K"), a keyboard device only. */
  hint?: string;
}) {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const base = searchBase(pathname);

  return (
    <form
      role="search"
      className="nf-admin-bar__search"
      onSubmit={(event) => {
        event.preventDefault();
        const q = input.current?.value.trim() ?? "";
        /* C6: a reference goes to the console-wide lookup; a word searches this desk. */
        if (q && isIdentifier(q)) {
          router.push(`/admin/lookup?q=${encodeURIComponent(q)}`);
          return;
        }
        router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
      }}
    >
      <UiIcon name="search" size={16} className="nf-admin-bar__search-glyph" />
      <label className="sr-only" htmlFor="admin-console-search">
        {label}
      </label>
      <input id="admin-console-search" ref={input} type="search" placeholder={placeholder} />
      {hint ? (
        <span className="nf-admin-bar__hint" aria-hidden="true">
          {hint}
        </span>
      ) : null}
    </form>
  );
}

/**
 * The phone's way into the same map: a menu button in the console bar that
 * opens the rail as a drawer. The drawer closes on the way through a link, on
 * Escape and on the scrim, and it hands focus back to the button.
 */
export function AdminTabs({
  counts,
  navLabel,
  identity,
  brand,
  shell,
  ledes,
  waitingText,
}: {
  counts: Record<string, number>;
  labels?: NavCopy;
  navLabel: string;
  identity?: AdminIdentity;
  brand?: ReactNode;
  shell?: ShellCopy;
  /** Desk key to its one line, drawn under each desk in the menu. */
  ledes?: Readonly<Record<string, string | undefined>>;
  /** "{count} waiting", for the line above the desks. */
  waitingText?: string;
}) {
  const closeLabel = shell?.nav.closeMenu ?? "Close the console menu";
  const pathname = usePathname() ?? "/admin";
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const current = currentDestination(pathname);
  /* Every queue once, however many rows carry it. */
  const waiting = [...new Set(ADMIN_NAV.flatMap((item) => item.countKeys ?? []))].reduce(
    (total, key) => total + (counts[key] ?? 0),
    0,
  );

  /* The shared overlay contract (lib/ui/use-overlay.ts): Escape closes, the
     page does not scroll behind, Tab stays inside, and focus goes back to
     the menu button. It used to hand-roll the first two and skip the trap. */
  const close = useCallback(() => setOpen(false), []);
  useOverlay({ open, onClose: close, panelRef: panel });

  return (
    <>
      <button
        ref={button}
        type="button"
        className="nf-admin-menu"
        aria-expanded={open}
        aria-controls="admin-drawer"
        aria-label={`${navLabel}${current ? `, ${labelFor(current, shell)}` : ""}${waiting > 0 ? `, ${waiting} waiting` : ""}`}
        onClick={() => setOpen(true)}
      >
        <UiIcon name="menu" size={20} />
        {waiting > 0 && <span className="nf-admin-menu__dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="nf-admin-drawer" id="admin-drawer">
          <button
            type="button"
            className="nf-admin-drawer__scrim"
            aria-label={closeLabel}
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          />
          <div
            ref={panel}
            className="nf-admin-drawer__panel"
            role="dialog"
            aria-modal="true"
            aria-label={navLabel}
          >
            <div className="nf-admin-drawer__head">
              {brand}
              <button
                type="button"
                className="nf-admin-icon-btn"
                aria-label={closeLabel}
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                }}
              >
                <UiIcon name="close" size={20} />
              </button>
            </div>
            <div
              className="nf-admin-drawer__scroll"
              onClick={(event) => {
                /* A chosen destination closes the drawer on its way through. */
                if ((event.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              {waiting > 0 && waitingText ? (
                <p className="nf-admin-drawer__total nf-numeric">{waitingText.replace("{count}", String(waiting))}</p>
              ) : null}
              <AdminRail counts={counts} shell={shell} navLabel={navLabel} ledes={ledes} />
            </div>
            {identity && (
              <div
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("a")) setOpen(false);
                }}
              >
                <AdminRailFoot identity={identity} counts={counts} shell={shell} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
