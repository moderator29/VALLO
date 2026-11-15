/**
 * THE CONTROL ROOM'S REGISTERS (the founder, 15 November 2026). Pure and
 * client-safe: what the super admin's page checks, in plain words.
 *
 * DATABASE SETUP. Each entry is a part of the product that needs something
 * in the database before it works, the file that puts it there, and a marker
 * the page can look for (a table, or a column of a table). The page reads the
 * live database, so it says what has really run, whatever a note in the
 * repository says. When new SQL is written for the founder to run, its entry
 * is added here in the same change.
 *
 * SWITCHES. The live on and off switches the founder asks about most, with
 * what each one means when it is on and when it is off.
 */

export type SetupMarker = { table: string; column?: string };

export type SetupItem = {
  key: string;
  /** What it is, as the founder would say it. */
  title: string;
  /** What works once it has run. */
  unlocks: string;
  /** The file under supabase/migrations to run in the Supabase SQL editor. */
  file: string;
  marker: SetupMarker;
};

export const SETUP_ITEMS: readonly SetupItem[] = [
  {
    key: "staff_escalations",
    title: "Escalations for every desk",
    unlocks: "The Escalate button on every desk, the escalations inbox, the response clocks and the overdue bump.",
    file: "pending/staff_escalations_2026-11-15.sql",
    marker: { table: "staff_escalations" },
  },
  {
    key: "identity_cross_check",
    title: "Identity cross-checks",
    unlocks: "Noticing the same ID file, a very similar picture or the same ID number on a second account, on the verification desk.",
    file: "pending/identity_cross_check_2026-11-15.sql",
    marker: { table: "kyc_document_fingerprints" },
  },
  {
    key: "payout_to_lister",
    title: "Payout to the lister on protected payments",
    unlocks: "Recording when the payment partner has paid a lister, and telling the lister.",
    file: "20261115120000_protected_payout_to_lister.sql",
    marker: { table: "provider_arrangements", column: "payout_status" },
  },
  {
    key: "protected_categories",
    title: "Protected payment categories",
    unlocks: "The eight kinds of deal a protected payment can be approved for, each off until approved.",
    file: "pending/protected_payment_categories_all_disabled_2026-11-09.sql",
    marker: { table: "protected_payment_categories" },
  },
  {
    key: "offers",
    title: "Offers and the Deal Room",
    unlocks: "Written offers on homes for sale, counteroffers and the Deal Room.",
    file: "pending/OFFERS_ALL.sql",
    marker: { table: "deal_documents" },
  },
  {
    key: "roommates",
    title: "Roommates",
    unlocks: "Roommate profiles, room posts, groups and the schools directory.",
    file: "pending/ROOMMATES_ALL.sql",
    marker: { table: "roommate_profiles" },
  },
  {
    key: "roommate_gallery",
    title: "Roommate profile photos",
    unlocks: "A photo gallery on a roommate profile.",
    file: "pending/roommates_9_profile_gallery_2026-11-10.sql",
    marker: { table: "roommate_profiles", column: "gallery" },
  },
  {
    key: "my_desk",
    title: "My desk: tasks and announcements",
    unlocks: "Staff tasks, comments and announcements.",
    file: "pending/staff_tasks_announcements_2026-11-10.sql",
    marker: { table: "staff_tasks" },
  },
  {
    key: "weekly_reports",
    title: "Weekly reports",
    unlocks: "The weekly report each member of staff sends, and its review.",
    file: "pending/staff_weekly_reports_2026-11-10.sql",
    marker: { table: "staff_weekly_reports" },
  },
  {
    key: "coo",
    title: "The COO desk",
    unlocks: "The COO's board and staff access recommendations.",
    file: "pending/coo_overview_2026-11-10.sql",
    marker: { table: "coo_escalations" },
  },
  {
    key: "business_development",
    title: "Business development pipeline",
    unlocks: "Prospects, stages, follow-ups and the activity record.",
    file: "pending/bd_prospects_2026-11-10.sql",
    marker: { table: "bd_prospects" },
  },
  {
    key: "social_media",
    title: "Social media desk",
    unlocks: "The content calendar, drafts, approvals and the record of what was posted.",
    file: "pending/social_posts_2026-11-10.sql",
    marker: { table: "social_posts" },
  },
  {
    key: "department_desks",
    title: "Marketing, content, technical and support lead desks",
    unlocks: "The four department desks and their records.",
    file: "pending/RUN_2_everything_else_2026-11-10.sql",
    marker: { table: "staff_desk_entries" },
  },
  {
    key: "copilot_confirm",
    title: "Copilot confirmations",
    unlocks: "The record that makes a copilot action run once only, after a person confirms it.",
    file: "pending/copilot_proposals_2026-11-10.sql",
    marker: { table: "copilot_proposals" },
  },
  {
    key: "listing_stats",
    title: "Listing statistics",
    unlocks: "Views, saves, shares and enquiries counted for each listing.",
    file: "pending/listing_stats_2026-11-13.sql",
    marker: { table: "listing_counters" },
  },
  {
    key: "exchange_rates",
    title: "Prices shown in other currencies",
    unlocks: "A price shown in another currency beside the naira figure.",
    file: "pending/display_exchange_rates_2026-11-13.sql",
    marker: { table: "display_exchange_rates" },
  },
  {
    key: "doc_feedback",
    title: "Was this helpful, on help pages",
    unlocks: "Members' answers on help and docs pages, read on the support desk.",
    file: "pending/docs_page_feedback_2026-11-10.sql",
    marker: { table: "doc_feedback" },
  },
];

