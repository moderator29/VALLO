import type { ChatCardData } from "@/components/app/messages/ChatCard";
import type { ThreadBubble } from "@/app/(app)/messages/[id]/ThreadView";
import type { InboxRow } from "@/app/(app)/messages/Inbox";
import type { ThreadContext } from "@/lib/messages/live";
import type { Inspection } from "@/lib/inspections/types";
import type { InspectionListingFacts } from "@/components/app/inspections/InspectionSheet";
import type { QueueRowData } from "@/app/admin/_components/QueueTable";
import { formatMoney } from "@vallo/i18n/core";
import { shareBody } from "@/components/app/messages/share";
import { COUNTERPART, HOTEL, PERSON } from "../_fixtures/people";

/**
 * F5's fixtures: brand-neutral, the catalogue's fictional names, never a real
 * person or brand. They render the real components so the look can be
 * screenshotted in a sandbox with no session. Never the proof of the writes.
 */

export const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
export const BOOKING_ID = "00000000-0000-4000-8000-00000000b001";
export const LISTING_ID = "00000000-0000-4000-8000-00000000a001";
export const INSPECTION_ID = "00000000-0000-4000-8000-00000000d001";

export const BOOKING_CARD: ChatCardData = {
  kind: "booking",
  id: BOOKING_ID,
  listingId: HOTEL.id,
  title: HOTEL.name,
  area: HOTEL.area,
  city: HOTEL.city,
  photo: "/brand/photos/bedroom-02.jpg",
  hue: 2,
  listingKind: "hotel",
  status: "CONFIRMED",
  statusLabel: "Confirmed",
  checkInLabel: "22 Jun 2026",
  checkOutLabel: "25 Jun 2026",
  partyLines: ["2 adults", "1 room"],
  roomName: "Deluxe room",
  features: ["King bed", "Free WiFi", "Breakfast included"],
  totalLabel: formatMoney(18_000_000),
  nightsLabel: "3 nights",
  rating: 5,
};

export const LISTING_CARD: ChatCardData = {
  kind: "listing",
  id: LISTING_ID,
  title: "Luxury 2 bedroom apartment",
  area: "Lekki Phase 1",
  city: "Lagos",
  photo: "/brand/photos/bedroom-01.jpg",
  hue: 1,
  listingKind: "rental",
  verified: true,
  priceLabel: formatMoney(280_000_000),
  periodLabel: "per year",
  bedrooms: 2,
  bathrooms: 2,
  rating: null,
};

export const BOOKING_THREAD: ThreadBubble[] = [
  {
    id: "m1",
    mine: false,
    body: `Hello ${PERSON.name.split(" ")[0]}\nYour booking is confirmed. Here are the details for your stay at ${HOTEL.name}.`,
    timeLabel: "09:12",
    imageUrl: null,
  },
  {
    id: "m2",
    mine: false,
    body: shareBody({ kind: "booking", id: BOOKING_ID }),
    timeLabel: "09:12",
    imageUrl: null,
    card: BOOKING_CARD,
  },
  {
    id: "m3",
    mine: true,
    body: "This looks perfect. Can you also confirm if late check out is available?",
    timeLabel: "09:18",
    imageUrl: null,
    read: true,
  },
  {
    id: "m4",
    mine: false,
    body: "Yes, late check out is available until 2:00 PM at no extra cost. Just let us know your preferred time on the day of your stay.\n\nWe look forward to hosting you.",
    timeLabel: "09:21",
    imageUrl: null,
  },
];

export const BOOKING_CONTEXT: ThreadContext = {
  kind: "booking",
  booking: {
    id: BOOKING_ID,
    status: "CONFIRMED",
    checkIn: "2026-06-22",
    checkOut: "2026-06-25",
    title: HOTEL.name,
    nights: 3,
    totalMinor: 18_000_000,
    listingId: HOTEL.id,
  },
  stateEvents: [
    { at: "2026-06-01T09:00:00.000Z", from: null, to: "PENDING" },
    { at: "2026-06-01T09:03:00.000Z", from: "PENDING", to: "CONFIRMED" },
  ],
};

