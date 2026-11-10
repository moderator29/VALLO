import Link from "next/link";
import type { ReactNode } from "react";
import { DocCallout } from "@/components/docs/DocCallout";
import { DocTable, type DocRow } from "@/components/docs/DocTable";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { CONTACT_EMAIL } from "@/lib/docs/contact";
import { JOB_DESCRIPTIONS, STAFF_POSITIONS } from "@/lib/admin/staff-positions";

/**
 * THE STAFF MANUAL (Agent DOCS, 11 November 2026): what each desk is for, who
 * gets in, how to work it, what a staff member may and may not decide alone,
 * and what is logged. It sits beside the handbook every staff member
 * acknowledges (`lib/admin/staff-handbook.ts`) and does not replace it: where
 * the two differ, the handbook is what staff agreed to.
 *
 * Every statement here was written from the desk's own source (its header
 * comment and the guard it calls). The `desks` list on each page is checked by
 * `lib/docs/coverage.test.ts` against the real routes, so a desk that is
 * renamed or removed fails the build here.
 *
 * Behind the console: `app/admin/handbook/manual/**` is inside the admin
 * layout, which decides access before anything renders. Nothing here is public.
 */

export type ManualPage = {
  slug: string;
  title: string;
  summary: string;
  icon: UiIconName;
  updated: string;
  /** The desks this page covers: the routes it explains. */
  desks: { href: string; label: string }[];
  glance: string[];
  sections: { id: string; heading: string; body: ReactNode }[];
};

const A = "font-semibold text-[var(--nf-content-link)] hover:underline";
const UPDATED = "2026-11-11";

const row = (head: ReactNode, who: string, decide: string, icon?: UiIconName): DocRow => ({
  head,
  ...(icon ? { icon } : {}),
  cells: { who, decide },
});

function DeskTable({ caption, rows }: { caption: string; rows: DocRow[] }) {
  return (
    <DocTable
      caption={caption}
      headLabel="Desk"
      columns={[
        { key: "who", label: "Who gets in" },
        { key: "decide", label: "What you do there" },
      ]}
      rows={rows}
    />
  );
}

/* ----------------------------------------------------------- the pages */

