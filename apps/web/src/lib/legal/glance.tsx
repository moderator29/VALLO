import type { ShortVersionItem } from "@/components/legal/LegalPreface";
import { DocFlow, type DocFlowStep } from "@/components/docs/DocFlow";
import { DocTable, type DocTableColumn, type DocTableRow } from "@/components/docs/DocTable";
import { GRACE_WINDOW_DAYS } from "@/lib/account-deletion/constants";
import {
  GOVERNING_SENTENCE,
  NO_INSPECTION_FEE,
  NO_RENTER_FEES_LINE,
  OFF_PLATFORM_SENTENCE,
  PROCESSOR_FEE_LABEL,
  PROCESSOR_FEE_WHEN,
  REFUND_ROUTE,
} from "@/lib/money/copy";
import { FULL_REFUND_HOURS } from "@/lib/trust/cancellation";
import { RESPONSE_COMMITMENTS } from "@/lib/trust/standards";

/**
 * THE SUMMARIES THAT SIT ABOVE THE LEGAL TEXT (founder, November 2026, "high
 * end" legal pages). PRESENTATION ONLY: every figure and sentence here is read
 * from the constant the product itself uses (lib/money/copy.ts,
 * lib/trust/cancellation.ts, lib/account-deletion/constants.ts) or restates a
 * section of lib/legal/terms.tsx or privacy.tsx that is cited beside it. The
 * sections remain the agreement; nothing here adds or removes an obligation.
 * Where a thing is not stated in the sections, it is not stated here.
 */

/* ------------------------------------------------------------------ terms */

export const TERMS_SHORT: ShortVersionItem[] = [
  { icon: "users", text: "Vallo connects renters, guests, owners and agents. It is not a party to your tenancy or your sale (section 14)." },
  { icon: "wallet", text: "Vallo never holds your money. Card payments are split by our payment processor in the same transaction, so the owner's share goes straight to their bank account (section 4)." },
  { icon: "price-tag", text: NO_RENTER_FEES_LINE },
  { icon: "id-card", text: "We check the identity of members and a person reviews every listing before it is published (sections 6, 7 and 14)." },
  { icon: "calendar-clock", text: `For stays: everything back until ${FULL_REFUND_HOURS} hours before check-in, half back inside that window, nothing once check-in day has started (section 5).` },
  { icon: "flag", text: "Pay only on Vallo. We cannot help recover money paid in cash or by direct transfer outside it (section 4)." },
];

const ROLE_COLUMNS: DocTableColumn[] = [
  { key: "who", label: "Who" },
  { key: "does", label: "What you do" },
  { key: "pays", label: "What you pay" },
  { key: "vallo", label: "What Vallo does" },
];

const ROLE_ROWS: DocTableRow[] = [
  {
    id: "renter",
    icon: "user",
    cells: {
      who: "Renter or guest",
      does: "Pay the price shown, in naira, before you confirm. Keep every message and payment on Vallo.",
      pays: "Nothing to Vallo. No fee to look, to book or to pay.",
      vallo: "Shows the full price first, records what was paid, to whom and when.",
    },
  },
  {
    id: "lister",
    icon: "key",
    cells: {
      who: "Owner or agent who lists",
      does: "List only what is lawful and yours to offer, with photographs of the actual property. Keep payout details on file.",
      pays: "Listing is free. The platform fee comes out of your share on a completed deal, shown in naira before you agree.",
      vallo: "Reviews each listing by a person before publishing. Can remove listings or stop accounts that break the terms.",
    },
  },
  {
    id: "host",
    icon: "building-hotel",
    cells: {
      who: "Host of a stay or restaurant",
      does: "Agree to the Host Agreement. Charge a guest nothing that is not listed on Vallo.",
      pays: "As a lister for a stay. A restaurant pays a fixed fee for each table that is seated.",
      vallo: "Approves a stay booking before payment opens.",
    },
  },
  {
    id: "vallo",
    icon: "shield-check",
    cells: {
      who: "Vallo",
      does: "Checks identity, reviews listings, investigates reports, acts on members who break the rules.",
      pays: "Charges a fee only when a deal is completed.",
      vallo: "Is not a party to your tenancy or sale and does not guarantee the transaction.",
    },
  },
];