const PHOTO = (n: number) =>
  `/brand/photos/${["living-room-day", "bedroom-01", "bedroom-02", "bathroom-01"][n % 4]}.jpg`;

export const RENTAL_THREAD: ThreadBubble[] = [
  { id: "r1", mine: false, body: "Hi, is this apartment still available for rent?", timeLabel: "10:24", imageUrl: null },
  {
    id: "r2",
    mine: true,
    body: "Yes, it is still available. The property is in a great location and ready for immediate move in.",
    timeLabel: "10:32",
    imageUrl: null,
    read: true,
  },
  { id: "r3", mine: false, body: "Perfect. Can you send me more photos and the monthly rent price?", timeLabel: "10:38", imageUrl: null },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `r4-${i}`,
    mine: true,
    body: "\u{1F4F7} Photo",
    timeLabel: "10:42",
    imageUrl: PHOTO(i),
    read: true,
  })),
  {
    id: "r5",
    mine: true,
    body: `Here are more photos of the apartment. The yearly rent is ${formatMoney(280_000_000)}.`,
    timeLabel: "10:42",
    imageUrl: null,
    read: true,
  },
  { id: "r6", mine: false, body: "This looks amazing. Can we schedule an inspection for this weekend?", timeLabel: "10:50", imageUrl: null },
  {
    id: "r7",
    mine: true,
    body: "Absolutely. I will send you available time slots and confirm once you pick one.",
    timeLabel: "10:53",
    imageUrl: null,
    read: false,
  },
];

export const RENTAL_CONTEXT: ThreadContext = {
  kind: "listing",
  listing: { id: LISTING_ID, title: "Luxury 2 bedroom apartment", area: "Lekki Phase 1", city: "Lagos", listingRole: "agent" },
};

export const INSPECTION: Inspection = {
  id: INSPECTION_ID,
  listingId: LISTING_ID,
  listingTitle: "Lekki Phase 1 apartment",
  state: "CONFIRMED",
  requestedAt: "2026-06-24T09:00:00.000Z",
  slotAt: "2026-06-24T09:00:00.000Z",
  note: null,
  listerNote: "The gate closes at 6, so earlier is better.",
  createdAt: "2026-06-20T12:00:00.000Z",
  respondedAt: "2026-06-21T08:00:00.000Z",
  conversationId: CONVERSATION_ID,
  counterpartName: COUNTERPART.name,
  /* A number the read would have allowed: the sheet draws the call line only
     when `lib/security/counterpart-contact.ts` gave one. */
  counterpartPhone: "+2348010000000",
  counterpartPhoneFormatted: "+234 801 000 0000",
  outcome: null,
};

export const INSPECTION_FACTS: InspectionListingFacts = {
  area: "Lekki Phase 1",
  city: "Lagos",
  kind: "rental",
  kindLabel: "2 bedroom apartment",
  priceLabel: formatMoney(250_000_000),
  periodLabel: "per year",
  photo: "/brand/photos/living-room-day.jpg",
  hue: 3,
};

export const INBOX: InboxRow[] = [
  {
    id: CONVERSATION_ID,
    counterpartName: HOTEL.name,
    listingTitle: HOTEL.name,
    lastMessage: "Yes, late check out is available until 2:00 PM at no extra cost.",
    whenLabel: "09:21",
    unread: 2,
    isRequest: false,
    counterpartKind: "agent",
    counterpartVerified: true,
    counterpartTier: "gold" as const,
    contextKind: "booking",
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    counterpartName: COUNTERPART.name,
    listingTitle: "Luxury 2 bedroom apartment",
    lastMessage: "Absolutely. I will send you available time slots and confirm once you pick one.",
    whenLabel: "10:53",
    unread: 0,
    isRequest: false,
    counterpartKind: "agent",
    counterpartVerified: true,
    counterpartTier: "gold" as const,
    contextKind: "listing",
  },
  {
    id: "00000000-0000-4000-8000-00000000c003",
    counterpartName: "Adaora Nwosu",
    listingTitle: "Table at The Harbour Kitchen",
    lastMessage: shareBody({ kind: "listing", id: LISTING_ID }),
    whenLabel: "Yesterday",
    unread: 0,
    isRequest: false,
    counterpartKind: "member",
    counterpartVerified: false,
    counterpartTier: "none" as const,
    contextKind: "reservation",
  },
  {
    id: "00000000-0000-4000-8000-00000000c004",
    counterpartName: "Ibrahim Musa",
    listingTitle: "Maitama 3 bedroom duplex",
    lastMessage: "Good afternoon. Is the duplex still on the market?",
    whenLabel: "Mon",
    unread: 1,
    isRequest: true,
    counterpartKind: "member",
    counterpartVerified: false,
    counterpartTier: "none" as const,
    contextKind: "listing",
  },
];