const DESKS_AND_ACCESS: ManualPage = {
  slug: "desks-and-access",
  title: "Desks, access and what is logged",
  summary: "How access works, what unlocks a desk, the roles, and why every action is on the record.",
  icon: "shield-lock",
  updated: UPDATED,
  desks: [
    { href: "/admin", label: "Console home" },
    { href: "/admin/handbook", label: "Staff handbook" },
    { href: "/admin/handbook/position", label: "Your role" },
    { href: "/admin/lookup", label: "Lookup" },
    { href: "/admin/staff", label: "Staff desk" },
    { href: "/admin/audit", label: "Audit log" },
    { href: "/admin/oversight", label: "Team oversight" },
    { href: "/admin/queue", label: "Queue" },
  ],
  glance: [
    "You see and act on only the desks named in your access. The database refuses the rest.",
    "A desk unlocks when you have acknowledged the current handbook and proved your security key in this session.",
    "Every decision is written to the audit log with your name, the time, the record and what changed. Nobody can edit the log.",
    "Only the super admin can grant or change access. You cannot grant it, including to yourself.",
  ],
  sections: [
    {
      id: "unlock",
      heading: "What unlocks a desk",
      body: (
        <ol>
          <li>
            Read and acknowledge the <Link href="/admin/handbook" className={A}>staff handbook</Link>. It is versioned: when
            it changes you are asked again before you can act.
          </li>
          <li>Prove your security key when the console asks. The key is asked again at the start of each session.</li>
          <li>Open a desk your access names. A desk you cannot open is closed; it does not exist as far as your account goes.</li>
        </ol>
      ),
    },
    {
      id: "roles",
      heading: "The roles",
      body: (
        <>
          <p>
            A super admin grants a position, which sets its default desks. Read your own on{" "}
            <Link href="/admin/handbook/position" className={A}>Your role</Link>. These are the positions as they are
            defined in the platform:
          </p>
          <DocTable
            caption="Staff positions and what each is for"
            headLabel="Position"
            columns={[{ key: "summary", label: "What the position is for" }]}
            rows={STAFF_POSITIONS.map((position) => ({
              head: JOB_DESCRIPTIONS[position].title,
              cells: { summary: JOB_DESCRIPTIONS[position].summary },
            }))}
          />
        </>
      ),
    },
    {
      id: "find",
      heading: "Finding a person, a booking or a reference",
      body: (
        <p>
          Press Ctrl K (Cmd K on a Mac) anywhere in the console and paste whatever the caller read out. The lookup
          searches every desk <em>you</em> may open and names the ones it skipped. For a member, open the person file: it
          gathers what the decision needs in one place instead of nine desks.
        </p>
      ),
    },
    {
      id: "logged",
      heading: "What is logged, and what a member sees",
      body: (
        <>
          <ul>
            <li>Every decision: who, when, the record, what changed. The log is append-only.</li>
            <li>
              A reason you write is read by the member exactly as you wrote it. Write it in plain words, without anything
              you would not want quoted.
            </li>
            <li>A member can see the outcome and your written reason. They cannot see your name or your internal notes.</li>
          </ul>
          <DocCallout kind="warning" title="Never move money, never ask for it">
            <p>
              Vallo never holds customer money: licensed payment partners process payments and hold escrow where it is switched on. Never ask for, accept
              or pass on money from anyone, and never move a conversation or a payment off the platform.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "escalate",
      heading: "When you are unsure",
      body: (
        <>
          <p>
            Do not guess. If you know the person in a case or have any interest in it, do not decide it: leave it for
            someone else and say why in the notes. If it needs a senior decision, escalate to the founder.
          </p>
          <DocCallout kind="note" title="Out of hours">
            <p>
              No out-of-hours rota is written into the platform. Until one is, raise anything urgent with the founder
              directly; the support promise on urgent tickets is four hours (see the support desk page).
            </p>
          </DocCallout>
        </>
      ),
    },
  ],
};

const IDENTITY: ManualPage = {
  slug: "identity-and-applications",
  title: "Identity checks and applications",
  summary: "Verification, agent and host applications, review calls, and moving an account whose owner lost their mailbox.",
  icon: "id-card",
  updated: UPDATED,
  desks: [
    { href: "/admin/kyc", label: "Verification" },
    { href: "/admin/kyc/guide", label: "Reviewer guide" },
    { href: "/admin/agents", label: "Agent applications" },
    { href: "/admin/businesses", label: "Host businesses" },
    { href: "/admin/review-calls", label: "Review calls" },
    { href: "/admin/account-recovery", label: "Account recovery" },
  ],
  glance: [
    "The verification queue is grouped by person, because a reviewer decides about a person, not a file.",
    "Renters and buyers are never asked for documents. Listers and people who get paid are.",
    "Approve an ID by typing the name as printed. That name becomes their confirmed identity.",
    "Account recovery has gates the database enforces: a national ID on file, a 72 hour wait, and a super admin who is not the account's owner.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Identity and application desks"
          rows={[
            row(<Link href="/admin/kyc" className={A}>Verification</Link>, "KYC review", "Check ID, selfie and proof of address, one person at a time.", "id-card"),
            row(<Link href="/admin/kyc/guide" className={A}>Reviewer guide</Link>, "KYC review, and admins", "What to look for on each document, the name rules and the words to use when sending something back.", "file-text"),
            row(<Link href="/admin/agents" className={A}>Agent applications</Link>, "The agents reviewers", "Decide an agent application with the whole six step form on one page.", "user-check"),
            row(<Link href="/admin/businesses" className={A}>Host businesses</Link>, "The hosts reviewers", "Read a host application, decide it, record the rungs and put the venue in front of guests.", "building-hotel"),
            row(<Link href="/admin/review-calls" className={A}>Review calls</Link>, "By case kind in your scope", "Calls arranged about a case you may see. A call outside your scope reads as not found.", "phone"),
            row(<Link href="/admin/account-recovery" className={A}>Account recovery</Link>, "Super admin", "Move an account to a new address when its owner lost the mailbox.", "lock"),
          ]}
        />
      ),
    },
    {
      id: "flow",
      heading: "The verification flow",
      body: (
        <>
          <p>
            Read the <Link href="/admin/kyc/guide" className={A}>reviewer guide</Link> before your first day: it is the
            full manual for this desk. In short, you confirm that the people who list and get paid on Vallo are who they
            say they are. Every decision is in the audit log with your name and the person is told the result in their
            notifications.
          </p>
          <ol>
            <li>Open the person. Identity at a glance shows the ID beside the selfie and the names to compare.</li>
            <li>Check the ID, then the selfie, against the checklists in the guide.</li>
            <li>Approve the ID by typing the name exactly as printed on it.</li>
            <li>Approve the selfie if it is the same person, live. Then check the proof of address.</li>
            <li>Anything you cannot accept, send back with a reason they can act on. They replace just that document.</li>
          </ol>
        </>
      ),
    },
    {
      id: "limits",
      heading: "What you may not do alone",
      body: (
        <ul>
          <li>Do not approve if the same ID number or face appears on another account. Report it.</li>
          <li>Do not contact a member outside Vallo.</li>
          <li>Account recovery is the super admin&apos;s alone, and the database enforces its gates whatever the page does.</li>
        </ul>
      ),
    },
  ],
};

