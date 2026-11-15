import type { Dictionary } from "@vallo/i18n/core";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { StaffScope } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
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
 *
 * EVERY ROW SAYS WHO IT IS FOR (15 November 2026). The founder's brief: "in
 * each admin desk make all things they have access to be in their nav". So
 * each destination carries the access areas that open it (`scopes`) and the
 * role it needs on top (`door`), and the frame draws a viewer only the rows
 * their own access opens: a staff member sees their desks and not rows that
 * lead nowhere for them, and the Staff desk and the Control room are the
 * super admin's alone. `canOpen` is the rule, `groupsFor` applies it, and
 * `nav-coverage.test.ts` fails when a row names no access or an area the
 * database does not have. Nothing here grants anything: the desk asks the
 * database again, every time.
 */
export type AdminNavKey = keyof Dictionary["admin"]["nav"];

/**
 * WHAT A ROW NEEDS BEYOND BEING STAFF (15 November 2026).
 *
 * "staff" is every person the console admits. "coo" is the super admin, the
 * Chief Operating Officer, or a staff member holding every one of that
 * position's access areas, which is the rule `requireCoo` itself applies.
 * "admin" and "super_admin" are the two roles.
 */
export type NavDoor = "staff" | "coo" | "admin" | "super_admin";

/** Who is reading the menu, as the console door answered for them. */
export type NavViewer = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** The access areas this person holds. Empty for an admin, who holds a role instead. */
  scopes: readonly StaffScope[];
  /** The named position, where they have one. Only the COO row reads it. */
  position?: string | null;
};

