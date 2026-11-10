/**
 * HOW LONG VALLO KEEPS EACH KIND OF DATA, AS DATA (founder, 10 November 2026).
 *
 * ONE SOURCE. The Privacy page's retention table (`components/legal/
 * RetentionTable.tsx`) draws exactly these rows, and nothing else on the site
 * states a period for these kinds of data by hand. Change a period here and
 * the page moves with it.
 *
 * STATUS: the founder's current schedule, in industry-standard periods, PENDING
 * COUNSEL (docs/handoff/COUNSEL_BRIEF.md section 2.2). `RETENTION_STATUS` is
 * the sentence the page prints beside it. Where the code removes data sooner
 * than the period (application logs, sign-up step counts), the period here is
 * the longest it is kept; the page says so.
 *
 * Plain language, no statute named in the cell: the legal basis is the
 * `basis` column's job and is for counsel to confirm.
 */

export type RetentionRow = {
  id: string;
  /** What the data is, in the words a member would use. */
  what: string;
  /** How long it is kept, and from when. */
  period: string;
  /** Why this long, in one plain phrase. */
  why: string;
};

export const RETENTION_SCHEDULE: readonly RetentionRow[] = [
  {
    id: "profile",
    what: "Your account and profile",
    period: "While your account is open. After you delete it, a 30-day window to change your mind, then it is permanently deleted.",
    why: "You asked us to keep it, or you asked us to delete it.",
  },
  {
    id: "financial",
    what: "Payment and financial records",
    period: "6 years after the transaction.",
    why: "Tax and company law, and anti money laundering practice.",
  },
  {
    id: "identity",
    what: "Identity checks (ID, selfie, address, bank name check)",
    period: "5 years after your relationship with Vallo ends. Applicants who were not approved: destroyed with the rest of the account.",
    why: "Anti money laundering practice.",
  },
  {
    id: "agreements",
    what: "Agreements and receipts",
    period: "6 years.",
    why: "They are the record of a deal, for tax and for any dispute.",
  },
  {
    id: "messages",
    what: "Messages",
    period: "24 months after the conversation's last activity. When you delete your account, your messages stay in the other person's conversation, shown as from a deleted account, unless they are needed for a dispute.",
    why: "So a conversation stays readable for the other person, and a dispute can be looked at.",
  },
  {
    id: "support",
    what: "Support tickets",
    period: "3 years.",
    why: "To handle complaints and show what we did.",
  },
  {
    id: "security",
    what: "Security and access logs",
    period: "Up to 12 months.",
    why: "To spot and investigate misuse.",
  },
  {
    id: "analytics",
    what: "Usage counts (the sign-up step counts)",
    period: "Up to 14 months.",
    why: "To see how the product is used over a full year.",
  },
  {
    id: "marketing",
    what: "Marketing consent records",
    period: "Until you withdraw consent, then 3 years as proof that you did.",
    why: "To show we only wrote to you when you agreed.",
  },
  {
    id: "backups",
    what: "Backups",
    period: "Roll off within 35 days.",
    why: "Deleted data leaves our backups on that cycle.",
  },
] as const;

/** Printed beside the table. */
export const RETENTION_STATUS =
  "This is our current schedule. It is being reviewed by our legal advisers and may change; if it does, we will update the date at the top of this page. These are the longest periods: some data is removed sooner.";

/** The columns, so the page and the test agree on the headers. */
export const RETENTION_COLUMNS = { what: "What", period: "How long we keep it", why: "Why" } as const;
