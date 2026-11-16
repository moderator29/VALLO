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
  { href: "/admin/lookup", name: "Lookup", icon: "search", what: "Paste a reference, an id or an email and find the record. Each part of the answer asks for its own area, and a desk your access does not include is named as not searched.", who: "Each section by its own area" },
  { href: "/admin/escalations", name: "Escalations", icon: "alert-triangle", what: "Anything a colleague cannot or may not decide, sent to the people who can, with one owner and a response time. The Escalate button on every desk raises one. The count beside it is what is waiting on you.", who: "Everybody with console access" },
  { href: "/admin/overview", name: "COO overview", icon: "trending-up", what: "The COO's desk: escalations with the COO, staff access recommendations for the super admin, and the backlog across desks.", who: "The COO (Operations)" },
  { href: "/admin/my-desk", name: "My desk", icon: "user", what: "Your own page: who you are here, what needs you today, your tasks, announcements and your weekly report.", who: "Everybody with console access" },
  { href: "/admin/copilot", name: "Copilot", icon: "bot", what: "The AI copilot on a page of its own, with what it can do for you desk by desk. The same copilot opens from the round button on every desk.", who: "Everybody with console access" },
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
  { href: "/admin/arrangements", name: "Protected payments", icon: "shield-check", what: "Not in use yet: that rail is switched off today, so expect it to be empty. Every payment a licensed bank holds through the payment partner, with the partner's state beside Vallo's. The list only reads; on a payment's own page Finance can refund the payer, or release a disputed payment to the lister, with a reason. See chapter 19.", who: "Finance" },
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
  { href: "/admin/offers", name: "Offers and deals", icon: "scale", what: "Offers on homes for sale, from the first offer to the end of the deal: figures with their definitions, the deals table, and a note, a dispute flag or a cancellation on a deal. Vallo takes none of the money. See chapter 20.", who: "Agreement approval" },
  { href: "/admin/restaurant-fees", name: "Restaurant fees", icon: "receipt", what: "What each restaurant owes for seated tables, and the seatings a restaurant and a diner disagree about. It charges nobody.", who: "Operations" },
];

const SAFETY: Desk[] = [
  { href: "/admin/cases", name: "Cases", icon: "flag", what: "One case per thing reported, from every part of Vallo, with its timeline, evidence and deadline.", who: "Trust and Safety, Reports and moderation, Roommates, Circle, Support, Listing approval; each sees its own modules" },
  { href: "/admin/trust", name: "Trust overview", icon: "trending-up", what: "The numbers across cases and restrictions.", who: "Trust and Safety, Read-only analyst, Reports and moderation, Roommates, Circle" },
  { href: "/admin/appeals", name: "Appeals", icon: "scale", what: "A member's appeal against a restriction, decided by somebody other than whoever made the decision.", who: "Trust and Safety" },
  { href: "/admin/roommates", name: "Roommates", icon: "users", what: "Room posts, profiles, groups and their verification.", who: "Roommates moderation, Trust and Safety" },
  { href: "/admin/circle", name: "Circle", icon: "circle-people", what: "Communities: pause, remove or restore.", who: "Circle moderation, Reports and moderation, Trust and Safety" },
  { href: "/admin/social-media", name: "Social media", icon: "camera", what: "Vallo's own social media: the content calendar, drafts, campaigns, the media library and approvals. It never posts to a platform.", who: "Social media" },
  { href: "/admin/marketing", name: "Marketing", icon: "price-tag", what: "Campaigns and promotions with approval, tracked links, the numbers you log, acquisition and referral figures, briefs and the monthly report. It never connects to an ad platform.", who: "Marketing" },
  { href: "/admin/content", name: "Content", icon: "file-text", what: "Guides, announcements and articles through an approval step, the editorial calendar, requests, style and SEO checklists, translations and help gaps.", who: "Content" },
  { href: "/admin/blocked-terms", name: "Blocked terms", icon: "block", what: "The words the safety scan acts on.", who: "Reports and moderation" },
  { href: "/admin/social", name: "Around", icon: "compass", what: "Proposed neighbourhood areas and area moderator applications: open or refuse them, pause or resume an area.", who: "Admins" },
  { href: "/admin/standing", name: "Standing", icon: "star", what: "Badges granted and revoked by hand, each with a reason.", who: "Admins" },
  { href: "/admin/weight-withheld", name: "Withheld weight", icon: "scale", what: "Reviews and reports that do not count toward a rating, and clearing that mark.", who: "Admins" },
];

