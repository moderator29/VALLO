"use client";

import type { ShellDictionary } from "@/lib/i18n/shell-dictionary";
import type { Side } from "@/lib/side.constants";
import { useState } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { Row, RowList } from "@/components/app/Screen";
import { withNext } from "@/lib/auth/next-link";
import { useRootFlag } from "@/lib/ui/root-flag";

/**
 * THE DOCK'S "+" AT THE RIGHT END, AND THE SHEET IT OPENS.
 *
 * It stood in the capsule's centre slot until the founder's swap of 13 October
 * 2026 put the grid menu there and moved the "+" out to the round button at the
 * right end, brand blue with its glow. The sheet does not move: it is a bottom
 * sheet (`Sheet`, a portal on the body that joins the overlay registry, so the
 * Android back button closes it) and opens the same from either place. Focus
 * returns to this button when it closes.
 *
 * THE SHEET, SINCE 13 OCTOBER 2026 (the founder, replacing the plain titles of
 * 7 October, handoff A.6): three clear options at the top, in this order, each
 * with a clean monochrome icon, one line and a short line under it.
 *
 *   Post to story    the existing story composer (`/stories/new`)
 *   Post to feed     the existing post composer for Around (`/around?compose=1`)
 *   List a property  the existing listing route for the person's side (the
 *                    agent wizard for an agent, the side's chooser otherwise);
 *                    on the Stays side "Create a stay listing"
 *
 * Nothing the sheet offered is removed: "Book a viewing" (Property) and "Book a
 * stay" (Stays) stay, below the three, as a quieter row. With the `social`
 * switch off there is no feed and no story to post to, so those two are not
 * offered rather than leading to a paused screen, and "List" stays. A GUEST
 * cannot post or list, so each option goes through the existing sign-up door
 * and returns to the destination afterwards (`withNext`); booking is public
 * and goes straight there.
 *
 * Switch workspace LEFT this sheet. It is about accounts, not about making
 * something, and it lives where accounts live: the Switch role row on
 * `/profile` (`SwitchRoleRow`), which fires the same named event
 * (`profile-switcher-event.ts`) that the workspace sheet in `AppShell`
 * listens for. Nothing it did is lost; it is one place, not two.
 *
 * The disc turns a quarter into its own close as the sheet opens (north star
 * 6.1, nav-island.css). That stays.
 *
 * `data-dock-create` marks the button for tests and screenshots, so neither
 * depends on a class name.
 */
export function CreateDock({
  t,
  listHref,
  side = "property",
  isHost = false,
  signedIn = true,
  socialOn = true,
}: {
  t: ShellDictionary;
  /** Where the listing option goes: the agent wizard for an agent, the side's chooser otherwise. */
  listHref: string;
  /** Which side's three options to offer. */
  side?: Side;
  /** A host's stay listing goes straight to their rooms rather than the chooser. */
  isHost?: boolean;
  /** A guest cannot post or list: each option goes through the sign-up door and back. */
  signedIn?: boolean;
  /** The `social` switch: off, the feed's composer is not offered. */
  socialOn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  /* `data-create-dock` on <html>: the feed's floating bloom steps aside for
     the dock's own plus (social-feed.css, lib/ui/root-flag.ts). */
  useRootFlag("create-dock");
  const copy = t.nav.create;
  const stays = side === "stays";

  /*
   * The three top-level options, in the founder's order, then what the sheet
   * already offered, below them. Keyed by a fixed id, not the href: a key must
   * not depend on a route. A guest goes through the sign-up door and comes back.
   */
  const door = (href: string) => (signedIn ? href : withNext("/sign-up", href));
  const more = t.homeV2;
  const top: { id: string; href: string; title: string; sub: string; icon: UiIconName }[] = [
    ...(socialOn
      ? [
          { id: "story", href: door("/stories/new"), title: more.createStory, sub: more.createStorySub, icon: "picture" as const },
          { id: "post", href: door("/around?compose=1"), title: more.createPost, sub: more.createPostSub, icon: "pencil" as const },
        ]
      : []),
    stays
      ? { id: "stay", href: door(isHost ? "/host/rooms" : listHref), title: more.createStay, sub: more.createStaySub, icon: "bed" }
      : { id: "list", href: door(listHref), title: more.createList, sub: more.createListSub, icon: "house" },
  ];
  /* Booking was always here and stays: public, so no sign-up door. */
  const below: { id: string; href: string; title: string; sub?: string; icon: UiIconName }[] = [
    stays
      ? { id: "book-stay", href: "/stays/search", title: copy.bookStay, icon: "calendar-booking" }
      : { id: "viewing", href: "/search", title: copy.viewing, sub: copy.viewingSub, icon: "calendar-booking" },
  ];
  const items = [...top.map((item) => ({ ...item, quiet: false })), ...below.map((item) => ({ ...item, quiet: true }))];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={copy.trigger}
        className="nf-dock-create"
        data-dock-create=""
      >
        {/* THE CENTRE TURNS INTO ITS OWN CLOSE (north star 6.1): the disc
            rotates 90 degrees as its sheet opens while the plus crossfades
            to a close mark (nav-island.css). */}
        <span className="nf-dock-plus" aria-hidden="true">
          <span className="nf-dock-plus__glyph nf-dock-plus__glyph--open">
            <UiIcon name="plus" size="md" />
          </span>
          <span className="nf-dock-plus__glyph nf-dock-plus__glyph--close">
            <UiIcon name="close" size="md" />
          </span>
        </span>
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={copy.title}
        /* Four rows with a short line each and a title: one detent that holds them. */
        detents={[0.62]}
        closeLabel={t.pickers.close}
      >
        <RowList inset={false} className="nf-create-sheet" data-testid="create-options">
          {items.map((item) => (
            <Row key={item.id} className="p-0">
              <Link
                data-testid={`create-${item.id}`}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`nf-row nf-row--tap nf-create-sheet__option${item.quiet ? " nf-create-sheet__option--quiet" : ""}`}
              >
                <span className="nf-create-sheet__icon" aria-hidden="true">
                  <UiIcon name={item.icon} size="md" />
                </span>
                <span className="nf-create-sheet__text">
                  <span className="nf-create-sheet__title">{item.title}</span>
                  {item.sub ? <span className="nf-create-sheet__sub">{item.sub}</span> : null}
                </span>
              </Link>
            </Row>
          ))}
        </RowList>
      </Sheet>
    </>
  );
}
