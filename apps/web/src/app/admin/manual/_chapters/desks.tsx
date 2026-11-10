import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { A, ScreenshotSlot, type ManualBody } from "./parts";

/**
 * Chapter 2. Read from the rail (`app/admin/_components/nav.ts`), each desk's
 * page and the gate its reads and actions call (`requireAdmin(scope)`,
 * `requireConsole`, `private.case_can`). "Admins" means the desk's reads call
 * the gate with no access area, so only an admin or super admin opens it.
 */

type Desk = { href: string; name: string; icon: UiIconName; what: string; who: string };

function rows(desks: Desk[]): DocTableRow[] {
  return desks.map((d) => ({
    id: d.href,
    icon: d.icon,
    cells: {
      desk: (
        <Link href={d.href} className={A}>
          {d.name}
        </Link>
      ),
      what: d.what,
      who: d.who,
    },
  }));
}

const COLUMNS = [
  { key: "desk", label: "Desk" },
  { key: "what", label: "What it is for" },
  { key: "who", label: "Who opens it" },
];

const OVERVIEW: Desk[] = [
  { href: "/admin", name: "Overview", icon: "home", what: "What is waiting on a person and how the platform is doing. A staff member sees their own desks here.", who: "Everybody with console access" },
  { href: "/admin/queue", name: "Unified queue", icon: "panel-left", what: "Listings, applications, reports, support tickets, message flags and held content in one list, ordered by when each is due. Each tab shows only what your areas decide.", who: "Any queue area; each tab by its own area" },
  { href: "/admin/lookup", name: "Lookup", icon: "search", what: "Paste a reference, an id or an email and find the record. Each part of the answer asks for its own area.", who: "Each section by its own area" },
];

const REVIEW: Desk[] = [
  { href: "/admin/listings", name: "Listings", icon: "clipboard-list", what: "Every property before it goes live: approve, send back for changes, or reject. Also the owners' written mandates behind agent and firm listings.", who: "Listing approval" },
  { href: "/admin/kyc", name: "Verification", icon: "id-card", what: "Identity documents and identity checks, one row per person, with the four-rung verification ladder.", who: "KYC review" },
  { href: "/admin/kyc/guide", name: "Reviewer guide", icon: "file-text", what: "How to read a document and a check before you decide it.", who: "KYC review" },
  { href: "/admin/agents", name: "Applications", icon: "user", what: "Agent, owner and firm applications. Also reached through the Agents tab of the Unified queue.", who: "KYC review" },
  { href: "/admin/review-calls", name: "Review calls", icon: "video", what: "Video calls with the person behind a case. A call records attendance and an outcome; it verifies nothing by itself.", who: "The area of the case: KYC review, Listing approval or Support" },
  { href: "/admin/supply", name: "Supply", icon: "building-apartment", what: "Who supplies the platform: owners, agents, firms and hosts. It reads and decides nothing.", who: "Admins" },
  { href: "/admin/businesses", name: "Businesses", icon: "building-hotel", what: "Hotels and restaurants: the verification rungs and publishing.", who: "Admins" },
  { href: "/admin/stops", name: "Stops", icon: "shield-stop", what: "Stopping an agent from trading, and lifting a stop.", who: "Admins" },
  { href: "/admin/business-development", name: "Business development", icon: "hand-coins", what: "The landlords, agents, hotels and restaurants being brought onto Vallo, and the pipeline that tracks them.", who: "Business development" },
  { href: "/admin/compliance", name: "Compliance", icon: "shield-lock", what: "Sanctions screening, reports to the NFIU, threshold reports and politically exposed persons. Staff only: nothing here reaches the member.", who: "Compliance" },
];

const MONEY: Desk[] = [
  { href: "/admin/money", name: "Money", icon: "coins", what: "Cautions, refunds to the card, the refund clock, the reconciliation job, and the record of the retired Vallo Guarantee.", who: "Finance (rulings on cautions and old claims: Guarantee claims)" },
  { href: "/admin/payments", name: "Payments", icon: "wallet", what: "Every payment attempt and how it ended. The health panel and the saved card lookup are admins only.", who: "Finance" },
  { href: "/admin/arrangements", name: "Arrangements", icon: "shield-check", what: "Every payment on the bank-held rail, with the provider's state beside Vallo's. Read only. That rail is switched off, so expect it to be empty.", who: "Finance" },
  { href: "/admin/chargebacks", name: "Chargebacks", icon: "credit-card", what: "Disputes a payer raised with their bank: open, move through their states, add notes.", who: "Finance" },
  { href: "/admin/fees", name: "Fees", icon: "receipt", what: "The fee rates in force. Lowering a rate is any admin; raising one is a super admin.", who: "Finance to read; admins to change" },
  { href: "/admin/referrals", name: "Referrals", icon: "hand-coins", what: "Referral rewards owed, the monthly budget, and the referrals and payouts a person decides.", who: "Admins" },
  { href: "/admin/retention", name: "Record retention", icon: "archive", what: "Money records past their retention date, and the typed-confirmation tool that destroys them.", who: "Finance to read; a super admin to destroy" },
];

