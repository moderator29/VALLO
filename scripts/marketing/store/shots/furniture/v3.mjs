/**
 * The pop-out furniture of the 10 November 2026 set (shots/v3.mjs), by shot
 * number. Same rules as the other batches (README.md, furniture.mjs): one
 * component of the screen lifted off the glass (`mags`, boxes read off the
 * component's own edges on the capture), at most one designed card, the
 * brand's 3D objects, and two or three round badges at the edges. Every
 * figure a card prints is printed on the screen under it.
 */
const SIDE = (a, b, c) => [
  { ...a },
  { ...b },
  { ...c },
];

export const RECIPES = {
  /* 1: home. The four ways in, lifted; the shortlist count the screen prints. */
  1: {
    mags: [{ box: [108, 2036, 1212, 2368], scale: 1.14, dy: 18 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "stat", tab: "On your shortlist", figure: "6", unit: "spaces saved", lucide: "heart" }],
    badges: SIDE(
      { name: "search", kind: "glyph", rx: 0.055, y: 0.205, size: 140, rot: -6 },
      { name: "villa", x: 0.05, y: 0.355, size: 150, rot: 5 },
      { name: "map-pin", kind: "glyph", rx: 0.062, y: 0.62, size: 128, rot: 8, tone: "paper" },
    ),
  },

  /* 2: the listing. What it asks, over the rim; what it costs to move in, under it. */
  2: {
    pops: [
      { side: "right", at: 0.01, center: true, kind: "stat", tab: "Asking", label: "Villa in Maitama", figure: "₦18m", unit: "a year", lucide: "key-round" },
      { side: "left", y: 0.962, anchor: "bottom", kind: "cells", tab: "Move-in total", title: "Every fee, added up", lucide: "receipt",
        cells: [["Rent", "₦18m"], ["Move-in total", "₦26.1m"]], foot: "Every cost the lister declared." },
    ],
    props: [{ name: "receipt", rx: 0.05, y: 0.775, size: 220, rot: 9 }],
  },

  /* 3 and 4: the connected pair. Props only, in the open ground each half has. */
  3: { props: [{ name: "explore", x: 0.045, y: 0.70, size: 225, rot: -8 }] },
  4: { props: [{ name: "calendar-booked", rx: 0.05, y: 0.70, size: 235, rot: 9 }] },

  /* 5: Vallo Circle. The button that opens it all, lifted; the count the page prints. */
  5: {
    mags: [{ box: [92, 1640, 1156, 1804], scale: 1.14, dy: 10 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "stat", tab: "Vallo Circle", figure: "3", unit: "communities", lucide: "users" }],
    props: [{ name: "local-talks", x: 0.05, y: 0.775, size: 215, rot: -7 }],
    badges: SIDE(
      { name: "message-circle", kind: "glyph", rx: 0.055, y: 0.205, size: 140, rot: -6 },
      { name: "megaphone", x: 0.05, y: 0.355, size: 150, rot: 6 },
      { name: "map-pin", kind: "glyph", rx: 0.062, y: 0.62, size: 128, rot: 8, tone: "paper" },
    ),
  },

  /* 6: Roommates. A welcome screen, so one designed card. */
  6: {
    pops: [{ side: "left", y: 0.962, anchor: "bottom", kind: "line", tab: "Vallo Roommates", lucide: "users", title: "Share a home", line: "Split the costs", meta: null }],
    props: [{ name: "team", rx: 0.05, y: 0.775, size: 225, rot: 8 }],
    badges: SIDE(
      { name: "users", kind: "glyph", x: 0.05, y: 0.22, size: 140, rot: -6 },
      { name: "home-small", rx: 0.055, y: 0.36, size: 150, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 7: the cost page. Its summary row, held up at size. */
  7: {
    mags: [{ box: [30, 846, 1290, 1046], scale: 1.14, dy: 16 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Line by line", lucide: "percent", title: "Agency fee", line: "10.0% of a year’s rent", amount: "₦1,800,000", meta: null }],
    props: [{ name: "coin", x: 0.05, y: 0.745, size: 200, rot: -8 }],
  },

  /* 8: the roommate welcome's second slide: what a badge says. */
  8: {
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Vallo Roommates", lucide: "badge-check", title: "A badge says what", line: "was confirmed, and no more", meta: null }],
    props: [{ name: "id-check", x: 0.05, y: 0.775, size: 215, rot: -8 }],
    badges: SIDE(
      { name: "users", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "phone", kind: "glyph", rx: 0.055, y: 0.36, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 9: saved. The first row off the glass; the two places compared. */
  9: {
    mags: [{ box: [48, 1385, 1274, 1630], scale: 1.14, dy: 16 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "cells", tab: "Compare", title: "To move in, compared", lucide: "scale",
      cells: [["Maitama", "₦26.1m"], ["Jericho", "₦3.3m"]], foot: "Your shortlist opens without signal." }],
    props: [{ name: "saved-heart", x: 0.045, y: 0.80, size: 210, rot: -8 }],
    badges: SIDE(
      { name: "heart", kind: "glyph", rx: 0.055, y: 0.21, size: 140, rot: -6 },
      { name: "price-tag", x: 0.05, y: 0.355, size: 150, rot: 6 },
      { name: "wifi-off", kind: "glyph", rx: 0.062, y: 0.62, size: 128, rot: 8, tone: "paper" },
    ),
  },

  /* 10: the assistant. One of its own starter questions, lifted. */
  10: {
    mags: [{ box: [51, 2424, 771, 2586], scale: 1.22, dx: -24, dy: 0 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Costs", lucide: "receipt-text", title: "What moving in costs", line: "Ask the assistant first", meta: null }],
    props: [{ name: "assistant", x: 0.045, y: 0.80, size: 215, rot: -7 }],
    badges: SIDE(
      { name: "sparkles", kind: "glyph", rx: 0.055, y: 0.21, size: 140, rot: -6 },
      { name: "home-small", x: 0.05, y: 0.355, size: 150, rot: 6 },
      { name: "message-circle", kind: "glyph", rx: 0.062, y: 0.62, size: 128, rot: 8, tone: "paper" },
    ),
  },

  /* 11: the stay. The photograph off the glass; a night's price under it. */
  11: {
    mags: [{ box: [0, 168, 1320, 1050], scale: 1.12, dy: 6 }],
    pops: [{ side: "left", y: 0.962, anchor: "bottom", kind: "stat", tab: "Lagoon Crest Resort", figure: "₦150,000", unit: "a night", lucide: "bed-double" }],
    props: [{ name: "hotel", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "bed-double", kind: "glyph", x: 0.05, y: 0.225, size: 138, rot: -5 },
      { name: "map-pinned", kind: "glyph", rx: 0.055, y: 0.335, size: 145, rot: 7 },
      { name: "camera", kind: "object", x: 0.058, y: 0.635, size: 132, rot: 9, tone: "paper" },
    ),
  },

  /* 12: the restaurant. Its own info card, lifted. */
  12: {
    mags: [{ box: [96, 1085, 1224, 1800], scale: 1.1, dy: 14 }],
    pops: [{ side: "left", y: 0.962, anchor: "bottom", kind: "stat", tab: "Harbour Lights Kitchen", figure: "80", unit: "seats", lucide: "utensils" }],
    props: [{ name: "restaurant", rx: 0.05, y: 0.775, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "utensils", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "map-pin", kind: "glyph", rx: 0.055, y: 0.34, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 13: the rent search, first result lifted; the rule the screen states. */
  13: {
    mags: [{ box: [60, 1296, 1262, 2410], scale: 1.12, dy: 20 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "How it works", lucide: "list-ordered", title: "Nobody pays to rank", line: "The order is not for sale", meta: null }],
    props: [{ name: "search", x: 0.045, y: 0.80, size: 205, rot: -7 }],
    badges: SIDE(
      { name: "city", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "map-pin", kind: "glyph", x: 0.05, y: 0.40, size: 134, rot: -7 },
      { name: "heart", kind: "glyph", rx: 0.062, y: 0.60, size: 126, rot: 8, tone: "paper" },
    ),
  },

  /* 14: the filters sheet. */
  14: {
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "stat", tab: "Matching", figure: "52", unit: "homes", lucide: "search" }],
    props: [{ name: "checklist", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "search", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "banknote", kind: "glyph", rx: 0.055, y: 0.34, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 15: schools. */
  15: {
    pops: [{ side: "left", y: 0.962, anchor: "bottom", kind: "stat", tab: "Schools in Abia", figure: "23", unit: "to browse", lucide: "graduation-cap" }],
    props: [{ name: "explore", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "map-pin", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "users", kind: "glyph", rx: 0.055, y: 0.34, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 16: the roommate checklist. */
  16: {
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Step 01", lucide: "eye", title: "See it first", line: "In person, or on a live video call", meta: null }],
    props: [{ name: "checklist", x: 0.05, y: 0.80, size: 215, rot: -7 }],
    badges: SIDE(
      { name: "eye", kind: "glyph", rx: 0.055, y: 0.21, size: 140, rot: -6 },
      { name: "map-pin", kind: "glyph", x: 0.05, y: 0.36, size: 146, rot: 7 },
      { kind: "mark", rx: 0.062, y: 0.62, size: 126, rot: 8, tone: "paper" },
    ),
  },

  /* 17: notifications. */
  17: {
    mags: [{ box: [44, 1190, 1274, 1895], scale: 1.1, dy: 14 }],
    props: [{ name: "bell", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "bell", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "message-circle", kind: "glyph", rx: 0.055, y: 0.34, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 18: payments. The page's own balance panel lifted: it prints the headline itself. */
  18: {
    mags: [{ box: [44, 626, 1276, 1140], scale: 1.14, dy: -16 }],
    pops: [{ side: "right", y: 0.962, anchor: "bottom", kind: "line", tab: "Agreements", lucide: "file-text", title: "See your agreements", line: "Terms you can read first", meta: null }],
    props: [{ name: "bank", x: 0.045, y: 0.862, size: 210, rot: -8 }],
    badges: SIDE(
      { name: "receipt-text", kind: "glyph", rx: 0.055, y: 0.225, size: 140, rot: -6 },
      { name: "banknote", kind: "glyph", x: 0.05, y: 0.425, size: 142, rot: 6 },
      { name: "landmark", kind: "glyph", rx: 0.062, y: 0.63, size: 128, rot: 8, tone: "paper" },
    ),
  },

  /* 19: the passport. */
  19: {
    mags: [{ box: [44, 1160, 1270, 2410], scale: 1.08, dy: 10 }],
    pops: [{ side: "left", y: 0.962, anchor: "bottom", kind: "line", tab: "You choose", lucide: "toggle-right", title: "Switch any line off", line: "Every line is shown until you do", meta: null }],
    props: [{ name: "id-check", rx: 0.05, y: 0.78, size: 215, rot: 8 }],
    badges: SIDE(
      { name: "badge-check", kind: "glyph", x: 0.05, y: 0.215, size: 140, rot: -6 },
      { name: "user-round", kind: "glyph", rx: 0.055, y: 0.34, size: 146, rot: 7 },
      { kind: "mark", x: 0.058, y: 0.62, size: 126, rot: -8, tone: "paper" },
    ),
  },

  /* 20: the close. */
  20: {
    props: [{ name: "keys", x: 0.05, y: 0.80, size: 215, rot: -8 }],
    badges: SIDE(
      { name: "home-small", rx: 0.055, y: 0.215, size: 150, rot: 6 },
      { name: "hotel", x: 0.05, y: 0.36, size: 150, rot: -6 },
      { name: "restaurant", rx: 0.062, y: 0.62, size: 130, rot: 8, tone: "paper" },
    ),
  },
};
