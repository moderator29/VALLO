/**
 * Shots 1 to 12. See README.md for the shape and furniture.mjs for the rules.
 *
 * Every figure here is printed on the screen it stands over: the example
 * villa asks ₦18m a year and totals ₦26.1m to move in, its cost page breaks
 * that into ₦18m rent, ₦4.5m fees and ₦3.6m refundable, and Lagoon Crest
 * Resort is ₦150,000 a night. So too for 6 to 12: the shortlist prints
 * ₦180m for sale on Chevron Drive and ₦26.1m and ₦3.3m to move in, the
 * restaurant prints Seats 80, the featured row prints ₦18m to move in in
 * Asokoro and ₦95m for the Karsana terrace, and the verification page prints
 * four steps, in order.
 *
 * Shots 6 to 12 follow the 16 October blueprint: the FIRST container is a
 * `mags` entry, one component of the app lifted off the glass and blown up
 * over the place it came from, and at most one designed `pops` card after it.
 */
export const F = {
  /* 1: the home. The hero's own promise above the rim, the shortlist below it. */
  1: {
    /* the hero search card, lifted off the glass and blown up over its own
       place: the blueprint's move. Its box is the card's own rounded edges. */
    mags: [{ box: [54, 1816, 1266, 2545], scale: 1.16, dx: 0, dy: 26 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "stat", tab: "On your shortlist", figure: "4", unit: "spaces saved", lucide: "heart" },
    ],
    props: [{ name: "villa", x: 0.055, y: 0.745, size: 210, rot: 7 }],
    badges: [
      { name: "search", kind: "glyph", rx: 0.055, y: 0.205, size: 140, rot: -6 },
      { name: "hotel", x: 0.05, y: 0.355, size: 150, rot: 5 },
      { name: "map", kind: "glyph", rx: 0.062, y: 0.62, size: 128, rot: 8, tone: "paper" },
    ],
  },

  /* 2: the listing. What it asks, over the rim; what it costs to move in, under it. */
  2: {
    pops: [
      { side: "right", at: 0.01, center: true, kind: "stat", tab: "Asking", label: "Villa in Maitama", figure: "₦18m", unit: "a year", lucide: "key-round" },
      { side: "left", y: 0.962, anchor: "bottom", kind: "cells", tab: "Move-in total", title: "Every fee, added up", lucide: "receipt",
        cells: [["Rent", "₦18m"], ["Move-in total", "₦26.1m"]], foot: "Vallo charges no inspection fee." },
    ],
    props: [{ name: "receipt", rx: 0.05, y: 0.775, size: 220, rot: 9 }],
  },

  /* 3: the cost page. Its own summary row, held up at size over the rim. */
  3: {
    pops: [
      { side: "left", at: 0.01, center: true, kind: "cells", tab: "The whole cost", lucide: "receipt-text",
        cells: [["Rent", "₦18m"], ["Fees", "₦4.5m"], ["Refundable", "₦3.6m"]], foot: "Vallo charges no inspection fee." },
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Line by line", lucide: "percent", title: "Agency fee", line: "10.0% of a year’s rent", amount: "₦1,800,000", meta: null },
    ],
    props: [{ name: "coin", x: 0.05, y: 0.745, size: 200, rot: -8 }],
  },

  /* 4 and 5 are the connected pair, and premium.mjs's `pair()` draws its two
     halves itself: it never calls `furnish()`, so nothing below reaches the
     image, and a `mags` entry would have nothing to lift (the pair's phone is
     tilted, not flat). The props are written out so the pair can be furnished
     the day `pair()` grows a furniture call, placed in the open ground each
     half actually has: on 4 the left margin, well under the hand-placed
     "Room booked" card; on 5 the wide empty right, clear of the seam. */

  /* 4: the pair's left half. The phone leans in from the right, so the ground
     down the left is open under the booking card. */
  4: {
    props: [{ name: "explore", x: 0.045, y: 0.70, size: 225, rot: -8 }],
  },

  /* 5: the pair's right half. The phone holds the left of the image and the
     right two thirds are empty ground. */
  5: {
    props: [{ name: "calendar-booked", rx: 0.05, y: 0.70, size: 235, rot: 9 }],
  },

  /* 6: payments. The page's own balance panel lifted off the glass: it prints
     the headline itself, "Vallo never holds your money". The one card is the
     other half of the empty state's sentence, which no single row shows. */
  6: {
    mags: [{ box: [51, 666, 1269, 1134], scale: 1.16, dy: -22 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Refunds", lucide: "undo-2", title: "Refunds come back", line: "To your card or bank account", meta: null },
    ],
    props: [{ name: "bank", x: 0.045, y: 0.862, size: 210, rot: -8 }],
    badges: [
      { name: "banknote", kind: "glyph", rx: 0.055, y: 0.225, size: 140, rot: -6 },
      { name: "receipt-text", kind: "glyph", x: 0.05, y: 0.425, size: 142, rot: 6 },
      { name: "landmark", kind: "glyph", rx: 0.062, y: 0.63, size: 128, rot: 8, tone: "paper" },
    ],
  },

  /* 7: the stay. "See the stay" is the photograph, so the photograph is what
     comes off the glass. The card under the phone carries the one figure the
     picture cannot: what a night costs. */
  7: {
    mags: [{ box: [0, 168, 1320, 1050], scale: 1.14, dy: 20 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "stat", tab: "Lagoon Crest Resort", figure: "₦150,000", unit: "a night", lucide: "bed-double" },
    ],
    props: [{ name: "hotel", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: [
      { name: "bed-double", kind: "glyph", x: 0.05, y: 0.225, size: 138, rot: -5 },
      { name: "map-pinned", kind: "glyph", rx: 0.055, y: 0.335, size: 145, rot: 7 },
      { name: "camera", kind: "object", x: 0.058, y: 0.635, size: 132, rot: 9, tone: "paper" },
    ],
  },

  /* 8: the assistant. One of its own starter questions, lifted off the glass
     over the place it sits. The card gathers the rest of what it answers,
     which the screen only says inside a paragraph. */
  8: {
    mags: [{ box: [51, 2424, 771, 2586], scale: 1.22, dx: -24, dy: 0 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Costs", lucide: "receipt-text", title: "What moving in costs", line: "Ask the assistant first", meta: null },
    ],
    props: [{ name: "clock", x: 0.045, y: 0.862, size: 210, rot: -8 }],
    badges: [
      { name: "sparkles", kind: "glyph", rx: 0.055, y: 0.23, size: 140, rot: -6 },
      { name: "house", kind: "glyph", x: 0.05, y: 0.43, size: 140, rot: 5 },
      { name: "message-circle", kind: "glyph", rx: 0.06, y: 0.63, size: 130, rot: 8, tone: "paper" },
    ],
  },

  /* 9: the shortlist. One saved place off the glass, and under the phone the
     thing the list never shows in one place: two of its prices side by side. */
  9: {
    mags: [{ box: [51, 1107, 1269, 1388], scale: 1.2, dy: -14 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "cells", tab: "Compare", lucide: "scale", title: "To move in, compared",
        cells: [["Maitama", "₦26.1m"], ["Jericho", "₦3.3m"]], foot: "Your shortlist opens without signal." },
    ],
    props: [{ name: "saved-heart", x: 0.045, y: 0.775, size: 215, rot: 7 }],
    badges: [
      { name: "heart", kind: "glyph", rx: 0.055, y: 0.225, size: 138, rot: -6 },
      { name: "price-tag", kind: "object", x: 0.05, y: 0.37, size: 150, rot: 6 },
      { name: "wifi-off", kind: "glyph", rx: 0.062, y: 0.635, size: 128, rot: 8, tone: "paper" },
    ],
  },

  /* 10: the restaurant. What the kitchen actually is, in its own words, off
     the glass. The card holds the room's one number. */
  10: {
    mags: [{ box: [51, 1905, 1269, 2580], scale: 1.14, dy: -20 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "stat", tab: "Harbour Lights Kitchen", figure: "80", unit: "seats", lucide: "utensils-crossed" },
    ],
    props: [{ name: "restaurant", x: 0.045, y: 0.79, size: 210, rot: -8 }],
    badges: [
      { name: "utensils", kind: "glyph", x: 0.05, y: 0.225, size: 138, rot: -5 },
      { name: "map-pinned", kind: "glyph", rx: 0.055, y: 0.44, size: 145, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.635, size: 130, rot: 8, tone: "paper" },
    ],
  },

  /* 11: the featured row. The featured listing itself off the glass, whole
     card, photograph and facts. The card under the phone is the other home,
     the one in the carousel above it. */
  11: {
    mags: [{ box: [51, 1233, 1269, 2400], scale: 1.12, dy: 18 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "For sale", lucide: "key-round", title: "Terrace in Karsana", line: "3 beds · 3 baths · 195 m²", amount: "₦95m", meta: null },
    ],
    props: [{ name: "apartment", x: 0.045, y: 0.79, size: 210, rot: -7 }],
    badges: [
      { name: "building-2", kind: "glyph", rx: 0.055, y: 0.225, size: 138, rot: -6 },
      { name: "buy", kind: "object", x: 0.05, y: 0.44, size: 150, rot: 6 },
      { name: "map-pinned", kind: "glyph", rx: 0.062, y: 0.635, size: 128, rot: 8, tone: "paper" },
    ],
  },

  /* 12: verification. The first step off the glass, in the words the page
     uses. The card counts the steps, which the page only ever says in a line
     of running text. It sits below the phone so the panel at the foot of the
     page, which runs the full width, is never cut. */
  12: {
    mags: [{ box: [48, 928, 1272, 1288], scale: 1.18, dx: 0, dy: -8 }],
    pops: [
      { side: "left", y: 0.978, anchor: "bottom", kind: "stat", tab: "What a lister passes", figure: "4", unit: "steps", lucide: "user-check" },
    ],
    props: [{ name: "id-check", rx: 0.05, y: 0.78, size: 215, rot: 9 }],
    badges: [
      { name: "badge-check", kind: "glyph", x: 0.05, y: 0.225, size: 138, rot: -5 },
      { name: "checklist", kind: "object", rx: 0.055, y: 0.44, size: 148, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.635, size: 130, rot: 8, tone: "paper" },
    ],
  },
};