const DEALS: Desk[] = [
  { href: "/admin/agreements", name: "Agreements", icon: "file-check", what: "The review gate between an agreement and payment. Approve, or send back with a reason both parties read.", who: "Agreement approval (claims: Guarantee claims)" },
  { href: "/admin/agreements/settings", name: "Risk settings", icon: "sliders", what: "The review threshold, the risk signals and the incident switch.", who: "Agreement approval" },
  { href: "/admin/bookings", name: "Bookings", icon: "calendar-booking", what: "Every stay and hotel room booking. Cancelling and refunding a stay is done on its own page, by an admin.", who: "Operations" },
  { href: "/admin/bookings/visits", name: "Visits", icon: "calendar-check", what: "Every inspection request as a week or month calendar. Read only.", who: "Operations" },
  { href: "/admin/bookings/reservations", name: "Reservations", icon: "utensils", what: "Restaurant table requests waiting on the restaurant.", who: "Operations" },
  { href: "/admin/restaurant-fees", name: "Restaurant fees", icon: "receipt", what: "What each restaurant owes for seated tables, and the seatings a restaurant and a diner disagree about. It charges nobody.", who: "Operations" },
];

const SAFETY: Desk[] = [
  { href: "/admin/cases", name: "Cases", icon: "flag", what: "One case per thing reported, from every part of Vallo, with its timeline, evidence and deadline.", who: "Trust and Safety, Reports and moderation, Roommates, Circle, Support, Listing approval; each sees its own modules" },
  { href: "/admin/trust", name: "Trust overview", icon: "trending-up", what: "The numbers across cases and restrictions.", who: "Trust and Safety, Read-only analyst, Reports and moderation, Roommates, Circle" },
  { href: "/admin/appeals", name: "Appeals", icon: "scale", what: "A member's appeal against a restriction, decided by somebody other than whoever made the decision.", who: "Trust and Safety" },
  { href: "/admin/roommates", name: "Roommates", icon: "users", what: "Room posts, profiles, groups and their verification.", who: "Roommates moderation, Trust and Safety" },
  { href: "/admin/circle", name: "Circle", icon: "circle-people", what: "Communities: pause, remove or restore.", who: "Circle moderation, Reports and moderation, Trust and Safety" },
  { href: "/admin/social-media", name: "Social media", icon: "camera", what: "Vallo's own social media: the content calendar, drafts, campaigns, the media library and approvals. It never posts to a platform.", who: "Social media" },
  { href: "/admin/blocked-terms", name: "Blocked terms", icon: "block", what: "The words the safety scan acts on.", who: "Reports and moderation" },
  { href: "/admin/social", name: "Around", icon: "compass", what: "Proposed neighbourhood areas and area moderator applications: open or refuse them, pause or resume an area.", who: "Admins" },
  { href: "/admin/standing", name: "Standing", icon: "star", what: "Badges granted and revoked by hand, each with a reason.", who: "Admins" },
  { href: "/admin/weight-withheld", name: "Withheld weight", icon: "scale", what: "Reviews and reports that do not count toward a rating, and clearing that mark.", who: "Admins" },
];

const SUPPORT: Desk[] = [
  { href: "/admin/support", name: "Support", icon: "headset", what: "Every member question and complaint, in lanes, ordered by how late it is.", who: "Support" },
  { href: "/admin/people", name: "People", icon: "user", what: "The person file: everything Vallo holds about one member. Every opening is written to the audit log.", who: "Admins" },
  { href: "/admin/account-recovery", name: "Account recovery", icon: "key", what: "Moving an account to a new email address when its owner lost the old mailbox. Two super admins and a 72 hour wait.", who: "Admins open it; super admins move the address" },
];

