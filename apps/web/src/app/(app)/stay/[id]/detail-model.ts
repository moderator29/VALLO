import { freeCancellationOpen, termsFromPolicyRules } from "@/lib/trust/cancellation";

/**
 * THE STAY DETAIL, AS THE SCREEN NEEDS IT.
 *
 * The business-grade schema landed in M1 to M5 (`accommodations`,
 * `room_types`, `rate_plans`, `cancellation_policies`). This is the view
 * model over it: the exact columns the showcase reads, named the way the
 * screen speaks, so the surface can be built and tested without waiting on
 * the read, and so the read has one shape to satisfy rather than a component
 * tree to guess at.
 *
 * WHERE THE DATA COMES FROM. `lib/stays/queries.ts` is another worker's file
 * and is not written yet; `app/(app)/stay/[id]/page.tsx` carries the seam and
 * the exact signature it expects. Until it lands the page renders the
 * catalogue listing it always has, which is the honest answer while no
 * accommodation row exists: the shelf is real today and the business-grade
 * rows arrive as hosts onboard.
 *
 * THE ARITHMETIC IS THE CHECKOUT'S. A nightly rate times nights, and nothing
 * else added on the way to the headline. `stayTotalMinor` in `components/app/stays/model.ts`
 * does the same for a catalogue listing, and `reserve()` does it again on the
 * server; three places, one sum, and a test here that says so.
 */

/** Mirrors `public.meal_plan`. */
export type MealPlan = "room_only" | "breakfast" | "half_board" | "full_board";

/** Mirrors `public.room_category`. */
export type RoomCategory = "single" | "double" | "twin" | "suite" | "family" | "dorm";

/** One row of `cancellation_policies`, as the screen reads it. */
export type StayCancellationPolicy = {
  id: string;
  name: string;
  /** The policy's own sentence. Written by a human, shown verbatim. */
  summary: string;
  /** Free cancellation window in hours, when the policy grants one. */
  freeUntilHours: number | null;
  /**
   * V-20. The policy's rules as stored (`[{refund_bps, hours_before}]`), the
   * thing refunds are computed from. Optional so harness fixtures still
   * compile; absent reads as "refundable when a free window is named".
   */
  rules?: unknown;
};

/** One row of `rate_plans`, with its policy resolved. */
export type StayRatePlan = {
  id: string;
  name: string;
  mealPlan: MealPlan;
  /** Integer kobo, per night. */
  rateMinor: number;
  minStayNights: number;
  maxStayNights: number | null;
  policy: StayCancellationPolicy | null;
};

/** One row of `room_types`, with its active rate plans. */
export type StayRoomType = {
  id: string;
  name: string;
  category: RoomCategory;
  description: string | null;
  sleeps: number;
  /** Integer kobo. The rate before any plan is chosen. */
  baseRateMinor: number;
  sizeSqm: number | null;
  ratePlans: StayRatePlan[];
  /** The room's own photographs, cover first. Absent or empty, the room is drawn without one. */
  photos?: StayPhoto[];
};

export type StayPhoto = { url: string; alt: string | null };

/** One row of `accommodations`, with everything the detail screen draws. */
export type StayDetail = {
  id: string;
  name: string;
  description: string | null;
  starRating: number | null;
  city: string | null;
  area: string | null;
  /**
   * The neighbourhood's point, rounded to about a kilometre on the server
   * (`areaPoint` in page.tsx), so the exact position never reaches the
   * browser. Null when the place has none. Drawn as an area on the Map tab.
   */
  areaPoint?: { lat: number; lng: number } | null;
  checkInFrom: string | null;
  checkOutBy: string | null;
  houseRules: string | null;
  photos: StayPhoto[];
  amenities: string[];
  roomTypes: StayRoomType[];
  policy: StayCancellationPolicy | null;
  /** The business behind the stay (hotel, resort, guest house), for the Property Type card. */
  businessKind?: string;
  /** The business's own name, for the host row on the About card. */
  hostName?: string | null;
  /** The business behind the stay, so a guest can message it before booking. */
  businessId?: string | null;
  /** True only where a human was checked (ledger rule 12). */
  hostVerified?: boolean;
  /**
   * UX-09 / UI-P2-01: an example stay (the accommodation or its business is
   * `is_demo`). The page says so under the name and offers nothing to book.
   */
  isExample?: boolean;
  /**
   * The guest rating, and ONLY where real review rows stand behind it.
   *
   * Null is the honest answer for every accommodation today: `reviews.listing_id`
   * is a foreign key to `listings`, so an accommodation id matches no review row
   * and there is nothing to average. The detail face draws no rating at all
   * rather than a zero, an empty star outline or a "no reviews yet" placeholder,
   * because all three read as a rating to somebody scanning the screen.
   */
  rating?: { average: number; count: number } | null;
};

