/**
 * Shots 13 to 24. See README.md for the shape and furniture.mjs for the rules.
 *
 * Each shot's first container is the blueprint's own move: one component of
 * the screen under it, lifted off the glass, blown up and dropped back over
 * its own place (`mags`). Every box is read off the component's own edges on
 * the capture, so nothing is ever cut. At most one designed card follows it,
 * for what the screen does not show in one place.
 *
 * Every figure here is printed on the screen it stands over: the rent search
 * finds 40 properties and its first result totals ₦26.1m to move in, the
 * filters sheet runs ₦0 to ₦30,000,000+, the stays home counts 69 stays
 * between 16/10/2026 and 19/10/2026, the premium terrace in Karsana asks
 * ₦95m, Grand Vista Hotel has 3 room types, 40 rooms on sale a night and
 * asks ₦85,000 a night, and the host's overview stands at 0 on an account
 * with 3 businesses.
 */
export const F = {
  /* 13: premium.mjs hand-places the "Payment settled" card over the header,
     so the lifted row carries the shot: "I own the property", the one of the
     four the headline asks about. */
  13: {
    mags: [{ box: [48, 2211, 1272, 2478], scale: 1.22, dy: 22 }],
    props: [
      { name: "keys", x: 0.045, y: 0.835, size: 215, rot: -8 },
      { name: "toolbox", rx: 0.05, y: 0.845, size: 200, rot: 8 },
    ],
    badges: [
      { name: "home-small", rx: 0.055, y: 0.225, size: 150, rot: 6 },
      { name: "building-2", kind: "glyph", x: 0.05, y: 0.405, size: 136, rot: -7 },
      { kind: "mark", rx: 0.062, y: 0.605, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 14: the rent search. The first result, lifted off its own list; under the
     phone, the rule the screen states in one line beside the count. */
  14: {
    mags: [{ box: [48, 1143, 1272, 2298], scale: 1.14, dy: 24 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "How it works", lucide: "list-ordered", title: "Nobody pays to rank", line: "The order is not for sale", meta: null },
    ],
    props: [{ name: "search", x: 0.045, y: 0.80, size: 205, rot: -7 }],
    badges: [
      { name: "city", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "map-pin", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { name: "heart", kind: "glyph", rx: 0.062, y: 0.60, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 15: the thread. The screen's own "Ask to view this home" button, held up
     at size over the enquiry it belongs to. */
  15: {
    mags: [{ box: [48, 762, 663, 906], scale: 1.26, dx: 18, dy: -16 }],
    props: [{ name: "local-talks", rx: 0.05, y: 0.775, size: 205, rot: 7 }],
    badges: [
      { name: "calendar-check", kind: "glyph", x: 0.05, y: 0.215, size: 144, rot: -6 },
      { name: "support", rx: 0.055, y: 0.40, size: 142, rot: 7 },
      { kind: "mark", x: 0.062, y: 0.605, size: 126, rot: -8, tone: "paper" },
    ],
  },

  /* 16: a welcome screen, so one container: the Yorùbá button itself, lifted
     off the glass. The headline's claim is the button. */
  16: {
    mags: [{ box: [48, 2451, 1272, 2622], scale: 1.22, dy: -18 }],
    props: [{ name: "explore", x: 0.05, y: 0.855, size: 200, rot: -7 }],
    badges: [
      { name: "celebrate", x: 0.05, y: 0.22, size: 148, rot: -6 },
      { name: "languages", kind: "glyph", rx: 0.055, y: 0.40, size: 134, rot: 7 },
      { kind: "mark", rx: 0.062, y: 0.615, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 17: the price check. The area the question is asked about, lifted off its
     own form; under the phone, what the answer is made of. */
  17: {
    mags: [{ box: [42, 1890, 1278, 2151], scale: 1.22, dy: 42 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Price check", lucide: "chart-no-axes-column", title: "What they ask nearby", line: "Advertised prices, not guesses", meta: null },
    ],
    props: [{ name: "map", x: 0.045, y: 0.78, size: 210, rot: -6 }],
    badges: [
      { name: "analytics", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "map-pin", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { kind: "mark", rx: 0.062, y: 0.61, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 18: the stays home. The two date fields, lifted off the form; over the
     rim, the count the screen sets under its title. */
  18: {
    mags: [{ box: [42, 906, 1278, 1176], scale: 1.22, dy: -18 }],
    pops: [
      { side: "right", at: 0.01, center: true, kind: "stat", tab: "Stays", label: "Across Nigeria", figure: "69", unit: "to explore", lucide: "bed-double" },
    ],
    props: [{ name: "calendar-booked", rx: 0.05, y: 0.775, size: 215, rot: 8 }],
    badges: [
      { name: "calendar-days", kind: "glyph", x: 0.05, y: 0.215, size: 142, rot: -6 },
      { name: "shortlet", rx: 0.055, y: 0.335, size: 146, rot: 7 },
      { name: "bed-double", kind: "glyph", x: 0.062, y: 0.605, size: 126, rot: -8, tone: "paper" },
    ],
  },

  /* 19: the homes for sale. The premium listing itself, lifted off its row;
     over the rim, what it asks, at size. */
  19: {
    mags: [{ box: [132, 1227, 1188, 2238], scale: 1.14, dy: 22 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "stat", tab: "For sale", label: "Terrace in Karsana", figure: "₦95m", unit: "to buy", lucide: "tag" },
    ],
    props: [{ name: "buy", x: 0.05, y: 0.825, size: 210, rot: -7 }],
    badges: [
      { name: "apartment", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "key-round", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { kind: "mark", rx: 0.062, y: 0.605, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 20: the host's rooms. The field the host sets, lifted off the room card;
     under the phone, the room type's own line, laid out. */
  20: {
    mags: [{ box: [84, 2304, 1236, 2556], scale: 1.22, dy: -20 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "cells", tab: "On the shelf", lucide: "layout-grid",
        cells: [["Room types", "3"], ["On sale", "3"], ["Sleeps", "2"]], foot: "Bookable on 64 nights from today." },
    ],
    props: [{ name: "hotel", rx: 0.05, y: 0.845, size: 205, rot: 7 }],
    badges: [
      { name: "calendar-booked", x: 0.05, y: 0.215, size: 148, rot: -6 },
      { name: "clock", kind: "glyph", rx: 0.055, y: 0.40, size: 134, rot: 7 },
      { name: "bed-double", kind: "glyph", x: 0.062, y: 0.605, size: 126, rot: -8, tone: "paper" },
    ],
  },

  /* 21: agreements. The screen's own answer to when an agreement is drawn up,
     lifted whole; under the phone, where the money goes. */
  21: {
    mags: [{ box: [48, 1665, 1272, 2373], scale: 1.16, dy: 20 }],
    pops: [
      { side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Your money", lucide: "landmark", title: "Straight to the bank", line: "Owner or agent, same payment", meta: null },
    ],
    props: [{ name: "pay", x: 0.045, y: 0.80, size: 210, rot: -7 }],
    badges: [
      { name: "shield", rx: 0.055, y: 0.215, size: 148, rot: 6 },
      { name: "landmark", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { kind: "mark", rx: 0.062, y: 0.605, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 22: the filter sheet. One filter row, lifted off the sheet; under the
     phone, the budget the two ends of the slider print small. */
  22: {
    mags: [{ box: [42, 1662, 1278, 2055], scale: 1.2, dy: 22 }],
    pops: [
      { side: "left", y: 0.962, anchor: "bottom", kind: "cells", tab: "Your budget", lucide: "wallet",
        cells: [["From", "₦0"], ["To", "₦30,000,000+"]] },
    ],
    props: [{ name: "checklist", rx: 0.05, y: 0.775, size: 205, rot: 8 }],
    badges: [
      { name: "price-tag", x: 0.05, y: 0.215, size: 148, rot: -6 },
      { name: "bed-double", kind: "glyph", rx: 0.055, y: 0.40, size: 134, rot: 7 },
      { name: "search", kind: "glyph", x: 0.062, y: 0.72, size: 126, rot: -8, tone: "paper" },
    ],
  },

  /* 23: the host's overview in the light theme. The four counters, lifted off
     the white card; over the rim, the number the day stands at. */
  23: {
    mags: [{ box: [108, 1488, 1212, 2289], scale: 1.14, dy: 22 }],
    pops: [
      { side: "left", at: 0.01, center: true, kind: "stat", tab: "Overview", label: "Needs you today", figure: "0", unit: "jobs", lucide: "sun-medium" },
    ],
    props: [{ name: "team", x: 0.045, y: 0.78, size: 205, rot: -6 }],
    badges: [
      { name: "bell", rx: 0.055, y: 0.215, size: 146, rot: 6 },
      { name: "calendar-days", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { kind: "mark", rx: 0.062, y: 0.605, size: 126, rot: 8, tone: "paper" },
    ],
  },

  /* 24: the stay. The stay's own card, rooms and amenities and all, lifted
     off the photograph it sits on. */
  24: {
    mags: [{ box: [48, 1080, 1272, 1800], scale: 1.16, dy: 24 }],
    props: [{ name: "city", x: 0.05, y: 0.795, size: 210, rot: -7 }],
    badges: [
      { name: "hotel", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "bed-double", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { name: "map-pin", kind: "glyph", rx: 0.062, y: 0.72, size: 126, rot: 8, tone: "paper" },
    ],
  },
};
