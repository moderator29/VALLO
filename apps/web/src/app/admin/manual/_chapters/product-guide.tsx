import Link from "next/link";
import { DocCallout } from "@/components/docs/DocArticle";
import { plural } from "@vallo/i18n/core";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { DocCrossLink } from "@/components/docs/DocArticle";
import { HOTEL_COMMISSION_PERCENT, HOTEL_COMMISSION_SENTENCE, SEATED_TABLE_FEE } from "@/app/(site)/docs/facts";
import { FEE_PERCENT } from "@/lib/money/fee-schedule";
import {
  CARD_RAIL_MOVES,
  FEE_OTHER_LINE,
  FEE_PROVIDER_CHARGES,
  FEE_RENT_LINE,
  FEE_ROUND_NOTE,
  FEE_WHO_PAYS,
  GOVERNING_SENTENCE,
  NO_INSPECTION_FEE,
  NO_RENTER_FEES_LINE,
  PAYOUT_ANSWER,
  PRIVATE_FEE_NOTE,
  REFUND_ROUTE,
  RENT_PAYMENT_NOT_OPEN,
  SALE_NEVER_PAID_ON_VALLO,
} from "@/lib/money/copy";
import { A, type ManualBody } from "./parts";

/**
 * Chapter 15: THE PRODUCT GUIDE FOR STAFF (the founder, 15 November 2026).
 *
 * What Vallo is, feature by feature, who each feature is for, what it gives a
 * business (B2B) and a person (B2C), what it costs, and what is and is not
 * open today. Written so that anybody on any desk can answer a member, a
 * prospect or a partner in the product's own words, and so each desk's
 * copilot answers from the same page (the manual is its knowledge base).
 *
 * Read from the published member documents (`app/(site)/docs`), the fee
 * schedule (`lib/money/fee-schedule.ts`, imported here so a figure cannot
 * drift), and the live switches, on 15 November 2026. On 16 November 2026
 * the held payment's fee and Vallo's own earnings sweep were added
 * (`fee-schedule.ts`, `lib/cron/jobs/revenue-sweep.ts`, the Control room's
 * earnings panel), and VALLO Intelligence
 * (`app/(app)/intelligence`, `components/app/intelligence`, `lib/intelligence`,
 * the four ways in in `nav-model.ts`, `CreateDock.tsx`, `HomeScreen.tsx` and
 * `lib/nav/member-keys.ts`). Where a feature is
 * built but not open, this chapter says so plainly. When the product
 * changes, this chapter changes with it.
 */

/**
 * "10 other currencies", counted the way every counted phrase on Vallo is.
 *
 * The number is written here rather than read from `lib/currency`, because
 * nothing under `app/admin` may import the currency guide: admin is a money
 * surface and the rule that keeps a converted figure off one is absolute
 * (`lib/currency/money-surfaces.test.ts`). This is prose about the product,
 * not a price, so the figure is stated and `manual.test.ts` holds it to
 * `FOREIGN_CURRENCIES.length`: add a currency and that test fails until this
 * moves with it.
 */
export const OTHER_CURRENCY_COUNT = 10;

const OTHER_CURRENCIES = plural(OTHER_CURRENCY_COUNT, {
  one: "{count} other currency",
  other: "{count} other currencies",
});

const OPEN = { state: "Open", tone: "success" } as const;
const NOT_OPEN = { state: "Not open yet", tone: "pending" } as const;
const PART = { state: "Partly open", tone: "info" } as const;

const STATUS: DocTableRow[] = [
  { id: "search", cells: { feature: "Search, filters, the map, saved places and compare", status: OPEN, say: "Anybody with an account can search homes, land, shops, offices, stays and restaurants." } },
  { id: "intelligence", cells: { feature: "VALLO Intelligence, one search across Vallo", status: OPEN, say: "One box for homes, stays, restaurants, roommates, people, communities, help and a member's own records. Every result is a real record or a real screen." } },
  { id: "listing", cells: { feature: "Listing a property, a stay or a restaurant", status: OPEN, say: "Free. A person at Vallo reviews the lister and the listing before it goes up." } },
  { id: "viewings", cells: { feature: "Viewings, in person or by video", status: OPEN, say: "Free. Vallo charges no inspection fee." } },
  { id: "messages", cells: { feature: "Messages and calls", status: OPEN, say: "A member can message any lister, host or restaurant from the listing." } },
  { id: "agreements", cells: { feature: "Agreements for rent and sale", status: OPEN, say: "Both sides confirm the same written terms. Paying the rent through Vallo is the part that is not open yet." } },
  { id: "stays", cells: { feature: "Booking and paying for a hotel room or a shortlet", status: OPEN, say: "Paid by card inside Vallo. The host's share goes to their bank through the payment processor." } },
  { id: "tables", cells: { feature: "Restaurant table bookings", status: OPEN, say: "Free for the diner. The bill is paid at the restaurant." } },
  { id: "roommates", cells: { feature: "Roommates", status: OPEN, say: "Profiles, room posts, groups, the schools and corps directory and the cost splitter." } },
  { id: "circle", cells: { feature: "Circle and Around", status: OPEN, say: "Communities and a local feed." } },
  { id: "assistant", cells: { feature: "The assistant", status: OPEN, say: "Answers questions and searches real listings, in four languages." } },
  { id: "offers", cells: { feature: "Offers and the Deal Room, for homes for sale", status: OPEN, say: "A buyer sends a written offer; the seller accepts, declines, counters or asks a question. Nothing is charged, and no purchase money passes through Vallo." } },
  { id: "price", cells: { feature: "Price Check", status: OPEN, say: "Shows what similar properties nearby are asking. It needs enough real listings near the spot to answer." } },
  { id: "rent-pay", cells: { feature: "Paying rent through Vallo", status: NOT_OPEN, say: "Do not promise it. Members can view, inspect and agree terms now." } },
  { id: "sale-pay", cells: { feature: "Paying for a property purchase through Vallo", status: { state: "Never", tone: "neutral" }, say: "Vallo does not take payment for a purchase at any stage." } },
  { id: "protected", cells: { feature: "Payment held by a licensed bank until the deal is done", status: NOT_OPEN, say: "Built and switched off today. Do not describe it to members or prospects as available." } },
  { id: "identity", cells: { feature: "Identity checked by a paid service", status: NOT_OPEN, say: "A person at Vallo reviews every identity today, with the free cross-checks on the verification desk. A paid service is being set up. If you are not sure about an ID, escalate it: do not decide it." } },
  { id: "wallet", cells: { feature: "Wallet", status: NOT_OPEN, say: "Vallo keeps no balance for anybody today." } },
  { id: "bill", cells: { feature: "Paying a restaurant bill through Vallo", status: NOT_OPEN, say: "Diners pay the restaurant directly." } },
  { id: "pro", cells: { feature: "The optional Pro plan", status: NOT_OPEN, say: "Nobody needs it to list, book, view or be paid." } },
  { id: "crypto", cells: { feature: "Paying with crypto", status: NOT_OPEN, say: "Not offered." } },
  { id: "rewards", cells: { feature: "Rewards and referrals", status: PART, say: "Invite links work. Whether rewards are paid depends on the campaign running; the screen says so." } },
  /* Read against the live platform on 15 November 2026 and added then. */
  { id: "phone", cells: { feature: "Confirming a phone number with a code", status: OPEN, say: "Asked at a member's first payment, and before a first listing is published. Nowhere else, and not at all for a member abroad while codes cannot be sent out of Nigeria." } },
  { id: "calls", cells: { feature: "Video and audio calls", status: OPEN, say: "Between members where a listing offers it, and as a review call a member of staff books with somebody." } },
  { id: "cards", cells: { feature: "Saving a card for next time", status: OPEN, say: "A member can keep a card on their account. Vallo never sees a full card number." } },
  { id: "currencies", cells: { feature: "Prices read in another currency", status: OPEN, say: `Naira is the price. A guide in ${OTHER_CURRENCIES} sits beside it, refreshed twice a day, marked approximate, and never on a money screen.` } },
  { id: "apps", cells: { feature: "The Android and iPhone apps, with notifications on the phone", status: OPEN, say: "The same account as the website, from Google Play and the App Store." } },
];

