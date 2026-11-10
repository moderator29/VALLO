import type { Dictionary } from "@vallo/i18n/core";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { AdminGlyphName, AdminIcon } from "./AdminGlyph";

export type { AdminIcon };

/**
 * The console's map, in the order the governing renders draw it (5EAA44CB,
 * 01F7DFC7, 8E9602E2, C1D98B3C): Overview, Listings, Supply, Verification,
 * Money, Agreements, Bookings, Moderation, Support, Operations, Analytics, and
 * Settings on its own at the foot.
 *
 * The renders draw twelve rows. The console has more desks than that, and
 * none of them is dropped: every desk that is not one of the twelve is a
 * CHILD of the row it belongs to. A child is listed under its parent while
 * the operator is inside that section, it lights the parent while it is open,
 * and every child is also in the "All desks" list at the foot of the rail, so
 * no working desk is ever more than one click away.
 *
 * The words are English. The twelve names are the renders' own and the
 * dictionary's `admin.nav` shape predates them; a destination whose key the
 * dictionary does carry still reads the translated label first.
 */
export type AdminNavKey = keyof Dictionary["admin"]["nav"];

export type AdminDestination = {
  key: string;
  href: string;
  icon: AdminIcon;
  label: string;
  /**
   * The `getQueueCounts()` key whose figure this row carries as its badge:
   * work waiting on THIS desk, the same figure the desk itself shows.
   */
  countKeys?: readonly string[];
  /** What the badge counts, read out and shown as its tooltip ("3 flagged messages waiting"). */
  countLabel?: string;
  children?: AdminDestination[];
};

const ui = (name: UiIconName): AdminIcon => ({ tier: "ui", name });
const glyph = (name: AdminGlyphName): AdminIcon => ({ tier: "admin", name });

