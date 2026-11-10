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
  "I never send a message to a member. I can draft a reply for you to read, change and send yourself.",
  "For any of those I set out the facts, say what I would weigh, and link you to the exact item on the desk where you decide.",
  "Every change I suggest appears as a card first. Nothing happens until you press Confirm, and it is recorded in the audit log as made through the copilot.",
];

export type DeskCapability = {
  key: string;
  desk: string;
  /** Any one of these opens the desk's tools. An empty list means every staff member. */
  scopes: readonly StaffScope[];
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
    can: ["Read your tasks, overdue items and announcements", "Add a task to your own list or comment on one", "Answer how-to questions from the staff manual"],
    prompts: ["What needs me first today?", "Add a task to follow up on the oldest ticket tomorrow", "Where do I take something I cannot decide?"],
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
    can: ["Count open reports by category and held content", "List the oldest open reports and held items"],
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
    can: ["Count tickets by lane and past promised time", "Read a ticket thread", "Draft a reply for you to edit and send"],
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
    can: ["Read open alerts, job health, visits and bookings"],
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
  support: ["What needs me first today?", "Summarise the oldest waiting tickets", "Draft a reply to the oldest ticket"],
  agreements: ["What needs me first today?", "What is the oldest agreement waiting?"],
  finance: ["What needs me first today?", "Is reconciliation clean?", "Which chargebacks are due soonest?"],
  compliance: ["What needs me first today?", "What is overdue in compliance?"],
  operations: ["What needs me first today?", "Any critical alerts open?"],
  trust_safety: ["What needs me first today?", "Which cases are overdue?", "Summarise open appeals"],
  roommates: ["What needs me first today?", "How many verifications are waiting?"],
  circle: ["What needs me first today?", "Which communities need attention?"],
  analyst: ["Give me the headline numbers", "How are bookings doing?"],
  business_development: ["What needs me first today?", "Which follow-ups are due this week?", "Summarise my pipeline"],
  social_media: ["What is on the calendar this week?", "Which posts are overdue?"],
};

const GENERIC: readonly string[] = ["What needs me first today?", "What are my open tasks?", "Where do I find how to do this in the manual?"];

/** Starter chips for a desk. */
export function starterPromptsFor(scope: StaffScope | null): string[] {
  return [...((scope && STARTERS[scope]) || GENERIC)];
}
