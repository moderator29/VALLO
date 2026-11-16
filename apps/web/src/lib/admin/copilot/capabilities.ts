import type { StaffScope } from "@/lib/admin/guard";

/**
 * WHAT THE COPILOT CAN DO, AND WHAT IT NEVER WILL, as plain data. Client-safe:
 * the full-page copilot draws it as the "What I can do for you" panel, the
 * desk sheets draw their starter chips from it, and the engine's system
 * prompt states the limits from the same list, so the screen and the rules
 * cannot say different things.
 */

/** The limits, stated plainly. Enforced in code: no tool exists for any of them. */
export const COPILOT_LIMITS: readonly string[] = [
  "I never move money: no refund, no payout, no transfer.",
  "I never restrict, suspend or ban a member.",
  "I never approve or reject a listing, an identity check, an agreement or an appeal.",
  "I never grant or revoke anyone's staff access. The COO can ask me to leave a recommendation for the super admin, and that is a note, not a change.",
  "I never delete or destroy a record.",
  "I never send a message to a member on my own. I can write a reply to a support ticket and show it to you word for word; it reaches the member only when you press Send on the card.",
  "For any of those I set out the facts, say what I would weigh, and link you to the exact item on the desk where you decide.",
  "Every change I suggest appears as a card first. Nothing happens until you press Confirm, and it is recorded in the audit log as made through the copilot.",
];

/**
 * What the copilot will not do, as the SUPER ADMIN reads it (16 November
 * 2026). Their copilot has hands for decisions, restrictions, switches,
 * staff access and booking refunds, each a card they press, so the staff
 * list above would be untrue to them.
 */
export const SUPER_ADMIN_COPILOT_LIMITS: readonly string[] = [
  "I never act on my own: every change is a card with a preview, and it happens only when you press it. The ones hard to take back ask you to type a word first.",
  "I never move money out: no payouts, no transfers, no company payments. Those need all three founders. A booking refund is a card you press, through the payment partner.",
  "I never delete or destroy a record.",
  "I never message a member on my own. A reply reaches them only when you press Send on the card.",
  "I propose a decision, a restriction, a switch or an access change only when you ask for it, and only on facts I have read, never a guess.",
  "Every change I make is recorded in the audit log as made through the copilot.",
];

export type DeskCapability = {
  key: string;
  desk: string;
  /** Any one of these opens the desk's tools. An empty list means every staff member. */
  scopes: readonly StaffScope[];
  /** Listed for the super admin alone, whatever scopes anybody else holds. */
  superAdminOnly?: true;
  href: string;
  can: readonly string[];
  prompts: readonly string[];
};

