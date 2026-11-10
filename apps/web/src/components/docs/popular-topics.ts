/**
 * The chips the help search opens with (DocSearchPanel) and the help page
 * repeats (app/(site)/help/PopularTopics.tsx): the subjects members write to
 * support about most (live support_tickets by topic, 9 November 2026), plus
 * the money questions every marketplace gets. A plain module so the help
 * page can read it without loading the search panel.
 */
export const POPULAR_TOPICS: { label: string; query: string; href: string }[] = [
  { label: "Bookings", query: "booking", href: "/help#bookings" },
  { label: "Verify my ID", query: "verify identity", href: "/help#verification" },
  { label: "Refunds", query: "refund", href: "/help#refunds" },
  { label: "Cancellation", query: "cancel", href: "/cancellations" },
  { label: "Payouts", query: "payout", href: "/help#payouts" },
  { label: "Inspections", query: "inspection", href: "/help#inspections" },
  { label: "List my property", query: "list property", href: "/guides" },
  { label: "Safety", query: "safety", href: "/safety" },
  { label: "My account", query: "account sign in", href: "/help#account" },
];