const LISTINGS: ManualPage = {
  slug: "listings-and-supply",
  title: "Listings, supply and people",
  summary: "Reviewing listings, the supply picture, example listings and the person file.",
  icon: "stack",
  updated: UPDATED,
  desks: [
    { href: "/admin/listings", label: "Listings" },
    { href: "/admin/examples", label: "Example listings" },
    { href: "/admin/supply", label: "Supply" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/stops", label: "Stops" },
    { href: "/admin/reference", label: "Reference lists" },
  ],
  glance: [
    "The listings queue pages forty at a time. A row opens the listing under review.",
    "A decision comes first on the page, and the evidence is listed as rows, each opening its own page with a way back.",
    "Example listings are marked as examples and have their own screen, so they are not mixed into the review queue.",
    "The person file is the front door when a member rings in without a booking or a listing to quote.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Listing and supply desks"
          rows={[
            row(<Link href="/admin/listings" className={A}>Listings</Link>, "Listing approval", "Review the queue, with tabs, search and a date range. Approve, or send back with a reason.", "stack"),
            row(<Link href="/admin/examples" className={A}>Example listings</Link>, "Admins", "See the seeded example properties as a set, apart from the review queue.", "grid"),
            row(<Link href="/admin/supply" className={A}>Supply</Link>, "Admins", "Owners, agents and firms: who supplies Vallo and where.", "users"),
            row(<Link href="/admin/people" className={A}>People</Link>, "Admins", "Search any member and open the person file.", "user-check"),
            row(<Link href="/admin/stops" className={A}>Stops</Link>, "Admins", "Where a person or a listing has been stopped, and why.", "shield-stop"),
            row(<Link href="/admin/reference" className={A}>Reference lists</Link>, "Admins", "The platform's own vocabulary: occupations and local governments.", "clipboard-list"),
          ]}
        />
      ),
    },
    {
      id: "review",
      heading: "Reviewing a listing",
      body: (
        <ol>
          <li>Open the listing from the queue. The page leads with the decision.</li>
          <li>Open the evidence rows you need: photos, details, location, costs, the lister, the checklist, fee terms, matches and notes.</li>
          <li>Decide on the evidence in front of you: the photographs, the listing and the documents filed. Never on who the person says they are.</li>
          <li>Write the reason in plain words. The lister reads it as you wrote it.</li>
        </ol>
      ),
    },
    {
      id: "mandate",
      heading: "Agent and firm listings",
      body: (
        <p>
          An agent or firm listing goes live only once Vallo has confirmed the owner who instructed the lister. Check the
          mandate before you approve. A landlord replies on a single-use link and needs no account.
        </p>
      ),
    },
  ],
};