export const ADMIN_PRIMARY: AdminDestination[] = [
  {
    key: "overview",
    href: "/admin",
    icon: glyph("home-solid"),
    label: "Overview",
    children: [
      {
        key: "queue",
        href: "/admin/queue",
        icon: ui("panel-left"),
        label: "Unified queue",
        /* V-88: reports, flags and held content are lanes of the queue now. */
        countKeys: ["reports", "flags", "moderation"],
        countLabel: "reports, flagged messages and held content waiting on a decision",
      },
      /* W8: the lookup box answered Control K and nothing else; it is a desk. */
      { key: "lookup", href: "/admin/lookup", icon: ui("search"), label: "Lookup" },
    ],
  },
  {
    key: "listings",
    href: "/admin/listings",
    icon: glyph("clipboard"),
    label: "Listings",
    countKeys: ["listings"],
    countLabel: "listings waiting on a review decision",
  },
  {
    key: "supply",
    href: "/admin/supply",
    icon: glyph("list-doc"),
    label: "Supply",
    children: [
      { key: "applications", href: "/admin/agents", icon: ui("user"), label: "Applications", countKeys: ["applications"], countLabel: "applications waiting on a decision" },
      { key: "businesses", href: "/admin/businesses", icon: ui("building-hotel"), label: "Businesses" },
      { key: "stops", href: "/admin/stops", icon: ui("shield-stop"), label: "Stops" },
    ],
  },
  {
    key: "kyc",
    href: "/admin/kyc",
    icon: glyph("check-square"),
    label: "Verification",
    countKeys: ["verification"],
    countLabel: "ID, selfie and address documents waiting on a decision",
    /* SCUML: the AML/CFT duties, one lane each. */
    children: [
      { key: "compliance", href: "/admin/compliance", icon: glyph("shield-lock"), label: "Compliance" },
      /* VC1: staff review calls, reached from the case desks and from here. */
      { key: "review-calls", href: "/admin/review-calls", icon: ui("video"), label: "Review calls" },
    ],
  },
  {
    key: "money",
    href: "/admin/money",
    icon: glyph("naira-square"),
    label: "Money",
    /* Every money decision waiting on a person badges the Money row, so it is
       seen with the section closed: Guarantee claims, referrals, payouts and
       undecided chargebacks (13 October). */
    countKeys: ["claims", "referrals", "payouts", "chargebacks"],
    countLabel: "Guarantee claims, referrals, payouts and chargebacks waiting on a decision",
    children: [
      { key: "payments", href: "/admin/payments", icon: ui("wallet"), label: "Payments" },
      {
        key: "chargebacks",
        href: "/admin/chargebacks",
        icon: ui("credit-card"),
        label: "Chargebacks",
        countKeys: ["chargebacks"],
        countLabel: "chargebacks open, waiting on evidence or a decision",
      },
      { key: "fees", href: "/admin/fees", icon: ui("document"), label: "Fees" },
      /* The referral desk: rewards owed, the monthly budget, and the referrals and payouts a person has to decide. */
      {
        key: "referrals",
        href: "/admin/referrals",
        icon: ui("hand-coins"),
        label: "Referrals",
        countKeys: ["referrals", "payouts"],
        countLabel: "referrals and payouts waiting on a decision",
      },
    ],
  },
  /* TRACK A: the escrow desk is retired (Vallo holds no money). Its place is
     the review gate between an agreement and payment. */
  {
    key: "agreements",
    href: "/admin/agreements",
    icon: glyph("shield-lock"),
    label: "Agreements",
    countKeys: ["agreements"],
    countLabel: "agreements waiting for review before payment opens",
    /* The review threshold, the signals and the incident switch. */
    children: [{ key: "agreement-settings", href: "/admin/agreements/settings", icon: ui("sliders"), label: "Risk settings" }],
  },
  {
    key: "bookings",
    href: "/admin/bookings",
    icon: ui("calendar-booking"),
    label: "Bookings",
    /* Visit ops: every inspection request as a week or month calendar. */
    children: [
      { key: "visits", href: "/admin/bookings/visits", icon: ui("calendar-check"), label: "Visits" },
      /* Restaurant reservations, and the fees a seated table owes. Both were
         reached only by the Control K box or a link inside another desk. */
      { key: "reservations", href: "/admin/bookings/reservations", icon: ui("utensils"), label: "Reservations" },
      { key: "restaurant-fees", href: "/admin/restaurant-fees", icon: ui("receipt"), label: "Restaurant fees", countKeys: ["seatings"], countLabel: "seatings the restaurant and the diner disagree about" },
    ],
  },
  {
    /* V-88: Moderation keeps what is not a queue. Its three queues (message
       flags, reports, held content) are lanes of the unified queue. */
    key: "moderation",
    href: "/admin/social",
    icon: glyph("moderation"),
    label: "Moderation",
    children: [
      { key: "social", href: "/admin/social", icon: ui("compass"), label: "Around" },
      /* Vallo Roommates (8 November 2026): posts, profiles, checks, schools, matching. */
      /* Trust and Safety (8 November): one case per thing reported, from
         every module; the overview, appeals and the Circle desk beside it. */
      { key: "cases", href: "/admin/cases", icon: ui("flag"), label: "Cases" },
      { key: "trust", href: "/admin/trust", icon: ui("trending-up"), label: "Trust overview" },
      { key: "appeals", href: "/admin/appeals", icon: ui("scale"), label: "Appeals" },
      { key: "roommates", href: "/admin/roommates", icon: ui("users"), label: "Roommates" },
      { key: "circle-desk", href: "/admin/circle", icon: ui("circle-people"), label: "Circle" },
      { key: "standing", href: "/admin/standing", icon: ui("star"), label: "Standing" },
      /* AR-11: the words the safety scan acts on. */
      { key: "blocked-terms", href: "/admin/blocked-terms", icon: ui("block"), label: "Blocked terms" },
      /* V-58: reviews and reports that do not count, and clearing a stamp. */
      { key: "weight-withheld", href: "/admin/weight-withheld", icon: ui("scale"), label: "Withheld weight" },
    ],
  },
  {
    key: "tickets",
    href: "/admin/support",
    icon: glyph("support"),
    label: "Support",
    countKeys: ["tickets"],
    countLabel: "support tickets open or pending",
    /* W8: People (the member file) and Account recovery had no way in but a
       typed address or a link from another desk. Both are support's work. */
    children: [
      { key: "people", href: "/admin/people", icon: ui("user"), label: "People" },
      { key: "account-recovery", href: "/admin/account-recovery", icon: ui("key"), label: "Account recovery", countKeys: ["recovery"], countLabel: "email recoveries opened and not yet finished" },
    ],
  },
  {
    key: "operations",
    href: "/admin/operations",
    icon: glyph("operations"),
    label: "Operations",
    countKeys: ["alerts"],
    countLabel: "alerts open, waiting on a person",
    children: [
      { key: "alerts", href: "/admin/alerts", icon: ui("bell"), label: "Alerts", countKeys: ["alerts"], countLabel: "alerts open, waiting on a person" },
      /* Vallo's own crash log: iPhone, Android, website and server (7 November 2026). */
      { key: "crashes", href: "/admin/crashes", icon: ui("alert-triangle"), label: "Crash log" },
      { key: "audit", href: "/admin/audit", icon: ui("history"), label: "Audit log" },
      { key: "oversight", href: "/admin/oversight", icon: ui("user"), label: "Team oversight" },
      /* Read-only checks of each provider key (Payluk, LiveKit, Apple push, Termii) and the map tiles. */
      { key: "providers", href: "/admin/operations/providers", icon: ui("key"), label: "Provider checks" },
      /* Video and audio calls: volume, connect rate, minutes. */
      { key: "call-usage", href: "/admin/call-usage", icon: ui("phone"), label: "Call usage" },
      /* Money records past their retention date, and the typed-confirmation tool. */
      { key: "retention", href: "/admin/retention", icon: ui("archive"), label: "Record retention", countKeys: ["retention"], countLabel: "accounts whose money records are past retention" },
    ],
  },
  {
    key: "analytics",
    href: "/admin/analytics",
    icon: glyph("bars"),
    label: "Analytics",
    /* A6: the first-party front door funnel and the invite codes (A5). */
    children: [
      { key: "front-door", href: "/admin/front-door", icon: ui("trending-up"), label: "Front door" },
      /* V-80: how fast the app is on the phones people use. */
      { key: "field-speed", href: "/admin/field-speed", icon: ui("bolt"), label: "Field speed" },
    ],
  },
];