const FEE_COLUMNS: DocTableColumn[] = [
  { key: "item", label: "Charge" },
  { key: "who", label: "Who pays" },
  { key: "when", label: "When" },
];

const FEE_ROWS: DocTableRow[] = [
  { id: "renter", icon: "user", cells: { item: "Fee to look, to book or to pay", who: "Nobody. Renters and guests pay nothing to Vallo.", when: "Never" } },
  { id: "listing", icon: "document", cells: { item: "Listing a property", who: "Nobody. Listing is free.", when: "Never" } },
  { id: "platform", icon: "price-tag", cells: { item: "Platform fee", who: "The lister, out of their share", when: "When a payment is made through the platform. The rate is shown in naira before the lister agrees." } },
  { id: "processing", icon: "credit-card", cells: { item: PROCESSOR_FEE_LABEL, who: "The lister, on the payout record", when: PROCESSOR_FEE_WHEN } },
  { id: "table", icon: "utensils", cells: { item: "Restaurant table", who: "The restaurant, a fixed fee for each seated table", when: "When a table is seated. The diner pays nothing extra." } },
  { id: "inspection", icon: "key", cells: { item: "Inspection", who: "Nobody", when: NO_INSPECTION_FEE } },
];

const DISPUTE_STEPS: DocFlowStep[] = [
  { icon: "flag", title: "Report it", outcome: "Tell us from the listing or the conversation, with photographs or messages if you have them." },
  { icon: "file-search", title: "We look at the record", outcome: "The inspection report and the messages on the platform are the record we read first (section 14)." },
  { icon: "user-check", title: "A person decides", outcome: "We can suspend a listing, stop the person who posted it from trading, or act on the member." },
  { icon: "scale", title: "If you disagree", outcome: "You can appeal a suspension or closure and a person not involved in the first decision reviews it (section 16). Nigerian law governs the terms (section 19)." },
];

export function TermsGlance() {
  return (
    <>
      <DocTable caption="Who does what" columns={ROLE_COLUMNS} rows={ROLE_ROWS} />
      <DocTable caption="What costs what" columns={FEE_COLUMNS} rows={FEE_ROWS} />
      <DocFlow label="If something goes wrong" steps={DISPUTE_STEPS} end={GOVERNING_SENTENCE} />
    </>
  );
}

/* ---------------------------------------------------------------- privacy */

export const PRIVACY_SHORT: ShortVersionItem[] = [
  { icon: "eye-off", text: "There is no advertising tracking and no analytics in Vallo. We keep a few counts of our own, described in section 2." },
  { icon: "wallet", text: "We never hold your money, so there is no balance in your name. Card numbers are handled by Paystack and we never see or store your full card number." },
  { icon: "location", text: "Your location is read only when you ask for it. We do not track it in the background." },
  { icon: "user-check", text: "A person decides on verification. No decision about your identity is made by a machine alone." },
  { icon: "trash", text: `You can delete your account yourself. Nothing is destroyed for ${GRACE_WINDOW_DAYS} days and you can restore it in that time. Records the law makes us keep stay, with you removed from them.` },
  { icon: "file-text", text: "The Nigeria Data Protection Act 2023 gives you rights over your data. Section 8 says how to use them." },
];

const DATA_COLUMNS: DocTableColumn[] = [
  { key: "what", label: "What we collect" },
  { key: "why", label: "Why" },
  { key: "who", label: "Who sees it" },
  { key: "keep", label: "How long we keep it" },
];