const AGREEMENTS: ManualPage = {
  slug: "agreements-and-bookings",
  title: "Agreements, bookings and visits",
  summary: "The gate between inspection and payment, stays and table requests, and the visits calendar.",
  icon: "file-check",
  updated: UPDATED,
  desks: [
    { href: "/admin/agreements", label: "Agreements" },
    { href: "/admin/agreements/settings", label: "Agreement risk settings" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/bookings/reservations", label: "Reservations" },
    { href: "/admin/bookings/visits", label: "Visits" },
  ],
  glance: [
    "An agreement reaches the queue only when the inspection report was submitted with its photos, or the host accepted the stay, and both parties confirmed the same version.",
    "Payment is not available to anybody until a reviewer approves the agreement.",
    "A paid stay can be cancelled, and the money returned, only on its booking page.",
    "Every decision is written to the audit log, and both parties are told by notification and email.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Agreement and booking desks"
          rows={[
            row(<Link href="/admin/agreements" className={A}>Agreements</Link>, "Agreement approval", "Approve or reject an agreement. A rejection needs a reason the parties will read.", "file-check"),
            row(<Link href="/admin/agreements/settings" className={A}>Agreement risk settings</Link>, "Agreements scope", "Change the risk settings behind the gate. Each change is validated and audited by the database.", "sliders"),
            row(<Link href="/admin/bookings" className={A}>Bookings</Link>, "Operations", "Every stay, with every figure checked. Open one to see what was paid and what is owed.", "calendar-booking"),
            row(<Link href="/admin/bookings/reservations" className={A}>Reservations</Link>, "Operations", "Restaurant requests nobody has answered, so a guest is not left waiting.", "utensils"),
            row(<Link href="/admin/bookings/visits" className={A}>Visits</Link>, "Operations", "Every inspection request as a week or month calendar. Read only.", "calendar-check"),
          ]}
        />
      ),
    },
    {
      id: "decide",
      heading: "Deciding an agreement",
      body: (
        <>
          <p>
            Decide on what was agreed and on the report and its photographs. If you or anyone close to you is a party,
            leave it for a colleague; the database already refuses a decision by a party to an agreement.
          </p>
          <p>
            Nothing on this desk takes or moves money. Approving opens payment for the parties; it does not make a payment.
          </p>
        </>
      ),
    },
    {
      id: "cancel",
      heading: "Cancelling a paid stay",
      body: (
        <p>
          The booking page is the only place on Vallo where a paid stay can be cancelled and the money returned.
          Everything you need to decide is on the page before the decision is offered: what was paid, what has been
          refunded, and the cancellation terms fixed on the booking. A refund goes back to the card or account the guest
          paid with.
        </p>
      ),
    },
  ],
};