export type SetupState = "ready" | "waiting" | "unknown";
export type SetupReading = { item: SetupItem; state: SetupState };

/**
 * What a probe's answer means. The database's own codes: an unknown table or
 * column is "waiting"; no error is "ready"; anything else could not be read,
 * and is never guessed either way.
 */
export function setupStateFrom(error: { code?: string | null; message?: string | null } | null): SetupState {
  if (!error) return "ready";
  const code = error.code ?? "";
  if (code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204") return "waiting";
  return "unknown";
}

/** Waiting first, then what could not be read, then what is ready; the register's order within each. */
export function orderSetup(readings: readonly SetupReading[]): SetupReading[] {
  const rank: Record<SetupState, number> = { waiting: 0, unknown: 1, ready: 2 };
  return readings.map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.state] - rank[b.r.state] || a.i - b.i).map((x) => x.r);
}

/** Where the founder opens a setup file to copy it. */
export const SETUP_FILE_BASE = "https://github.com/moderator29/VALLO/blob/main/supabase/migrations/";

export function setupFileHref(file: string): string {
  return `${SETUP_FILE_BASE}${file}`;
}

/* ---------------------------------------------------------------- switches */

export type SwitchNote = {
  key: string;
  title: string;
  on: string;
  off: string;
};

export const SWITCH_NOTES: readonly SwitchNote[] = [
  {
    key: "payments_protected_pay_on",
    title: "Protected payments offered to members",
    on: "Members can be offered a payment held by the partner bank, where a category is approved.",
    off: "No member is offered a held payment. Card payments are not affected.",
  },
  {
    key: "payments_escrowpay_on",
    title: "The payment partner may be asked",
    on: "Vallo may ask the payment partner to open a held payment.",
    off: "Nothing is sent to the payment partner to start a payment.",
  },
  {
    key: "phone_confirmation",
    title: "Phone confirmation",
    on: "A member confirms a mobile number before their first payment and before publishing their first listing. Nothing else asks.",
    off: "Nobody is asked for a phone number anywhere.",
  },
  {
    key: "wallet",
    title: "Wallet",
    on: "The wallet is shown to members.",
    off: "No wallet. Vallo keeps no balance for anybody.",
  },
  {
    key: "crypto_payments",
    title: "Paying with crypto",
    on: "Crypto is offered as a way to pay.",
    off: "Crypto is not offered.",
  },
  {
    key: "restaurant_bill_pay",
    title: "Paying a restaurant bill through Vallo",
    on: "A diner can pay the bill in the app.",
    off: "Diners pay the restaurant directly.",
  },
  {
    key: "restaurant_deposits",
    title: "Restaurant table deposits",
    on: "A restaurant can ask for a card deposit on a table.",
    off: "Tables are booked with no deposit.",
  },
  {
    key: "dojah_identity",
    title: "Paid identity check",
    on: "A member's selfie and ID number are sent to the paid identity service.",
    off: "Identity is reviewed by a person, with the free cross-checks on the verification desk.",
  },
  {
    key: "video_calls",
    title: "Video calls",
    on: "Members can make video calls and video viewings.",
    off: "No video calls.",
  },
  {
    key: "assistant",
    title: "The assistant",
    on: "Members who agree to it can use the assistant.",
    off: "The assistant is closed to members.",
  },
];