/**
 * What a rate includes, in words.
 *
 * `room_only` says nothing extra is included rather than saying "room only",
 * which reads as a restriction to somebody who has not met the phrase. The
 * other three are the words a hotel uses and a guest recognises.
 */
export const MEAL_PLAN_KEY: Record<MealPlan, "roomOnly" | "breakfast" | "halfBoard" | "fullBoard"> = {
  room_only: "roomOnly",
  breakfast: "breakfast",
  half_board: "halfBoard",
  full_board: "fullBoard",
};

export const ROOM_CATEGORY_KEY: Record<
  RoomCategory,
  "single" | "double" | "twin" | "suite" | "family" | "dorm"
> = {
  single: "single",
  double: "double",
  twin: "twin",
  suite: "suite",
  family: "family",
  dorm: "dorm",
};

/**
 * The total for a plan over a stay, in kobo.
 *
 * Null when the stay is not a stay yet (no dates) or the plan cannot take it,
 * because a number that ignores a minimum-stay rule is a number the checkout
 * will refuse, and finding that out at the payment step is the worst place to
 * find it out.
 */
export function ratePlanTotalMinor(plan: StayRatePlan, nights: number | null): number | null {
  if (nights === null || nights < 1) return null;
  if (nights < plan.minStayNights) return null;
  if (plan.maxStayNights !== null && nights > plan.maxStayNights) return null;
  return plan.rateMinor * nights;
}

/** Whether a plan can take a stay of this length at all. */
export function planAcceptsNights(plan: StayRatePlan, nights: number | null): boolean {
  if (nights === null) return true;
  if (nights < plan.minStayNights) return false;
  return plan.maxStayNights === null || nights <= plan.maxStayNights;
}

/**
 * The cheapest nightly rate a room type can actually be booked at.
 *
 * Rate plans first, because a plan's rate is what is charged; the room's base
 * rate is the fallback for a room nobody has written a plan for yet. Plans
 * that cannot take this stay are not counted, so the "from" price is never a
 * price this person cannot have.
 */
export function roomFromMinor(room: StayRoomType, nights: number | null = null): number | null {
  const usable = room.ratePlans.filter((plan) => planAcceptsNights(plan, nights));
  if (usable.length > 0) return Math.min(...usable.map((plan) => plan.rateMinor));
  if (room.ratePlans.length > 0) return null;
  return room.baseRateMinor > 0 ? room.baseRateMinor : null;
}

