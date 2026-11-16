"use client";

import { useCallback, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import Link from "next/link";
import { Logo } from "@/design-system/brand/Logo";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { SUPPORT_HREF } from "@/lib/support-email";
import "@/app/css/site.css";

/**
 * Marketing side navigation, for phones.
 *
 * SHORT. One grouped surface of rows and one button.
 *
 * What it was: a bare list where every row carried its own bottom border
 * INCLUDING the last one, so the stack ended on a hairline hanging under
 * nothing; an "Display" overline over two loose controls; a "Contact support"
 * line set as a third kind of thing again, at a third size; and the sign-up
 * button wearing `nf-breathe`, a permanent looping pulse on the one control in
 * the panel that did not need help being noticed. Four different row treatments
 * for what is, at most, six destinations.
 *
 * Now: the destinations live in a single glass surface with inset hairlines
 * between them and none at either end, which is the platform's grouped list and
 * the pattern the reference set uses for every panel it has. Support is a row
 * in that group rather than a separate species. The label sits OUTSIDE the
 * surface. The only filled thing in the panel is the one action it is asking
 * for. The display group that held the language control is gone: language
 * lives only in Settings.
 *
 * The opener is the product's panel glyph rather than the three-line
 * hamburger it used to be. Two menus on one platform drawn differently is two
 * platforms as far as a thumb is concerned, and the product settled on this
 * mark; the marketing site had simply never been brought across.
 */
export function MobileMenu({
  links,
  signIn,
  signUp,
  openLabel,
  closeLabel,
  menuLabel,
  opener = "square",
}: {
  links: { href: string; label: string }[];
  signIn: string;
  signUp: string;
  openLabel: string;
  closeLabel: string;
  /** The dialog's accessible name, in the reader's language. */
  menuLabel: string;
  /** "capsule": the landing capsule's round brand button with the menu
      glyph (site.css, "THE LANDING CAPSULE"). */
  opener?: "square" | "capsule";
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  /* The platform's `Sheet` in its page shape: Escape, Back, the focus trap
     and return, the scroll lock and drag or flick down to close. The sheet
     portals itself to <body>, which matters here: the sticky header's
     backdrop-filter makes it the containing block for fixed descendants, and
     a panel rendered inside it was clipped to the 64px header bar. */

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-label={openLabel}
        onClick={() => setOpen(true)}
        className={opener === "capsule" ? "nf-cap__menu" : "nf-icon-btn h-11 w-11"}
      >
        <UiIcon name={opener === "capsule" ? "menu" : "panel-left"} size={20} />
      </button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        title={menuLabel}
        hideTitle
        fullPage
      >
          <div className="flex min-h-full flex-col">
            <div className="mb-block flex items-center justify-between">
              <Logo size={50} wordSize={21} />
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => setOpen(false)}
                className="nf-icon-btn nf-press"
              >
                <UiIcon name="close" size={20} />
              </button>
            </div>

            <nav className="flex-1">
              <span className="nf-group-label">Go to</span>
              {/*
                ONE SURFACE. The rows used to each carry their own bottom
                border, last one included, so the list ended on a rule hanging
                under nothing and read as five separate strips. Inset dividers,
                none at the ends, and the whole thing inside a single card: one
                object with parts.

                No `--inset` modifier: an inset divider exists to clear a
                leading glyph column, and these rows have no leading glyph. The
                card's own inline padding is what holds the rules off the
                corners here, which is the same job done by the surface instead
                of by the row.
              */}
              <ul className="nf-panel nf-panel--card nf-group nf-rows">
                {[
                  ...links,
                  { href: "/sign-in", label: signIn },
                  { href: SUPPORT_HREF, label: "Contact support" },
                ].map((l) => (
                  /* Every row here is a route on our own origin, including
                     Contact support: it used to render as a bare anchor when
                     a mailbox was configured, because `SUPPORT_HREF` was a
                     mailto then. It is `/contact` in both worlds now. */
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      prefetch
                      onClick={() => setOpen(false)}
                      className="nf-row nf-row--tap justify-between"
                    >
                      <span className="nf-body font-semibold text-[var(--nf-content-primary)]">
                        {l.label}
                      </span>
                      <UiIcon
                        name="chevron-right"
                        size={16}
                        className="shrink-0 text-[var(--nf-content-muted)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-block">
              {/* No language control here (founder, 29 September 2026): the
                  language is changed in Settings and nowhere else. */}
              {/* The one filled control in the panel, and the reason the panel
                  exists. It used to wear `nf-breathe`, a permanent pulse loop:
                  the single most prominent thing on the surface, animated
                  forever to draw attention to itself. */}
              <ButtonLink
                href="/start"
                onClick={() => setOpen(false)}
                variant="primary"
                size="lg"
                full
                className="mt-block"
              >
                {signUp}
              </ButtonLink>
            </div>
          </div>
      </Sheet>
    </div>
  );
}
