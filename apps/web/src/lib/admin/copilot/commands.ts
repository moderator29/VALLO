import type { StaffScope } from "@/lib/admin/guard";

/**
 * THE COPILOT'S QUICK COMMANDS (the founder, 16 November 2026: "our AI
 * copilot should have prefixes, like 'what needs me today', more and more
 * options as the chat is going").
 *
 * Type "/" in the copilot and these appear, filtered as you type. A command
 * either asks a question for you (`prompt`), starts a sentence for you to
 * finish (`template`), or does something in the chat itself (`action`). Each
 * names the access areas that open it, so a person only ever sees commands
 * for desks they hold; the server answers the list (`commandsFor`) from the
 * console door, never from what the browser claims.
 *
 * Pure: no React, no fetch.
 */

export type CopilotCommand = {
  /** What is typed after the slash. Lower case, no spaces. */
  key: string;
  /** One line under it in the menu. */
  hint: string;
  /** Sent as the question when chosen. */
  prompt?: string;
  /** Put in the composer, for the person to finish. */
  template?: string;
  /** Done in the chat itself. */
  action?: "new" | "history" | "settings";
  /** Any one of these opens it. Absent: every member of staff. */
  scopes?: readonly StaffScope[];
  /** The super admin alone. */
  superAdmin?: true;
  /** How the menu groups it. */
  group: "Today" | "Your desks" | "Do something" | "Platform" | "Chat";
};

export const COPILOT_COMMANDS: readonly CopilotCommand[] = [
  { key: "today", group: "Today", hint: "What needs you first today", prompt: "What needs me first today?" },
  { key: "tasks", group: "Today", hint: "Your open tasks and what is overdue", prompt: "What are my open tasks, and what is overdue?" },
  { key: "escalations", group: "Today", hint: "Escalations waiting on you", prompt: "What escalations are waiting on me, most urgent first?" },
  { key: "news", group: "Today", hint: "The latest staff announcements", prompt: "What are the latest staff announcements?" },

  { key: "tickets", group: "Your desks", hint: "The oldest waiting support tickets", prompt: "Show me the oldest waiting support tickets.", scopes: ["support"] },
  { key: "late", group: "Your desks", hint: "Tickets past the promised time", prompt: "Which support tickets are past the promised time?", scopes: ["support"] },
  { key: "alerts", group: "Your desks", hint: "Open risk alerts, worst first", prompt: "Which risk alerts are open, worst first?", scopes: ["operations"] },
  { key: "jobs", group: "Your desks", hint: "Scheduled jobs that failed or went quiet", prompt: "Are any scheduled jobs failing or stale?", scopes: ["operations"] },
  { key: "bookings", group: "Your desks", hint: "Bookings by state this week", prompt: "How do bookings stand this week?", scopes: ["operations"] },
  { key: "flags", group: "Your desks", hint: "Open message flags, oldest first", prompt: "Show me the open message flags, oldest first.", scopes: ["moderation"] },
  { key: "reports", group: "Your desks", hint: "Open reports by category", prompt: "What reports are open, by category, and which is oldest?", scopes: ["moderation"] },
  { key: "listings", group: "Your desks", hint: "Listings waiting for review", prompt: "What listings are waiting for review, oldest first?", scopes: ["listing_approval"] },
  { key: "kyc", group: "Your desks", hint: "Identity checks waiting", prompt: "What identity checks are waiting, oldest first?", scopes: ["kyc_review"] },
  { key: "cases", group: "Your desks", hint: "Open trust and safety cases", prompt: "What trust and safety cases are open, most urgent first?", scopes: ["trust_safety"] },
  { key: "money", group: "Your desks", hint: "Money this week, and chargebacks", prompt: "Summarise money this week, with any chargebacks.", scopes: ["finance"] },
  { key: "agreements", group: "Your desks", hint: "Agreements waiting on a person", prompt: "What agreements are waiting on a person?", scopes: ["agreements"] },

  { key: "reply", group: "Do something", hint: "Write a reply to a ticket, shown before it is sent", template: "Reply to the oldest waiting ticket: ", scopes: ["support"] },
  { key: "resolve", group: "Do something", hint: "Resolve something, with a card to press", template: "Resolve " },
  { key: "task", group: "Do something", hint: "Add a task to your own list", template: "Add a task to my list: " },
  { key: "escalate", group: "Do something", hint: "Raise an escalation", template: "Raise an escalation about " },
  { key: "announce", group: "Do something", hint: "Draft a staff announcement", template: "Draft a staff announcement about " },
  { key: "where", group: "Do something", hint: "Find the page that does something", template: "Where do I go to " },
  { key: "handbook", group: "Do something", hint: "What your handbook says", template: "What does my handbook say about " },

  { key: "pulse", group: "Platform", hint: "How the platform is doing today", prompt: "How is the platform doing today?", superAdmin: true },
  { key: "sql", group: "Platform", hint: "Database setup still to run", prompt: "What SQL still has to run?", superAdmin: true },
  { key: "access", group: "Platform", hint: "Who has access to what", prompt: "Who has access to what, and which teams have nobody?", superAdmin: true },
  { key: "changes", group: "Platform", hint: "What changed this week", prompt: "What changed this week?", superAdmin: true },
  { key: "control", group: "Platform", hint: "The control room: switches and keys", prompt: "What does the control room say is not set up yet?", superAdmin: true },

  { key: "help", group: "Chat", hint: "What I can do for you", prompt: "What can you do for me on my desks?" },
  { key: "new", group: "Chat", hint: "Start a new conversation", action: "new" },
  { key: "history", group: "Chat", hint: "Your saved conversations", action: "history" },
  { key: "settings", group: "Chat", hint: "Answer length and how the chat behaves", action: "settings" },
];

export type CommandViewer = { isAdmin: boolean; isSuperAdmin: boolean; scopes: readonly StaffScope[] };

/** The commands this person may see: their own desks, and the platform ones for the super admin. */
export function commandsFor(viewer: CommandViewer, all: readonly CopilotCommand[] = COPILOT_COMMANDS): CopilotCommand[] {
  return all.filter((c) => {
    if (c.superAdmin) return viewer.isSuperAdmin;
    if (!c.scopes) return true;
    if (viewer.isAdmin || viewer.isSuperAdmin) return true;
    return c.scopes.some((s) => viewer.scopes.includes(s));
  });
}

/**
 * The menu for what has been typed so far ("/", "/ti", "/tickets"), best
 * first: a key that starts with the words, then one that contains them, then
 * a hint that does. Null when the composer is not a command.
 */
export function matchCommands(draft: string, list: readonly CopilotCommand[]): CopilotCommand[] | null {
  const m = /^\/([a-z]*)$/i.exec(draft.trimStart());
  if (!m) return null;
  const q = (m[1] ?? "").toLowerCase();
  if (!q) return [...list];
  const starts = list.filter((c) => c.key.startsWith(q));
  const contains = list.filter((c) => !c.key.startsWith(q) && c.key.includes(q));
  const hints = list.filter((c) => !c.key.includes(q) && c.hint.toLowerCase().includes(q));
  return [...starts, ...contains, ...hints];
}