const MONEY: ManualPage = {
  slug: "money-and-fees",
  title: "Money, fees and chargebacks",
  summary: "What the money desk watches, how rates change, and how a chargeback is worked.",
  icon: "banknote",
  updated: UPDATED,
  desks: [
    { href: "/admin/money", label: "Money" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/chargebacks", label: "Chargebacks" },
    { href: "/admin/fees", label: "Fees" },
    { href: "/admin/restaurant-fees", label: "Restaurant fees" },
    { href: "/admin/referrals", label: "Referrals" },
  ],
  glance: [
    "Vallo never holds customer money (licensed payment partners do), so there is no Vallo float to manage and no Vallo balance to chase.",
    "A rate change is a new dated row, never an edit, and cannot start in the past.",
    "Zero is drawn as No fee, never as a blank: a deliberate zero and a missing value mean different things.",
    "A chargeback is worked from opened to won, or to lost and recovered.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Money desks"
          rows={[
            row(<Link href="/admin/money" className={A}>Money</Link>, "Finance", "Watch cautions, refunds, the reconciliation job and move-in charges.", "banknote"),
            row(<Link href="/admin/payments" className={A}>Payments</Link>, "Finance", "Payment attempts, with their state and reference.", "credit-card"),
            row(<Link href="/admin/chargebacks" className={A}>Chargebacks</Link>, "Finance", "Every card payment a bank reversed, worked to its outcome.", "alert-triangle"),
            row(<Link href="/admin/fees" className={A}>Fees</Link>, "Admins", "See the rates in force and what has been earned. Change a rate by adding a new dated row.", "coins"),
            row(<Link href="/admin/restaurant-fees" className={A}>Restaurant fees</Link>, "Admins", "Seated tables and what is owed, per restaurant per month, and the disagreements to settle.", "utensils"),
            row(<Link href="/admin/referrals" className={A}>Referrals</Link>, "Admins", "What Vallo owes in rewards, the budget, the live campaign and the referrals and payouts waiting.", "gift"),
          ]}
        />
      ),
    },
    {
      id: "rules",
      heading: "The rules that do not bend",
      body: (
        <ul>
          <li>Never tell anyone Vallo is holding their money. A licensed payment partner holds payments; Vallo records them.</li>
          <li>Never ask for, accept or pass on money for any reason. There is no fee you may charge and no payment you may arrange.</li>
          <li>Vallo charges no inspection fee. If a member says they were asked for one, treat it as a report.</li>
          <li>On a purchase, Vallo takes no money at any stage. Never present the value of agreed offers as Vallo revenue.</li>
        </ul>
      ),
    },
    {
      id: "rates",
      heading: "Changing a rate",
      body: (
        <>
          <p>
            A rate change is an <strong>insert</strong>, never an edit, so the history is the whole story of what has ever
            been charged. A new rate can start now or in the future. It cannot start in the past, because back-dating one
            would make a fee already charged unexplainable.
          </p>
          <p>
            Read the fees page with the earned section beside it: a rate above zero with nothing earned next to it is a
            question to ask.
          </p>
        </>
      ),
    },
    {
      id: "chargebacks",
      heading: "Working a chargeback",
      body: (
        <p>
          Open the case from the chargebacks desk. It shows the payment and its history. Work it from opened through to
          won, or to lost and recovered, and record what you did. Only staff holding the finance scope are admitted.
        </p>
      ),
    },
  ],
};