export const COPILOT_CAPABILITIES: readonly DeskCapability[] = [
  {
    key: "my-desk",
    desk: "My Desk",
    scopes: [],
    href: "/admin/my-desk",
    can: ["Read your tasks, overdue items and announcements", "Read the escalations waiting on you and the ones you raised, and say how to escalate", "Mark an escalation seen, add a note, ask the raiser, resolve, decline or reopen it, on a card you press", "Add a task to your own list or comment on one", "Answer how-to questions from the staff manual"],
    prompts: ["What needs me first today?", "What is waiting on me?", "How do I escalate this?", "Add a task to follow up on the oldest ticket tomorrow"],
  },
  {
    key: "listings",
    desk: "Listings",
    scopes: ["listing_approval"],
    href: "/admin/listings",
    can: ["Summarise the review queue and the oldest waiting listings", "Show the review facts and quality checks for one listing"],
    prompts: ["Summarise the oldest waiting listings", "Which listings have failed a quality check?"],
  },
  {
    key: "kyc",
    desk: "Verification",
    scopes: ["kyc_review"],
    href: "/admin/kyc",
    can: ["Count applicants and pending documents", "Show who has waited longest and which document kinds are pending (never the documents)"],
    prompts: ["Who has waited longest for verification?", "How many documents are pending?"],
  },
  {
    key: "moderation",
    desk: "Reports and moderation",
    scopes: ["moderation"],
    href: "/admin/queue",
    can: ["Count open reports by category and held content", "List the oldest open reports and held items", "Read open message flags and clear or escalate one, on a card you press"],
    prompts: ["What is older than 24 hours in moderation?", "Summarise the open reports by category"],
  },
  {
    key: "trust",
    desk: "Trust and Safety",
    scopes: ["trust_safety", "moderation", "roommates", "circle"],
    href: "/admin/cases",
    can: ["List cases by status, severity, module and overdue", "Read one case timeline", "Count appeals and read the trust overview", "Draft an internal case note for you to paste"],
    prompts: ["Which cases are overdue?", "Walk me through the newest critical case", "Draft a note for this case"],
  },
  {
    key: "support",
    desk: "Support",
    scopes: ["support"],
    href: "/admin/support",
    can: ["Count tickets by lane and past promised time", "Read a ticket thread", "Write a reply and show it to you word for word; it goes to the member when you press Send reply", "Resolve, reopen or close a ticket, on a card you press"],
    prompts: ["Draft a reply to the oldest ticket", "Which tickets are past their promised time?", "Summarise ticket threads waiting on us"],
  },
  {
    key: "agreements",
    desk: "Agreements",
    scopes: ["agreements"],
    href: "/admin/agreements",
    can: ["Count agreements waiting for review and show the oldest"],
    prompts: ["What is the oldest agreement waiting?", "How many agreements have a mandate attached?"],
  },
  {
    key: "finance",
    desk: "Money",
    scopes: ["finance"],
    href: "/admin/money",
    can: ["Read reconciliation health, tenancy charge counts, refund totals and chargebacks", "Show payments by outcome (counts and amounts only)"],
    prompts: ["Is reconciliation clean?", "Which chargebacks have evidence due soonest?", "How did payments do this week?"],
  },
  {
    key: "compliance",
    desk: "Compliance",
    scopes: ["compliance"],
    href: "/admin/compliance",
    can: ["Count cases, threshold reports and sanctions hits waiting (counts only)"],
    prompts: ["What is overdue in compliance?", "How many sanctions hits are waiting?"],
  },
  {
    key: "operations",
    desk: "Operations",
    scopes: ["operations"],
    href: "/admin/operations",
    can: ["Read open alerts, job health, visits and bookings", "Take an alert or resolve it with a note, on a card you press"],
    prompts: ["Any critical alerts open?", "Is any scheduled job stale?", "How many bookings are in stay now?"],
  },
  {
    key: "analytics",
    desk: "Analytics",
    scopes: ["analyst"],
    href: "/admin/analytics",
    can: ["Read the headline numbers: live listings, sign-ups, money collected, bookings"],
    prompts: ["Give me the headline numbers", "How do bookings compare with the last period?"],
  },
  {
    key: "bd",
    desk: "Business Development",
    scopes: ["business_development"],
    href: "/admin/business-development",
    can: ["Read the pipeline, KPI counts and follow-ups due", "Add a prospect or log a contact for your confirmation"],
    prompts: ["Which follow-ups are due this week?", "Add a prospect: a landlord in Lekki", "Summarise my pipeline"],
  },
  {
    key: "social",
    desk: "Social Media",
    scopes: ["social_media"],
    href: "/admin/social-media",
    can: ["Read the week grid, drafts and report counts", "Save a draft post for your confirmation (nothing is posted)"],
    prompts: ["What is on the calendar this week?", "Which posts are overdue?", "Draft a post for Friday"],
  },
  {
    key: "marketing",
    desk: "Marketing",
    scopes: ["marketing"],
    href: "/admin/marketing",
    can: ["Read campaigns, the campaign calendar, acquisition and referral performance (counts, never budgets or names)", "Build a tracked link", "Draft a creative brief or a report reading for you to add (nothing is saved)"],
    prompts: ["Which campaigns end this week?", "How did referrals do over the last eight weeks?", "Build a tracked link for the December push on Instagram"],
  },
  {
    key: "content",
    desk: "Content",
    scopes: ["content"],
    href: "/admin/content",
    can: ["Read the editorial calendar, requests, checklists, translation status and help gaps", "Read feed moderation as counts only", "Draft an article outline or a staff announcement for you to add (nothing is saved or posted)"],
    prompts: ["What is overdue on the calendar?", "Which help pages are failing members?", "Draft an outline for a help article on deposits"],
  },
  {
    key: "technical",
    desk: "Technical",
    scopes: ["technical"],
    href: "/admin/technical",
    can: ["Read platform health, error trends, the incident log, runbooks and expiry reminders (never a key or secret)", "Draft an incident update, status page text or a post-incident review for you to add (nothing is posted)"],
    prompts: ["Is anything late or failing today?", "How are errors trending this week?", "Draft a status page update for the open incident"],
  },
  {
    key: "support-lead",
    desk: "Support lead",
    scopes: ["support_lead"],
    href: "/admin/support-lead",
    can: ["Read team load, quality scores, the repeated-issue tracker and the policy library (counts and references only)", "Draft a canned reply, a coaching note or a policy note for you to add (nothing is saved)"],
    prompts: ["Who is holding the most open tickets?", "What are members writing about most?", "Draft a canned reply for deposit questions"],
  },
  {
    key: "platform",
    desk: "The platform",
    scopes: [],
    superAdminOnly: true,
    href: "/admin/control",
    can: [
      "Read the whole platform in one answer: members, listers, real and example listings, money taken in the last 7 and 30 days, what is waiting on every desk and how each switch stands",
      "Read the control room: what is waiting on you, which database files are still to run, and which services are connected",
      "Read who holds staff access, who has acknowledged the handbook, who has been active and which teams have nobody on them",
      "Read the audit trail in plain words: who did what and when, with the desk each record lives on",
      "Do what you do from the panel, on a card you press: approve, reject or send back a listing, an agent application or an identity check; release or remove held content; turn a switch on or off; restrict a member or lift it; grant or take away staff access; refund a booking. The ones hard to take back ask you to type a word first",
    ],
    prompts: ["What needs me today?", "What is waiting across the platform?", "What SQL still has to run?", "Who has access to what?", "What changed this week?"],
  },
  {
    key: "copilot-map",
    desk: "Finding your way",
    scopes: [],
    href: "/admin/copilot",
    can: ["Say which desk a piece of work is done on, from the console's own menu, and take you there", "Read your own position handbook back to you, section by section"],
    prompts: ["Where do I do this?", "What does my handbook say about this?"],
  },
  {
    key: "coo",
    desk: "COO desk",
    scopes: ["operations"],
    href: "/admin/overview",
    can: ["Read escalations, access recommendations and the cross-desk backlog", "Raise an escalation or leave an access recommendation for confirmation"],
    prompts: ["What is the biggest backlog across desks?", "List open escalations"],
  },
];