const SUPPORT: Desk[] = [
  { href: "/admin/support", name: "Support", icon: "headset", what: "Every member question and complaint, in lanes, ordered by how late it is.", who: "Support" },
  { href: "/admin/people", name: "People", icon: "user", what: "The person file: everything Vallo holds about one member, in one place. Open it first when a member rings in with no booking or listing to quote. Every opening is written to the audit log.", who: "Admins" },
  { href: "/admin/account-recovery", name: "Account recovery", icon: "key", what: "Moving an account to a new email address when its owner lost the old mailbox. Two super admins and a 72 hour wait.", who: "Admins open it; super admins move the address" },
  { href: "/admin/support-lead", name: "Support lead", icon: "headset", what: "The support team's load and who holds what, escalations, quality reviews and coaching, the support figures, and canned replies and policy notes with approval.", who: "Support lead" },
];

const OPERATIONS: Desk[] = [
  { href: "/admin/account-deletions", name: "Account deletions", icon: "user", what: "Why members delete their account: requests in 7, 30 or 90 days or all time, the reasons ranked with their share, the change on the period before, how many were restored within 30 days, and how many gave no reason. Counts and shares only; the free-text notes show to a super admin alone. Copy summary and Copy as CSV are on the page.", who: "Operations, Support lead, Marketing" },
  { href: "/admin/doc-feedback", name: "Pages that fail", icon: "file-search", what: "Which help pages members say did not help. Read only.", who: "Support" },
  { href: "/admin/operations", name: "Operations", icon: "settings-gear", what: "Scheduled jobs, notifications and the platform's health.", who: "Operations" },
  { href: "/admin/alerts", name: "Alerts", icon: "bell", what: "Risk and system alerts waiting on a person. Resolving one is an admin decision.", who: "Operations to read" },
  { href: "/admin/crashes", name: "Crash log", icon: "alert-triangle", what: "Vallo's own crash log across the apps, the website and the server: one row per distinct crash, newest first, with how often it happened, where, on which platform, and the top of its stack.", who: "Operations" },
  { href: "/admin/audit", name: "Audit log", icon: "history", what: "Every decision anybody made in the console. The CSV export is the Compliance area's.", who: "Admins (export: Compliance)" },
  { href: "/admin/oversight", name: "Team oversight", icon: "users", what: "Each queue's backlog and its oldest item, and each staff member's decisions over 30 days.", who: "Operations" },
  { href: "/admin/technical", name: "Technical", icon: "sliders", what: "Read-only platform health and error trends, the incident log, runbooks, release notes, expiry reminders and post-incident reviews. It shows no key or credential and changes no infrastructure.", who: "Technical" },
  { href: "/admin/operations/providers", name: "Provider checks", icon: "key", what: "Read-only checks of each outside provider the platform depends on. They run again on the live server every time the page opens.", who: "Operations" },
  { href: "/admin/call-usage", name: "Call usage", icon: "phone", what: "Video and audio calls in a date range, by state and kind: volume, connect rate, minutes, average length and setup time, and how many reconnected.", who: "Operations" },
  { href: "/admin/analytics", name: "Analytics", icon: "chart-bar", what: "Booking outcomes, supply over time and thin areas. Anything the platform does not record is marked as such, never drawn as a figure.", who: "Admins" },
  { href: "/admin/analytics/listings", name: "Listing analytics", icon: "eye", what: "Views, saves, enquiries and viewing requests over 7, 30 or 90 days, the conversion from a view to each, the top listings, and the figures by area and by lister.", who: "Read-only analyst" },
  { href: "/admin/front-door", name: "Front door", icon: "door", what: "How many visits reach each step of joining over 7 and 30 days, the step to step conversion by language, and confirmed sign-ups by invite code.", who: "Admins" },
  { href: "/admin/field-speed", name: "Field speed", icon: "bolt", what: "How fast the app is on the phones people use: page speed per route and connection over the last seven days, from one page view in ten on real phones. With no samples it says so rather than drawing a zero.", who: "Admins" },
];

