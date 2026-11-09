"use client";

import type { ShellDictionary } from "@/lib/i18n/shell-dictionary";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useOverlay } from "@/lib/ui/use-overlay";
import { useSwipeToClose } from "@/lib/ui/use-swipe-to-close";
import { WholePrefetchLink } from "@/components/app/WholePrefetchLink";
import { KeepWarm } from "@/components/app/KeepWarm";
import { usePathname, useSearchParams } from "next/navigation";
import { AppRail } from "./AppRail";
import { isFocusedRoute, isImmersiveRoute, showsTabBar } from "./MobileTabBar";
import { CIRCLE_ROUTE } from "./circle-route";
import { ShellDock } from "./ShellDock";
import { openCreateSheet } from "./CreateDock";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { AuthGateProvider, SignedOutActions } from "@/components/auth/AuthGate";
import { sideOfPath, sideOfPlansQuery, type Side } from "@/lib/side.constants";
import { SideFlip } from "./flip/SideFlip";
import { SideSync } from "./SideSync";
import { isDetailPath } from "@/lib/side.constants";
import type { ProfileSelection, Workspace } from "@/lib/supply/workspaces";

const LazyNotifyBanner = lazy(() =>
  new Promise<{ default: typeof import("./notify/NotifyBanner").NotifyBanner }>((resolve) => {
    const load = () =>
      import("./notify/NotifyBanner").then((m) => ({ default: m.NotifyBanner }));
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => void load().then(resolve), { timeout: 2000 });
    } else {
      setTimeout(() => void load().then(resolve), 2000);
    }
  }),
);

/**
 * The consumer shell, for both sides.
 *
 * The single wrapper for every consumer page, so the navigation is identical
 * everywhere rather than living on the home route alone. On `lg` and up the
 * sticky `AppRail` sits beside the content; below `lg` the rail is gone and the
 * fixed `MobileTabBar` carries navigation, with the main column padded so
 * nothing hides behind it. The active destination is read from the current path
 * here, so the highlight stays correct as the user moves around without each
 * page having to pass it in.
 *
 * ---------------------------------------------------------------------------
 * THE HEADER LOST THREE CONTROLS AND THE SHELL LOST A WHOLE NAVIGATION SURFACE.
 *
 * The app bar carried six controls on every screen: the drawer toggle, the
 * wordmark, a language switcher, a theme toggle, a permanently filled AI
 * Assistant button, the notification bell and the avatar. Three of those had no
 * business being there:
 *
 *  - **Language** is a choice somebody makes once, and it is a card on
 *    `/settings`. A permanent control for a once-ever decision is a control
 *    that is wrong 99.9% of the time it is on screen.
 *  - **Theme** is the same argument, and it is a card on `/settings` too.
 *  - **The assistant** was the loudest thing on the bar - filled primary, brand
 *    gradient, on every route - and it was ALSO a tab on the phone dock and
 *    ALSO a row in the rail. Three placements for one feature. It keeps the
 *    one in the side navigation, which renders as the rail on desktop and the
 *    drawer on a phone, so it has exactly one placement per viewport.
 *
 * **The desktop dock is gone entirely.** It was a floating pill fixed over the
 * bottom of the content offering Notifications, Messages and Settings - all
 * three of which are rows in the rail, three inches away, permanently visible
 * on the same viewport the dock only appeared on. It was a second navigation
 * competing with the first, and on the listing page it fought the sticky action
 * bar for the bottom edge, which is why `pinsActionBar` existed. That special
 * case is gone with it.
 *
 * WHAT THE HEADER CARRIES NOW: the drawer toggle and the wordmark on a phone,
 * then either the bell and the avatar (signed in) or Sign up and Log in
 * (signed out).
 */
/**
 * WHERE THE BELL SHOWS (D78, 7 October 2026, evening). The founder: the
 * notification bell belongs on the top bar of the dock's main places only,
 * Home, Search and Feed (each side's own), and nowhere else: not on a
 * profile, a listing, settings or any feature page. Notifications stay one
 * tap away in the side navigation everywhere.
 */