export const ADMIN_ROWS: QueueRowData[] = [
  { id: "1", reference: "LST-1024", type: "Listing", icon: "house", title: "Luxury 2 bedroom apartment", place: "Lekki, Lagos", detail: `${formatMoney(165_000_000)} per year`, detailSub: "2 beds, 2 baths", status: "UNDER_REVIEW", statusLabel: "In review", submitted: "28 Apr 2026, 10:24" },
  { id: "2", reference: "BKG-1023", type: "Booking", icon: "calendar-booking", title: "Chinedu Okafor", place: "Lekki, Lagos", detail: "2 bed apartment (Lekki)", detailSub: "2 guests, 30 Apr to 2 May", status: "PENDING", statusLabel: "Requested", submitted: "28 Apr 2026, 09:17" },
  { id: "3", reference: "AGT-1022", type: "Agent", icon: "user", title: COUNTERPART.name, place: "Abuja", detail: "Individual agent", detailSub: "New agent application", status: "APPROVED", statusLabel: "Approved", submitted: "28 Apr 2026, 08:42" },
  { id: "4", reference: "PAY-1021", type: "Payment", icon: "wallet", title: "Card upgrade", place: "Lagos", detail: "Saved card", detailSub: "Ending 5307", status: "COMPLETED", statusLabel: "Completed", submitted: "27 Apr 2026, 18:33" },
  { id: "5", reference: "LST-1020", type: "Listing", icon: "house", title: "Modern 3 bedroom duplex", place: "Maitama, Abuja", detail: `${formatMoney(280_000_000)} per year`, detailSub: "3 beds, 4 baths", status: "SUBMITTED", statusLabel: "Submitted", submitted: "27 Apr 2026, 16:21" },
  { id: "6", reference: "SUP-1019", type: "Support", icon: "ticket", title: "Profile verification issue", sub: "jane.s", detail: "ID not clear", detailSub: "Re-upload required", status: "reviewing", statusLabel: "In review", submitted: "27 Apr 2026, 14:50" },
  { id: "7", reference: "RPT-1018", type: "Report", icon: "flag", title: "Suspicious activity", place: "Abuja", detail: "Possible wash trading", detailSub: "Flagged for review", status: "open", statusLabel: "Open", submitted: "27 Apr 2026, 13:12" },
  { id: "8", reference: "BKG-1017", type: "Booking", icon: "calendar-booking", title: "Funmi Adekunle", place: "Ikeja, Lagos", detail: "Resort (Epe)", detailSub: "3 guests, 10 to 12 May", status: "CONFIRMED", statusLabel: "Confirmed", submitted: "26 Apr 2026, 23:06" },
  { id: "9", reference: "LST-1016", type: "Listing", icon: "house", title: "Cosy 1 bedroom apartment", place: "Victoria Island, Lagos", detail: `${formatMoney(95_000_000)} per year`, detailSub: "1 bed, 1 bath", status: "REJECTED", statusLabel: "Not approved", submitted: "26 Apr 2026, 21:33" },
  { id: "10", reference: "FLG-1015", type: "Message", icon: "chat-bubble", title: "Agent enquiry", sub: "realestate_pro", detail: "Property inspection request", detailSub: "Interested in Lekki properties", status: "open", statusLabel: "Open", submitted: "26 Apr 2026, 19:18" },
];