export type SwitchReading = { note: SwitchNote; state: "on" | "off" | "missing" };

export function readSwitches(rows: readonly { key: string; enabled: boolean }[]): SwitchReading[] {
  const by = new Map(rows.map((r) => [r.key, r.enabled]));
  return SWITCH_NOTES.map((note) => ({ note, state: by.has(note.key) ? (by.get(note.key) ? "on" : "off") : "missing" }));
}

/* ------------------------------------------------------------- connections */

export type ConnectionReading = { key: string; title: string; ready: boolean; meaning: string };

/**
 * Which outside services this deployment is set up to reach. Only whether the
 * settings are present: never a key, a name or a value.
 */
export function readConnections(input: {
  codesNigeria: boolean;
  codesAbroad: boolean;
  paymentPartner: boolean;
  paymentPartnerWebhook: boolean;
  cardPayments: boolean;
  email: boolean;
  copilot: boolean;
  onCallPage: boolean;
}): ConnectionReading[] {
  return [
    {
      key: "codes_ng",
      title: "Codes to Nigerian numbers",
      ready: input.codesNigeria,
      meaning: input.codesNigeria ? "Members with a Nigerian number can confirm it." : "No code can be sent to a Nigerian number, so nobody with one can confirm it.",
    },
    {
      key: "codes_abroad",
      title: "Codes to numbers outside Nigeria",
      ready: input.codesAbroad,
      meaning: input.codesAbroad
        ? "Members abroad confirm their number by code like everybody else."
        : "No code can be sent abroad, so members abroad are not asked for a phone. Their number is saved unconfirmed. This turns itself back on when the international sender is set up.",
    },
    {
      key: "card",
      title: "Card payments",
      ready: input.cardPayments,
      meaning: input.cardPayments ? "Card payments can be taken." : "The card processor is not connected on this deployment.",
    },
    {
      key: "partner",
      title: "The payment partner for held payments",
      ready: input.paymentPartner && input.paymentPartnerWebhook,
      meaning:
        input.paymentPartner && input.paymentPartnerWebhook
          ? "The partner is connected, and its reports can be confirmed as its own."
          : input.paymentPartner
            ? "The partner is connected, but its webhook secret is missing, so its reports cannot be trusted yet."
            : "The partner is not connected. Nothing can be sent to it.",
    },
    {
      key: "email",
      title: "Email",
      ready: input.email,
      meaning: input.email ? "Emails can be sent." : "The email service is not connected.",
    },
    {
      key: "copilot",
      title: "The copilot and the assistant",
      ready: input.copilot,
      meaning: input.copilot ? "The copilot on each desk can answer." : "The copilot is not connected and cannot answer.",
    },
    {
      key: "page",
      title: "The on-call page",
      ready: input.onCallPage,
      meaning: input.onCallPage ? "A critical alert pages a person." : "Nobody is paged on a critical alert. Set an alert email or webhook.",
    },
  ];
}