const B2B: DocTableRow[] = [
  {
    id: "owners",
    cells: {
      who: "Owners and landlords",
      gets: "List your own property with no agency fee. Enquiries come to you. Free viewings booked in the app, a written agreement both sides confirm, and a tenancy file afterwards. An Ownership seen mark once a reviewer has seen your document.",
      asks: "Your name, phone number and where you live; a government ID or your NIN; whatever you hold on the property; a Nigerian bank account in your own name. About five minutes.",
    },
  },
  {
    id: "agents",
    cells: {
      who: "Agents",
      gets: "A profile people can read before they call, a verification ladder that sets you apart from an unknown number, enquiries and viewing requests in one inbox, viewing times you publish once, analytics on each listing, and a listing board you can print.",
      asks: "Everything an owner gives, plus proof of address dated within three months, and your fees stated in the open where a tenant can read them. About ten minutes.",
    },
  },
  {
    id: "firms",
    cells: {
      who: "Registered firms",
      gets: "One firm page with your staff under it, and the same tools as an agent for each of them. A colleague already on Vallo can admit a new member of staff.",
      asks: "What an agent gives, plus the registered name and RC number as the CAC holds them, the CAC certificate, and something showing each person works there. About fifteen minutes.",
    },
  },
  {
    id: "hotels",
    cells: {
      who: "Hotels and guest houses",
      gets: "Room types, rate plans and a calendar; bookings paid by card when the guest books; a calendar that can sync with other sites you sell on; an earnings statement you can download; guests who see every charge before they book.",
      asks: "Your identity, your business papers and the details of the place. A person at Vallo reviews them before you are published.",
    },
  },
  {
    id: "shortlets",
    cells: {
      who: "Shortlet and serviced apartment hosts",
      gets: "Nightly rates, cleaning charge, minimum stay and house rules set by you; requests you accept or decline, or bookings a guest can pay for at once if you choose that; gate details released only once a booking is confirmed; your share paid to your bank.",
      asks: "The same host setup as a hotel, sized for one place or a few.",
    },
  },
  {
    id: "restaurants",
    cells: {
      who: "Restaurants",
      gets: "Table requests with date, time and party size; you confirm or decline; a check-in code for each table; a count of how many tables a guest kept and missed; reminders sent to the diner; reviews only from diners who were seated.",
      asks: "Host setup as a restaurant: your papers, your hours, how many people each sitting takes, and your house rules.",
    },
  },
];

const B2C: DocTableRow[] = [
  { id: "renters", cells: { who: "Renters", gets: "The move-in total under every rent, not only the yearly figure. Light, water and the gate as filters. Who listed it, and what Vallo has confirmed about them. A free viewing in person or by video. A written agreement before any money moves. No fee from Vallo." } },
  { id: "buyers", cells: { who: "Buyers and investors", gets: "Homes, land, shops and offices for sale with the lister shown. The Ownership seen mark where a reviewer has seen an owner's document. Price Check to see what similar places nearby are asking. A written offer to the seller, with counteroffers kept as versions in a Deal Room. Vallo takes no payment for a purchase, and tells buyers to have their own solicitor look at the title." } },
  { id: "guests", cells: { who: "Guests", gets: "Hotels, shortlets and serviced apartments priced for their dates and party, with every charge at the door shown before they book. Card payment inside Vallo. A cancellation policy fixed on the booking. A check on arrival: is it as listed?" } },
  { id: "diners", cells: { who: "Diners", gets: "A table booked for free, up to 90 days ahead, for up to 50 people. A check-in code, reminders, and a conversation with the restaurant if they are running late." } },
  { id: "students", cells: { who: "Students, corps members and young professionals", gets: "Roommates: a profile, room posts, groups that search together, a directory of schools and of states of posting, checks a person can add (a school email code or a document), and a cost splitter." } },
  { id: "everyone", cells: { who: "Everybody", gets: "One account for all of it. English, Yoruba, Hausa and Igbo. The web, Android and iPhone. An assistant that answers questions and names only places that are really on Vallo. Communities in Circle and a local feed in Around." } },
];

const FEES: DocTableRow[] = [
  { id: "member", cells: { who: "A renter, buyer, guest or diner", pays: "Nothing to Vallo. They pay exactly the listed price." } },
  { id: "viewing", cells: { who: "Somebody viewing a property", pays: "Nothing. Vallo charges no inspection fee." } },
  { id: "list", cells: { who: "Anybody listing a property, a stay or a restaurant", pays: "Nothing to list." } },
  { id: "card", cells: { who: "A lister or host, when a card payment is made", pays: `About ${FEE_PERCENT.otherTotal}% in total, from their share: Vallo's service fee of ${FEE_PERCENT.vallo}% and the payment processor's fee of about ${FEE_PERCENT.otherProcessor}%. Shown to them in naira before they agree.` } },
  { id: "hotel", cells: { who: "A hotel, on a paid room booking", pays: `Vallo's commission of ${HOTEL_COMMISSION_PERCENT} percent of the booking, from the hotel's share.` } },
  { id: "restaurant", cells: { who: "A restaurant", pays: `${SEATED_TABLE_FEE} for each table seated from a Vallo booking, billed once a month. A no-show or a cancelled table costs nothing.` } },
  { id: "rent", cells: { who: "A lister, on a rent payment (not open yet)", pays: `About ${FEE_PERCENT.rentTotal}% in total when it opens: Vallo's ${FEE_PERCENT.vallo}% and the payment partner's fee of about ${FEE_PERCENT.rentPartner}%.` } },
];

const SAY_THIS: DocTableRow[] = [
  { id: "free", cells: { asked: "Is it free?", say: "Yes to join, search, message, view and list. Vallo earns only when a deal is paid through it, and that comes from the lister's or host's share, never added to the customer's price." } },
  { id: "why", cells: { asked: "Why should I list with you? I already post on WhatsApp and Instagram.", say: "Keep doing that. Vallo is one more place, and it is the one where people can see who you are, what Vallo has confirmed about you, and the full cost before they call. That means fewer time wasters and fewer questions asked twice." } },
  { id: "leads", cells: { asked: "How many customers will I get?", say: "I cannot promise a number, and nobody honest can. Vallo is new, so the first listers in each area are the ones people find. Listing costs nothing, so you lose nothing by being early." } },
  { id: "paid", cells: { asked: "How do I get paid?", say: "For a stay or a hotel room, the guest pays by card inside Vallo and your share goes to your own bank account through the payment processor. Vallo never holds your money. Paying rent through Vallo is not open yet, so today a rent is agreed on Vallo and you will be told when payment opens." } },
  { id: "review", cells: { asked: "Why do you ask for my ID?", say: "Because every lister on Vallo is reviewed by a person before they go up. It is what lets a stranger trust your listing. Your documents are seen only by the review team and are never shown to other members." } },
  { id: "agent", cells: { asked: "Are you cutting out agents?", say: "No. Vallo does not remove the agent. It removes the runaround: people see who they are dealing with and what they will pay before they call." } },
  { id: "safe", cells: { asked: "Can you promise I will not be scammed?", say: "No, and we never say so. What we do is review every lister and listing, show what has been confirmed and what has not, keep viewings free, and tell everybody to pay only inside Vallo after a viewing. A badge is not a promise." } },
  { id: "find", cells: { asked: "I cannot find what I am looking for.", say: "Open VALLO Intelligence from the menu, or press Ctrl K on a computer. Type it the way you would say it, then read the chips under Search understood and remove any that are wrong. If it still finds nothing, Vallo may not have it yet, and I will not promise it will." } },
  { id: "search-kept", cells: { asked: "Does Vallo keep what I search for?", say: "Your recent searches are kept on your account for you alone, and you can remove them or clear them all. For Vallo's own figures a search is kept without your account id or your address, and words with a long number in them are not kept at all." } },
  { id: "value", cells: { asked: "Can Vallo tell me what price to put on my property?", say: "No. Vallo does not put a price on anybody's property. Price Check shows what similar properties near a spot are currently asking on Vallo, how many it found, and how sure it is. If it has too few to be sure, it says so instead of guessing." } },
];

/**
 * EVERY FEE, AND WHO KEEPS IT (the founder, 15 November 2026). Figures are
 * imported from the fee schedule, never typed, so a change to the schedule
 * moves this table with it.
 */
