import type { StaffScope } from "@/lib/admin/guard";

/**
 * EVERY DESK A POSITION CAN OPEN, KEYED BY ACCESS AREA (15 November 2026).
 *
 * A handbook does not list its desks by hand. It reads the position's own
 * scopes out of `JOB_DESCRIPTIONS` and prints the desks those scopes open, so
 * a handbook cannot describe access the position does not hold, and a scope
 * added to a position puts its desks in that person's handbook on the next
 * render.
 *
 * The facts are the staff manual's desk list (`app/admin/manual/_chapters/
 * desks.tsx`, chapter 2, read on 15 November 2026) and chapter 1's account of
 * what each access area opens. They are repeated here rather than imported
 * because that chapter is a table of every desk for every reader, and a
 * handbook needs one row per desk for ONE reader, with what that person does
 * there. Where the two ever disagree the desk itself is right: open it.
 *
 * Client-safe: data only. The `StaffScope` import is a type, so nothing of the
 * console door is pulled in.
 */

export type HandbookDesk = {
  href: string;
  name: string;
  /** What the desk is for, in one sentence. */
  what: string;
  /** What the person holding this area does there. */
  you: string;
};

/** The desks every person with console access opens, whatever their position. */
export const EVERY_STAFF_DESK: readonly HandbookDesk[] = [
  { href: "/admin", name: "Overview", what: "What is waiting on a person, and how the platform is doing.", you: "Read it when you arrive. A staff member sees their own desks here." },
  { href: "/admin/my-desk", name: "My desk", what: "Your own page: who you are here, what needs you today, your tasks and the announcements sent to you.", you: "Open it first thing. Make your own tasks, read announcements, and file your weekly report from its tab." },
  { href: "/admin/queue", name: "Unified queue", what: "Listings, applications, reports, support tickets, message flags and held content in one list, ordered by when each falls due.", you: "Work the tabs your access areas decide. Each tab shows only what you may decide." },
  { href: "/admin/lookup", name: "Lookup", what: "Paste a reference, an id or an email and find the record.", you: "Use it when a member gives you a reference. Each part of the answer asks for its own access area." },
  { href: "/admin/escalations", name: "Escalations", what: "Anything a colleague cannot or may not decide, sent to the people who can, with one owner and a response time.", you: "Raise one with the Escalate button at the top of any page, and answer the ones waiting on you." },
  { href: "/admin/copilot", name: "Copilot", what: "The console's assistant, as a full page as well as the button on every desk.", you: "Ask it how to do something, or what is waiting on you. It never decides anything for you." },
  { href: "/admin/handbook", name: "Staff handbook", what: "The rules every staff member acknowledges before a desk unlocks.", you: "Read it and acknowledge it. Your desks stay locked until you do." },
  { href: "/admin/manual", name: "Staff manual", what: "What each desk is for and how to work it, chapter by chapter.", you: "Read the chapters for your desks, and keep it open while you learn." },
];

/**
 * What each access area opens. A desk open to several areas appears under each
 * one, because a handbook is read by one person who holds one set of areas.
 */