const CASES: ManualPage = {
  slug: "cases-and-safety",
  title: "Cases, reports and safety",
  summary: "The case desk, appeals, alerts, standing, withheld weight and the community desks.",
  icon: "shield-check",
  updated: UPDATED,
  desks: [
    { href: "/admin/trust", label: "Trust and Safety overview" },
    { href: "/admin/cases", label: "Cases" },
    { href: "/admin/alerts", label: "Risk alerts" },
    { href: "/admin/appeals", label: "Appeals" },
    { href: "/admin/standing", label: "Standing" },
    { href: "/admin/weight-withheld", label: "Withheld weight" },
    { href: "/admin/blocked-terms", label: "Blocked terms" },
    { href: "/admin/circle", label: "Circle" },
    { href: "/admin/social", label: "Around" },
    { href: "/admin/roommates", label: "Roommates" },
  ],
  glance: [
    "The case desk gathers every module's reports about one thing into one case, escalated first, then new, then by severity and deadline.",
    "What you see is decided by the database from your scope, not by hiding rows on the page.",
    "An appeal is decided by Trust and Safety only, and never by the person who made the original decision.",
    "A reported item is read. A private thread beyond the reported item is not.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Trust and safety desks"
          rows={[
            row(<Link href="/admin/trust" className={A}>Overview</Link>, "Analysts and above", "See the work waiting, whether moderation is keeping up, and where trouble is coming from.", "chart-bar"),
            row(<Link href="/admin/cases" className={A}>Cases</Link>, "Moderation and Trust and Safety", "Work a case on one screen: what was reported, the reports, the timeline and the actions.", "clipboard-list"),
            row(<Link href="/admin/alerts" className={A}>Risk alerts</Link>, "Moderation", "Cases that outlive one flag. An alert stays open until someone says what was done.", "alert-triangle"),
            row(<Link href="/admin/appeals" className={A}>Appeals</Link>, "Trust and Safety", "Members asking us to look again. Oldest first.", "history"),
            row(<Link href="/admin/standing" className={A}>Standing</Link>, "Admins", "Badges a person grants rather than a trigger awards.", "verified-badge"),
            row(<Link href="/admin/weight-withheld" className={A}>Withheld weight</Link>, "Admins", "Reviews and reports that do not count because the author shares a contact detail with the lister.", "scale"),
            row(<Link href="/admin/blocked-terms" className={A}>Blocked terms</Link>, "Moderation", "Read, add and retire blocked terms.", "block"),
            row(<Link href="/admin/circle" className={A}>Circle</Link>, "Circle moderation", "Community health, and pause, remove or restore a community with a reason.", "circle-people"),
            row(<Link href="/admin/social" className={A}>Around</Link>, "Moderation", "Places people asked for, and the queues behind the feed.", "feed"),
            row(<Link href="/admin/roommates" className={A}>Roommates</Link>, "Roommates moderation", "Profiles and posts under the Trust and Safety layer.", "users"),
          ]}
        />
      ),
    },
    {
      id: "decide",
      heading: "Deciding a case",
      body: (
        <ol>
          <li>Open the case. Read what was reported, then the reports, then the timeline.</li>
          <li>Decide on the evidence in front of you: dismiss, act, or hold the content.</li>
          <li>Write the reason the reporter will read. Put anything a colleague needs in the internal notes, never in a message to the member.</li>
          <li>If you know the person or have any interest in it, leave it for someone else and say why in the notes.</li>
        </ol>
      ),
    },
    {
      id: "report-first",
      heading: "Patterns to report the same day",
      body: (
        <p>
          Requests for money off the platform, inspection fees and fake listings. Report them to your lead the same day. A
          report about being asked to pay outside Vallo runs on the four-hour promise published on the standards page.
        </p>
      ),
    },
  ],
};

const SUPPORT: ManualPage = {
  slug: "support-desk",
  title: "The support desk",
  summary: "A support agent's working day: tickets, replies, escalations and the promises Vallo makes.",
  icon: "headset",
  updated: UPDATED,
  desks: [{ href: "/admin/support", label: "Support" }],
  glance: [
    "The door is the support scope, with the handbook acknowledged and your security key proved this session.",
    "A reply is a staff message, and the database tells the member.",
    "A ticket about being asked to pay outside Vallo, or one escalated to money or safety, runs on a four hour promise. The rest run on a day.",
    "A ticket escalated to another desk can be opened by that desk through its link. They see that ticket and no queue.",
  ],
  sections: [
    {
      id: "day",
      heading: "Working the queue",
      body: (
        <ol>
          <li>Open the desk. Tickets are the ones members filed while signed in, or through the contact form, each with a VAL-SUP reference.</li>
          <li>Read the ticket and anything the member attached. The member can also have linked one of their own records to it.</li>
          <li>Reply in plain words. The member is notified and reads it in the conversation.</li>
          <li>Resolve what can be resolved. Route what cannot to the right desk with the escalation control.</li>
        </ol>
      ),
    },
    {
      id: "promises",
      heading: "The promises",
      body: (
        <p>
          The response times printed on the public{" "}
          <Link href="/standards" className={A}>standards page</Link> are the same numbers the console computes a due time
          from. If you are close to a due time, say so to your lead.
        </p>
      ),
    },
    {
      id: "documents-feedback",
      heading: "Feedback from the documentation",
      body: (
        <p>
          When a signed-in reader marks a documentation page as not helpful, it arrives here as an ordinary ticket whose
          first line is &quot;Documentation feedback&quot; and names the page. Treat it as a request to fix the page: pass the
          page and the note to whoever owns the documentation. The member also gets a reference.
        </p>
      ),
    },
    {
      id: "never",
      heading: "What you never do",
      body: (
        <ul>
          <li>Never ask for or pass on account numbers, and never move a conversation or a payment off the platform.</li>
          <li>Never tell a member Vallo is holding their money.</li>
          <li>Contact a member only inside Vallo, or on the contact address they gave the form.</li>
        </ul>
      ),
    },
  ],
};