const MONEY_IN_FULL: DocTableRow[] = [
  {
    id: "m-member",
    cells: {
      payment: "A renter, buyer, guest or diner, on anything",
      pays: "Nothing to Vallo. Exactly the price on the listing, with nothing added.",
      keeps: "Nothing.",
    },
  },
  {
    id: "m-listing",
    cells: { payment: "Listing a property, a stay or a restaurant", pays: "Nothing.", keeps: "Nothing." },
  },
  {
    id: "m-viewing",
    cells: { payment: "Viewing a property, in person or by video", pays: "Nothing.", keeps: "Nothing." },
  },
  {
    id: "m-card",
    cells: {
      payment: "Any card payment on Vallo (a stay, a hotel room)",
      pays: `About ${FEE_PERCENT.otherTotal}% in total, out of the lister's or host's share.`,
      keeps: `Vallo's service fee of ${FEE_PERCENT.vallo}%. The payment processor's fee of about ${FEE_PERCENT.otherProcessor}% is the processor's own charge.`,
    },
  },
  {
    id: "m-hotel",
    cells: {
      payment: "A paid hotel room booking",
      pays: `Vallo's commission of ${HOTEL_COMMISSION_PERCENT} percent of the booking, out of the hotel's share.`,
      keeps: "The commission. It is never added to the guest's price.",
    },
  },
  {
    id: "m-restaurant",
    cells: {
      payment: "A table seated from a Vallo booking",
      pays: `${SEATED_TABLE_FEE} for each table seated, billed to the restaurant once a month.`,
      keeps: "The fee. A no-show or a cancelled table costs nothing.",
    },
  },
  {
    id: "m-rent",
    cells: {
      payment: "A rent payment (not open)",
      pays: `About ${FEE_PERCENT.rentTotal}% in total when it opens, out of the lister's share.`,
      keeps: `Vallo's ${FEE_PERCENT.vallo}%. The payment partner's fee of about ${FEE_PERCENT.rentPartner}% is the partner's own charge.`,
    },
  },
  {
    id: "m-sale",
    cells: {
      payment: "A property purchase",
      pays: "Nothing passes through Vallo at any stage.",
      keeps: "Nothing. Vallo takes no part of a purchase price and asks for no deposit.",
    },
  },
  {
    id: "m-referral",
    cells: {
      payment: "A referral reward",
      pays: "Nothing. Vallo pays the reward.",
      keeps: "Nothing. Whether a reward is paid depends on the campaign running, and the screen says so.",
    },
  },
];

/**
 * VALLO INTELLIGENCE'S TABS (16 November 2026), read from
 * `lib/intelligence/contract.ts` (the tabs), `lib/intelligence/rank.ts`
 * (which kinds each tab holds) and the sources under
 * `lib/intelligence/sources` (who may see each: people, communities and posts
 * are signed in only and need Around switched on; Yours is the member's own,
 * read through their own session; roommate people need an active roommate
 * profile of the member's own).
 */
const INTELLIGENCE_TABS: DocTableRow[] = [
  { id: "all", cells: { tab: "All", what: "A few of each kind, grouped, best first, with See all for each.", who: "Everybody who can open it" } },
  { id: "property", cells: { tab: "Properties", what: "Homes, land, shops and offices to rent or buy, from the same listings as Search.", who: "Everybody who can open it" } },
  { id: "stay", cells: { tab: "Stays", what: "Hotels, shortlets and serviced apartments.", who: "Everybody who can open it" } },
  { id: "restaurant", cells: { tab: "Restaurants", what: "Restaurants to book a table at.", who: "Everybody who can open it" } },
  { id: "roommate", cells: { tab: "Roommates", what: "Rooms on offer, and people open to matching.", who: "Rooms: everybody. People: a member with an active roommate profile of their own" } },
  { id: "person", cells: { tab: "People", what: "Profiles found by handle or name, never by job or place. Blocked people never show.", who: "Signed-in members, while Around is switched on" } },
  { id: "community", cells: { tab: "Communities", what: "Public Circle communities, and public posts.", who: "Signed-in members, while Around is switched on" } },
  { id: "guide", cells: { tab: "Guides", what: "Help answers and guides, and screens of Vallo: change my email goes to the right setting.", who: "Everybody who can open it" } },
  { id: "personal", cells: { tab: "Yours", what: "Their own saved homes, offers, bookings, conversations and saved searches, and an agent's own listings.", who: "The member alone" } },
];

/**
 * EVERY PART OF THE PRODUCT, WITH THE STAFF HALF ADDED (15 November 2026).
 * The member side is the published documents; the staff side names the desk
 * where that part is read and decided. A desk named here is on the console
 * menu, and the menu is what decides whether a reader can open it.
 */
const FOR_STAFF: DocTableRow[] = [
  {
    id: "s-account",
    cells: {
      part: "Accounts and profiles",
      member: "Sign up free with an email and a password or Google, fill in a profile, claim a handle, choose a language and what their public page shows.",
      staff: "The member file on People, and Lookup by name, email, phone or reference. Account recovery for somebody locked out of their email. You never change an email or a password for a member.",
    },
  },
  {
    id: "s-search",
    cells: {
      part: "Search, the map, saved places and compare",
      member: "Search by city, area or kind of place, narrow by light, water and the gate, switch to the map, save a place or a search, and put up to four side by side.",
      staff: "The front door funnel and the listing figures on Analytics: who arrives, who signs up, what is being viewed, saved and enquired about, by listing and by area.",
    },
  },
  {
    id: "s-intelligence",
    cells: {
      part: "VALLO Intelligence",
      member: "Types what they want in their own words, sees what search understood as chips they can remove, and gets real results by kind, with their own saved homes, offers, bookings and conversations under Yours.",
      staff: "Search, under Intelligence in the console menu, for Read-only analyst, Content and Marketing: what people look for as counts, never as people, and the aliases that teach search a word. No desk shows what one member searched.",
    },
  },
  {
    id: "s-listing",
    cells: {
      part: "A listing itself",
      member: "Read the price with the move-in total under it, the gallery and video, the amenities, the answers on light and water, who listed it and the map.",
      staff: "The Listings desk: approve, ask for more, or send it back with a reason. Approval and publishing wait on the lister's identity. Examples shows the example listings and when each retires.",
    },
  },
  {
    id: "s-viewings",
    cells: {
      part: "Viewings and inspection reports",
      member: "Book a viewing from the listing, in person or by live video, free, then fill in a report of eight rooms and areas.",
      staff: "Visits, as a week or month calendar, on the bookings desk. A member reporting a demand for an inspection fee becomes a case.",
    },
  },
  {
    id: "s-agreements",
    cells: {
      part: "Agreements for rent and sale",
      member: "Both sides confirm the same written terms, drawn from the listing's figures and the inspection report. A change moves the version and both confirm again.",
      staff: "The Agreements desk, which is the review gate before payment opens, with the risk threshold and the incident switch behind it. Both sides read a rejection's reason.",
    },
  },
  {
    id: "s-offers",
    cells: {
      part: "Offers and the Deal Room",
      member: "A buyer sends a written offer; the seller accepts, declines, counters or asks a question; every version is kept, with the inspection and the documents each side asked for.",
      staff: "The Offers and deals desk, from the first offer to the end of the deal. No money is involved at any point, so there is nothing to refund and nothing to release.",
    },
  },
  {
    id: "s-stays",
    cells: {
      part: "Stays: hotels, shortlets and serviced apartments",
      member: "Priced for their dates and party, with every charge at the door shown before booking, paid by card, one of four cancellation policies fixed on the booking, and an as-listed question from check-in.",
      staff: "Bookings for what is booked, in stay and finished. Payments and Chargebacks for the money. A no to the as-listed question reaches a person.",
    },
  },
  {
    id: "s-restaurants",
    cells: {
      part: "Restaurants and tables",
      member: "Book a table free, up to 90 days ahead, for up to 50 people, with a check-in code, a conversation and two reminders. The bill is paid at the restaurant.",
      staff: "Reservations for how each table went, and Restaurant fees for what a seated table owes and the seatings a restaurant and a diner disagree about.",
    },
  },
  {
    id: "s-roommates",
    cells: {
      part: "Roommates",
      member: "A roommate profile, posts for a room or a roommate, groups searching together, a directory of schools and states of posting, optional checks they can add, and a cost splitter.",
      staff: "The Roommates desk for its posts, profiles, checks and matching, and its cases on the Cases desk.",
    },
  },
  {
    id: "s-circle",
    cells: {
      part: "Circle and Around",
      member: "Communities to ask and answer about areas and property, and a feed of the places people live and work in, by local government, estate or campus.",
      staff: "The Circle desk and the Around desk for what is held or reported, Blocked terms for the words the safety scan acts on, and Withheld weight for reviews and reports that do not count.",
    },
  },
  {
    id: "s-messages",
    cells: {
      part: "Messages and calls",
      member: "Message any lister, host or restaurant from the listing, with property and stays in their own tabs, and video or audio calls where they are offered.",
      staff: "Flagged messages are a lane of the unified queue. Call volume, connect rate and minutes are on Call usage. Nobody reads a conversation without a reason written on the case.",
    },
  },
  {
    id: "s-assistant",
    cells: {
      part: "The assistant",
      member: "Asks it about finding, renting, buying and staying, in four languages. It searches the same listings a member does, so it names only real ones.",
      staff: "Nothing to moderate directly. A wrong answer is worth a case or a note to the Content desk, because the assistant reads the same published material staff do.",
    },
  },
  {
    id: "s-price",
    cells: {
      part: "Price Check",
      member: "Sees what similar properties nearby are currently asking, how many were found, how far away and how recent, and how sure it is.",
      staff: "Read-only. It needs enough real listings near the spot and says so when it has too few, and it never builds a figure from example listings. It is not a price put on a property, and nobody at Vallo may offer one.",
    },
  },
  {
    id: "s-badges",
    cells: {
      part: "Marks and the verification ladder",
      member: "Sees what has been looked at about a lister, one rung at a time, and what each rung means.",
      staff: "The Verification desk and its reviewer guide, Review calls where documents do not settle it, and Standing for a member's marks and strikes.",
    },
  },
  {
    id: "s-reviews",
    cells: {
      part: "Reviews",
      member: "Only somebody who stayed, was seated or holds a tenancy can review. A review cannot be edited once posted; a host replies once in public.",
      staff: "A review that breaks the rules is a case. Withheld weight is where a review or report that does not count is recorded, and where a mark is cleared.",
    },
  },
  {
    id: "s-money",
    cells: {
      part: "Money",
      member: "Pays by card inside Vallo, reads receipts, and asks about a refund.",
      staff: "The Money desk, Payments, Chargebacks, Fees, Referrals and Restaurant fees. Refunds are decided on the facts by the desk that owns them, never promised by whoever picked up the ticket.",
    },
  },
  {
    id: "s-rewards",
    cells: {
      part: "Rewards and referrals",
      member: "Invites friends with a link or a code and reads where their invites stand.",
      staff: "The Referrals desk: rewards owed, the monthly budget, and the referrals and payouts waiting on a decision. Whether a reward is paid depends on the campaign running.",
    },
  },
  {
    id: "s-support",
    cells: {
      part: "Support and reporting",
      member: "Writes in, reports a listing, a person or a post, and appeals a decision.",
      staff: "The Support desk and its lanes, Cases for one case per thing reported, Appeals for a second look, and Pages that fail for the help pages members say did not help.",
    },
  },
  {
    id: "s-privacy",
    cells: {
      part: "Privacy, data and leaving",
      member: "Asks for a copy of their data, hides their activity, blocks somebody, or deletes the account.",
      staff: "Account deletions reads why members leave as rates, never as names. Record retention lists money records past their retention date. Documents are opened only inside the console and never downloaded, printed or forwarded.",
    },
  },
  {
    id: "s-apps",
    cells: {
      part: "The apps, speed and faults",
      member: "Uses Vallo in a browser or as the Android and iPhone app on the same account, in English, Yoruba, Hausa or Igbo.",
      staff: "Crash log for iPhone, Android, the website and the server; Field speed for how fast it is on the phones people really use; Alerts and the Technical desk for anything live.",
    },
  },
];

