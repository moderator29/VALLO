import type { Destination } from "@/lib/admin/copilot/destinations";

/**
 * RECORDED ANSWERS FOR THE COPILOT PREVIEW.
 *
 * Each one is a real answer shape: the words the model would write, and the
 * destinations the tools handed back for that turn, already filtered the way
 * the server filters them. No key, no network, no database: the preview is
 * the proof of the look, never of a read.
 *
 * Every name and figure here is invented.
 */
export type RecordedTurn = {
  key: string;
  /** What the person asked. */
  asked: string;
  /** What the copilot wrote, markers and all. */
  answer: string;
  /** What the tools returned this turn. Only these become buttons. */
  destinations: Destination[];
  /** One line on what this screen is proving. */
  proves: string;
};

export const RECORDED: readonly RecordedTurn[] = [
  {
    key: "desk",
    asked: "What needs me first today?",
    answer: [
      "Seven listings are waiting on a review decision, and the oldest has waited 2 days. That is the first thing.",
      "",
      "- 3 submitted, 4 under review, from the listings queue",
      "- 15 support tickets are open, 2 of them past their promised time",
      "",
      "[[go:/admin/listings|Open Listings]]",
      "[[go:/admin/support|Open Support]]",
    ].join("\n"),
    destinations: [
      { label: "Open Listings", href: "/admin/listings" },
      { label: "Open Support", href: "/admin/support" },
    ],
    proves: "An answer that starts with the point, keeps the list short, and ends in two buttons.",
  },
  {
    key: "where",
    asked: "Where do I go when a member cannot sign in?",
    answer: [
      "Account recovery. It holds every member locked out of their email and what each one is waiting on.",
      "",
      "[[go:/admin/account-recovery|Open Account recovery]]",
    ].join("\n"),
    destinations: [{ label: "Open Account recovery", href: "/admin/account-recovery" }],
    proves: "where_do_i_go: one desk, one line on what it is for, one button.",
  },
  {
    key: "invented",
    asked: "Can I see who holds staff access?",
    answer: [
      "No. Granting and reading staff access is the super admin's own desk, and it is not on your rail, so I cannot read it for you.",
      "",
      "Ask your lead, or raise it with the Escalate button at the top of the page.",
      "",
      "[[go:/admin/staff|Open the Staff desk]]",
      "[[go:/admin/escalations|Open Escalations]]",
    ].join("\n"),
    destinations: [{ label: "Open Escalations", href: "/admin/escalations" }],
    proves: "The Staff desk was never returned by a tool for this person, so it stays plain words. Only Escalations is a button.",
  },
  {
    key: "super",
    asked: "What needs me today?",
    answer: [
      "One escalation is waiting on you, and two critical alerts are open.",
      "",
      "- 9,120 members, 340 real listings live, 60 examples still up",
      "- N45,000 taken in the last 7 days, N160,000 in the last 30",
      "- One part of the database is still waiting for its file to be run: staff_escalations_2026-11-15.sql",
      "",
      "Nobody holds Reports and moderation, so every moderation escalation reaches you.",
      "",
      "[[go:/admin/control|Open the control room]]",
      "[[go:/admin/escalations|Open Escalations]]",
      "[[go:/admin/staff|Open the Staff desk]]",
    ].join("\n"),
    destinations: [
      { label: "Open the control room", href: "/admin/control" },
      { label: "Open Escalations", href: "/admin/escalations" },
      { label: "Open the Staff desk", href: "/admin/staff" },
    ],
    proves: "The super admin's answer: the numbers, the empty team, three buttons, no lecture.",
  },
  {
    key: "handbook",
    asked: "What does my handbook say about refunds?",
    answer: [
      'Your handbook is plain about it, under "What you may decide alone": you may close a ticket you answered yourself, and you may not decide a refund. A refund is the Money desk\'s decision.',
      "",
      "[[go:/admin/handbook/position|Read your handbook]]",
    ].join("\n"),
    destinations: [{ label: "Read your handbook", href: "/admin/handbook/position" }],
    proves: "get_my_handbook: their own handbook, the section named, a button to read it.",
  },
  {
    key: "unread",
    asked: "How much have we taken this month?",
    answer: [
      "Money over the last 30 days could not be read just now, so there is no figure to give you. The last 7 days read fine: N45,000.",
      "",
      "[[go:/admin/money|Open the Money desk]]",
    ].join("\n"),
    destinations: [{ label: "Open the Money desk", href: "/admin/money" }],
    proves: "A read that failed is said plainly, with no estimate in its place.",
  },
];

export const RECORDED_KEYS = RECORDED.map((turn) => turn.key);