const OFFERS: ManualPage = {
  slug: "offers-and-deals-desk",
  title: "The Offers and Deals desk",
  summary: "Overview figures with their definitions, the deals table, inspecting a deal, and the three things staff may do.",
  icon: "file-check",
  updated: UPDATED,
  desks: [{ href: "/admin/offers", label: "Offers and Deals" }],
  glance: [
    "It sits behind the same staff scope and the same security key as the agreements desk.",
    "Every figure shows its definition. There is no total of money, because Vallo does not receive the purchase price.",
    "Staff read terms, versions, activity and document states. They never see a buyer's identity data, a document's contents or private messages.",
    "Staff can add a note, flag or resolve a dispute, and cancel a deal. They cannot change a figure, a version or who agreed to what.",
  ],
  sections: [
    {
      id: "overview",
      heading: "The overview figures",
      body: (
        <DocTable
          caption="The overview figures and how each is defined"
          headLabel="Figure"
          columns={[{ key: "def", label: "Definition" }]}
          rows={[
            { head: "Submitted", cells: { def: "Offers sent in the window shown." } },
            { head: "New", cells: { def: "Open offers the seller has not acted on or opened since they arrived." } },
            { head: "Awaiting seller", cells: { def: "Open offers where the next move is the seller's." } },
            { head: "Negotiating", cells: { def: "Open offers with more than one version." } },
            { head: "Terms agreed", cells: { def: "Offers where both sides confirmed the same version. Not sales." } },
            { head: "Withdrawn", cells: { def: "Offers the buyer withdrew." } },
            { head: "Expired", cells: { def: "Offers that passed their stated expiry with no answer." } },
            { head: "Completed", cells: { def: "Deals where both sides recorded completion." } },
            { head: "Disputed", cells: { def: "Deals with a concern open in the cases desk." } },
          ]}
        />
      ),
    },
    {
      id: "table",
      heading: "The deals table",
      body: (
        <p>
          Filter by state, search by reference, property or person, and sort by what arrived, what moved or the figure.
          Press / to jump to search. It is read only. Every row opens the deal.
        </p>
      ),
    },
    {
      id: "inspect",
      heading: "Inspecting a deal",
      body: (
        <>
          <p>
            A deal page shows the terms, every version, the activity and the document states. You see whether the buyer is
            eligible, never their identity data.
          </p>
          <DocCallout kind="warning" title="Private messages and documents">
            <p>
              Document contents and private messages are reached only from the cases desk, under the Trust and Safety
              rules, with a written reason that is audited. Do not look for another way in.
            </p>
          </DocCallout>
        </>
      ),
    },
    {
      id: "intervene",
      heading: "Intervening",
      body: (
        <>
          <p>There are three things you can do, each with a written reason kept in the audit log with your name:</p>
          <ul>
            <li>Add a note.</li>
            <li>Flag a dispute, or resolve one. A dispute is handled through the cases desk.</li>
            <li>Cancel a deal, where you are allowed to.</li>
          </ul>
          <p>
            The console asks for your security key before accepting any of them. There is no control to change an amount,
            a version, or who agreed to what, on purpose: the record of what the two sides agreed must stay exactly as they
            agreed it.
          </p>
        </>
      ),
    },
    {
      id: "say",
      heading: "What you may say to a member",
      body: (
        <ul>
          <li>Terms agreed is not a sale.</li>
          <li>Vallo takes no money for a purchase, and does not verify title.</li>
          <li>Uploaded, under review and approved are different states. None of them is a check of title.</li>
        </ul>
      ),
    },
  ],
};

