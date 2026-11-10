/**
 * Shots 25 to 35. See README.md for the shape and furniture.mjs for the rules.
 *
 * Each shot's first container is the screen's own component, lifted off the
 * glass and blown up over its own place (`mags`): the fee rule on the host's
 * bookings page, the verification card, the new listing's row, the room's
 * standing rate, the restaurant's name, the WhatsApp card, the Pro view
 * card, the settings header, the agency fee row, the villa's row, and the
 * welcome screen's move-in card. A designed card comes second, and only
 * where the screen does not show the thing in one place.
 *
 * Every figure printed is printed on the screen under it: 10% of the charge,
 * ₦1.8m to move in, ₦93,500 a night, step 1 of 8, a Free plan that is
 * current, 10.0%, 10.0% and 5.0% of a year's rent. The screens that stand on
 * zeros (the host's arrivals and occupancy, the businesses' tiers, the Pro
 * counters) print none of them.
 *
 * 35 is the closing image: the magnified card, one object, one badge.
 */
export const F = {
  /* 25: room bookings. The paragraph that states the fee, at size over itself;
     where the rest of the money goes, under the phone. */
  25: {
    mags: [{ box: [28, 996, 1296, 1330], scale: 1.16, dy: 14 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "line", tab: "Payout", lucide: "landmark", title: "Your share, your bank", line: "Paid by card, after approval", meta: null },
    ],
    props: [{ name: "bank", rx: 0.05, y: 0.775, size: 215, rot: 8 }],
    badges: [
      { name: "credit-card", kind: "glyph", x: 0.055, y: 0.195, size: 140, rot: -6 },
      { name: "pay", rx: 0.055, y: 0.56, size: 150, rot: 7 },
      { kind: "mark", x: 0.062, y: 0.68, size: 128, rot: -5, tone: "paper" },
    ],
  },

  /* 26: the agent's dashboard. The verification card carries the whole point,
     so it stands alone: no tier, no count, none of the screen's zeros. */
  26: {
    mags: [{ box: [44, 1166, 1276, 1722], scale: 1.16, dy: -20 }],
    props: [{ name: "verified", x: 0.05, y: 0.83, size: 210, rot: -7 }],
    badges: [
      { name: "check", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "id-check", x: 0.055, y: 0.38, size: 150, rot: -6 },
      { kind: "mark", rx: 0.062, y: 0.66, size: 128, rot: 5, tone: "paper" },
    ],
  },

  /* 27: the new row. The newest listing's own row at size, and above it the
     rule the row follows. */
  27: {
    mags: [{ box: [63, 2010, 1257, 2340], scale: 1.16, dy: 18 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "line", tab: "Just listed", lucide: "bell", title: "New listings", line: "Updated as they are published", meta: null },
    ],
    props: [{ name: "apartment", x: 0.05, y: 0.838, size: 205, rot: 7 }],
    badges: [
      { name: "sparkles", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "home-small", x: 0.055, y: 0.38, size: 150, rot: -7 },
      { name: "heart", kind: "glyph", rx: 0.062, y: 0.56, size: 126, rot: 7, tone: "paper" },
    ],
  },

  /* 28: the calendar. The room's standing rate at size; under the phone, the
     nights the screen lets you set apart. */
  28: {
    mags: [{ box: [45, 1348, 1278, 1572], scale: 1.18, dy: 20 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "line", tab: "Rate", lucide: "calendar-days", title: "Set it by the night", line: "Fri and Sat, or every night", meta: null },
    ],
    /* the calendar prints a rate in every cell, so the object stands in the band
       under the handset rather than on the grid */
    props: [{ name: "calendar-booked", rx: 0.055, y: 0.864, size: 196, rot: 8 }],
    badges: [
      { name: "moon", kind: "glyph", x: 0.055, y: 0.195, size: 138, rot: -6 },
      { name: "hotel", rx: 0.055, y: 0.44, size: 150, rot: 6 },
      { name: "banknote", kind: "glyph", x: 0.062, y: 0.62, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 29: restaurants. The first one's own row at size, and the rule for a table. */
  29: {
    mags: [{ box: [51, 1566, 1269, 1948], scale: 1.16, dy: 22 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "line", tab: "Reservations", lucide: "utensils", title: "Book a table", line: "The restaurant confirms", meta: null },
    ],
    props: [{ name: "restaurant", x: 0.05, y: 0.765, size: 215, rot: -8 }],
    badges: [
      { name: "map-pin", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "local-talks", x: 0.055, y: 0.44, size: 150, rot: -6 },
      { name: "calendar-check", kind: "glyph", rx: 0.062, y: 0.72, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 30: the listing wizard. The WhatsApp card at size, and where you are in the
     eight steps, which that card does not say. */
  30: {
    mags: [{ box: [70, 2060, 1250, 2520], scale: 1.14, dy: 10 }],
    pops: [
      { side: "right", at: 0.01, center: true, kind: "stat", tab: "Where you are", figure: "Step 1", unit: "of 8", lucide: "list-checks" },
    ],
    props: [{ name: "checklist", rx: 0.05, y: 0.872, size: 200, rot: 8 }],
    badges: [
      { name: "pencil", kind: "glyph", x: 0.055, y: 0.195, size: 138, rot: -6 },
      { name: "copy", kind: "glyph", rx: 0.055, y: 0.44, size: 144, rot: 7 },
      { name: "check", kind: "glyph", x: 0.062, y: 0.56, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 31: Pro. The Pro view card at size, and the plan the page says you hold. */
  31: {
    mags: [{ box: [206, 1064, 1118, 1756], scale: 1.12, dy: -40 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "stat", tab: "Your plan", figure: "Free", unit: "current", lucide: "wallet" },
    ],
    props: [{ name: "toolbox", x: 0.048, y: 0.765, size: 210, rot: -7 }],
    badges: [
      { name: "sparkles", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "analytics", x: 0.055, y: 0.33, size: 150, rot: -6 },
      { name: "users", kind: "glyph", rx: 0.062, y: 0.70, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 32: the host's settings. The page's own header at size; the businesses it
     holds, as a row of pills, under the phone. */
  32: {
    mags: [{ box: [40, 552, 1230, 872], scale: 1.16, dy: 24 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "counters", tab: "Live on Vallo",
        items: [["building-2", "Hotel"], ["bed-double", "Apartments"], ["utensils", "Restaurant"]] },
    ],
    /* the business rows run to the foot of the screen, so the object sits over the bar */
    props: [{ name: "hotel", x: 0.045, y: 0.852, size: 200, rot: -8 }],
    badges: [
      { name: "key-round", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "restaurant", x: 0.055, y: 0.52, size: 150, rot: -6 },
      { name: "user-round", kind: "glyph", rx: 0.062, y: 0.68, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 33: the move-in sheet. The agent's own fee row at size, and over the rim the
     three fees the sheet never sets side by side. */
  33: {
    mags: [{ box: [60, 2136, 1260, 2402], scale: 1.18, dy: 0 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "cells", tab: "Fee by fee", lucide: "percent",
        cells: [["Agency fee", "10.0%"], ["Legal fee", "10.0%"], ["Agreement", "5.0%"]], foot: "Every one a share of a year’s rent." },
    ],
    props: [{ name: "contract", x: 0.048, y: 0.862, size: 200, rot: -7 }],
    badges: [
      { name: "receipt-text", kind: "glyph", rx: 0.055, y: 0.195, size: 138, rot: 6 },
      { name: "coin", x: 0.055, y: 0.38, size: 150, rot: -6 },
      { name: "banknote", kind: "glyph", rx: 0.062, y: 0.56, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 34: every home. One home's own row at size, and under the phone the rule
     that decides the order they come in. */
  34: {
    mags: [{ box: [63, 1905, 1257, 2236], scale: 1.16, dy: 20 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "line", tab: "The order", lucide: "list", title: "How the order works", line: "Nobody can pay to be higher.", meta: null },
    ],
    props: [{ name: "map", rx: 0.05, y: 0.775, size: 215, rot: 8 }],
    badges: [
      { name: "search", kind: "glyph", x: 0.055, y: 0.195, size: 138, rot: -6 },
      { name: "home-small", rx: 0.055, y: 0.38, size: 150, rot: 7 },
      { name: "map-pin", kind: "glyph", x: 0.062, y: 0.55, size: 126, rot: 6, tone: "paper" },
    ],
  },

  /* 35: the close. The welcome screen's own move-in card at size, one object,
     one mark, and nothing else. */
  35: {
    mags: [{ box: [118, 1552, 1206, 1934], scale: 1.16, dy: 0 }],
    props: [{ name: "city", x: 0.05, y: 0.78, size: 215, rot: -7 }],
    badges: [{ kind: "mark", rx: 0.058, y: 0.47, size: 140, rot: 6 }],
  },
};