export const SCOPE_DESKS: Record<StaffScope, readonly HandbookDesk[]> = {
  listing_approval: [
    { href: "/admin/listings", name: "Listings", what: "Every property before it goes live, and the owners' written mandates behind agent and firm listings.", you: "Read the whole listing, then approve, ask for more, or reject with a reason the lister reads." },
    { href: "/admin/queue?tab=listings", name: "Unified queue, Listings tab", what: "The same listings, ordered by when each falls due.", you: "Take the oldest row and work down. Late rows come first." },
    { href: "/admin/cases", name: "Cases, property", what: "One case per thing reported about a property.", you: "Read, note and act on property cases. Other modules stay closed to this area." },
    { href: "/admin/review-calls", name: "Review calls", what: "Video calls with the person behind a case.", you: "Hold a call on a listing where you need to see the person. A call records attendance and an outcome and decides nothing by itself." },
  ],
  kyc_review: [
    { href: "/admin/kyc", name: "Verification", what: "Identity documents and identity checks, one row per person, with the four-rung verification ladder.", you: "Open each document in the console's own viewer, then approve, refuse with a reason, or ask for a selfie with the ID." },
    { href: "/admin/kyc/guide", name: "Reviewer guide", what: "How to read a document and a check before you decide it.", you: "Read it before your first decision, and again whenever you are unsure." },
    { href: "/admin/agents", name: "Applications", what: "Agent, owner and firm applications.", you: "Approve, send back with a note, or refuse with a reason the applicant reads." },
    { href: "/admin/queue?tab=agents", name: "Unified queue, Agents tab", what: "The same applications, ordered by when each falls due.", you: "Work the oldest first." },
  ],
  moderation: [
    { href: "/admin/queue?tab=reports", name: "Unified queue, Reports tab", what: "What members reported, what the scanner flagged in messages, and content it held.", you: "Start review, then resolve or dismiss. A dismissal needs a reason, and you can write a separate line for the reporter." },
    { href: "/admin/cases", name: "Cases", what: "One case per thing reported, with its timeline, evidence and deadline.", you: "Assign it to yourself, note what you see, act on the content, and resolve it with an outcome." },
    { href: "/admin/blocked-terms", name: "Blocked terms", what: "The words the safety scan acts on.", you: "Read them, and propose a change to your lead when a word is catching the wrong thing." },
    { href: "/admin/circle", name: "Circle", what: "Communities: pause, remove or restore.", you: "Act on a community a case has found against." },
    { href: "/admin/trust", name: "Trust overview", what: "The numbers across cases and restrictions.", you: "Read it to see whether a pattern is growing." },
  ],
  support: [
    { href: "/admin/support", name: "Support", what: "Every member question and complaint, in lanes, ordered by how late it is.", you: "Take a ticket, reply, set its status honestly, and hand money, safety or identity questions to that desk." },
    { href: "/admin/queue?tab=tickets", name: "Unified queue, Tickets tab", what: "The same tickets beside the other work falling due.", you: "Use it when you want one list of everything waiting." },
    { href: "/admin/cases", name: "Cases, to read", what: "The case behind a report a member is asking about.", you: "Read, note, message the member and escalate. This area never acts on content." },
    { href: "/admin/doc-feedback", name: "Pages that fail", what: "Which help pages members say did not help.", you: "Read it and tell the Content Manager what members cannot find." },
  ],
  agreements: [
    { href: "/admin/agreements", name: "Agreements", what: "The review gate between an agreement and payment.", you: "Read the whole agreement, then approve it or send it back with a reason both parties read." },
    { href: "/admin/agreements/settings", name: "Risk settings", what: "The review threshold, the risk signals and the incident switch.", you: "Read them so you know why an agreement came to review. Change one only with your lead." },
  ],
  guarantee: [
    { href: "/admin/money", name: "Money, claims and cautions", what: "Caution rulings, and the record of claims made before the Vallo Guarantee was retired on 9 November 2026.", you: "Decide an old claim against the inspection report and the agreement, and record the payout reference once it is paid." },
  ],
  finance: [
    { href: "/admin/money", name: "Money", what: "Cautions, refunds to the card, the refund clock, the reconciliation job, and the record of the retired Vallo Guarantee.", you: "Read it daily. Chase every reconciliation difference until it is explained." },
    { href: "/admin/payments", name: "Payments", what: "Every payment attempt and how it ended.", you: "Read the outcomes and the amounts. The health panel and the saved card lookup are for admins." },
    { href: "/admin/chargebacks", name: "Chargebacks", what: "Disputes a payer raised with their bank.", you: "Open one, move it through its states and add notes. Each move is written down and the lister is told." },
    { href: "/admin/fees", name: "Fees", what: "The fee rates in force.", you: "Read them. Changing one is an admin decision, and raising one is a super admin's." },
    { href: "/admin/retention", name: "Record retention", what: "Money records past their retention date.", you: "Read the list. Only a super admin destroys a record, after typing the confirmation phrase." },
  ],
  compliance: [
    { href: "/admin/compliance", name: "Compliance", what: "Sanctions screening, reports to the NFIU, threshold reports, politically exposed persons and beneficial ownership.", you: "Work each lane. Every decision here needs a second member of staff, and nothing reaches the member." },
    { href: "/admin/audit", name: "Audit log export", what: "Every decision anybody made in the console, as a file.", you: "Export what a regulator asks for, and keep a record of what was sent and when." },
  ],
  operations: [
    { href: "/admin/operations", name: "Operations", what: "Scheduled jobs, notifications and the platform's health.", you: "Read it each morning and act on anything red." },
    { href: "/admin/alerts", name: "Alerts", what: "Risk and system alerts waiting on a person.", you: "Read them and act. Closing an alert is an admin decision." },
    { href: "/admin/bookings", name: "Bookings", what: "Every stay and hotel room booking.", you: "Find a booking that is stuck, late or disputed. Cancelling and refunding one is an admin decision on its own page." },
    { href: "/admin/bookings/visits", name: "Visits", what: "Every inspection request as a week or month calendar.", you: "Read it to see where viewings are piling up." },
    { href: "/admin/bookings/reservations", name: "Reservations", what: "Restaurant table requests waiting on the restaurant.", you: "Accept or decline on the restaurant's behalf where it cannot. The guest is told." },
    { href: "/admin/restaurant-fees", name: "Restaurant fees", what: "What each restaurant owes for seated tables, and the seatings a restaurant and a diner disagree about.", you: "Read it and settle the disagreements. It charges nobody." },
    { href: "/admin/crashes", name: "Crash log", what: "Vallo's own crash log across the apps, the website and the server.", you: "Read it when members report something broken." },
    { href: "/admin/call-usage", name: "Call usage", what: "Video and audio calls: volume, connect rate and minutes.", you: "Read it when calls are failing." },
    { href: "/admin/operations/providers", name: "Provider checks", what: "Read-only checks of each outside provider the platform depends on.", you: "Run a check when you suspect a provider rather than us." },
    { href: "/admin/oversight", name: "Team oversight", what: "Each queue's backlog and its oldest item, and each staff member's decisions over 30 days.", you: "Read it weekly and move people to where the queue is." },
  ],
  trust_safety: [
    { href: "/admin/cases", name: "Cases, every module", what: "Every case from every part of Vallo, with its timeline, evidence and deadline.", you: "Decide the cases your team cannot, and keep the standard the same across reviewers." },
    { href: "/admin/trust", name: "Trust overview", what: "The numbers across cases and restrictions.", you: "Read it weekly, and report what is growing." },
    { href: "/admin/appeals", name: "Appeals", what: "A member's appeal against a restriction.", you: "Decide it, as somebody other than whoever made the decision being appealed." },
    { href: "/admin/roommates", name: "Roommates", what: "Room posts, profiles, groups and their verification.", you: "Act on a Roommates case your team raised." },
    { href: "/admin/circle", name: "Circle", what: "Communities: pause, remove or restore.", you: "Act on a community a case has found against." },
  ],
  roommates: [
    { href: "/admin/roommates", name: "Roommates", what: "Room posts, profiles, groups and their verification.", you: "Review a post, a profile or a group, and decide its verification." },
    { href: "/admin/cases", name: "Cases, Roommates", what: "Cases raised in Roommates.", you: "Work them like any case. Identity documents stay with the verification desk." },
  ],
  circle: [
    { href: "/admin/circle", name: "Circle", what: "Communities: pause, remove or restore.", you: "Decide what happens to a community and its posts." },
    { href: "/admin/cases", name: "Cases, Circle and the feed", what: "Cases raised in Circle and in the feed.", you: "Work them like any case." },
  ],
  analyst: [
    { href: "/admin/trust", name: "Trust overview, numbers only", what: "The counts across cases and restrictions.", you: "Read the numbers. This area never opens what a case says." },
    { href: "/admin/search", name: "Search", what: "What people look for in VALLO Intelligence over 7 or 30 days, as counts, and the search aliases. Words show only once three different visits searched them.", you: "Read the figures. You can see the aliases but not change them." },
  ],
  business_development: [
    { href: "/admin/business-development", name: "Business development", what: "The landlords, agents, hotels and restaurants being brought onto Vallo, and the pipeline that tracks them.", you: "Add a prospect, log every contact, set the next follow-up date, and move a prospect through the stages." },
  ],
  social_media: [
    { href: "/admin/social-media", name: "Social media", what: "Vallo's own social media: the content calendar, drafts, campaigns, the media library and approvals.", you: "Plan the calendar, write the drafts, send them for approval, and record what you posted. The desk never posts to a platform." },
  ],
  marketing: [
    { href: "/admin/marketing", name: "Marketing", what: "Campaigns and promotions with approval, tracked links, the numbers you log, acquisition and referral figures, briefs and the monthly report.", you: "Plan each campaign, build its tracked link, send it for approval, and log its real numbers. The desk never connects to an advertising platform." },
    { href: "/admin/account-deletions", name: "Account deletions", what: "Why members delete their account, as counts and shares.", you: "Read the reasons ranked, to see what is driving people away. The free-text notes are for a super admin alone." },
    { href: "/admin/search", name: "Search", what: "What people look for in VALLO Intelligence over 7 or 30 days, as counts, and the aliases that teach search a spelling or a nickname. Words show only once three different visits searched them.", you: "Read what people search for and what found nothing. Add, change or switch off an alias; each change is written to the audit log with your name." },
  ],
  content: [
    { href: "/admin/content", name: "Content", what: "Guides, announcements and articles through an approval step, the editorial calendar, requests, style and search checklists, translations and help gaps.", you: "Keep the calendar, write and edit, send each item for approval, and record the link once it is published." },
    { href: "/admin/search", name: "Search", what: "What people look for in VALLO Intelligence over 7 or 30 days, as counts, and the aliases that teach search a spelling or a nickname. Words show only once three different visits searched them.", you: "Read what people search for and what found nothing. Add, change or switch off an alias; each change is written to the audit log with your name." },
  ],
  technical: [
    { href: "/admin/technical", name: "Technical", what: "Read-only platform health and error trends, the incident log, runbooks, release notes, expiry reminders and post-incident reviews.", you: "Read health every morning, declare and update incidents, and write the runbooks. It shows no key or credential and changes no infrastructure." },
  ],
  support_lead: [
    { href: "/admin/support-lead", name: "Support lead", what: "The support team's load and who holds what, escalations, quality reviews and coaching, the support figures, and saved replies and policy notes with approval.", you: "Read the load each day, work the escalation list, review a sample of answers, and write the policy notes the team answers from." },
    { href: "/admin/account-deletions", name: "Account deletions", what: "Why members delete their account, as counts and shares.", you: "Read it to see which support failures are costing accounts." },
  ],
};

/** The desks one position opens: the standing ones, then its areas', with no repeats. */
export function desksForScopes(scopes: readonly StaffScope[]): HandbookDesk[] {
  const out: HandbookDesk[] = [...EVERY_STAFF_DESK];
  const seen = new Set(out.map((desk) => desk.href));
  for (const scope of scopes) {
    for (const desk of SCOPE_DESKS[scope]) {
      if (seen.has(desk.href)) continue;
      seen.add(desk.href);
      out.push(desk);
    }
  }
  return out;
}