/** The cheapest nightly rate across the whole property. The ActionBar's figure. */
export function stayFromMinor(detail: StayDetail, nights: number | null = null): number | null {
  const prices = detail.roomTypes
    .map((room) => roomFromMinor(room, nights))
    .filter((price): price is number => price !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Rooms that sleep this party, largest first is not wanted: cheapest first is. */
export function roomsForGuests(detail: StayDetail, guests: number): StayRoomType[] {
  return detail.roomTypes.filter((room) => room.sleeps >= guests);
}

/**
 * The room list, in the order a person reads it: what they can book, cheapest
 * first, then the rooms too small for the party, which stay visible because
 * hiding them makes a property look emptier than it is.
 */
export function orderedRooms(detail: StayDetail, guests: number): StayRoomType[] {
  const price = (room: StayRoomType) => roomFromMinor(room) ?? Number.MAX_SAFE_INTEGER;
  return [...detail.roomTypes].sort((a, b) => {
    const fits = Number(b.sleeps >= guests) - Number(a.sleeps >= guests);
    if (fits !== 0) return fits;
    return price(a) - price(b);
  });
}

/**
 * How many people the property can take, as one number.
 *
 * The largest room's `sleeps`, not the sum: a guest reads this as "can this
 * place take my party", and a total across rooms would answer a question
 * nobody asked and promise a booking no single room can honour.
 */
export function maxSleeps(detail: StayDetail): number | null {
  const values = detail.roomTypes.map((room) => room.sleeps).filter((count) => count > 0);
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * The one room and rate a "Book now" can honestly mean.
 *
 * The cheapest rate plan on the cheapest room that takes this party for this
 * length of stay. Null when no room takes the party, no plan takes the nights,
 * or the property has no rate plans at all, and the face then sends the reader
 * to the room list rather than to a checkout that would refuse them.
 *
 * Rooms that cannot take the party are skipped rather than priced, because a
 * headline price somebody cannot book is the oldest lie in travel.
 */
export function cheapestBookable(
  detail: StayDetail,
  nights: number | null,
  guests: number,
): { room: StayRoomType; plan: StayRatePlan } | null {
  let best: { room: StayRoomType; plan: StayRatePlan } | null = null;
  for (const room of detail.roomTypes) {
    if (guests > 0 && room.sleeps < guests) continue;
    for (const plan of room.ratePlans) {
      if (!planAcceptsNights(plan, nights)) continue;
      if (best === null || plan.rateMinor < best.plan.rateMinor) best = { room, plan };
    }
  }
  return best;
}

/**
 * The checkout link's ingredients: the stay, the dates and the party.
 *
 * Lives here rather than in `RoomTypes.tsx` because that file is a client
 * component and the availability card on the server face needs the same link.
 */
export type ReserveBase = {
  stayId: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  /** The route the link lands on; the real checkout unless a harness says otherwise. */
  basePath?: string;
};

/* THE FIRST-PARTY CHECKOUT, ALWAYS. This lane never borrows a step from the
   third-party one: a room on Vallo is reserved and paid for on Vallo. */
export function reserveHref(base: ReserveBase, roomTypeId: string, ratePlanId: string): string {
  const search = new URLSearchParams({ stay: base.stayId, room: roomTypeId, rate: ratePlanId });
  if (base.checkIn && base.checkOut) {
    search.set("checkIn", base.checkIn);
    search.set("checkOut", base.checkOut);
  }
  search.set("guests", String(base.guests));
  return `${base.basePath ?? "/checkout"}?${search.toString()}`;
}

/* ------------------------------------------------------------------ V-20 */

/**
 * Whether a plan is refundable in the sense a guest means it: its first
 * window gives EVERYTHING back and, given a check-in, that window is still
 * open now. Read from the policy's rules (what a refund is computed from),
 * else from the named free window. A plan with no policy is not called
 * refundable: a promise nobody wrote down is not one this screen makes.
 */
export function planRefundable(plan: StayRatePlan, checkIn?: string | null, now: Date = new Date()): boolean {
  const policy = plan.policy;
  if (!policy) return false;
  const terms = Array.isArray(policy.rules)
    ? termsFromPolicyRules(policy.id, policy.rules)
    : policy.freeUntilHours !== null
      ? termsFromPolicyRules(policy.id, [{ refund_bps: 10_000, hours_before: policy.freeUntilHours }])
      : null;
  return terms !== null && freeCancellationOpen(terms, checkIn, now);
}

/**
 * What "Book now" picks, and the cheaper rate it passed over.
 *
 * On the walk, Book now chose a non-refundable rate on a page advertising free
 * cancellation, and said so only in small grey type at checkout. So the
 * default is the CHEAPEST REFUNDABLE rate that takes this party for these
 * nights, else the cheapest rate outright, and the choice is labelled. When
 * the cheapest rate overall is non-refundable and a refundable one exists,
 * both are returned so the page can show both prices side by side.
 */
export function bookNowChoice(
  detail: StayDetail,
  nights: number | null,
  guests: number,
  checkIn?: string | null,
  now: Date = new Date(),
): {
  pick: { room: StayRoomType; plan: StayRatePlan };
  refundable: boolean;
  cheaperNonRefundable: { room: StayRoomType; plan: StayRatePlan } | null;
} | null {
  let cheapest: { room: StayRoomType; plan: StayRatePlan } | null = null;
  let cheapestRefundable: { room: StayRoomType; plan: StayRatePlan } | null = null;
  for (const room of detail.roomTypes) {
    if (guests > 0 && room.sleeps < guests) continue;
    for (const plan of room.ratePlans) {
      if (!planAcceptsNights(plan, nights)) continue;
      if (cheapest === null || plan.rateMinor < cheapest.plan.rateMinor) cheapest = { room, plan };
      if (planRefundable(plan, checkIn, now) && (cheapestRefundable === null || plan.rateMinor < cheapestRefundable.plan.rateMinor)) {
        cheapestRefundable = { room, plan };
      }
    }
  }
  if (cheapest === null) return null;
  if (cheapestRefundable === null) return { pick: cheapest, refundable: false, cheaperNonRefundable: null };
  return {
    pick: cheapestRefundable,
    refundable: true,
    cheaperNonRefundable:
      cheapest.plan.rateMinor < cheapestRefundable.plan.rateMinor && !planRefundable(cheapest.plan, checkIn, now)
        ? cheapest
        : null,
  };
}