const OPERATIONS: ManualPage = {
  slug: "operations-and-tools",
  title: "Operations, compliance and tools",
  summary: "Scheduled jobs and providers, the crash log, speed, analytics, retention, settings and the AML desk.",
  icon: "settings-gear",
  updated: UPDATED,
  desks: [
    { href: "/admin/operations", label: "Operations" },
    { href: "/admin/operations/providers", label: "Provider checks" },
    { href: "/admin/crashes", label: "Crash log" },
    { href: "/admin/field-speed", label: "Field speed" },
    { href: "/admin/call-usage", label: "Call usage" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/front-door", label: "Front door" },
    { href: "/admin/retention", label: "Money record retention" },
    { href: "/admin/compliance", label: "Compliance" },
    { href: "/admin/switches", label: "Switches" },
    { href: "/admin/settings", label: "Settings" },
  ],
  glance: [
    "Operations shows whether scheduled jobs are running and clean, and the audit log and notifications.",
    "Provider checks re-run on the live server every time they are opened, and are for admins only.",
    "Analytics marks what the platform does not record, rather than drawing a figure it cannot stand behind.",
    "The compliance desk is the AML and counter-terrorist-financing checklist and is staff only.",
  ],
  sections: [
    {
      id: "desks",
      heading: "The desks",
      body: (
        <DeskTable
          caption="Operations and tools"
          rows={[
            row(<Link href="/admin/operations" className={A}>Operations</Link>, "Operations", "Scheduled job health, alerts, the audit log and notifications.", "settings-gear"),
            row(<Link href="/admin/operations/providers" className={A}>Provider checks</Link>, "Admins", "Read-only checks of every outside provider, run live.", "bolt"),
            row(<Link href="/admin/crashes" className={A}>Crash log</Link>, "Admins", "One row per distinct crash, newest first, with how often, where and on which platform.", "alert-triangle"),
            row(<Link href="/admin/field-speed" className={A}>Field speed</Link>, "Admins", "Real-user page speed per route and connection over seven days.", "trending-up"),
            row(<Link href="/admin/call-usage" className={A}>Call usage</Link>, "Operations", "Totals of calls in a window by state and kind, with the connect rate.", "phone"),
            row(<Link href="/admin/analytics" className={A}>Analytics</Link>, "Admins", "Booking outcomes, supply over time and thin areas.", "chart-bar"),
            row(<Link href="/admin/front-door" className={A}>Front door</Link>, "Admins", "How many visits reach each step of joining, and sign-ups by invite code.", "door"),
            row(<Link href="/admin/retention" className={A}>Money record retention</Link>, "Admins", "A careful tool that removes expired money records of purged accounts.", "history"),
            row(<Link href="/admin/compliance" className={A}>Compliance</Link>, "Compliance", "The AML and counter-terrorist-financing checklist.", "certificate"),
            row(<Link href="/admin/switches" className={A}>Switches</Link>, "Admins", "Feature switches. Each change is on the record.", "sliders"),
            row(<Link href="/admin/settings" className={A}>Settings</Link>, "Admins", "The console's own configuration, and the door to the desks behind it.", "settings-gear"),
          ]}
        />
      ),
    },
    {
      id: "care",
      heading: "Take care",
      body: (
        <ul>
          <li>The retention tool destroys data. It caps what one call touches, and the confirmation must match the number shown.</li>
          <li>A switch turns a feature off or on for everyone. Say why in the reason, and check the result.</li>
          <li>
            Contact for anything this manual does not answer: <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.
          </li>
        </ul>
      ),
    },
  ],
};

export const MANUAL_PAGES: readonly ManualPage[] = [
  DESKS_AND_ACCESS,
  IDENTITY,
  LISTINGS,
  AGREEMENTS,
  MONEY,
  CASES,
  SUPPORT,
  OFFERS,
  OPERATIONS,
];

export function manualBySlug(slug: string): ManualPage | undefined {
  return MANUAL_PAGES.find((page) => page.slug === slug);
}
