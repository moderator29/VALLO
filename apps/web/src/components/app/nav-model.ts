import type { ShellDictionary } from "@/lib/i18n/shell-dictionary";
import { SUBSCRIPTIONS_OPEN } from "@/lib/subscriptions/open";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { Side } from "@/lib/side.constants";
import { CIRCLE_ROUTE } from "./circle-route";
import { ROOMMATES_ROUTES } from "@/lib/features/roommates/model";

/**
 * The side navigation, as data.
 *
 * One module, read by both the desktop rail and the phone drawer, so the two
 * cannot drift.
 *
 * ---------------------------------------------------------------------------
 * THIS FILE JUST GOT MUCH SHORTER, AND THAT IS THE POINT.
 *
 * An ordinary renter was offered TWENTY-FIVE destinations here, and an agent
 * who is also staff was offered FORTY. Nobody navigates twenty-five things.
 * They scan the first five, give up, and use search. Counted before:
 *
 *   Discover      Home, Rent, Explore + 5 children, Feed + 3 children   12
 *   Account       Bookings, Messages, Notifications, Wallet, Assistant,
 *                 Profile + 3 children                                   9
 *   Become agent                                                         1
 *   Legal         Help, Terms, Privacy                                   3
 *                                                                       ==
 *                                                                       25
 *
 * Counted after: ELEVEN for a renter and TWELVE for an agent who is also staff
 * (the same eleven, minus the Become an agent row nobody needs now, plus one
 * row each for the two workspaces). Every one of them is a place that does
 * something the others do not.
 *
 * THERE IS NO SUB-NAVIGATION LEFT ANYWHERE IN THIS FILE. No row has children,
 * `NavTree` no longer renders them, and the rule that produced that is the
 * owner's: if a thing needs children it is either its own screen or it does not
 * belong in navigation. What went, and why:
 *
 *  - **The five Explore children.** `/search?type=hotel`, `?type=property`,
 *    `?type=home`, `?type=restaurant`, `?type=experience` were five rows
 *    pointing at ONE screen with one query parameter changed. The category is
 *    a control on that screen, at the top of the filter drawer, offering every
 *    market the catalogue actually holds rather than five of them. Five rows in
 *    a drawer were a worse copy of a filter.
 *
 *  - **Rent.** `/rent` was discovery filtered to the long-let market, which is
 *    the same thing again: a filter presented as a destination. The page is
 *    deleted now (V-26) and the address redirects to `/search?market=rent`.
 *
 *  - **The three Feed children.** Feed, Places and People are the feed screen
 *    and two indexes reachable from it. The first child pointed at the same
 *    href as its own parent.
 *
 *  - **The three Profile children.** Profile is already a row of its own at the
 *    top of the rail (`nf-nav__who`) and the island on the tab bar. Saved is
 *    promoted to a real row because it is a destination people go to on
 *    purpose; Settings likewise.
 *
 *  - **The whole Legal section.** Help, Terms and Privacy are all three
 *    already rows inside Settings, under About, and they were only ever put
 *    here because nothing else in the product linked them. Something does now.
 *
 * WHAT DID NOT CHANGE: nothing here is offered to somebody who cannot use it.
 * The agent workspace appears only for an approved agent and the console only
 * for staff, both resolved from the person's own RLS-bound reads in
 * `getShellIdentity`.
 *
 * WHERE THE ASSISTANT LIVES. Exactly one placement per viewport, and this is
 * it. It used to have three at once: a permanently filled primary button in the
 * app header, a tab on the phone dock, and this row. The header button and the
 * tab are both gone. Below `lg` this file renders as the drawer and above it as
 * the rail, so on any given screen there is one Assistant control.
 */

export type NavLeaf = {
  href: string;
  label: string;
  icon: UiIconName;
  badge?: number;
};

export type NavNode = NavLeaf & {
  /** Present only on a parent. The parent's own href still navigates. */
  children?: NavLeaf[];
};

export type NavSection = {
  /** Null on the first section, which needs no heading above the first row. */
  heading: string | null;
  items: NavNode[];
  /**
   * Hidden on phones, because the bottom dock already carries these.
   *
   * Home, Explore and Feed sit in the dock on a phone, permanently, one thumb
   * reach away. Repeating them at the top of the drawer means the first thing
   * somebody sees when they open the menu is three destinations they can
   * already reach without opening the menu, which pushes everything the drawer
   * exists for below the fold.
   *
   * The desktop rail has no dock beside it, so there they are the only way to
   * those three screens and they stay.
   *
   * A flag on the section rather than a check on its index: the reason travels
   * with the data, and reordering the sections later cannot silently hide the
   * wrong one.
   */
  hideWhenDocked?: boolean;
};