const DATA_ROWS: DocTableRow[] = [
  {
    id: "profile",
    icon: "user",
    cells: {
      what: "Your account and profile: name, email, phone, handle, photo, bio",
      why: "To run your account and show your profile",
      who: "Other members see what your profile shows. Our staff see it to run the service.",
      keep: `While your account is open. Destroyed after the ${GRACE_WINDOW_DAYS}-day window if you delete it.`,
    },
  },
  {
    id: "listings",
    icon: "home",
    cells: {
      what: "What you list: description, photographs, price, address, map position",
      why: "To show your listing",
      who: "Anybody can see the listing. The street address is read only by signed-in members.",
      keep: "While your account is open, or until you remove it.",
    },
  },
  {
    id: "activity",
    icon: "messages",
    cells: {
      what: "Bookings, inspections, messages and reviews",
      why: "To run bookings and let people talk to each other",
      who: "The people in each booking or conversation, and our staff if something is reported",
      keep: "Messages and content are destroyed with your account. Booking records are kept as the next row says.",
    },
  },
  {
    id: "payments",
    icon: "credit-card",
    cells: {
      what: "Payment references, amounts, how a payment was split, refunds, a card token and payout bank account if you save them",
      why: "To take payments, pay the lister and make refunds",
      who: "Paystack, our payment processor, and our staff",
      keep: "Five years after the transaction, as the law requires. Your name, email and phone are removed from the record.",
    },
  },
  {
    id: "verification",
    icon: "id-card",
    cells: {
      what: "ID photo, selfie, proof of address, business registration, bank name check (listers and agents only)",
      why: "To confirm who is listing and getting paid",
      who: "A reviewer at Vallo. Only our staff can read the documents.",
      keep: "An approved agent's documents are kept five years after the account closes, then destroyed. If you were not approved, they are destroyed with your account.",
    },
  },
  {
    id: "location",
    icon: "location",
    cells: {
      what: "Device location, only when you ask for it",
      why: "To place a listing's pin, centre the map or save a price-check spot",
      who: "You and our service. It is not tracked in the background.",
      keep: "A saved price-check spot is stored to about 100 metres and goes with your account.",
    },
  },
  {
    id: "assistant",
    icon: "bot",
    cells: {
      what: "What you type to the AI assistant or the support chat",
      why: "To write the answers",
      who: "Anthropic, only if you agree to it. A ticket with a person is read by our staff.",
      keep: "Assistant conversations stay on your account until you delete it. The support chat is kept on your device.",
    },
  },
  {
    id: "counts",
    icon: "chart-bar",
    cells: {
      what: "Sign-up step counts, and a record of each email we send you",
      why: "To see where joining Vallo gets stuck, and to answer whether an email arrived",
      who: "Our staff. Nothing is shared with anyone.",
      keep: "90 days",
    },
  },
];

const DELETION_STEPS: DocFlowStep[] = [
  { icon: "settings-gear", title: "Ask to delete", outcome: "In Settings, then Account. You do not need to write to us.", href: "/settings" },
  { icon: "clipboard-list", title: "Say why, or skip it", outcome: "You choose from a short list or prefer not to say. Only the code of your choice goes in the audit log. Nothing you type is kept." },
  { icon: "lock", title: "Confirm", outcome: "Your account is signed out everywhere and deactivated. Nobody can reach your profile." },
  { icon: "mail", title: `${GRACE_WINDOW_DAYS} days to change your mind`, outcome: "We email you the date and a code. Use the code in the window and everything is put back." },
  { icon: "trash", title: "Deletion runs", outcome: "Your profile and content are destroyed. Records the law makes us keep stay, with you removed from them. We email you when it is done." },
];

export function PrivacyGlance() {
  return (
    <>
      <DocTable caption="What we collect, why, who sees it and how long we keep it" columns={DATA_COLUMNS} rows={DATA_ROWS} />
      <DocFlow label={`Deleting your account, with ${GRACE_WINDOW_DAYS} days to restore it`} steps={DELETION_STEPS} />
    </>
  );
}