export const PRODUCT_GUIDE: ManualBody = {
  intro: (
    <p>
      This chapter is for everybody who works at Vallo, on any desk. It says what Vallo is, feature by feature, who
      each feature is for, what it gives a business and what it gives a person, what it costs, and what is open today
      and what is not. Use it to answer a member, a prospect or a partner in the product&apos;s own words. If something
      here and something you were told elsewhere disagree, this page and the product are right: say only what is on
      this page.
    </p>
  ),
  glance: [
    "Vallo is a marketplace for property, stays and restaurant tables in Nigeria, with Roommates, communities and a local feed on the same account.",
    "Every lister and every listing is reviewed by a person at Vallo before it goes up. That is the reason to choose Vallo, for both sides.",
    "It is free to join, search, message, view and list. Vallo earns only on a completed, paid deal, from the lister's or host's share.",
    "Vallo never holds customer money. Card payments go to the owner, agent or host through the payment processor.",
    "Open today: search, VALLO Intelligence, listing, viewings, messages, agreements, offers on homes for sale, stays and hotel rooms paid by card, table bookings, Roommates, Circle, Around, the assistant and Price Check.",
    "Not open yet: paying rent through Vallo, the wallet, paying a restaurant bill, the Pro plan. Never promise these.",
    "Never promise a number of customers, a price for somebody's property, a refund, or that a deal carries no risk. Say what Vallo does.",
    "Naira is the price of record. Other currencies are a reading guide beside it, and never what anybody pays.",
    "Onboarding has a chapter of its own on each side: a lister, and a member.",
  ],
  sections: [
    {
      id: "in-one-minute",
      title: "Vallo in one minute",
      body: (
        <>
          <p>
            Vallo is a marketplace for property, stays and restaurants in Nigeria. A person can rent or buy a home, a
            shop, an office or land; book a hotel room, a shortlet or a serviced apartment; and book a table at a
            restaurant. Owners, agents, firms, hotels, shortlet hosts and restaurants list on Vallo, and a person at
            Vallo reviews each of them, and each listing, before it goes up.
          </p>
          <p>
            Around that sit Roommates, for people who want to share a home; Circle, communities where people ask and
            answer about areas and property; Around, a feed of the places people live and work in; an assistant that
            answers questions; and Price Check, which shows what similar properties nearby are asking.
          </p>
          <p>
            The problem Vallo exists to fix is ordinary and stubborn: in too many property searches in Nigeria, nobody
            can be sure that a listing is real, that the price is the price, or that the person at the other end is who
            they say. Vallo does not remove the agent. It removes the runaround: you see who you are dealing with and
            what you will pay before you call anybody.
          </p>
          <DocCallout tone="note" title="The one sentence to remember">
            Everything on Vallo was listed by a real person who applied and was reviewed, the full cost is shown before
            anybody calls, and Vallo is free until a deal is paid.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-is-open",
      title: "What is open today, and what is not",
      body: (
        <>
          <p>
            This is the table to keep open while you talk to anybody. A feature marked Not open yet is built or
            planned, and no member can use it today. Do not offer it, do not give a date for it, and do not let a
            prospect sign up expecting it.
          </p>
          <DocTable
            caption="Every feature, whether it is open, and what you may say"
            columns={[
              { key: "feature", label: "Feature" },
              { key: "status", label: "Today", kind: "state" },
              { key: "say", label: "What you may say" },
            ]}
            rows={STATUS}
          />
          <DocCallout tone="note" title="Not open yet means today, not forever">
            This table is checked against the product, and it moves often: several of these are being worked on now and
            some will have changed within a day or two of you reading this. Never promise a date, and never say a
            feature is coming. If you need to know where something stands right now, open the screen itself, or ask a
            super admin to read the Control room, which reads the live platform. The guide follows the product; it
            never runs ahead of it.
          </DocCallout>
          <DocCallout tone="warning" title="Vallo is new, and the catalogue is young">
            Most of the listings a visitor sees today are example listings, marked as examples, there to show how the
            platform works. Real listings are being added now. Say this plainly to a prospect: the first listers in
            each area are the ones people find. Never describe an example listing as a real property, and never tell a
            prospect how many customers they will get.
          </DocCallout>
        </>
      ),
    },
    {
      id: "for-businesses",
      title: "What Vallo gives a business (B2B)",
      body: (
        <>
          <p>
            A business on Vallo is anybody who lists: an owner or landlord, an agent, a registered firm, a hotel or
            guest house, a shortlet or serviced apartment host, or a restaurant. Each sets up a workspace on their own
            account. One account holds one side: an owner account cannot also be an agent account.
          </p>
          <DocTable
            caption="For each kind of business: what they get, and what Vallo asks of them"
            columns={[
              { key: "who", label: "Who" },
              { key: "gets", label: "What they get" },
              { key: "asks", label: "What Vallo asks for" },
            ]}
            rows={B2B}
          />
          <p>What every business gets, whichever kind they are:</p>
          <ul role="list">
            <li>
              <strong>Free listing.</strong> Not free for a trial period: listing is free. Nobody has to pay a monthly
              subscription to use Vallo.
            </li>
            <li>
              <strong>A page people can trust before they call.</strong> Who you are, what Vallo has confirmed about
              you, your listings, your reviews and how quickly you reply.
            </li>
            <li>
              <strong>Enquiries that have read the facts.</strong> The price, the move-in total, light, water and the
              gate are on the listing, so the first message is not the same five questions.
            </li>
            <li>
              <strong>Photos and video.</strong> Up to 15 photos and videos on a listing, in any mix; a video can be up
              to 60 seconds.
            </li>
            <li>
              <strong>One announcement.</strong> An approved listing is announced once in the place it sits in on
              Around, the local feed.
            </li>
            <li>
              <strong>Clear money.</strong> Before publishing, the lister sees the price a customer pays and what they
              receive after Vallo&apos;s commission, in naira.
            </li>
            <li>
              <strong>A workspace.</strong> Listings, enquiries, viewing times, bookings, the calendar, earnings and
              reviews in one place, on a phone or a computer.
            </li>
          </ul>
          <DocCallout tone="note" title="What a business agrees to">
            Charge nothing that is not on the listing. Add no charge without a stated reason. Keep every payment for a
            deal inside Vallo. Describe the place as it is: a guest is asked on arrival whether it is as listed.
          </DocCallout>
        </>
      ),
    },
    {
      id: "for-people",
      title: "What Vallo gives a person (B2C)",
      body: (
        <>
          <DocTable
            caption="For each kind of person: what they get"
            columns={[
              { key: "who", label: "Who" },
              { key: "gets", label: "What they get" },
            ]}
            rows={B2C}
          />
          <p>
            A person needs an account to see inside Vallo, and must be 18 or over. An account is free. Looking, saving,
            messaging and asking to view never cost anything.
          </p>
        </>
      ),
    },
    {
      id: "feature-by-feature",
      title: "Feature by feature",
      body: (
        <>
          <h3 className="nf-h4">Search, filters and the map</h3>
          <p>
            Type a city, an area or the kind of place. Tiles narrow it to rentals, homes, apartments, shortlets, villas,
            shops, offices, land and more. Sort by recommended, top rated or price. Light, water and the gate are
            filters, not small print. Switch to the map, save a place with the heart, save a search, and put up to four
            places side by side to compare.
          </p>
          <h3 className="nf-h4">VALLO Intelligence</h3>
          <p>
            One search across everything Vallo holds, in the member&apos;s own words. It has its own section below,
            because it is the first place to send a member who cannot find something.
          </p>
          <h3 className="nf-h4">Reading a listing</h3>
          <p>
            A rent is priced per year with the move-in total shown under it: every cost the lister named, each on its
            own row. The listing shows the key facts, the gallery and any video, the amenities, the answers on light
            and water, who listed it, their reviews and the map. An unanswered question shows as unanswered.
          </p>
          <h3 className="nf-h4">Viewings</h3>
          <p>
            Schedule a visit from the listing, in person or by live video from the property. It is free: Vallo charges
            no inspection fee. If an owner or agent asks for a fee to inspect, that is a private arrangement, it is not
            a Vallo charge, and the member can report it. After a viewing the member fills an inspection report of
            eight rooms and areas with notes and photos.
          </p>
          <h3 className="nf-h4">Agreements</h3>
          <p>
            For a rent or a sale, an agreement is drawn up from the listing&apos;s own figures and the inspection
            report. Both sides confirm the same version; if anything changes, the version moves and both confirm again.
            Money moves only after the viewing and the agreement.
          </p>
          <h3 className="nf-h4">Offers and the Deal Room</h3>
          <p>
            On a home that is for sale, Make an offer lets a buyer tell the seller in writing what they propose to
            pay, how they plan to pay and when they would like to complete. The seller can accept, decline, answer with
            a counteroffer or ask a question. Each offer and counteroffer is its own version, so nobody can later claim
            different terms were agreed. The Deal Room is where the offer lives: the versions, the inspection, the
            documents each side asks for, and the stage the deal has reached. Making an offer costs nothing, commits
            the buyer to nothing and does not take the home off the market. A buyer needs a government ID on their
            account and must be 18 or over. Vallo receives no part of the purchase price and asks for no deposit.
          </p>
          <h3 className="nf-h4">Paying</h3>
          <p>
            Every payment for a deal happens inside Vallo. A hotel room is paid by card when the guest books. A
            shortlet is paid when the host accepts, or at once where the host has chosen that for the listing. The payment
            goes to the owner, agent or host through the payment processor as soon as it clears, and Vallo never sees
            a full card number. A refund goes back the way the money came, usually within 5 to 10 working days.
            Paying rent through Vallo is not open yet, and Vallo does not take payment for a purchase at any stage.
          </p>
          <h3 className="nf-h4">Stays: hotels, shortlets and serviced apartments</h3>
          <p>
            Priced per night for the guest&apos;s dates and party. Every charge at the door (caution deposit, power,
            cleaning, an extra guest, a visitor) is answered by the host before the place can be published, and shown
            before booking. Unpaid dates are held for 48 hours at no cost. Each stay shows one of four cancellation
            policies, fixed on the booking when it is paid. From check-in, the guest is asked whether the place is as
            listed; a no goes to a person at Vallo.
          </p>
          <h3 className="nf-h4">Restaurants and tables</h3>
          <p>
            A diner books a table for free, up to 90 days ahead, for up to 50 people. The restaurant confirms or
            declines. The booking carries a check-in code and its own conversation, and Vallo reminds the diner the
            evening before and two hours before. The bill is paid at the restaurant. Only a diner who was seated can
            review.
          </p>
          <h3 className="nf-h4">Roommates</h3>
          <p>
            For people who want to share a home: students, corps members, graduates and young professionals. A
            roommate profile, posts for a room on offer or a roommate wanted, groups of two or more searching together
            with a shared shortlist, a directory of schools and of states of posting, optional checks a person can add
            (a code sent to a school email address, or a document such as a student ID or an NYSC call-up letter), and
            a cost splitter. The rule to repeat: meet in a public place, and never send money before seeing the room.
          </p>
          <h3 className="nf-h4">Circle</h3>
          <p>
            Communities for people who buy, rent, let, sell and work in property. A member asks a question, discusses
            an area, attaches a live listing to ask about it, and reads answers, with an accepted answer shown first.
            Communities can be public or private. An answer in Circle is a member&apos;s opinion, not Vallo&apos;s.
          </p>
          <h3 className="nf-h4">Around</h3>
          <p>
            A feed of places, not of strangers. A member joins their local government, estate or campus and reads what
            people there are saying. All 36 states, the Federal Capital Territory and all 774 local governments are
            there.
          </p>
          <h3 className="nf-h4">Messages and calls</h3>
          <p>
            Every listing has a message button, and a member does not need a booking to ask. Conversations sit in
            Messages, with property and stays in their own tabs. Keeping the conversation on Vallo is what gives
            support something to work from if a deal goes wrong.
          </p>
          <h3 className="nf-h4">The assistant</h3>
          <p>
            Answers questions about finding, renting, buying and staying, in English, Yoruba, Hausa or Igbo. It
            searches the same listings a member does, so it names only places that are really on Vallo. It is an AI,
            the member agrees before using it, and it never acts without the member&apos;s approval.
          </p>
          <h3 className="nf-h4">Price Check</h3>
          <p>
            Tell it where and what, and it shows what similar properties near there are currently advertised for on
            Vallo, how many it found, how far away and how recent, and how sure it is. It is the asking prices of
            listings, not what anybody paid, not a price put on a particular property and not advice. It needs at least
            five comparable real listings nearby, and it says so when it has too few. It does not price land, hotels or
            restaurants, and it never builds a figure from example listings.
          </p>
          <h3 className="nf-h4">How an identity is checked today</h3>
          <p>
            Every lister&apos;s identity is reviewed by a person at Vallo. On the verification desk, a reviewer opens
            the person and sees their document beside their selfie, the names on record, whether the bank account name
            agrees, and a panel of Cross-checks: whether the same ID number, the same file or a very similar picture is
            on another account, whether the image carries the mark of an editing app, and, for a passport, whether the
            check digits in the two lines at the bottom of the photo page pass. None of that proves an ID is genuine.
            It catches common forgeries and an ID used twice.
          </p>
          <p>
            A paid identity service is being set up. While identity is reviewed by hand, the rule is simple and it is
            the founder&apos;s own: <strong>if you are not sure about an ID, do not decide it.</strong>{" "}
            Do not approve it, do not tell the member what you suspect, and press Escalate. It reaches a person who can
            decide. Nobody is marked down for escalating an ID that turns out to be real.
          </p>
          <h3 className="nf-h4">Badges and verification</h3>
          <p>
            The verification ladder says what Vallo has confirmed about a lister, one rung at a time, each decided by a
            person. The Verified tick appears only once a person at Vallo has looked at the ID of the lister behind the
            listing. The Ownership seen mark means a reviewer saw an owner&apos;s document: it is not a title search
            and not legal advice. Other badges are earned from what really happened, such as replying quickly. A badge
            is not a promise about how anybody will behave.
          </p>
          <h3 className="nf-h4">Reviews</h3>
          <p>
            Only somebody who stayed, was seated or holds a tenancy can review. A review cannot be edited once posted.
            A host can reply once, publicly, and can ask Vallo to look at a review that breaks the rules.
          </p>
          <h3 className="nf-h4">Tools that need no account</h3>
          <p>
            A move-in calculator that shows the real total up front, area price pages, and a checker for a property
            advert or a receipt seen elsewhere. These are open to anybody and are a good first thing to show a person.
          </p>
          <h3 className="nf-h4">Notifications</h3>
          <p>
            A member chooses what reaches them: bookings, messages, payments and agreements, and separately ideas and
            offers. Marketing is off until they turn it on, and nobody at Vallo turns it on for them. Notifications
            arrive in the app, as a push on a phone where the app is installed and push is allowed, and by email
            according to their email preferences.
          </p>
          <h3 className="nf-h4">Rewards and referrals</h3>
          <p>
            A member invites people with a link or a code, and can see where each invite stands. Whether a reward is
            paid depends on the campaign running at the time, and the screen says which. Never tell somebody a reward
            is owed: the Referrals desk decides each one against the budget, and the figures a member reads are their
            own.
          </p>
          <h3 className="nf-h4">The workspaces a lister works from</h3>
          <p>
            An approved lister does not work from the ordinary member screens. An owner or agent has a workspace with
            their listings, enquiries, viewing times, inspections, a calendar, earnings, reviews, their figures per
            listing, and paid promotion where it is offered. A host has rooms or tables, a calendar, bookings and
            requests to accept, photographs, arrival details, earnings with a statement, and their own settings. A
            restaurant has its tables, its hours and the fees a seated table owes.
          </p>
          <h3 className="nf-h4">A tenancy after the keys</h3>
          <p>
            Once a tenancy exists it has a file of its own: the terms, the move-in figures each on their own row, the
            documents, and a way to raise a complaint about the property that reaches a person. The move-in total a
            renter saw on the listing is the same total they see here, which is the point of asking a lister for every
            cost before publishing. Paying the rent itself through Vallo is not open, so a tenancy file today records
            an agreement rather than a payment.
          </p>
          <h3 className="nf-h4">Cancellations and refunds</h3>
          <p>
            Every stay carries one of four cancellation policies, chosen by the host and fixed on the booking at the
            moment it is paid, so a later change to the listing cannot move it. A refund that is due goes back to the
            card or account the money came from, and banks usually show it within 5 to 10 working days. A refund is
            decided by the desk that owns it, on the facts of the booking and the policy on it, never by whoever is in
            the conversation.
          </p>
          <h3 className="nf-h4">A member&apos;s data, and leaving</h3>
          <p>
            A member can ask for a copy of their data, hide their activity, block another member, and delete their
            account. Deleting is theirs to do, from their own settings. The reason they give is read as a rate on the
            account deletions desk and never as a name beside a reason. Money records are kept for as long as the
            rules require and no longer, which is what the record retention desk lists.
          </p>
          <h3 className="nf-h4">Languages and apps</h3>
          <p>
            English, Yoruba, Hausa and Igbo. Vallo runs in any web browser and as the app for Android phones and
            iPhones, from Google Play and the App Store, on the same account.
          </p>
        </>
      ),
    },
    {
      id: "intelligence",
      title: "VALLO Intelligence: one search across Vallo",
      body: (
        <>
          <p>
            VALLO Intelligence is one search across everything Vallo holds. A member types what they want in their own
            words, such as &quot;2 bedroom in Lekki under 5m&quot; or &quot;hotels in Abuja this weekend&quot;, and gets
            real results grouped by kind. Every result is a real record or a real screen of Vallo. Nothing in the
            results is written by an AI. It lives at{" "}
            <Link href="/intelligence" className={A}>
              /intelligence
            </Link>
            .
          </p>
          <h3 className="nf-h4">Four ways in</h3>
          <ul role="list">
            <li>
              <strong>The menu.</strong> VALLO Intelligence, near the top of the side menu. On a phone it is the first
              row of the menu.
            </li>
            <li>
              <strong>The + Create sheet.</strong> VALLO Intelligence sits directly below Post to story. Where there is
              no story to post to, it is first.
            </li>
            <li>
              <strong>Home.</strong> A bar that reads Search everything VALLO, with example searches turning over in
              it. It opens VALLO Intelligence with the cursor in the box. The search box in Home&apos;s top banner is a
              different thing: it searches the marketplace, the same as Search.
            </li>
            <li>
              <strong>The keyboard.</strong> On a computer, Ctrl K (Cmd K on a Mac) opens it from anywhere in the app,
              even from inside a box. Inside the console the same keys open Search the console instead.
            </li>
          </ul>
          <h3 className="nf-h4">What it searches</h3>
          <DocTable
            caption="The tabs on VALLO Intelligence, and who sees each"
            columns={[
              { key: "tab", label: "Tab" },
              { key: "what", label: "What is in it" },
              { key: "who", label: "Who sees it" },
            ]}
            rows={INTELLIGENCE_TABS}
          />
          <p>
            A tab with nothing in it for a search is not shown. When a place is named, a card for that place leads the
            results, with what Vallo holds there.
          </p>
          <h3 className="nf-h4">How it reads the words</h3>
          <ul role="list">
            <li>
              <strong>Search understood.</strong> Above the results, chips say what search took from the words: rent or
              buy, the place, bedrooms, a budget, furnished, amenities, dates and guests. Tapping a chip removes that
              filter and searches again. Edit filters opens the same filters as a form, and Clear removes them all.
            </li>
            <li>
              <strong>Spelling.</strong> A misspelling is offered, never applied without saying so. For
              &quot;resturants&quot; the screen asks Searching for restaurants? If the words as typed found nothing and
              the fix finds something, it shows those results and says so: Showing results for restaurants, with a link
              to search the words as typed instead.
            </li>
            <li>
              <strong>Place nicknames.</strong> It knows how people write places: VI for Victoria Island, Lekki ph 1 for
              Lekki Phase 1, PH for Port Harcourt, FCT for Abuja, Lasgidi for Lagos. It only knows places on Vallo&apos;s
              own list. A place it does not know is searched as plain words, never guessed. Staff on the Search desk can
              add more nicknames and spellings (chapter 10).
            </li>
            <li>
              <strong>A long question.</strong> When somebody types a long sentence the rules cannot read, such as
              &quot;somewhere quiet for my mum near her church in Surulere&quot;, Vallo AI may be asked to turn the words
              into the same filters. That happens only when they press Search, only if they agreed to use Vallo AI, and
              only the words are sent. The screen says Read with Vallo AI. The results still come from Vallo&apos;s own
              records.
            </li>
            <li>
              <strong>Nothing found.</strong> The screen offers other ways in, such as any budget, all of Lagos or the
              spelling fix, and each one is tried first so it only appears when it finds something.
            </li>
          </ul>
          <h3 className="nf-h4">The empty screen, moods and voice</h3>
          <ul role="list">
            <li>
              Before a search, the screen is a quiet page to start from. A signed-in member sees their own recent
              searches first, each one removable, with Clear all. Then Start with a mood, the cities the newest places
              are in, Suggested for you, a few searches to try, popular searches (only words at least three different
              visits searched in 30 days), the newest listings, and people to follow. A list with nothing real in it is
              left out.
            </li>
            <li>
              <strong>Start with a mood</strong> turns a feeling into a real search: Work from home (wifi and a
              workspace), Room for family (3 bedrooms), A weekend away (shortlets this weekend), Pool days (a pool) and
              Light all day (a generator).
            </li>
            <li>
              <strong>Search by voice.</strong> The microphone button lets a member speak instead of typing, where their
              browser can turn speech into words. The browser does that, not Vallo; on some browsers, Chrome among them,
              the sound goes to the browser&apos;s maker. The words land in the box and nothing is searched until they
              press Search. The first time on a device, a note on screen says all of this.
            </li>
            <li>
              <strong>The Intelligence button</strong> opens a short panel: suggest filters, explain these filters,
              compare two results, nearby areas, where do I find. Each one opens Vallo AI with the search written into
              the question. Nothing is sent until the member sends it.
            </li>
          </ul>
          <h3 className="nf-h4">Example listings</h3>
          <p>
            Example listings can appear in results, after the real ones. Each says Example listing. Not available. It
            carries no trust mark and offers nothing but opening it. If a member asks why they cannot book one, that is
            why.
          </p>
          <h3 className="nf-h4">Signed in, and signed out</h3>
          <p>
            Like Search, VALLO Intelligence needs an account while the catalogue is closed to visitors, and a visitor
            is asked to sign in. If the founder opens the catalogue to visitors, a visitor can use it too, but sees only
            places, properties, stays, restaurants, rooms offered by roommates, screens and help. People, communities,
            posts, recent searches and the Yours tab are for signed-in members only.
          </p>
          <h3 className="nf-h4">Privacy</h3>
          <ul role="list">
            <li>
              A member&apos;s own records under Yours are read through their own account, so they see only what is
              theirs. No desk in the console shows another member&apos;s results.
            </li>
            <li>
              Recent searches are kept for the member alone: their last 20, which they can remove one by one or all at
              once. They go when the account is deleted. No desk in the console shows them.
            </li>
            <li>
              For the Search desk, Vallo keeps each search as the words, what kind of thing they pointed at, how many
              results came back and how long it took. It keeps no account id and no address. The visit is kept only as
              a code that cannot be turned back into who it was. Words carrying a long run of digits, such as a phone or
              account number, are dropped and never kept.
            </li>
            <li>
              The desk shows counts, and shows words only once three different visits searched them. No search on the
              desk is tied to a person.
            </li>
          </ul>
          <DocCallout tone="note" title="When a member cannot find something">
            Ask them what they typed, and try the same words in VALLO Intelligence yourself. Read the Search
            understood chips: a wrong place or a budget they did not mean is the usual cause, and tapping the chip
            removes it. If a word is not understood, tell the Content desk, which can add it as an alias. If nothing on
            Vallo matches, say so plainly. Never promise that a listing will appear.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-it-costs",
      title: "What Vallo costs",
      body: (
        <>
          <DocTable
            caption="Who pays Vallo, and what"
            columns={[
              { key: "who", label: "Who" },
              { key: "pays", label: "What they pay" },
            ]}
            rows={FEES}
          />
          <p>
            The payment processor&apos;s and the payment partner&apos;s fees are their own charges. Vallo does not keep
            them. The percentages are round figures: the exact amount is always shown in naira before a lister agrees.
            The member-facing page is{" "}
            <Link href="/docs/what-vallo-costs" className={A}>
              What Vallo costs
            </Link>
            ; send that link rather than typing figures from memory.
          </p>
        </>
      ),
    },
    {
      id: "the-money-in-full",
      title: "The money in full: every fee, who pays, what Vallo keeps",
      body: (
        <>
          <p>
            The section above is the short answer. This is the whole of it, and it is the one part of the product where
            a wrong sentence costs somebody money. Every figure here is read from the fee schedule the product itself
            charges on, so none of it can drift out of date while this page says otherwise.
          </p>
          <DocTable
            caption="Every payment on Vallo: who pays, and what Vallo keeps"
            columns={[
              { key: "payment", label: "The payment" },
              { key: "pays", label: "Who pays, and what" },
              { key: "keeps", label: "What Vallo keeps" },
            ]}
            rows={MONEY_IN_FULL}
          />
          <h3 className="nf-h4">The five sentences to know by heart</h3>
          <ul role="list">
            <li>{NO_RENTER_FEES_LINE}</li>
            <li>{FEE_WHO_PAYS}</li>
            <li>{CARD_RAIL_MOVES}</li>
            <li>{PAYOUT_ANSWER}</li>
            <li>{REFUND_ROUTE}</li>
          </ul>
          <h3 className="nf-h4">The rates, said exactly</h3>
          <p>{FEE_OTHER_LINE}</p>
          <p>{FEE_RENT_LINE}</p>
          <p>
            {FEE_PROVIDER_CHARGES} {FEE_ROUND_NOTE}
          </p>
          <p>{HOTEL_COMMISSION_SENTENCE}</p>
          <h3 className="nf-h4">Who holds the money</h3>
          <p>
            {GOVERNING_SENTENCE} A card payment is split at the processor in the one transaction: the owner&apos;s,
            agent&apos;s or host&apos;s share goes to their own bank account, Vallo&apos;s fee comes to Vallo, and
            Vallo never sees a full card number. There is no account on Vallo holding anybody&apos;s balance.
          </p>
          <h3 className="nf-h4">What is not open, in money terms</h3>
          <ul role="list">
            <li>
              <strong>Paying rent through Vallo.</strong> {RENT_PAYMENT_NOT_OPEN} The rent fee above is what it will
              cost when it opens, and it is not charged to anybody today.
            </li>
            <li>
              <strong>Paying for a purchase.</strong> {SALE_NEVER_PAID_ON_VALLO} This one is not a switch waiting to be
              turned on: it is how Vallo works.
            </li>
            <li>
              <strong>A payment held by a licensed bank until a deal is done.</strong> Built, and switched off. Do not
              describe it to a member or a prospect as something they can use, and do not name a partner for it.
            </li>
            <li>
              <strong>A wallet, a balance, a top-up or a withdrawal.</strong> Not open. Vallo keeps no balance for
              anybody.
            </li>
            <li>
              <strong>Paying a restaurant bill through Vallo, and crypto.</strong> Not open. A diner pays the
              restaurant, and Vallo takes no crypto.
            </li>
            <li>
              <strong>Payouts of money held by Vallo.</strong> There are none, because nothing is held. A lister is
              paid by the processor in the same transaction as the payment.
            </li>
          </ul>
          <h3 className="nf-h4">The held payment, and Vallo&apos;s own earnings</h3>
          <p>
            When a payment held by a licensed bank is used, it costs about {FEE_PERCENT.rentTotal}% in total: Vallo&apos;s{" "}
            {FEE_PERCENT.vallo}% and the payment partner&apos;s own fee of about {FEE_PERCENT.rentPartner}%. Quote it that
            way, as two parts and an approximate total, and send the{" "}
            <Link href="/docs/what-vallo-costs" className={A}>
              What Vallo costs
            </Link>{" "}
            page rather than a figure from memory. Vallo&apos;s {FEE_PERCENT.vallo}% is sent with each payment itself, so
            the share that applied is on the record of that one payment. The partner&apos;s fee is the partner&apos;s, and it
            never passes through Vallo.
          </p>
          <p>
            Vallo&apos;s share lands in Vallo&apos;s own wallet at the payment partner. It is Vallo&apos;s money, never a
            member&apos;s: a lister is paid straight to their own bank when a payment is released. Once a day a sweep moves
            Vallo&apos;s share to Vallo&apos;s own bank account, one payout at a time. It does nothing until its switch is on
            and the destination bank account is set, so until then the money stays in the wallet. The super admin reads where
            it stands in the{" "}
            <Link href="/admin/control" className={A}>
              Control room
            </Link>
            , under Vallo&apos;s own earnings.
          </p>
          <DocCallout tone="note" title="Who answers about the sweep">
            Vallo&apos;s own earnings and the sweep are for Finance and the super admin. If anybody else is asked about
            them, say it is Vallo&apos;s own money and never a member&apos;s, and pass the question to Finance.
          </DocCallout>
          <h3 className="nf-h4">Two things that are free and are often doubted</h3>
          <p>
            {NO_INSPECTION_FEE} {PRIVATE_FEE_NOTE}
          </p>
          <p>
            Listing is free, and not free for a trial. Nobody has to pay a subscription to list, book, view or be paid.
          </p>
          <h3 className="nf-h4">Prices in other currencies</h3>
          <p>
            Naira is the price. Every listing is priced in naira and every payment is charged in naira. Beside a naira
            figure a member can read an approximate guide in {OTHER_CURRENCIES}, worked out from a published rate that
            is refreshed twice a day, and it is marked as approximate every time it appears.
            It never appears on a money screen: not a checkout, a receipt, a refund, a payout, an offer, an agreement
            or the move-in figures. A lister cannot enter or publish a price in another currency, and nobody is ever
            charged in one.
          </p>
          <DocCallout tone="warning" title="What you never say about money">
            That Vallo holds, keeps or looks after anybody&apos;s money. That a payment is held for a member today.
            That a refund or a payout will be made, which another desk decides on the facts. A figure from memory: the
            exact naira amount is always on the screen in front of the person.
          </DocCallout>
        </>
      ),
    },
    {
      id: "the-platform-today",
      title: "What the platform looks like today, honestly",
      body: (
        <>
          <p>
            Said plainly, because a prospect can tell when it is not: the product is built and the catalogue is young.
            Read against the live platform on 15 November 2026, the public catalogue held 64 example listings, which
            are marked as examples, and one real approved listing, with 32 member accounts on the platform. Every one
            of those figures moves, so read the live one rather than quoting this page: the examples and their retirement
            dates are on{" "}
            <Link href="/admin/examples" className={A}>
              Examples
            </Link>
            , the live counts on{" "}
            <Link href="/admin/analytics" className={A}>
              Analytics
            </Link>
            , and the platform in one answer in the control room, which only a super admin opens.
          </p>
          <h3 className="nf-h4">What that means in a conversation</h3>
          <ul role="list">
            <li>
              <strong>Never promise customers.</strong> Not a number of enquiries, not a number of bookings, not
              &quot;you will be busy by December&quot;. What you can say is true and better: listing costs nothing, and
              the first listers in an area are the ones people find.
            </li>
            <li>
              <strong>Never let an example listing be mistaken for a real one.</strong> They are there to show how the
              platform works and they are marked. If a prospect asks how many real listings there are, give the figure
              from the desk, not an impression.
            </li>
            <li>
              <strong>Lead with what is finished.</strong> A person at Vallo reviews every lister and every listing;
              the full cost is on the listing before anybody calls; viewings are free; a written agreement comes before
              money; a card payment goes to the lister through the processor, not to Vallo.
            </li>
            <li>
              <strong>Be straight about what is not open.</strong> Paying rent through Vallo is not open. Say so early.
              A prospect who signs up expecting it is a complaint in three weeks.
            </li>
            <li>
              <strong>Bring supply, not promises.</strong> The honest pitch to a landlord or a hotel is that it is free
              to be here, a person checks who you are so a stranger can trust your listing, and your page shows what
              you charge before anybody rings.
            </li>
          </ul>
          <DocCallout tone="note" title="Built, and switched on, are two different things">
            Several parts of this product are finished and switched off on purpose: payment held by a licensed bank,
            the paid identity check, the wallet, the landlord line. Finished is not available. Only the screen itself,
            or a super admin reading the control room, says where something stands right now.
          </DocCallout>
        </>
      ),
    },
    {
      id: "every-part-for-staff",
      title: "Every part of the product, and what staff can do about it",
      body: (
        <>
          <p>
            The member documents are written for members. This is the same ground with the other half added: what staff
            can see and where they do something about it. Where a row names a desk, that is where the work happens; the
            documents it names are what to send a member rather than retyping an answer.
          </p>
          <DocTable
            caption="Each part of the product, what a member does, and what staff can see and do"
            columns={[
              { key: "part", label: "The part" },
              { key: "member", label: "What a member does" },
              { key: "staff", label: "What staff can see and do" },
            ]}
            rows={FOR_STAFF}
          />
          <p>
            Nothing in that last column happens quietly. Every file you open and every decision you take is written to
            the audit log with your name, and a member reads the reason you wrote exactly as you wrote it.
          </p>
        </>
      ),
    },
    {
      id: "onboarding",
      title: "Onboarding: the two chapters to read next",
      body: (
        <>
          <p>
            Bringing somebody onto Vallo is most of the work of several desks, so it has two chapters of its own rather
            than a paragraph here.
          </p>
          <ul role="list">
            <li>
              <Link href="/admin/manual/onboarding-a-lister" className={A}>
                Onboarding a lister, end to end
              </Link>
              : the five doors, what each kind of lister gives, how long each step takes, what the reviewer looks at,
              what happens when something is missing, what the lister sees at each step, and the words to use when
              asking a business for their papers.
            </li>
            <li>
              <Link href="/admin/manual/onboarding-a-member" className={A}>
                Onboarding a member
              </Link>
              : sign up to first booking, what Vallo asks for and exactly when, the settings members ask about, and
              what staff can see and do about a member.
            </li>
          </ul>
          <DocCrossLink href="/admin/manual/queues">Working a queue, for the decisions those two chapters end in</DocCrossLink>
        </>
      ),
    },
    {
      id: "how-review-works",
      title: "How Vallo reviews listers and listings",
      body: (
        <>
          <p>
            This is the heart of the pitch to both sides, so know it exactly.
          </p>
          <ul role="list">
            <li>
              <strong>The lister.</strong> Before anybody can publish, they set up a workspace and give their identity
              (a government ID or NIN), proof of address where the role needs it, business papers for a firm or a host,
              and a Nigerian bank account in their own name. A person at Vallo looks at these and approves, asks for
              more, or says no with a reason.
            </li>
            <li>
              <strong>The listing.</strong> A person at Vallo reads each listing before it goes up, and approves it,
              asks for more, or rejects it with a reason the lister can read and act on.
            </li>
            <li>
              <strong>An agent&apos;s instruction.</strong> An agent or firm listing goes live only once Vallo has
              confirmed the owner who instructed them.
            </li>
            <li>
              <strong>Afterwards.</strong> Members can report a listing, a person or a post. A guest is asked on
              arrival whether a stay is as listed. A listing or a lister can be suspended.
            </li>
          </ul>
          <DocCallout tone="warning" title="What review is not">
            Review is a person looking at documents and a listing. It is not a promise that a deal will go well, a
            search of title, a survey of the building or legal advice. Never tell anybody that a property, a person or
            a payment on Vallo carries no risk. Say what was looked at, and tell buyers to use their own solicitor.
          </DocCallout>
        </>
      ),
    },
    {
      id: "what-to-say",
      title: "What to say when you are asked",
      body: (
        <>
          <p>
            These are the questions that come up most, with an answer you can use as it stands. Your desk&apos;s copilot
            reads this page, so you can also ask it to draft a reply and then check the draft against this table.
          </p>
          <DocTable
            caption="Common questions and an honest answer to each"
            columns={[
              { key: "asked", label: "What you are asked" },
              { key: "say", label: "What you can say" },
            ]}
            rows={SAY_THIS}
          />
        </>
      ),
    },
    {
      id: "never-say",
      title: "What nobody at Vallo says",
      body: (
        <>
          <ul role="list">
            <li>That Vallo holds, keeps or looks after anybody&apos;s money. It never does.</li>
            <li>That a listing, a person, a place or a payment comes with a promise of safety. Say what was looked at and by whom.</li>
            <li>A number of customers, enquiries or bookings a business will get.</li>
            <li>That Vallo puts a price on a property. Price Check shows asking prices, with how sure it is.</li>
            <li>That listing is free only for now, or for a first period. Listing is free.</li>
            <li>That a feature marked Not open yet is available, or a date for it.</li>
            <li>That a member will get a refund or a payout. Another desk decides that, on the facts.</li>
            <li>That the Vallo Guarantee exists. It was retired on 9 November 2026.</li>
            <li>Anything about a named member to somebody else. Use a reference or a count.</li>
          </ul>
          <p>
            If you are asked something this chapter does not answer, do not guess. Say you will find out, then ask your
            lead or use the Escalate button, described in{" "}
            <Link href="/admin/manual/escalation" className={A}>
              Escalation and out of hours
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: "where-to-send-people",
      title: "Where to send people",
      body: (
        <>
          <p>A link to the right page is better than a long message. These are the pages members can open.</p>
          <ul role="list">
            <li>
              <Link href="/docs/what-vallo-is" className={A}>What Vallo is</Link>, for anybody new.
            </li>
            <li>
              <Link href="/intelligence" className={A}>VALLO Intelligence</Link>, for anybody who cannot find something.
            </li>
            <li>
              <Link href="/docs/what-vallo-costs" className={A}>What Vallo costs</Link>, for every fee.
            </li>
            <li>
              <Link href="/docs/listing-on-vallo" className={A}>Listing a property</Link>,{" "}
              <Link href="/docs/for-owners" className={A}>For owners and landlords</Link> and{" "}
              <Link href="/docs/for-agents" className={A}>For agents and firms</Link>.
            </li>
            <li>
              <Link href="/docs/hosting" className={A}>Hosting a hotel or shortlet</Link> and{" "}
              <Link href="/docs/restaurants" className={A}>Restaurants and tables</Link>.
            </li>
            <li>
              <Link href="/docs/roommates" className={A}>Roommates</Link> and{" "}
              <Link href="/docs/circle" className={A}>Vallo Circle</Link>.
            </li>
            <li>
              <Link href="/docs/paying-on-vallo" className={A}>How paying works</Link> and{" "}
              <Link href="/docs/badges-and-verification" className={A}>Badges and verification</Link>.
            </li>
            <li>
              <Link href="/docs/trust-and-safety" className={A}>Avoiding scams and reporting</Link>.
            </li>
          </ul>
        </>
      ),
    },
  ],
};