export function buildNav({
  t,
  side = "property",
  unreadNotifications,
  unreadConversations = 0,
  isAgent,
  isAdmin,
  isHost = false,
  signedIn,
  walletLive = false,
}: {
  t: ShellDictionary;
  /**
   * Which side the shell is on. Property returns the model exactly as it was;
   * Stays returns its own: Stays, Explore stays, Feed, then Account with
   * Trips replacing Bookings, then Settings. The workspaces (Agent Mode, the
   * console) belong to the Property side and render only there; the Stays
   * business console arrives later as a `/host/*` sibling with its own gate.
   */
  side?: Side;
  unreadNotifications: number;
  /** B1: conversations with an unread message, live; badges Messages. */
  unreadConversations?: number;
  isAgent: boolean;
  isAdmin: boolean;
  /** Holds a Stays host business: one row into `/host`, on either side. */
  isHost?: boolean;
  signedIn: boolean;
  /**
   * True only once the member's Wallet is connected on the new rail. Until
   * then the Wallet row is not drawn (the founder, 9 November 2026, sweep item
   * 25): the rail behind it is switched off. The route itself keeps working
   * for anybody with a link. No caller passes it yet, so it is hidden.
   */
  walletLive?: boolean;
}): NavSection[] {
  const stays = side === "stays";
  const sections: NavSection[] = [
    {
      heading: null,
      /*
       * Three places to look at the marketplace, and they are genuinely three
       * different things: the shelf assembled for you, the whole catalogue you
       * search yourself, and what people nearby are saying. Everything that
       * used to sit here was one of these three with a filter on it.
       *
       * Open to a signed-out visitor, all three, because a marketplace nobody
       * can see cannot be found. Acting is what gates, not looking.
       *
       * On the Stays side the first two are the Stays roots (`/stays`,
       * `/stays/search`); `/home` and `/search` stay the Property roots so
       * every existing link keeps its meaning. Feed is shared.
       */
      hideWhenDocked: true,
      items: stays
        ? [
            { href: "/stays", label: t.nav.stays, icon: "bed" },
            { href: "/stays/search", label: t.nav.search, icon: "search" },
            { href: "/around", label: t.nav.feed, icon: "feed" },
            { href: CIRCLE_ROUTE, label: t.nav.circle, icon: "circle-people" },
            { href: "/around/people", label: t.feedV2.people.navPeople, icon: "users" },
            /* Vallo Roommates (8 November 2026): one row after Circle and People, nothing moved. */
            ...(t.roommatesEntry ? [{ href: ROOMMATES_ROUTES.home, label: t.roommatesEntry.nav, icon: "house-duplex" as const }] : []),
          ]
        : [
            { href: "/home", label: t.nav.home, icon: "home" },
            { href: "/search", label: t.nav.search, icon: "search" },
            /* `grid` meant "Around" and nothing about a grid of four squares says
               feed, place or neighbourhood: it was the one destination in the set
               a person could not guess from its glyph. `feed` exists now. */
            { href: "/around", label: t.nav.feed, icon: "feed" },
            { href: CIRCLE_ROUTE, label: t.nav.circle, icon: "circle-people" },
            { href: "/around/people", label: t.feedV2.people.navPeople, icon: "users" },
            /* Vallo Roommates (8 November 2026): one row after Circle and People, nothing moved. */
            ...(t.roommatesEntry ? [{ href: ROOMMATES_ROUTES.home, label: t.roommatesEntry.nav, icon: "house-duplex" as const }] : []),
          ],
    },
  ];

  /*
   * The account block, which only means anything once there is an account.
   *
   * Showing Bookings, Wallet and Messages to a signed-out browser is offering
   * six rows that all lead to the same sign-up screen, which teaches somebody
   * that this navigation wastes their time. They get the three above and the
   * Sign up control in the header instead.
   */
  if (signedIn) {
    sections.push({
      heading: t.nav.accountLabel,
      items: [
        /* PLANS, ONE ROW ON BOTH SIDES (V-76). Bookings and Inspections on
           Property and Trips on Stays were three lists whose empty states
           pointed at each other; they are one dated page now, which opens on
           the side the shell is on. */
        {
          href: stays ? "/bookings?side=stays&from=stays" : "/bookings",
          label: t.shape.plans.title,
          icon: "calendar-booking",
        } as NavNode,
        {
          href: "/messages",
          label: t.nav.messages,
          icon: "chat-bubble",
          ...(unreadConversations > 0 ? { badge: unreadConversations } : {}),
        },
        {
          href: "/notifications",
          label: t.nav.notifications,
          icon: "bell",
          ...(unreadNotifications > 0 ? { badge: unreadNotifications } : {}),
        },
        { href: "/saved", label: t.nav.saved, icon: "heart" },
        { href: "/agreements", label: t.nav.agreements, icon: "document" },
        /* D78: the passport is a feature, with its own row. Its name is the
           passport's own (`passportV2.navLabel`, translated in all four
           languages), so the row and the page it opens cannot drift. */
        { href: "/settings/passport", label: t.passportV2.navLabel, icon: "id-card" },
        /* No crypto row: V-83 took the deferred crypto market out of the
           shipped tree (parked on `claude/parked-crypto-deferred`). */
        /*
         * THE ASSISTANT ROW IS BACK, BY REQUEST.
         *
         * It was taken out on the argument that `/assistant` already has a door
         * on `/home` through `AiAssistantBanner`, and that two doors to one room
         * make the navigation longer without making anything more reachable.
         *
         * That argument had a hole in it: the banner is on ONE screen. From
         * anywhere else - a listing, an agreement, a thread - reaching the
         * assistant meant going home first, so the "second door" was in practice
         * the only door, and it was on a screen you had to leave to use it. A
         * tool you reach for from inside what you are doing is precisely a thing
         * that has to be reachable from inside what you are doing.
         */
        /*
         * "AI Assistant", NOT "Vallo AI", and it is the dictionary's string
         * rather than a literal.
         *
         * The drawer called it Vallo AI, the page it opens is titled AI
         * Assistant, and `BCD39CA8` writes AI Assistant: one destination with
         * two names, in the two places a person meets it one tap apart. A
         * hardcoded English literal in a navigation model is also the reason
         * it could drift - every other row here reads `t.nav.*` and would
         * have followed a rename for free. (R1 finding A33.)
         */
        { href: "/assistant", label: t.nav.aiAssistant, icon: "bot" },
      ],
    });

    /*
     * MONEY IS ITS OWN GROUP (7 October 2026, D70).
     *
     * Receipts, Payouts and Refunds were built, tested and reachable only by
     * typing the address. The founder opened this drawer, looked for what he
     * had paid for, did not find it, and concluded it had not been built. He
     * was navigating correctly; this list was wrong.
     *
     * One heading for everything that is a figure about this person: what
     * they paid, the proof of it, what came back, what they are owed, and
     * what an invite earns. Every row but one is a record, never an account:
     * Vallo holds no customer money (ADR 0003). The one account, Balance, is
     * the escrow partner's, read from it with its time (lib/money/member-wallet.ts).
     *
     * Payouts shows to everyone signed in, not only to listers: its page
     * draws an honest empty state that points at payout details, and hiding
     * the door is exactly the failure this group exists to undo.
     *
     * Invite friends and Rewards moved here from the account block: an
     * invite link and what Vallo owes for it are money, and the earlier note
     * that placed them on the account (same day) is superseded by this one.
     */
    /*
     * MONEY, THREE ROWS (D78, 7 October 2026, evening).
     *
     * The founder: "the payment, receipts, payout etc should be removed from
     * there and put in the wallet ... that gives space for the side nav;
     * normally all of it is supposed to be inside the wallet." Payments,
     * Receipts, Payouts and Refunds are rows on the Wallet screen now. The
     * invite row is "Referral", and the Leaderboard opens from the Referral
     * page, not from here.
     */
    sections.push({
      heading: t.experienceShell.navMoneyLabel,
      items: [
        ...(walletLive ? [{ href: "/wallet", label: t.experienceShell.navBalance, icon: "wallet" } as NavLeaf] : []),
        /* "Rewards" is the Rewards page's own title. Whether a reward is
           running is said by the page itself, from the rewards read
           (`lib/referral/rewards-read.ts`); the row never shows a figure. */
        { href: "/rewards", label: t.experienceRewards.title, icon: "hand-coins" },
        { href: "/settings/invite", label: t.experienceShell.navInvite, icon: "users" },
      ],
    });
  }

  /*
   * The two workspaces, shown only to somebody who has one, and each is ONE
   * ROW.
   *
   * The agent group used to carry eight children and the console six, so an
   * agent who is also staff was offered forty destinations in this one panel.
   * A workspace is a place you GO, and once you are in it, it has its own
   * navigation with its own rail: reproducing that rail inside the consumer
   * drawer is drawing the same eight rows in two places and making the person
   * who has both choose which copy to use.
   *
   * Nothing became unreachable. Every one of those fourteen destinations is a
   * row in the workspace's own navigation, one tap further in, which is where
   * somebody who is working looks for it.
   */
  /*
   * PRICE CHECK HAS A DOOR (track L, 25 September 2026). `/price` had no
   * inbound link anywhere in the product (`lib/nav/route-parents.ts` used to say so):
   * it was reached by address and by share cards only. It sits on the
   * Property side, because what it reports is what homes near a place are
   * asking, and signed in, because the route is behind the gate. Its own
   * section, not the docked one, so it is not hidden on a phone where the
   * dock carries Home, Search and Feed. The label is the feature's name and
   * never "valuation", "worth" or "value" (`check-valuation-words.mjs`).
   */
  if (signedIn && !stays) {
    sections.push({
      heading: null,
      items: [{ href: "/price", label: t.priceCheck.title, icon: "price-tag" }],
    });
  }

  const workspaces: NavNode[] = [];

  /* Agent mode is Property's workspace. On the Stays side the shell simply
     has no agent surface, exactly as a personal-mode shell has none today;
     the mode cookie is left alone and the row returns on the flip back. */
  if (isAgent && !stays) {
    workspaces.push({
      href: "/agent/dashboard",
      label: t.nav.agentMode,
      icon: "building-apartment",
    });
  }

  /* The host console is the Stays business's workspace. It shows on both
     sides, because a host looks for their bookings wherever they are. */
  if (isHost) {
    workspaces.push({ href: "/host", label: t.nav.hostMode, icon: "bed" });
  }

  if (isAdmin && !stays) {
    workspaces.push({ href: "/admin", label: t.nav.consoleLabel, icon: "shield-stop" });
  }

  if (workspaces.length > 0) {
    sections.push({ heading: t.nav.workspacesLabel, items: workspaces });
  }

  /*
   * The last section: one way to start listing, and one way to change
   * everything else.
   *
   * Settings is the destination that absorbed the cuts. Theme and language used
   * to be two permanent controls in the app header on every single screen, for
   * a choice most people make once; both are cards on that page. Help, Terms
   * and Privacy are rows on it too, which is why the Legal section here is
   * gone.
   */
  /*
   * BECOME AN AGENT WENT, AND THEN THE WHOLE IDEA OF IT WENT.
   *
   * The row was cut first, as the third door to a page the profile already
   * linked twice: a permanent rail row for an action you take once is the
   * clearest possible case of something that belongs inside a screen.
   *
   * The page itself has since gone too, and with it the framing. There is no
   * conversion from renter to agent. There is one account carrying three
   * profiles, and the switch-profile sheet on `/profile` both switches between
   * them and sets up whichever one is not there yet. Nothing in this file
   * points at it, because switching profile is not navigation: it changes what
   * the rest of this list means.
   */
  const tail: NavNode[] = [];

  /*
   * BECOME AN AGENT IS A ROW AGAIN, and the note above is now history rather
   * than current reasoning.
   *
   * It was cut as a third door to a page the profile already linked twice, and
   * that argument was sound about a DUPLICATE row. What replaced it was a
   * switch-profile sheet reached by tapping an avatar, which is the least
   * discoverable control on the platform, for the single most important thing
   * somebody can do here: start listing property.
   *
   * A marketplace with no supply has exactly one conversion that matters, and
   * it was hidden two taps inside a sheet nobody opens. The owner is right
   * that it belongs where a person can see it.
   *
   * ONLY FOR PEOPLE WHO ARE NOT ALREADY AGENTS. An agent sees the workspace
   * row above instead, and showing both would offer somebody a door into a
   * room they are standing in.
   *
   * `verified` rather than a building or a briefcase, deliberately: the thing
   * on the other side of this row is a verification ladder, not a job title,
   * and the icon should say what the flow actually is.
   */
  /*
   * AND THEN IT STOPPED SAYING "BECOME AN AGENT", WHICH IS THE WHOLE POINT.
   *
   * The row was right that a marketplace with no supply has exactly one
   * conversion that matters and that it must be visible. It was wrong about
   * what that conversion is. Most of the supply this platform now wants is
   * LANDLORDS WHO ARE NOT AGENTS AND NEVER WILL BE, and the only door into
   * the supply side was marked become an agent. There is exactly one `agents`
   * row in the whole database and it is the example lister.
   *
   * It reads "Add a workspace" now, from `t.supply`, which is the same words
   * the switch profile sheet uses for the same door, so the two entrances
   * cannot say different things about one destination.
   *
   * TWO CONDITIONS CAME OFF, AND BOTH WERE WRONG RATHER THAN CAUTIOUS.
   *
   * `!isAgent` hid it from anybody who already had a supply account, on the
   * argument that they should see the workspace row instead. That argument
   * assumed one workspace per person, which is the model this direction
   * exists to replace: a man who lets his own flat and agents another has two,
   * and an agent whose firm joins Vallo gains a third. Adding a second is not
   * a door into a room you are standing in.
   *
   * `!stays` hid it on the Stays side, where the founder has ruled the same
   * control offers three different doors: we are a hotel, I run a shortlet, we
   * are a restaurant. The chooser reads the side and draws the right three.
   */
  if (signedIn) {
    tail.push({
      href: stays ? "/profile/setup?side=stays" : "/profile/setup",
      label: t.supply.addTitle,
      icon: "plus",
    });
  }

  /* Track B: help is one tap from every screen, on both sides, signed in or
     not. Signed in, it opens the in-app help and support page (the support
     chat and "talk to a person"); signed out, the public help centre. */
  tail.push({ href: signedIn ? "/support" : "/help", label: t.nav.helpSupport, icon: "headset" });
  if (signedIn) {
    /* P6 (7 October): Pro, what it is and where the member stands, above
       Settings. "Pro" is the plan's name and reads the same in every
       language (the dictionary's own `experienceFeatures.pro.label` is
       "Pro"), so the shell slice is not widened for one word. */
    if (SUBSCRIPTIONS_OPEN) tail.push({ href: "/pro", label: "Pro", icon: "crown" });
    tail.push({ href: "/settings", label: t.nav.settings, icon: "settings-gear" });
  }
  /*
   * THE DOCK'S OLD GRID TRAY, KEPT WHOLE (founder, 7 November 2026). The
   * dock's centre slot became Vallo Circle, and every destination its tray
   * held must stay one tap from the side menu. Most already had a row; the
   * ones that did not on this side or signed-in state join the tail here,
   * once each, so nothing the tray offered was lost.
   */
  const listed = new Set(sections.flatMap((section) => section.items.map((item) => item.href)).concat(tail.map((item) => item.href)));
  for (const item of formerTrayItems(t, signedIn, stays)) {
    if (!listed.has(item.href)) {
      tail.push(item);
      listed.add(item.href);
    }
  }
  if (tail.length > 0) sections.push({ heading: null, items: tail });

  return sections;
}