/* ---------------------------------------------------------- cancellations */

export const REFUNDS_SHORT: ShortVersionItem[] = [
  { icon: "calendar-check", text: "A reservation you have not paid for is a hold. Cancel it any time, for nothing." },
  { icon: "calendar-clock", text: `Paid stay: everything back more than ${FULL_REFUND_HOURS} hours before check-in, half back inside that, nothing once check-in day has started.` },
  { icon: "user-check", text: "A person handles a paid cancellation and decides it, and you get the amount and the reason in writing." },
  { icon: "banknote", text: REFUND_ROUTE },
  { icon: "circle-check", text: "If the agent cancels, the place is not as listed, or you could not get in, you get everything back." },
  { icon: "wallet", text: "There is no Vallo balance for a refund to sit in. It goes back the way the money came." },
];

const REFUND_COLUMNS: DocTableColumn[] = [
  { key: "situation", label: "Situation" },
  { key: "happens", label: "What happens" },
  { key: "decides", label: "Who decides" },
  { key: "time", label: "How long it takes" },
];

const REFUND_ROWS: DocTableRow[] = [
  {
    id: "unpaid",
    icon: "calendar-check",
    cells: { situation: "You cancel a hold you have not paid for", happens: "Nothing is charged and the nights reopen at once", decides: "You, from Plans", time: "Immediately" },
  },
  {
    id: "early",
    icon: "calendar-clock",
    cells: { situation: `You cancel a paid stay more than ${FULL_REFUND_HOURS} hours before check-in`, happens: "The full amount you paid goes back", decides: "Vallo support applies the terms fixed on your booking", time: "Support decides within five Nigerian business days of your ask. Banks usually show it within 5 to 10 working days after." },
  },
  {
    id: "late",
    icon: "hourglass",
    cells: { situation: `You cancel inside the last ${FULL_REFUND_HOURS} hours`, happens: "Half comes back. The other half stays with the agent.", decides: "Vallo support applies the terms fixed on your booking", time: "As above" },
  },
  {
    id: "checkin",
    icon: "circle-x",
    cells: { situation: "Check-in day has started", happens: "Nothing comes back for a cancellation. If you never got in or the place was not as listed, report it instead.", decides: "A person looks at the booking if you report it", time: `Answered ${RESPONSE_COMMITMENTS.standard.label.toLowerCase()}, sooner when check-in is close` },
  },
  {
    id: "agent",
    icon: "user-check",
    cells: { situation: "The agent cancels", happens: "Everything comes back, whenever it happens", decides: "Vallo support", time: "As above" },
  },
  {
    id: "notaslisted",
    icon: "flag",
    cells: { situation: "The place is not what was listed, or you could not get in", happens: "Do not cancel. Report it. A full refund follows once it is confirmed.", decides: "A person at Vallo looks at it first", time: `Answered ${RESPONSE_COMMITMENTS.standard.label.toLowerCase()}` },
  },
];

const REFUND_STEPS: DocFlowStep[] = [
  { icon: "calendar-booking", title: "Open the booking", outcome: "Ask from the booking in Plans, or write to support with your booking reference.", href: "/bookings" },
  { icon: "file-check", title: "We apply your booked terms", outcome: "The terms fixed on your booking when you paid, exactly as written." },
  { icon: "user-check", title: "A person decides", outcome: "A refund is somebody's money, so a named person decides it." },
  { icon: "banknote", title: "It goes back the way it came", outcome: "To the card or bank account you paid with, through our payment processor. You get the amount and the reason in writing." },
];

export function RefundsGlance() {
  return (
    <>
      <DocTable caption="Refunds for a stay, by situation" columns={REFUND_COLUMNS} rows={REFUND_ROWS} />
      <DocFlow label="Asking for a refund" steps={REFUND_STEPS} end={OFF_PLATFORM_SENTENCE} />
    </>
  );
}