const SETTINGS: Desk[] = [
  { href: "/admin/settings", name: "Settings", icon: "settings-gear", what: "The door to the console's own configuration: the Control room, Switches, Reference data, Examples, Staff, the Staff handbook, this manual and Help and support. It shows only the desks you can open, and reads nothing itself.", who: "Admins" },
  { href: "/admin/control", name: "Control room", icon: "sliders", what: "What is waiting on the super admin, which parts of the database are in place, how the main switches stand and which services are connected. It only reads.", who: "Super admin" },
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

const FINDING: DocTableRow[] = [
  { id: "rail", cells: { where: "The menu (an admin)", what: "On a wide screen the rail down the left lists every desk your access opens, in groups, with a count where work is waiting. On a phone the menu button at the top left opens the same full menu over the page, every group your access opens, each desk with its one line. A dot on the button means work is waiting. Choosing a desk, Escape or a tap outside closes it." } },
  { id: "staff", cells: { where: "The staff frame (a member of staff)", what: "My desk, Console, Handbook, Your role, Staff manual and Help and support, a button for each desk your access opens, and under them Everything your access opens: every desk your areas open, in the console's own groups. A desk you cannot open is not listed." } },
  { id: "search", cells: { where: "Search the console (an admin)", what: "Press Ctrl K, or Cmd K on a Mac, from anywhere. On a phone, press the search button in the bar; it opens full size. Type a desk's name and press Enter to go there, or paste a reference to look it up across the desks you may open, or search people or the Unified queue. It lists only desks your access opens, and it never acts on a record." } },
  { id: "escalate", cells: { where: "The Escalate button", what: "At the top of every admin page, for whatever you cannot or may not decide. See chapter 6." } },
  { id: "copilot", cells: { where: "The copilot button", what: "The round button at the corner of every desk, and Ask the AI copilot on the console's front page. See chapter 18." } },
];

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
    "A payment held by a licensed bank is built and switched off today. Its desk under Money is Protected payments, not in use until that rail is switched on.",
    "On a phone the menu button opens the whole menu, and Search the console finds a desk or a reference.",
  ],
  sections: [
    {
      id: "finding-your-way",
      title: "Finding your way: the menu, search and your phone",
      body: (
        <>
          <p>
            Everything below works the same on a computer and a phone. What you see depends on whether you are an admin
            or a member of staff.
          </p>
          <DocTable
            caption="The ways round the console"
            columns={[
              { key: "where", label: "Where" },
              { key: "what", label: "What it does" },
            ]}
            rows={FINDING}
          />
          <p>
            Every desk asks the database again when it opens, so typing the address of a desk you do not hold gets the
            same refusal as pressing a button you cannot see. The{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalate button
            </Link>{" "}
            and{" "}
            <Link href="/admin/manual/copilot" className={A}>
              the copilot
            </Link>{" "}
            have chapters of their own.
          </p>
        </>
      ),
    },
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
            Sales are never paid on Vallo. A refund goes back to the card or account that paid. A payment held by a
            licensed bank is built and switched off today: never describe it, a wallet or a balance to a member as
            something they can use. Vallo&apos;s own earnings and the daily sweep to Vallo&apos;s bank are for Finance and
            the super admin; see{" "}
            <Link href="/admin/manual/product-guide#the-money-in-full" className={A}>
              The money in full
            </Link>
            .
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
    {
      id: "take-care",
      title: "Desks that change things for everybody",
      body: (
        <>
          <ul role="list">
            <li>
              <strong>
                <Link href="/admin/switches" className={A}>
                  Switches
                </Link>
              </strong>{" "}
              turn a part of the product off or on for everybody at once. A switch can only take a part away, never break
              it: turning it back on restores it exactly as it was. Every change is written to the audit log with your
              name. Check the result straight after, and tell the team why.
            </li>
            <li>
              <strong>Record retention</strong> destroys data. Only a super admin can do it, after typing the confirmation
              against the count shown. See{" "}
              <Link href="/admin/manual/money#retention" className={A}>
                Money records past retention
              </Link>
              .
            </li>
            <li>
              <strong>Fee rates</strong> change what everybody is charged from the moment the new rate starts. See{" "}
              <Link href="/admin/manual/money#rates" className={A}>
                Changing a fee rate
              </Link>
              .
            </li>
            <li>
              <strong>Provider checks, Analytics and Field speed</strong> only read. A figure the platform does not record
              is marked as not recorded rather than drawn, so a gap on the page is a gap in what is recorded, not a zero.
            </li>
          </ul>
          <p>
            Anything this manual does not answer, ask with the{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalate button
            </Link>{" "}
            rather than guess.
          </p>
        </>
      ),
    },
  ],
};