const OPERATIONS: Desk[] = [
  { href: "/admin/doc-feedback", name: "Pages that fail", icon: "file-search", what: "Which help pages members say did not help. Read only.", who: "Support" },
  { href: "/admin/operations", name: "Operations", icon: "settings-gear", what: "Scheduled jobs, notifications and the platform's health.", who: "Operations" },
  { href: "/admin/alerts", name: "Alerts", icon: "bell", what: "Risk and system alerts waiting on a person. Resolving one is an admin decision.", who: "Operations to read" },
  { href: "/admin/crashes", name: "Crash log", icon: "alert-triangle", what: "Vallo's own crash log across the apps, the website and the server.", who: "Operations" },
  { href: "/admin/audit", name: "Audit log", icon: "history", what: "Every decision anybody made in the console. The CSV export is the Compliance area's.", who: "Admins (export: Compliance)" },
  { href: "/admin/oversight", name: "Team oversight", icon: "users", what: "Each queue's backlog and its oldest item, and each staff member's decisions over 30 days.", who: "Operations" },
  { href: "/admin/operations/providers", name: "Provider checks", icon: "key", what: "Read-only checks of each outside provider the platform depends on.", who: "Operations" },
  { href: "/admin/call-usage", name: "Call usage", icon: "phone", what: "Video and audio calls: volume, connect rate and minutes.", who: "Operations" },
  { href: "/admin/analytics", name: "Analytics", icon: "chart-bar", what: "Bookings, supply and demand over time.", who: "Admins" },
  { href: "/admin/front-door", name: "Front door", icon: "door", what: "How people arrive and sign up.", who: "Admins" },
  { href: "/admin/field-speed", name: "Field speed", icon: "bolt", what: "How fast the app is on the phones people use.", who: "Admins" },
];

const SETTINGS: Desk[] = [
  { href: "/admin/switches", name: "Switches", icon: "sliders", what: "Turning a feature on or off for everybody.", who: "Admins" },
  { href: "/admin/reference", name: "Reference data", icon: "grid", what: "The lists the product picks from: occupations, local governments.", who: "Admins" },
  { href: "/admin/examples", name: "Examples", icon: "building-apartment", what: "The example listings that show the product before real supply. They are never counted as real supply.", who: "Admins" },
  { href: "/admin/staff", name: "Staff", icon: "user-check", what: "Who holds console access, their keys, and the Support team panel.", who: "Admins read; the founder's super admin grants" },
  { href: "/admin/handbook", name: "Staff handbook", icon: "file-text", what: "The rules every staff member acknowledges before a desk unlocks.", who: "Everybody with console access" },
  { href: "/admin/manual", name: "Staff manual", icon: "clipboard-list", what: "This manual.", who: "Everybody with console access" },
];

function DeskTable({ caption, desks }: { caption: string; desks: Desk[] }) {
  return <DocTable caption={caption} columns={COLUMNS} rows={rows(desks)} />;
}

export const DESKS: ManualBody = {
  intro: (
    <p>
      The console is a set of desks, each for one kind of work. This chapter lists every desk on the rail, what it is for,
      and which access area opens it. A staff member sees buttons only for the desks their areas open.
    </p>
  ),
  glance: [
    "A desk that asks for no access area is open to admins and super admins only.",
    "Where a desk is open to several areas, each person sees only the part their area allows, and the database decides it.",
    "The decision controls live on each desk. The Unified queue routes you there and can take an item or decide in bulk through the same controls.",
    "Escrow is not offered on Vallo and there is no escrow desk.",
  ],
  sections: [
    {
      id: "overview",
      title: "Overview, the queue and lookup",
      body: (
        <>
          <DeskTable caption="Overview desks" desks={OVERVIEW} />
          <ScreenshotSlot desk="the Unified queue" />
        </>
      ),
    },
    {
      id: "review",
      title: "Review, supply and compliance",
      body: <DeskTable caption="Review, supply and compliance desks" desks={REVIEW} />,
    },
    {
      id: "money",
      title: "Money",
      body: (
        <>
          <DeskTable caption="Money desks" desks={MONEY} />
          <DocCallout tone="note" title="What is true about money today">
            Vallo never holds customer money. Stays and hotel rooms pay by card through Paystack, and the
            lister&apos;s share goes to their bank in the same transaction. A restaurant table is free to book. Payment for rentals is not open on Vallo.
            Sales are never paid on Vallo. A refund goes back to the card or account that paid. Never describe a wallet,
            a balance or escrow to anybody.
          </DocCallout>
        </>
      ),
    },
    {
      id: "deals",
      title: "Agreements and bookings",
      body: <DeskTable caption="Agreement and booking desks" desks={DEALS} />,
    },
    {
      id: "safety",
      title: "Moderation, and Trust and Safety",
      body: <DeskTable caption="Moderation and Trust and Safety desks" desks={SAFETY} />,
    },
    {
      id: "support",
      title: "Support and people",
      body: <DeskTable caption="Support desks" desks={SUPPORT} />,
    },
    {
      id: "operations",
      title: "Operations and analytics",
      body: <DeskTable caption="Operations and analytics desks" desks={OPERATIONS} />,
    },
    {
      id: "settings",
      title: "Settings",
      body: <DeskTable caption="Settings desks" desks={SETTINGS} />,
    },
  ],
};