const BELL_PATHS: ReadonlySet<string> = new Set(["/home", "/stays", "/search", "/stays/search", "/around", CIRCLE_ROUTE]);

/** SW16: the bell on every dock root. With the social layer off, Agreements
    holds the Feed slot, so it is a root then and carries the bell too. */
function bellOn(pathname: string, socialOn: boolean): boolean {
  return BELL_PATHS.has(pathname) || (!socialOn && pathname === "/agreements");
}

export function AppShell({
  t,
  side = "property",
  userName,
  userHandle = "",
  verified = false,
  unreadNotifications = 0,
  avatarUrl = "",
  signedIn = false,
  isAgent = false,
  isAdmin = false,
  isHost = false,
  workspaces = [],
  currentProfile = { kind: "personal" },
  socialOn = true,
  preview,
  children,
}: {
  t: ShellDictionary;
  side?: Side;
  userName: string;
  userHandle?: string;
  /** The human-checked tick in the drawer's user card. See `AppRail`. */
  verified?: boolean;
  unreadNotifications?: number;
  avatarUrl?: string;
  signedIn?: boolean;
  isAgent?: boolean;
  isAdmin?: boolean;
  /** Holds a Stays host business; adds the host workspace row. */
  isHost?: boolean;
  /**
   * Every workspace this account actually holds, resolved on the server from
   * the caller's own RLS bound reads and handed down.
   *
   * IT IS A LIST OF WHAT THEY HAVE, NEVER OF WHAT THEY MAY DO. The switch
   * writes a cookie; every route re-gates for itself. An empty list is the
   * ordinary state and the sheet has copy for it.
   */
  workspaces?: Workspace[];
  currentProfile?: ProfileSelection;
  /**
   * The `social` switch (`lib/social/flag.ts`, read once in the layout).
   * Off, Around leaves the dock, the side navigation and the Create sheet
   * (north star 10 E: "hide the tab when the switch is off"); the routes
   * themselves already say "Around is paused". Defaults on, as the switch
   * fails open.
   */
  socialOn?: boolean;
  /**
   * The dev preview harness, and nothing else, ever.
   *
   * Two facts the chrome takes from the browser rather than from a prop: the
   * route it is on, and whether the drawer is open. Neither can be reached
   * from a screenshot harness - `verify-shots.mjs` loads a URL and shoots,
   * it does not click - so the drawer, which is the single largest surface
   * this component owns, could not be proven against its reference image at
   * all. `app/(dev)/preview/f1/*` sets this; the product never does, and the
   * preview tree 404s in production.
   */
  preview?: { route?: string; drawer?: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = preview?.route ?? pathname;
  /* Five navigation rows are the same pathname with a different `type`, so the
     rail needs that one parameter to tell them apart. Everything else about
     the query is ignored, so /search?q=Lekki still lights Explore. */
  const searchParams = useSearchParams();
  const activeType = searchParams.get("type");
  const [drawer, setDrawer] = useState(preview?.drawer ?? false);
  const effectiveSide: Side = sideOfPath(active) ?? sideOfPlansQuery(active, searchParams) ?? side;
  const immersive = isImmersiveRoute(active);
  const edgeToEdge = /^\/(listing|stay|restaurant)\/[^/]+$/.test(active);

  /*
    THE HEADER IS ON EVERY IN-APP PAGE, by the founder's ruling
    (DESIGN_DIRECTION section 3.2): hamburger, lockup, bell, avatar, both
    sides. It used to appear on tab roots only, on the argument that inner
    pages carry their own back control; the renders put the lockup and the
    bell over inner pages too, and the drawer has to be reachable from
    anywhere. The one exception stays: a photo-first detail page reaches the
    top edge with its own controls riding the picture.
  */
  const showsHeader = !immersive && !edgeToEdge && !isFocusedRoute(active);

  /* The drawer closes on navigation. State derived during render rather than
     in an effect, so there is no frame with the old page under an open panel. */
  const [drawerRoute, setDrawerRoute] = useState(active);
  if (active !== drawerRoute) {
    setDrawerRoute(active);
    if (drawer) setDrawer(false);
  }

  const drawerPanel = useRef<HTMLDivElement | null>(null);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const openDrawer = useCallback(() => setDrawer(true), []);

  useOverlay({ open: drawer, onClose: closeDrawer, panelRef: drawerPanel });
  /* F-15: the drawer also closes on a swipe back towards the left edge. */
  const drawerSwipe = useSwipeToClose(closeDrawer);

  /*
   * THE HEADER IS NOT A BAR UNTIL THERE IS SOMETHING UNDER IT.
   *
   * Every governing render that draws this header - the founder's home
   * target, the feed render, the flip render, the stays render - draws the
   * lockup, the bell and the avatar sitting ON THE PAGE, with no bar behind
   * them at all. What shipped was an 88 per cent canvas veil on every screen
   * at every scroll position, which at the top of a page is a flat dark band
   * across the first 60px with a hard edge under it, over a page whose own
   * brand glow it is masking. (R1 finding A38.)
   *
   * The veil is not wrong, it is just premature: the reason it exists is
   * content passing UNDERNEATH, and at scroll zero nothing is. So the bar is
   * transparent until the page moves and frosts once it has, which is both
   * what the renders show and what the veil was for.
   *
   * A scroll listener rather than `animation-timeline: scroll()`, which is
   * Chromium-only and would leave every other engine permanently transparent
   * with type scrolling through the lockup - the exact defect the veil
   * prevents. Passive, rAF-throttled, and it writes an attribute rather than
   * state on every frame, so a scroll costs one class change at the moment
   * it crosses the threshold and nothing at all in between. Not motion, so
   * `prefers-reduced-motion` does not apply: it is a material that answers a
   * condition, like the dock's own auto-hide.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!showsHeader) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [showsHeader]);

  const marked = signedIn && unreadNotifications > 0;

  return (
    <AuthGateProvider signedIn={signedIn}>
    <SideFlip side={effectiveSide} t={t}>
    <SideSync side={effectiveSide} persist={!isDetailPath(active)} />
    {/* The startup track: the main tabs fetched ahead when idle and on return,
        and the screen refreshed in place after time away (KeepWarm). */}
    <KeepWarm side={effectiveSide} socialOn={socialOn} current={pathname ?? ""} enabled={signedIn && !preview} />
    <div className="nf-app-shell flex min-h-dvh" data-side={effectiveSide}>
      <AppRail
        t={t}
        side={effectiveSide}
        active={active}
        activeType={activeType}
        userName={userName}
        userHandle={userHandle}
        avatarUrl={avatarUrl}
        unreadNotifications={unreadNotifications}
        isAgent={isAgent}
        isAdmin={isAdmin}
        isHost={isHost}
        signedIn={signedIn}
        socialOn={socialOn}
      />

      {/*
        The side drawer: the designed surface of the drawer render, sliding in
        from the LEFT as the render has it, stopping short of the far edge so a
        strip of the dimmed app stays visible and tappable, on the spring.
      */}
      {drawer && (
        <div
          ref={drawerPanel}
          tabIndex={-1}
          className="fixed inset-0 z-[60] outline-none lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.menuLabel}
        >
          <button
            type="button"
            aria-label={t.a11y.closeMenu}
            onClick={closeDrawer}
            className="nf-drawer-scrim absolute inset-0"
          />
          {/* The panel's own box is the stylesheet's: the drawer render draws
              a FLOATING lit panel with all four corners rounded and a strip of
              the dimmed app beside it, not a slab welded to the screen edge,
              and the safe areas are part of that geometry. Utilities here
              would outrank the component layer and pin it back to the edge. */}
          <div className="nf-drawer nf-drawer--left absolute" {...drawerSwipe}>
            {/* The panel draws the moving edge light (edge-m.css) and holds
                still; this inner layer is what scrolls, so the light stays on
                the panel's edge instead of scrolling away with the rows. */}
            <div className="nf-drawer__scroll">
            <AppRail
              t={t}
              side={effectiveSide}
              active={active}
              activeType={activeType}
              userName={userName}
              userHandle={userHandle}
              avatarUrl={avatarUrl}
              verified={verified}
              unreadNotifications={unreadNotifications}
              isAgent={isAgent}
              isAdmin={isAdmin}
              isHost={isHost}
              signedIn={signedIn}
              socialOn={socialOn}
              variant="drawer"
              onNavigate={closeDrawer}
            />
            </div>
          </div>
        </div>
      )}

      <main
        id="main"
        className={
          immersive
            ? "flex h-dvh min-w-0 flex-1 flex-col overflow-hidden"
            : /* `nf-soft-top`: section 17's lavender-white wash behind the
                 header (a faint night glow in dark), painted once here for
                 every in-app page (css/clean-17.css). */
              `nf-soft-top min-w-0 flex-1 lg:pb-3xl ${showsTabBar(active) ? "nf-main--docked" : "pb-xl"}`
        }
      >
        {showsHeader && (
        <header
          data-scrolled={scrolled || undefined}
          /* THE NAVY TOP BLOCK (founder reference 05, 29 September 2026). The
             header is a night island in both themes: in light it is the dark
             VALLO band over light content, painted by `app/css/light.css`,
             and the logo is its one artwork, as everywhere (D82). In dark the
             attribute changes nothing. */
          data-theme="dark"
          className={`nf-safe-top nf-app-header sticky top-0 z-40 ${
            signedIn ? "lg:hidden" : ""
          }`}
        >
          {/*
            THE SIGNED-OUT HEADER OVERFLOWED AT 390 AND CLIPPED ITS OWN PRIMARY
            CONTROL, AND NOTHING SCROLLED.

            A2 measured it on `/verification`: the actions group's right edge
            landed at 407px inside a 390px viewport, so about seventeen pixels
            of "Sign up" were cut off, while `document.scrollWidth` stayed 390.
            That last number is what made it a defect rather than a squeeze: an
            overflowing flex row does not extend the scrollport, so the clipped
            part of the button could not be reached by ANY gesture. The one
            control a signed-out visitor is there to press was partly not there.

            THREE THINGS WERE SPENDING WIDTH AND NONE OF THEM WOULD GIVE IT UP.
            The hamburger and the actions are both `shrink-0`, correctly: a
            control you cannot read is a control you cannot use. The lockup was
            fixed at a 40px mark plus a 19px wordmark, about 134px, on a row
            that has 342px after the gutters. And a `flex-1` SPACER sat between
            the lockup and the actions, which costs nothing in width itself but
            costs a `gap-sm` on each side of it, so the row paid for four gaps
            where three would do.

            THE FIX IS THAT THE BRAND GIVES WAY, because it is the only item
            here that can lose size without losing meaning. `responsive` scales
            the mark and the wordmark with the viewport (`clamp`), which at 390
            draws the lockup at about 114px instead of 134 and at full size from
            a tablet up. The spacer is gone and the actions push themselves over
            with `ms-auto`, which returns the fourth gap. Measured after: the
            actions' right edge is inside the gutter at 390 and `scrollWidth`
            still equals the viewport, which is now true because nothing
            overflows rather than because the overflow was unreachable.

            It is the same family as the `minmax(0, 1fr)` finding already in the
            ledger: freeing the TRACK and never the ITEM. A flex row whose
            children all refuse to shrink does not wrap and does not scroll, it
            simply paints past its own edge.
          */}
          <div
            className="nf-app-header__row flex h-header-sm min-w-0 items-center gap-sm px-gutter sm:h-header"
            /* Which of the two tails this row is carrying, so the stylesheet
               can treat the tight one differently. Signed in the tail is a
               44px bell (the avatar left in Track M); signed out it is two buttons, 172px
               of them, and that row does not fit a full lockup on a phone. */
            data-tail={signedIn ? "account" : "signed-out"}
          >
            <button
              type="button"
              aria-label={t.a11y.openMenu}
              aria-expanded={drawer}
              onClick={openDrawer}
              className="nf-tap nf-icon-btn nf-app-header__btn -ms-2xs lg:hidden"
            >
              <UiIcon name="menu" size={20} />
            </button>
            {/* D78 (7 October 2026, evening): no logo or wordmark in the app's
                top bar. The founder: "in the platform top dashboard inside the
                app, remove our logo and the VALLO text". The menu and the bell
                are what the bar holds; the brand is the whole screen. */}
            {/* The fold slot (plan item 29): a `PageHeader variant="large"`
                portals its title here once the large title has scrolled
                under the bar. Empty, and invisible, on every other screen. */}
            <span className="nf-app-header__fold" />

            {signedIn && (
              /* UX-04, AND THE FOUNDER'S TRACK M CUT. Which side the app is on
                 used to be a visible "Property" or "Stays" tag here; the
                 founder took it out of the header ("remove the property text,
                 and in stays remove the stays one too"). The accent, the dock
                 and the switch already say which side you are on to the eye,
                 so the words stay for a screen reader only. */
              <span className="sr-only" data-side-tag={effectiveSide}>
                {t.side.indicatorPrefix} {effectiveSide === "stays" ? t.side.staysName : t.side.propertyName}
              </span>
            )}
            <SignedOutActions t={t} className="ms-auto" />
            {signedIn && (bellOn(pathname ?? "", socialOn) || (!immersive && showsTabBar(active))) && (
              /* `ms-auto` on the group: on a signed-in header
                 `SignedOutActions` renders null, so this is the first item
                 after the brand and it is the one that has to push right. */
              <div className="ms-auto flex items-center gap-inline-tight">
                {!immersive && showsTabBar(active) && (
                  /* CREATE, FROM THE HEADER (29 October 2026). The round "+"
                     at the dock's end is gone; this opens the same Create
                     sheet (post, story, list a place, book). A pencil, the
                     compose mark X, Telegram and WhatsApp use. */
                  <button
                    type="button"
                    onClick={openCreateSheet}
                    aria-label={t.nav.create.trigger}
                    aria-haspopup="dialog"
                    className="nf-tap nf-icon-btn nf-icon-btn--round nf-app-header__btn"
                    data-testid="header-create"
                  >
                    <UiIcon name="pencil" size={20} />
                  </button>
                )}
                {bellOn(pathname ?? "", socialOn) && (
                  /* Fetched whole, so the bell opens the list with no skeleton:
                     about 11 KB on the wire, kept for five minutes. */
                  <WholePrefetchLink
                    href="/notifications"
                    aria-label={
                      marked
                        ? t.a11y.notificationsUnread.replace("{count}", String(unreadNotifications))
                        : t.nav.notifications
                    }
                    className="nf-tap nf-icon-btn nf-icon-btn--round nf-app-header__btn"
                  >
                    <UiIcon name="bell" size={20} />
                    {marked && <span aria-hidden="true" className="nf-app-header__dot" />}
                  </WholePrefetchLink>
                )}
                {/* NO AVATAR HERE (Track M, 25 September 2026). The founder
                    took the round photograph out of the header: the drawer
                    opens on the person, and the dock carries Profile. */}
              </div>
            )}
          </div>
        </header>
        )}

        {immersive ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          <div className="nf-shell nf-page-stage py-section-tight">{children}</div>
        )}
      </main>

      {signedIn && !preview ? (
        <Suspense>
          <LazyNotifyBanner />
        </Suspense>
      ) : null}

      {!immersive && showsTabBar(active) && (
        <ShellDock
          t={t}
          side={effectiveSide}
          active={active}
          unreadNotifications={unreadNotifications}
          signedIn={signedIn}
          isAgent={isAgent}
          isHost={isHost}
          socialOn={socialOn}
          workspaces={workspaces}
          currentProfile={currentProfile}
          avatarUrl={avatarUrl}
        />
      )}
    </div>
    </SideFlip>
    </AuthGateProvider>
  );
}