/** What the dock's grid tray (`DockMore`) offered, for the side menu's check. */
export function formerTrayItems(t: ShellDictionary, signedIn: boolean, stays: boolean): NavLeaf[] {
  return signedIn
    ? [
        { href: "/messages", label: t.nav.messages, icon: "chat-bubble" },
        { href: stays ? "/bookings?side=stays&from=stays" : "/bookings", label: t.shape.plans.title, icon: "calendar-booking" },
        { href: "/saved", label: t.nav.saved, icon: "heart" },
        { href: "/assistant", label: t.nav.aiAssistant, icon: "bot" },
        { href: "/agreements", label: t.nav.agreements, icon: "document" },
        { href: "/price", label: t.priceCheck.title, icon: "price-tag" },
        { href: "/settings", label: t.nav.settings, icon: "settings-gear" },
        { href: "/support", label: t.nav.helpSupport, icon: "headset" },
        { href: "/support/new?kind=problem", label: t.experienceInbox.support.home.reportProblem, icon: "flag" },
      ]
    : [
        { href: "/assistant", label: t.nav.aiAssistant, icon: "bot" },
        { href: "/price", label: t.priceCheck.title, icon: "price-tag" },
        { href: "/help", label: t.nav.helpSupport, icon: "headset" },
      ];
}

/**
 * Whether a row is the page being looked at.
 *
 * `activeType` is still a parameter and still consulted, even though no row in
 * this file carries a `?type=` any more. The agent navigation reads the same
 * `NavTree`, and a future row may want the same trick; the honest reason to
 * keep it is that removing it would change `NavTree`'s signature for a saving
 * of four lines. A row with no query still ignores the query entirely, so
 * `/search?q=Lekki` lights Explore rather than nothing.
 */
export function isCurrent(href: string, activePath: string, activeType: string | null): boolean {
  const [path, query] = href.split("?");
  if (path !== activePath) return false;
  if (!query) return true;
  const wanted = new URLSearchParams(query).get("type");
  return wanted === activeType;
}

/** True when this parent contains the current page, so it opens on arrival. */
export function containsCurrent(
  node: NavNode,
  activePath: string,
  activeType: string | null,
): boolean {
  if (!node.children) return false;
  return node.children.some((child) => isCurrent(child.href, activePath, activeType));
}