const STARTERS: Partial<Record<StaffScope, readonly string[]>> = {
  listing_approval: ["What needs me first today?", "Summarise the oldest waiting listings"],
  kyc_review: ["What needs me first today?", "Who has waited longest for verification?"],
  moderation: ["What needs me first today?", "What is older than 24 hours?"],
  support: ["What needs me first today?", "Summarise the oldest waiting tickets", "Reply to the oldest ticket"],
  agreements: ["What needs me first today?", "What is the oldest agreement waiting?"],
  finance: ["What needs me first today?", "Is reconciliation clean?", "Which chargebacks are due soonest?"],
  compliance: ["What needs me first today?", "What is overdue in compliance?"],
  operations: ["What needs me first today?", "Any critical alerts open?"],
  trust_safety: ["What needs me first today?", "Which cases are overdue?", "Summarise open appeals"],
  roommates: ["What needs me first today?", "How many verifications are waiting?"],
  circle: ["What needs me first today?", "Which communities need attention?"],
  analyst: ["Give me the headline numbers", "How are bookings doing?"],
  business_development: ["What needs me first today?", "Which follow-ups are due this week?", "Summarise my pipeline", "Draft a reply to a business asking why they should list", "What can I tell a prospect about fees?", "How do I tell a forged ID?"],
  social_media: ["What is on the calendar this week?", "Which posts are overdue?"],
  marketing: ["Which campaigns end this week?", "How did referrals do lately?"],
  content: ["What is overdue on the calendar?", "Which help pages are failing members?"],
  technical: ["Is anything late or failing today?", "How are errors trending?"],
  support_lead: ["Who is holding the most open tickets?", "What are members writing about most?"],
};

const GENERIC: readonly string[] = ["What needs me first today?", "What are my open tasks?", "Where do I go to do this?", "What does my handbook say?"];

/**
 * THE SUPER ADMIN'S OWN CHIPS (16 November 2026): the five questions the
 * founder actually asks, in their own words.
 */
export const SUPER_ADMIN_STARTERS: readonly string[] = [
  "What needs me today?",
  "What is waiting across the platform?",
  "What SQL still has to run?",
  "Who has access to what?",
  "What changed this week?",
  "What escalations are waiting on me?",
];

/** Starter chips for a desk. The super admin gets their own, whatever desk they are on. */
export function starterPromptsFor(scope: StaffScope | null, viewer?: { isSuperAdmin?: boolean }): string[] {
  if (viewer?.isSuperAdmin) return [...SUPER_ADMIN_STARTERS];
  return [...((scope && STARTERS[scope]) || GENERIC)];
}