export type AdminDestination = {
  key: string;
  href: string;
  icon: AdminIcon;
  label: string;
  /**
   * The access areas any ONE of which opens this desk. Empty means every
   * member of staff the console admits, and then `door` says whether a role
   * is needed on top. Written on every row, and `nav-coverage.test.ts` fails
   * when one is missing or names an area the database does not have.
   *
   * This only decides what the menu DRAWS. Every desk asks the database again
   * (`requireAdmin(scope)`), so a hand-typed address is refused exactly as
   * before and a row drawn in error opens nothing.
   */
  scopes: readonly StaffScope[];
  /** The role needed on top of the areas. */
  door: NavDoor;
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
    key: "overview", scopes: [], door: "staff",
    href: "/admin",
    icon: glyph("home-solid"),
    label: "Overview",
    children: [
      /* My Desk (10 November 2026): the personal workspace every staff member
         and admin has, with its tasks and the announcements addressed to them. */
      { key: "my-desk", scopes: [], door: "staff", href: "/admin/my-desk", icon: ui("user"), label: "My desk" },
      { key: "my-tasks", scopes: [], door: "staff", href: "/admin/my-desk/tasks", icon: ui("clipboard-list"), label: "My tasks" },
      { key: "announcements", scopes: [], door: "staff", href: "/admin/my-desk/announcements", icon: ui("bell"), label: "Announcements" },
      /* The weekly report opens every Saturday; the reviewers' table of who has
         filed sits under Staff and Access. The copilot is on every desk and
         here as a full page. */
      { key: "weekly-report", scopes: [], door: "staff", href: "/admin/my-desk/weekly", icon: ui("calendar-check"), label: "Weekly report" },
      { key: "weekly-reports", scopes: [], door: "admin", href: "/admin/reports/weekly", icon: ui("file-search"), label: "Weekly reports" },
      { key: "copilot", scopes: [], door: "staff", href: "/admin/copilot", icon: ui("bot"), label: "Copilot" },
      {
        key: "queue", scopes: ["moderation", "listing_approval", "support", "kyc_review"], door: "staff",
        href: "/admin/queue",
        icon: ui("panel-left"),
        label: "Unified queue",
        /* V-88: reports, flags and held content are lanes of the queue now. */
        countKeys: ["reports", "flags", "moderation"],
        countLabel: "reports, flagged messages and held content waiting on a decision",
      },
      /* W8: the lookup box answered Control K and nothing else; it is a desk. */
      { key: "lookup", scopes: ["support", "trust_safety", "moderation", "kyc_review"], door: "staff", href: "/admin/lookup", icon: ui("search"), label: "Lookup" },
      /* The COO desk: escalations, staff access recommendations, and the
         real backlog across listings, moderation, support, agreements and
         operations. Open only to a super admin or a staff member holding
         every one of the COO's scopes (`requireCoo`), not a single scope,
         so it is not badged by any one desk's own count. */
      { key: "coo-overview", scopes: ["operations"], door: "coo", href: "/admin/overview", icon: ui("trending-up"), label: "COO overview" },
      /* Escalations (15 November 2026): what any member of staff could not or
         may not decide, sent to the team that can. The badge is what waits
         on the viewer (`staff_escalation_counts`), never a team's total. */
      {
        key: "escalations", scopes: [], door: "staff",
        href: "/admin/escalations",
        icon: ui("flag"),
        label: "Escalations",
        countKeys: ["escalations"],
        countLabel: "escalations waiting on you",
      },
    ],
  },
  {
    key: "listings", scopes: ["listing_approval"], door: "staff",
    href: "/admin/listings",
    icon: glyph("clipboard"),
    label: "Listings",
    countKeys: ["listings"],
    countLabel: "listings waiting on a review decision",
  },
  {
    key: "supply", scopes: ["listing_approval", "business_development"], door: "admin",
    href: "/admin/supply",
    icon: glyph("list-doc"),
    label: "Supply",
    children: [
      { key: "applications", scopes: ["kyc_review", "listing_approval"], door: "staff", href: "/admin/agents", icon: ui("user"), label: "Applications", countKeys: ["applications"], countLabel: "applications waiting on a decision" },
      { key: "businesses", scopes: ["kyc_review", "listing_approval", "business_development"], door: "staff", href: "/admin/businesses", icon: ui("building-hotel"), label: "Businesses" },
      { key: "stops", scopes: ["listing_approval", "trust_safety"], door: "staff", href: "/admin/stops", icon: ui("shield-stop"), label: "Stops" },
      /* Business development: landlords, agents, hotels, shortlet hosts and
         restaurants brought onto Vallo, and the pipeline that tracks them. */
      { key: "business-development", scopes: ["business_development"], door: "staff", href: "/admin/business-development", icon: ui("hand-coins"), label: "Business development" },
    ],
  },
  {
    key: "kyc", scopes: ["kyc_review"], door: "staff",
    href: "/admin/kyc",
    icon: glyph("check-square"),
    label: "Verification",
    countKeys: ["verification"],
    countLabel: "ID, selfie and address documents waiting on a decision",
    /* SCUML: the AML/CFT duties, one lane each. */
    children: [
      { key: "compliance", scopes: ["compliance"], door: "staff", href: "/admin/compliance", icon: glyph("shield-lock"), label: "Compliance" },
      /* VC1: staff review calls, reached from the case desks and from here. */
      { key: "review-calls", scopes: ["kyc_review", "trust_safety"], door: "staff", href: "/admin/review-calls", icon: ui("video"), label: "Review calls" },
    ],
  },
  {
    key: "money", scopes: ["finance"], door: "staff",
    href: "/admin/money",
    icon: glyph("naira-square"),
    label: "Money",
    /* Every money decision waiting on a person badges the Money row, so it is
       seen with the section closed: Guarantee claims, referrals, payouts and
       undecided chargebacks (13 October). */
    countKeys: ["claims", "referrals", "payouts", "chargebacks"],
    countLabel: "Guarantee claims, referrals, payouts and chargebacks waiting on a decision",
    children: [
      { key: "payments", scopes: ["finance"], door: "staff", href: "/admin/payments", icon: ui("wallet"), label: "Payments" },
      {
        key: "chargebacks", scopes: ["finance"], door: "staff",
        href: "/admin/chargebacks",
        icon: ui("credit-card"),
        label: "Chargebacks",
        countKeys: ["chargebacks"],
        countLabel: "chargebacks open, waiting on evidence or a decision",
      },
      /* BUILD 7.11: every protected payment with the provider's state beside Vallo's. Read-only. */
      { key: "arrangements", scopes: ["finance", "agreements"], door: "staff", href: "/admin/arrangements", icon: ui("shield-check"), label: "Protected payments" },
      { key: "fees", scopes: ["finance"], door: "staff", href: "/admin/fees", icon: ui("document"), label: "Fees" },
      /* The referral desk: rewards owed, the monthly budget, and the referrals and payouts a person has to decide. */
      {
        key: "referrals", scopes: ["finance"], door: "staff",
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
    key: "agreements", scopes: ["agreements", "guarantee"], door: "staff",
    href: "/admin/agreements",
    icon: glyph("shield-lock"),
    label: "Agreements",
    countKeys: ["agreements"],
    countLabel: "agreements waiting for review before payment opens",
    /* The review threshold, the signals and the incident switch. */
    children: [
      { key: "agreement-settings", scopes: ["agreements"], door: "staff", href: "/admin/agreements/settings", icon: ui("sliders"), label: "Risk settings" },
      /* Offers on properties for sale, from first offer to the end of the deal. */
      { key: "offers", scopes: ["agreements"], door: "staff", href: "/admin/offers", icon: ui("scale"), label: "Offers and deals" },
    ],
  },
  {
    key: "bookings", scopes: ["operations", "support"], door: "staff",
    href: "/admin/bookings",
    icon: ui("calendar-booking"),
    label: "Bookings",
    /* Visit ops: every inspection request as a week or month calendar. */
    children: [
      { key: "visits", scopes: ["operations"], door: "staff", href: "/admin/bookings/visits", icon: ui("calendar-check"), label: "Visits" },
      /* Restaurant reservations, and the fees a seated table owes. Both were
         reached only by the Control K box or a link inside another desk. */
      { key: "reservations", scopes: ["operations", "support"], door: "staff", href: "/admin/bookings/reservations", icon: ui("utensils"), label: "Reservations" },
      { key: "restaurant-fees", scopes: ["finance", "operations"], door: "staff", href: "/admin/restaurant-fees", icon: ui("receipt"), label: "Restaurant fees", countKeys: ["seatings"], countLabel: "seatings the restaurant and the diner disagree about" },
    ],
  },
  {
    /* V-88: Moderation keeps what is not a queue. Its three queues (message
       flags, reports, held content) are lanes of the unified queue. */
    key: "moderation", scopes: ["moderation", "circle"], door: "staff",
    href: "/admin/social",
    icon: glyph("moderation"),
    label: "Moderation",
    children: [
      { key: "social", scopes: ["moderation", "circle"], door: "staff", href: "/admin/social", icon: ui("compass"), label: "Around" },
      /* Vallo Roommates (8 November 2026): posts, profiles, checks, schools, matching. */
      /* Trust and Safety (8 November): one case per thing reported, from
         every module; the overview, appeals and the Circle desk beside it. */
      { key: "cases", scopes: ["trust_safety", "moderation"], door: "staff", href: "/admin/cases", icon: ui("flag"), label: "Cases" },
      { key: "trust", scopes: ["trust_safety", "analyst"], door: "staff", href: "/admin/trust", icon: ui("trending-up"), label: "Trust overview" },
      { key: "appeals", scopes: ["trust_safety"], door: "staff", href: "/admin/appeals", icon: ui("scale"), label: "Appeals" },
      { key: "roommates", scopes: ["roommates", "moderation"], door: "staff", href: "/admin/roommates", icon: ui("users"), label: "Roommates" },
      { key: "circle-desk", scopes: ["circle", "moderation"], door: "staff", href: "/admin/circle", icon: ui("circle-people"), label: "Circle" },
      /* The Social Media Manager position (10 November 2026): the content
         calendar, drafts, the media library and approvals. No platform API. */
      { key: "social-media", scopes: ["social_media"], door: "staff", href: "/admin/social-media", icon: ui("camera"), label: "Social media" },
      /* The staff roles of 10 November 2026: Marketing (campaigns), Content
         (the editorial calendar and approvals). Each is its own desk and scope. */
      { key: "marketing", scopes: ["marketing"], door: "staff", href: "/admin/marketing", icon: ui("price-tag"), label: "Marketing" },
      { key: "content", scopes: ["content"], door: "staff", href: "/admin/content", icon: ui("file-text"), label: "Content" },
      { key: "standing", scopes: ["trust_safety", "moderation"], door: "staff", href: "/admin/standing", icon: ui("star"), label: "Standing" },
      /* AR-11: the words the safety scan acts on. */
      { key: "blocked-terms", scopes: ["moderation"], door: "staff", href: "/admin/blocked-terms", icon: ui("block"), label: "Blocked terms" },
      /* V-58: reviews and reports that do not count, and clearing a stamp. */
      { key: "weight-withheld", scopes: ["moderation", "trust_safety"], door: "staff", href: "/admin/weight-withheld", icon: ui("scale"), label: "Withheld weight" },
    ],
  },
  {
    key: "tickets", scopes: ["support", "support_lead"], door: "staff",
    href: "/admin/support",
    icon: glyph("support"),
    label: "Support",
    countKeys: ["tickets"],
    countLabel: "support tickets open or pending",
    /* W8: People (the member file) and Account recovery had no way in but a
       typed address or a link from another desk. Both are support's work. */
    children: [
      { key: "people", scopes: ["support", "trust_safety"], door: "staff", href: "/admin/people", icon: ui("user"), label: "People" },
      { key: "account-recovery", scopes: ["support"], door: "staff", href: "/admin/account-recovery", icon: ui("key"), label: "Account recovery", countKeys: ["recovery"], countLabel: "email recoveries opened and not yet finished" },
      /* The docs upgrade: which help pages members say did not help. */
      { key: "doc-feedback", scopes: ["support", "content"], door: "staff", href: "/admin/doc-feedback", icon: ui("file-search"), label: "Pages that fail" },
      /* The Customer Support Lead: team workload, QA, support figures and policy notes. */
      { key: "support-lead", scopes: ["support_lead"], door: "staff", href: "/admin/support-lead", icon: ui("headset"), label: "Support lead" },
    ],
  },
  {
    key: "operations", scopes: ["operations"], door: "staff",
    href: "/admin/operations",
    icon: glyph("operations"),
    label: "Operations",
    countKeys: ["alerts"],
    countLabel: "alerts open, waiting on a person",
    children: [
      { key: "alerts", scopes: ["operations"], door: "staff", href: "/admin/alerts", icon: ui("bell"), label: "Alerts", countKeys: ["alerts"], countLabel: "alerts open, waiting on a person" },
      /* Vallo's own crash log: iPhone, Android, website and server (7 November 2026). */
      { key: "crashes", scopes: ["operations", "technical"], door: "staff", href: "/admin/crashes", icon: ui("alert-triangle"), label: "Crash log" },
      { key: "audit", scopes: ["operations"], door: "admin", href: "/admin/audit", icon: ui("history"), label: "Audit log" },
      { key: "oversight", scopes: ["operations"], door: "admin", href: "/admin/oversight", icon: ui("user"), label: "Team oversight" },
      /* The Technical Administrator's read-only health panel and incident log. */
      { key: "technical", scopes: ["technical", "operations"], door: "staff", href: "/admin/technical", icon: ui("sliders"), label: "Technical" },
      /* Read-only checks of each provider key (the protected-pay provider, LiveKit, Apple push, Termii) and the map tiles. */
      { key: "providers", scopes: ["operations", "technical"], door: "staff", href: "/admin/operations/providers", icon: ui("key"), label: "Provider checks" },
      /* Video and audio calls: volume, connect rate, minutes. */
      { key: "call-usage", scopes: ["operations", "technical", "analyst"], door: "staff", href: "/admin/call-usage", icon: ui("phone"), label: "Call usage" },
      /* Money records past their retention date, and the typed-confirmation tool. */
      { key: "retention", scopes: ["operations", "compliance"], door: "staff", href: "/admin/retention", icon: ui("archive"), label: "Record retention", countKeys: ["retention"], countLabel: "accounts whose money records are past retention" },
      /* Why members delete their account, as rates (Operations, Support lead, Marketing). */
      { key: "account-deletions", scopes: ["operations", "support_lead", "marketing"], door: "staff", href: "/admin/account-deletions", icon: ui("user"), label: "Account deletions" },
    ],
  },
  {
    key: "analytics", scopes: ["analyst"], door: "staff",
    href: "/admin/analytics",
    icon: glyph("bars"),
    label: "Analytics",
    /* A6: the first-party front door funnel and the invite codes (A5). */
    children: [
      { key: "front-door", scopes: ["analyst", "marketing"], door: "staff", href: "/admin/front-door", icon: ui("trending-up"), label: "Front door" },
      /* Listing stats: views, saves, enquiries and viewing requests by listing, area and lister. */
      { key: "listing-analytics", scopes: ["analyst"], door: "staff", href: "/admin/analytics/listings", icon: ui("eye"), label: "Listings" },
      /* V-80: how fast the app is on the phones people use. */
      { key: "field-speed", scopes: ["analyst", "technical"], door: "staff", href: "/admin/field-speed", icon: ui("bolt"), label: "Field speed" },
    ],
  },
];

export const ADMIN_SETTINGS: AdminDestination = {
  key: "settings", scopes: [], door: "admin",
  href: "/admin/settings",
  icon: ui("settings-gear"),
  label: "Settings",
  children: [
    /* The control room (15 November 2026): the super admin's own page (what
       is waiting, which database files are in, the main switches, the
       services set up). Marked `super_admin`, so the rail draws it for the
       super admin alone; the page refuses anybody else as well
       (`readControlRoom`), as the Staff desk does. */
    { key: "control", scopes: [], door: "super_admin", href: "/admin/control", icon: ui("sliders"), label: "Control room" },
    { key: "switches", scopes: [], door: "admin", href: "/admin/switches", icon: ui("key"), label: "Switches" },
    { key: "reference", scopes: [], door: "admin", href: "/admin/reference", icon: ui("grid"), label: "Reference data" },
    { key: "examples", scopes: [], door: "admin", href: "/admin/examples", icon: ui("building-apartment"), label: "Examples" },
    /* Track K: who holds staff access (super admin only) and the handbook. */
    { key: "staff", scopes: [], door: "super_admin", href: "/admin/staff", icon: ui("user"), label: "Staff" },
    { key: "handbook", scopes: [], door: "staff", href: "/admin/handbook", icon: ui("document"), label: "Staff handbook" },
    /* Section 10 of the docs upgrade: how each desk works, on the docs kit. */
    { key: "manual", scopes: [], door: "staff", href: "/admin/manual", icon: ui("clipboard-list"), label: "Staff manual" },
    { key: "help", scopes: [], door: "staff", href: "/settings/help", icon: ui("headset"), label: "Help and support" },
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

/**
 * THE RAIL'S GROUPING (founder brief, 10 November 2026): Overview, My Desk,
 * Staff and Access, Operations, Departments, Intelligence, Knowledge Centre
 * and Settings. Each group is an expandable category. The groups only
 * REGROUP the destinations above by key: no key or href is renamed, no desk
 * is removed, and every destination appears in exactly one group (a test
 * holds both). Departments carries named sections, one per department,
 * mapped onto the desks that exist.
 */
export type AdminGroupSection = { key: string; label: string | null; items: AdminDestination[] };
export type AdminGroup = { key: string; label: string; icon: AdminIcon; sections: AdminGroupSection[] };

const BY_KEY = new Map<string, AdminDestination>(
  [...ADMIN_PRIMARY, ADMIN_SETTINGS].flatMap((item) => [item, ...(item.children ?? [])]).map((item) => [item.key, item]),
);

function pick(...keys: string[]): AdminDestination[] {
  return keys.map((key) => {
    const found = BY_KEY.get(key);
    if (!found) throw new Error(`nav group names a destination that does not exist: ${key}`);
    return found;
  });
}

export const ADMIN_GROUPS: AdminGroup[] = [
  { key: "g-overview", label: "Overview", icon: glyph("home-solid"), sections: [{ key: "overview", label: null, items: pick("overview", "escalations", "queue", "lookup", "coo-overview") }] },
  { key: "g-my-desk", label: "My Desk", icon: ui("user"), sections: [{ key: "my-desk", label: null, items: pick("my-desk", "my-tasks", "announcements", "weekly-report", "copilot") }] },
  { key: "g-staff", label: "Staff and Access", icon: ui("users"), sections: [{ key: "staff", label: null, items: pick("staff", "oversight", "weekly-reports") }] },
  {
    key: "g-operations",
    label: "Operations",
    icon: glyph("operations"),
    sections: [
      {
        key: "operations",
        label: null,
        items: pick(
          "operations", "alerts", "crashes", "providers", "call-usage", "retention",
          "supply", "applications", "businesses", "stops",
          "bookings", "visits", "reservations", "restaurant-fees",
          "agreements", "agreement-settings",
        ),
      },
    ],
  },
  {
    key: "g-departments",
    label: "Departments",
    icon: ui("building-apartment"),
    sections: [
      { key: "business-development", label: "Business Development", items: pick("business-development") },
      { key: "social-media", label: "Social Media", items: pick("social-media") },
      { key: "marketing", label: "Marketing", items: pick("marketing") },
      { key: "content", label: "Content", items: pick("content") },
      { key: "technical", label: "Technical", items: pick("technical") },
      { key: "support", label: "Support", items: pick("tickets", "people", "account-recovery", "support-lead") },
      { key: "listing-verification", label: "Listing verification", items: pick("listings", "kyc", "review-calls") },
      {
        key: "trust-safety",
        label: "Trust and Safety",
        items: pick("social", "cases", "appeals", "roommates", "circle-desk", "standing", "blocked-terms", "weight-withheld"),
      },
      { key: "finance", label: "Finance", items: pick("money", "payments", "chargebacks", "arrangements", "offers", "fees", "referrals") },
      { key: "compliance", label: "Compliance", items: pick("compliance") },
    ],
  },
  { key: "g-intelligence", label: "Intelligence", icon: glyph("bars"), sections: [{ key: "intelligence", label: null, items: pick("analytics", "listing-analytics", "front-door", "field-speed", "trust", "account-deletions", "audit") }] },
  { key: "g-knowledge", label: "Knowledge Centre", icon: ui("document"), sections: [{ key: "knowledge", label: null, items: pick("handbook", "manual", "doc-feedback") }] },
  { key: "g-settings", label: "Settings", icon: ui("settings-gear"), sections: [{ key: "settings", label: null, items: pick("settings", "control", "switches", "reference", "examples", "help") }] },
];

/* -------------------------------------------------------------------------- */
/* WHO THE MENU IS DRAWN FOR (15 November 2026)                               */
/* -------------------------------------------------------------------------- */

/**
 * Can this viewer open this destination?
 *
 * The same four answers the doors themselves give: a super admin opens
 * everything; an admin opens everything but a super admin's own rows (Staff
 * and the Control room); the COO row wants the position, every one of its
 * access areas, or the super admin (`requireCoo`); a row with no areas is open
 * to every member of staff the console admits; and any other row wants one of
 * the areas it names.
 *
 * It decides what is DRAWN and nothing else. Every desk asks the database
 * again, so this can only hide a row, never open one.
 */
export function canOpen(item: AdminDestination, viewer: NavViewer): boolean {
  if (viewer.isSuperAdmin) return true;
  if (item.door === "super_admin") return false;
  if (item.door === "admin") return viewer.isAdmin;
  if (item.door === "coo") {
    if (viewer.isAdmin) return true;
    if (viewer.position === "coo") return true;
    return JOB_DESCRIPTIONS.coo.scopes.every((scope) => viewer.scopes.includes(scope));
  }
  if (viewer.isAdmin) return true;
  if (item.scopes.length === 0) return true;
  return item.scopes.some((scope) => viewer.scopes.includes(scope));
}

/** The rows of one group this viewer can open, in the group's own order. */
export function groupItemsFor(group: AdminGroup, viewer: NavViewer): AdminGroupSection[] {
  return group.sections
    .map((section) => ({ ...section, items: section.items.filter((item) => canOpen(item, viewer)) }))
    .filter((section) => section.items.length > 0);
}

/**
 * THE MENU THIS VIEWER SEES: the same groups in the same order, with the rows
 * their access does not open left out, and a group that has nothing left in it
 * dropped rather than drawn empty. Without a viewer the whole menu is drawn,
 * which is what a frame rendered on its own (a test, a preview) gets.
 */
export function groupsFor(viewer?: NavViewer): AdminGroup[] {
  if (!viewer) return ADMIN_GROUPS;
  return ADMIN_GROUPS.map((group) => ({ ...group, sections: groupItemsFor(group, viewer) })).filter(
    (group) => group.sections.length > 0,
  );
}

/** Every destination this viewer can open, in rail order, one per address. */
export function destinationsFor(viewer: NavViewer): AdminDestination[] {
  const out: AdminDestination[] = [];
  const seen = new Set<string>();
  for (const group of groupsFor(viewer)) {
    for (const item of groupItems(group)) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      out.push(item);
    }
  }
  return out;
}

/**
 * The pages the menu files under one desk, in the menu's own order. The desk's
 * own head draws them as buttons (`DeskLinks` in `panels.tsx`), so what is on
 * the desk and what is on the menu are the one list.
 */
export function childrenOf(key: string): AdminDestination[] {
  const parent = [...ADMIN_PRIMARY, ADMIN_SETTINGS].find((item) => item.key === key);
  return parent?.children ?? [];
}

/** One desk's own address, by its menu key. */
export function deskHref(key: string): string | undefined {
  return [...ADMIN_PRIMARY, ADMIN_SETTINGS].find((item) => item.key === key)?.href;
}

/** The destinations a group holds, in order. */
export function groupItems(group: AdminGroup): AdminDestination[] {
  return group.sections.flatMap((section) => section.items);
}

/** The group a path belongs to: the one holding the longest matching href. */
export function activeGroupKey(pathname: string): string | null {
  let best: { key: string; length: number } | null = null;
  for (const group of ADMIN_GROUPS) {
    for (const item of groupItems(group)) {
      if (isActiveHref(pathname, item.href) && (!best || item.href.length > best.length)) {
        best = { key: group.key, length: item.href.length };
      }
    }
  }
  return best?.key ?? null;
}

/** The single destination lit for a path: the longest matching href across every group. */
export function activeItemKey(pathname: string): string | null {
  let best: AdminDestination | null = null;
  for (const group of ADMIN_GROUPS) {
    for (const item of groupItems(group)) {
      if (isActiveHref(pathname, item.href) && (!best || item.href.length > best.href.length)) best = item;
    }
  }
  return best?.key ?? null;
}

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
