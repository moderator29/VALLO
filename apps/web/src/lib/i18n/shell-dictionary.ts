import type { Dictionary } from "@vallo/i18n/core";

/**
 * THE SHELL'S SLICE OF THE DICTIONARY (Track M performance, 25 September 2026).
 *
 * `AppShell` is a client component, so whatever the (app) layout hands it as
 * `t` is serialised into the page. It was handed the WHOLE dictionary: every
 * string of every surface, 365 KB of JSON, in the HTML of every first load,
 * when the header, the drawer, the dock and the switch read a small part of
 * it. The founder asked for an app that loads fast with no "booting"; this was
 * the single largest thing every page carried for no reader.
 *
 * The first cut sent whole namespaces (58 KB), found by an import walker that
 * also counted `t.nav.settings` as the `settings` namespace. This one is
 * typed: `AppShell` and everything it hands `t` to take a `ShellDictionary`,
 * so the compiler refuses any read that is not carried here, and the shell
 * carries only the lines it draws (about 4 KB; the test holds it under 8).
 * A full dictionary still fits wherever a `ShellDictionary` is asked for, so
 * the previews and the admin console that pass one need no change.
 */
export type ShellDictionary = Pick<Dictionary, "a11y" | "common" | "nav" | "side"> & {
  shape: Pick<Dictionary["shape"], "workspace" | "plans">;
  supply: Pick<Dictionary["supply"], (typeof SUPPLY_KEYS)[number]>;
  priceCheck: Pick<Dictionary["priceCheck"], "title">;
  pickers: Pick<Dictionary["pickers"], "close">;
  /** The navigation's own new lines (the Payments and Invite rows). */
  experienceShell: Pick<
    Dictionary["experienceShell"],
    "navPayments" | "navInvite" | "navMoneyLabel" | "navBalance" | "navReceipts" | "navPayouts" | "navRefunds" | "navLeaderboard"
    | "navDocsLabel" | "navDocsTerms" | "navDocsPrivacy" | "navDocsSafety" | "navDocsHelp" | "navDocsDocs"
  >;
  /** The passport row's label is the passport's own name, so the row and the page cannot drift. */
  passportV2: Pick<Dictionary["passportV2"], "navLabel">;
  /** The Rewards row's label is the Rewards page's own title, so the two cannot drift. */
  experienceRewards: Pick<Dictionary["experienceRewards"], "title">;
  /** The Create sheet's top-level options and their short lines (the "+" at the dock's right end). */
  homeV2: Pick<Dictionary["homeV2"], (typeof CREATE_KEYS)[number]>;
  /** The People row's label, beside Feed: the page's own word, so the two cannot drift. */
  feedV2: { people: Pick<Dictionary["feedV2"]["people"], "navPeople"> };
  /** Vallo Roommates' side-nav row and its Create sheet option (8 November 2026). */
  roommatesEntry: Pick<Dictionary["roommates"]["entryX"], "nav" | "createDock" | "createDockSub">;
  /** "Report a problem", the support home's own words, for the More menu on every screen. */
  experienceInbox: { support: { home: Pick<Dictionary["experienceInbox"]["support"]["home"], "reportProblem"> } };
};

const CREATE_KEYS = [
  "createStory",
  "createStorySub",
  "createPost",
  "createPostSub",
  "createList",
  "createListSub",
  "createStay",
  "createStaySub",
] as const;

/** The workspace switcher's lines. */
const SUPPLY_KEYS = [
  "switchTitle",
  "personal",
  "personalMeaning",
  "addTitle",
  "addMeaning",
  "current",
  "empty",
  "switchTrigger",
  "kinds",
  "standings",
] as const;

const cache = new WeakMap<Dictionary, ShellDictionary>();

export function shellDictionary(t: Dictionary): ShellDictionary {
  const cached = cache.get(t);
  if (cached) return cached;
  const shell: ShellDictionary = {
    a11y: t.a11y,
    common: t.common,
    nav: t.nav,
    side: t.side,
    shape: { workspace: t.shape.workspace, plans: t.shape.plans },
    supply: Object.fromEntries(SUPPLY_KEYS.map((key) => [key, t.supply[key]])) as ShellDictionary["supply"],
    priceCheck: { title: t.priceCheck.title },
    pickers: { close: t.pickers.close },
    feedV2: { people: { navPeople: t.feedV2.people.navPeople } },
    experienceShell: {
      navPayments: t.experienceShell.navPayments,
      navInvite: t.experienceShell.navInvite,
      navDocsLabel: t.experienceShell.navDocsLabel,
      navDocsTerms: t.experienceShell.navDocsTerms,
      navDocsPrivacy: t.experienceShell.navDocsPrivacy,
      navDocsSafety: t.experienceShell.navDocsSafety,
      navDocsHelp: t.experienceShell.navDocsHelp,
      navDocsDocs: t.experienceShell.navDocsDocs,
      navMoneyLabel: t.experienceShell.navMoneyLabel,
      navBalance: t.experienceShell.navBalance,
      navReceipts: t.experienceShell.navReceipts,
      navPayouts: t.experienceShell.navPayouts,
      navRefunds: t.experienceShell.navRefunds,
      navLeaderboard: t.experienceShell.navLeaderboard,
    },
    passportV2: { navLabel: t.passportV2.navLabel },
    experienceRewards: { title: t.experienceRewards.title },
    experienceInbox: { support: { home: { reportProblem: t.experienceInbox.support.home.reportProblem } } },
    /* Under its own key, not `roommates`, so the shell's import graph never
       reads (and the agent nav's slice never carries) the whole namespace. */
    roommatesEntry: { nav: t.roommates.entryX.nav, createDock: t.roommates.entryX.createDock, createDockSub: t.roommates.entryX.createDockSub },
    homeV2: Object.fromEntries(CREATE_KEYS.map((key) => [key, t.homeV2[key]])) as ShellDictionary["homeV2"],
  };
  cache.set(t, shell);
  return shell;
}