export const ADMIN_SETTINGS: AdminDestination = {
  key: "settings",
  href: "/admin/settings",
  icon: ui("settings-gear"),
  label: "Settings",
  children: [
    { key: "switches", href: "/admin/switches", icon: ui("key"), label: "Switches" },
    { key: "reference", href: "/admin/reference", icon: ui("grid"), label: "Reference data" },
    { key: "examples", href: "/admin/examples", icon: ui("building-apartment"), label: "Examples" },
    /* Track K: who holds staff access (super admin only) and the handbook. */
    { key: "staff", href: "/admin/staff", icon: ui("user"), label: "Staff" },
    { key: "handbook", href: "/admin/handbook", icon: ui("document"), label: "Staff handbook" },
    /* Section 10 of the docs upgrade: how each desk works, on the docs kit. */
    { key: "manual", href: "/admin/manual", icon: ui("clipboard-list"), label: "Staff manual" },
    { key: "help", href: "/settings/help", icon: ui("headset"), label: "Help and support" },
  ],
};

/** Every destination, parents first then their children, in rail order. */
export const ADMIN_NAV: AdminDestination[] = [...ADMIN_PRIMARY, ADMIN_SETTINGS].flatMap((item) => [
  item,
  ...(item.children ?? []),
]);

/** The desks that are not one of the twelve rows, for the "All desks" list. */
export const ADMIN_SECONDARY: AdminDestination[] = [...ADMIN_PRIMARY, ADMIN_SETTINGS].flatMap(
  (item) => item.children ?? [],
);

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A parent row is lit when it, or any of its children, is the open page. */
export function isSectionActive(pathname: string, item: AdminDestination): boolean {
  if (isActiveHref(pathname, item.href)) return true;
  return (item.children ?? []).some((child) => isActiveHref(pathname, child.href));
}

export function countFor(item: AdminDestination, counts: Record<string, number>): number {
  return (item.countKeys ?? []).reduce((total, key) => total + (counts[key] ?? 0), 0);
}

/** The destination the open page belongs to, child first. */
export function currentDestination(pathname: string): AdminDestination | undefined {
  const child = ADMIN_SECONDARY.find((item) => isActiveHref(pathname, item.href));
  if (child) return child;
  return [...ADMIN_PRIMARY, ADMIN_SETTINGS].find((item) => isSectionActive(pathname, item));
}

export type ShellCopy = Dictionary["admin"]["shell"];

/** A destination's name in the reader's language, English where none is written yet. */
export function labelFor(item: AdminDestination, shell?: ShellCopy): string {
  const fromDictionary = shell ? (shell.nav as Record<string, string | undefined>)[item.key] : undefined;
  return fromDictionary ?? item.label;
}

/** What a destination's badge counts, in the reader's language. */
export function countLabelFor(item: AdminDestination, shell?: ShellCopy): string {
  const key = item.countKeys?.[0];
  const fromDictionary = shell && key ? (shell.counts as Record<string, string | undefined>)[key] : undefined;
  return fromDictionary ?? item.countLabel ?? "waiting";
}
