/**
 * VIDEO TWO, "Vision and what's coming" (films/vision2, rebuilt 11 November
 * 2026 on the upgraded platform). About 99 seconds, vertical, one cut.
 *
 * One phone carries the film through what Vallo is now: the full cost of a
 * home, stays and tables, then the part that is more than listings (Vallo
 * Circle, Roommates), what was actually confirmed (badges, the passport),
 * the workspace for owners, hosts and agents, the AI assistant, and the
 * direction. It ends on the store card, live on both stores.
 *
 * Nothing here refers to a number of seconds: every beat hangs on s(i), e(i)
 * and w(i, "word") from the film's own clock, so when the real recording
 * replaces films/vision2/timeline.json the whole film re-anchors itself.
 * Claims: video/FACTS.md, FACTS-OCT.md and HANDOFF.md (see docs/marketing/
 * voiceover/VIDEO-2-ELEVENLABS.md for the line-by-line source of each).
 * Copy rules: marketing/DESIGN.md section 2. The member on every screen is
 * the placeholder "Member"; no address, number or real name is shown.
 */
import {
  anchors, ground, hero, lift, headline, ending, chipRow, popOut, figureOut,
  badgeDisc, object3d, installFocus, leak, flash, slabWipe, shutter, irisTicks,
  tileFall, whipPan,
} from "../kit.js";
import { openerWords, totalPlate, gatherDiscs } from "./parts.js";

export async function build(ctx) {
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });
  const CX = ctx.W / 2;
  const TOP = 470;     // the band under the chapter pill, where a container sits
  const BAND = 1440;   // the label band under the phone's content
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });
  const T = ctx.T;

  /* ---------- poses ---------- */
  const HOME = { cx: CX, cy: 1075, height: 1380 };
  const LOW = { cx: CX, cy: 1255, height: 1180 };
  const BACK = { cx: CX, cy: 1300, height: 1150 };
  const PEEK = { cx: CX, cy: 1990, height: 1380 };   // the top of the phone, rising out of the frame's foot
  const off = (p, dy = 1750) => ({ ...p, cy: p.cy + dy });
  /* the dock's centre icon, Vallo Circle, in display px */
  const DOCK = { x: 540, y: 2680 };
  const PUSH = H.aim(DOCK.x, DOCK.y, 2300, CX, 1120);

  /* ---------- the crops, in the displays' own pixels (1320 x 2868), read off the screens ---------- */
  const CELLS = { x: 46, y: 818, w: 1228, h: 186 };            // v3-listing-cost: RENT, FEES, REFUNDABLE
  const GREETING = { x: 44, y: 458, w: 1232, h: 800 };          // v3-home: the greeting card with the shortlist
  const STAYS_TOP = { x: 44, y: 1612, w: 1232, h: 404 };        // v3-stays: Hotels and Shortlets
  const REST_ROW = { x: 140, y: 1448, w: 1040, h: 186 };        // v3-restaurant: seafood, smart casual, seats 80
  const EXPLORE = { x: 13, y: 398, w: 1258, h: 838 };           // v3-circle-explore: "Explore Circle" and its eight tiles
  const ASK_TILE = { x: 350, y: 586, w: 310, h: 300 };
  const AREAS_TILE = { x: 690, y: 586, w: 250, h: 300 };
  const SAY_BLOCK = { x: 36, y: 1180, w: 1250, h: 610 };        // v3-roommates and -2: the numeral, heading and paragraph
  const TABS = { x: 262, y: 500, w: 1040, h: 130 };             // v3-schools: Groups, Schools, Corps members
  const CARD_01 = { x: 42, y: 871, w: 1236, h: 195 };           // v3-safety: "View the home in person..."
  const CARD_04 = { x: 42, y: 1899, w: 1236, h: 187 };          // v3-safety: "Never send money to an account you cannot verify."
  const PASS_HEAD = { x: 30, y: 314, w: 1290, h: 461 };         // v3-passport: the heading and what it says
  const ROW_HOTEL = { x: 0, y: 874, w: 1278, h: 307 };          // host-start: "We are a hotel"
  const ROW_AGENT = { x: 42, y: 2105, w: 1236, h: 137 };        // host-start: "I am an agent"
  const ROW_OWN = { x: 42, y: 1791, w: 1236, h: 141 };          // host-start: "I own the property"
  const BUBBLE = { x: 514, y: 590, w: 630, h: 214 };            // assistant-caution-2: the member's question
  const SPLIT_ROW = { x: 40, y: 1136, w: 1238, h: 134 };        // v3-split: a person's cost row
  const STAY_INFO = { x: 26, y: 1751, w: 1276, h: 817 };         // v3-stay: the info section below the image

  /* ---------- the phone's path ---------- */
  H.path([
    [0, { ...PEEK, opacity: 1 }],
    [s(2) - 0.15, { ...PEEK }, "none"],
    [s(2) + 0.55, { ...LOW }, "power3.out"],
    [s(3) - 0.3, { ...LOW }],
    [s(3) + 0.35, { ...HOME }, "glide"],
    [s(4) - 0.1, { ...HOME }],
    [s(4) + 0.5, { ...BACK }, "glide"],
    [s(5) - 0.2, { ...BACK }],
    [s(5) + 0.4, { ...HOME }, "glide"],
    [s(7) - 0.3, { ...HOME }],
    [s(7) + 0.45, { ...LOW }, "glide"],
    [s(9) - 0.3, { ...LOW }],
    /* the pivot: the phone leaves, the words carry the beat */
    [s(9) + 0.12, { ...off(HOME), ry: -18 }, "power3.in"],
    [s(10) - 0.05, { ...off(HOME), ry: 16 }, "none"],
    /* and comes back already pushed onto the dock: Circle is the centre of it */
    [s(10) + 0.75, { ...PUSH, ry: 0 }, "power3.out"],
    [s(11) - 0.05, { ...PUSH }],
    [s(11) + 0.7, { ...HOME }, "glide"],
    [s(14) - 0.1, { ...HOME }],
    [s(14) + 0.5, { ...LOW }, "glide"],
    [s(16) - 0.2, { ...LOW }],
    [s(16) + 0.4, { ...HOME }, "glide"],
    [s(18) - 0.2, { ...HOME }],
    [s(18) + 0.45, { ...BACK }, "glide"],
    [s(21) - 0.2, { ...BACK }],
    [s(21) + 0.4, { ...HOME }, "glide"],
    [s(22) - 0.35, { ...HOME }],
    [s(22) + 0.1, { ...off(HOME), rz: -8, ry: 20 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ]);
  H.swing(s(7) + 0.05, s(13) + 0.05, s(16) + 0.05, s(18) + 0.05, s(21) + 0.05);

  /* ===================== 1. The opening frame (0 - s3) =====================
     Composed and still at t = 0. The voice's first line sets the key word in
     its box; the second line replaces the words and the phone rises. */
  ground(ctx, 0, s(3) - 0.05, { tone: "navy", y: 26, seed: 11 });
  const open = layer("open", 0, s(3) - 0.2);
  openerWords(ctx, open, { x: 70, y: 470, size: 114, tKey: w(1, "moving") - 0.05, t1: s(2) - 0.3 });
  ctx.hideCaptions(0, s(2) - 0.25);
  headline(ctx, open, {
    lines: [[["Vallo is where", false]], [["it is going.", true]]],
    x: 70, y: 280, size: 104, t0: s(2) - 0.08, t1: s(3) - 0.45, stagger: 0.05,
  });
  ctx.hideCaptions(s(2) - 0.15, s(3) - 0.5);
  H.show("v3-welcome", 0, s(3) + 0.2, { enter: "cut" });
  badgeDisc(ctx, open, { name: "villa", kind: "object", x: 905, y: 330, size: 150, t0: s(1) + 0.35, t1: s(2) - 0.3, seed: 12 });
  badgeDisc(ctx, open, { name: "keys", kind: "object", x: 160, y: 1450, size: 130, t0: s(2) + 0.2, t1: s(3) - 0.5, seed: 13, tone: "paper" });
  badgeDisc(ctx, open, { name: "city", kind: "object", x: 930, y: 1390, size: 140, t0: s(2) + 0.45, t1: s(3) - 0.5, seed: 14 });

  /* ===================== 2. The full cost (s3 - s5) =====================
     CUT 1 -> 2. A navy slab travels up the frame as the phone rises into
     its next pose with the listing on the glass. */
  slabWipe(ctx, s(3) - 0.05, { dir: "up", dur: 0.42 });
  ground(ctx, s(3) - 0.05, s(7) - 0.05, { tone: "electric", y: 22, seed: 12 });
  const cost = layer("cost", s(3) - 0.1, s(7) - 0.1);
  H.show("v3-listing", s(3) - 0.2, s(4) - 0.05, { enter: "slide" });
  popOut(ctx, cost, {
    kind: "line", lucide: "receipt-text", tab: "Before you call", title: "The full cost, up front", line: "Nothing left for later.",
    x: CX, y: TOP, t0: w(3, "full") - 0.15, t1: s(4) - 0.2, size: 31, from: "above", seed: 21,
  });
  H.show("v3-listing-cost", s(4) - 0.05, w(4, "all") - 0.1, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-listing-cost", crop: CELLS, t0: w(4, "rent") - 0.05, t1: w(4, "caution") - 0.1,
    to: { x: CX, y: 620, s: 0.72, r: -1.4 }, exit: "up", fly: 0.55, seed: 22, radius: 34,
  });
  H.show("v3-listing-total", w(4, "all") - 0.1, s(5) - 0.15, { enter: "slide" });
  totalPlate(ctx, cost, {
    x: CX, y: 640, t0: w(4, "all") - 0.1, t1: s(5) - 0.28, tRoll0: w(4, "added") + 0.05, tRoll1: w(4, "added") + 1.0, size: 40,
  });
  badgeDisc(ctx, cost, { name: "receipt", kind: "object", x: 150, y: 1450, size: 130, t0: w(4, "refundable"), t1: s(5) - 0.3, seed: 23 });
  badgeDisc(ctx, cost, { name: "coin", kind: "object", x: 940, y: 1380, size: 120, t0: w(4, "caution"), t1: s(5) - 0.3, seed: 24, tone: "paper" });

  /* SAVE AND COMPARE. A light whip, then the home's own greeting card held up. */
  whipPan(ctx, s(5) - 0.04, { dir: "left", dur: 0.24, sound: null });
  ctx.sfx("swipe", s(5) - 0.1, { offset: -3 });
  H.show("v3-home", s(5) - 0.12, w(6, "Split") - 0.2, { enter: "slide" });
  H.show("v3-split", w(6, "Split") - 0.2, s(7) - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-home", crop: GREETING, t0: w(5, "save") + 0.05, t1: w(6, "Split") - 0.4,
    to: { x: CX, y: 900, s: 0.64, r: 1.2 }, exit: "fade", fly: 0.6, seed: 25, radius: 40,
  });
  popOut(ctx, cost, {
    kind: "line", lucide: "scale", tab: "Your shortlist", title: "Two homes, side by side", line: "Compare before you decide.",
    x: CX, y: TOP, t0: w(5, "compare") - 0.1, t1: w(6, "Split") - 0.35, size: 31, from: "above", seed: 26,
  });
  H.tap(w(5, "side") + 0.1, 270, 1160);

  /* SPLIT THE TOTAL, line by line. */
  whipPan(ctx, w(6, "Split") - 0.15, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  lift(ctx, H, {
    id: "v3-split", crop: SPLIT_ROW, t0: w(6, "Split") - 0.05, t1: w(6, "between") - 0.2,
    to: { x: CX, y: 700, s: 0.78, r: 1.2 }, exit: "fade", fly: 0.55, seed: 60, radius: 30,
  });
  popOut(ctx, cost, {
    kind: "counters", items: [["user", "Person 1"], ["user", "Person 2"], ["user", "Person 3"]],
    x: CX, y: TOP, t0: w(6, "between") - 0.1, t1: s(7) - 0.4, size: 30, from: "above", seed: 61, tab: "Split the total",
  });
  object3d(ctx, cost, { name: "team", size: 200, x: 930, y: 1250, t0: w(6, "Split") + 0.1, t1: s(7) - 0.35, drift: 1, seed: 62 });

  /* ===================== 3. Stays and tables (s6) =====================
     CUT 2 -> 3. Four tick brackets close on the centre and bloom. */
  irisTicks(ctx, s(7) - 0.05, { dur: 0.44 });
  ground(ctx, s(7) - 0.05, s(9) - 0.05, { tone: "dusk", y: 70, seed: 13 });
  const stays = layer("stays", s(7) - 0.1, s(9) - 0.1);
  H.show("v3-stays", s(7) - 0.2, w(7, "table") - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-stays", crop: STAYS_TOP, t0: w(7, "hotel") - 0.05, t1: w(7, "going", 2) - 0.25,
    to: { x: CX, y: 640, s: 0.66, r: -1.2 }, exit: "left", fly: 0.55, seed: 27, radius: 36,
  });
  H.show("v3-restaurant", w(7, "table") - 0.2, w(8, "See") - 0.2, { enter: "slide" });
  H.show("v3-stay", w(8, "See") - 0.2, s(9) - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-restaurant", crop: REST_ROW, t0: w(7, "table") - 0.05, t1: w(8, "See") - 0.55,
    to: { x: CX, y: 640, s: 0.78, r: 1.1 }, exit: "fade", fly: 0.55, seed: 28, radius: 36,
  });
  chipRow(ctx, stays, {
    items: [["Hotels", "hotel"], ["Shortlets", "key-round"], ["Tables", "utensils"]],
    x: CX, y: BAND, t0: w(7, "hotel") + 0.05, gap: Math.max(0.35, (w(7, "table") - w(7, "hotel")) / 3.2),
    t1: w(8, "See") - 0.3, size: 32, wrapW: 1000, anchor: "center",
  });
  object3d(ctx, stays, { name: "hotel", size: 190, x: 130, y: 1170, t0: w(7, "hotel") + 0.1, t1: w(7, "going", 2) - 0.2, drift: 1, seed: 29 });
  object3d(ctx, stays, { name: "restaurant", size: 190, x: 940, y: 1190, t0: w(7, "table") + 0.1, t1: w(8, "See") - 0.3, drift: 1, seed: 30 });

  /* SEE THE ROOM, READ THE MENU. Every detail before you book. */
  whipPan(ctx, w(8, "See") - 0.15, { dir: "right", dur: 0.24, sound: "whoosh_short" });
  popOut(ctx, stays, {
    kind: "counters", items: [["eye", "See the room"], ["book-open", "Read the menu"], ["check-circle", "Check details"]],
    x: CX, y: TOP, t0: w(8, "See") + 0.1, t1: w(8, "check") - 0.2, size: 30, from: "above", seed: 63, tab: "Before you book",
  });
  lift(ctx, H, {
    id: "v3-stay", crop: STAY_INFO, t0: w(8, "check") - 0.1, t1: s(9) - 0.55,
    to: { x: CX, y: 620, s: 0.54, r: -1.2 }, exit: "fade", fly: 0.55, seed: 64, radius: 40,
  });
  object3d(ctx, stays, { name: "hotel", size: 200, x: 935, y: 1300, t0: w(8, "See") + 0.2, t1: s(9) - 0.3, drift: 1, seed: 65 });
  ctx.hidePill(w(8, "See") - 0.2, s(9));

  /* ===================== 4. More than listings (s7) =====================
     CUT 3 -> 4. The frame breaks into tiles and drops away. The phone is
     gone; the words carry the beat. */
  ctx.sfx("riser", s(9) - 0.95, { offset: -4 });
  tileFall(ctx, s(9) - 0.05, { cols: 6, rows: 10, dur: 0.46, seed: 9 });
  ground(ctx, s(9) - 0.05, s(13) - 0.05, { tone: "violet", y: 24, seed: 14 });
  const more = layer("more", s(9) - 0.1, s(10) - 0.05);
  headline(ctx, more, {
    lines: [[["More than", false]], [["listings.", true]]],
    x: CX, y: 520, size: 146, t0: s(9) + 0.04, t1: s(10) - 0.32, align: "center", keyStyle: "chip", stagger: 0.07,
  });
  ctx.hideCaptions(s(9) - 0.1, s(10) - 0.3);
  chipRow(ctx, more, {
    items: [["Community", "users"], ["Roommates", "house"], ["Workspaces", "briefcase"]],
    x: CX, y: 1010, t0: s(9) + 0.7, gap: 0.3, t1: s(10) - 0.4, size: 36, wrapW: 1000, anchor: "center",
  });
  object3d(ctx, more, { name: "city", size: 240, x: 830, y: 1420, t0: s(9) + 0.35, t1: s(10) - 0.35, drift: 1, seed: 31 });
  object3d(ctx, more, { name: "local-talks", size: 200, x: 220, y: 1380, t0: s(9) + 0.55, t1: s(10) - 0.35, drift: 1, seed: 32 });

  /* ===================== 5. Vallo Circle (s8 - s10) =====================
     A bloom, not a cut: the phone is back, pushed onto the dock, and the
     dock's centre icon is Circle. */
  flash(ctx, s(10) - 0.08, { sound: "whoosh_short" });
  leak(ctx, s(10) - 0.02, { warm: false, dur: 0.9 });
  const circle = layer("circle", s(10) - 0.2, s(13) - 0.1);
  H.show("v3-circle", s(10) - 0.5, s(11) - 0.05, { enter: "cut" });
  ctx.hidePill(s(10) - 0.1, s(11) + 0.7);
  H.ring(s(10) + 0.55, s(11) - 0.25, { x: 440, y: 2590, w: 200, h: 180, r: 90 });
  popOut(ctx, circle, {
    kind: "line", lucide: "users", tab: "Community", title: "Ask, share, learn", line: "About homes and areas.",
    x: CX, y: TOP, t0: w(10, "circle") - 0.1, t1: s(11) - 0.1, size: 31, from: "above", seed: 33,
  });
  /* who is in it, one chip on each word */
  H.show("v3-circle-explore", s(11) - 0.1, s(13) - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-circle-explore", crop: EXPLORE, t0: w(11, "sharing") - 0.1, t1: s(12) - 0.55,
    to: { x: CX, y: 880, s: 0.66, r: -1.2 }, exit: "fade", fly: 0.6, seed: 34, radius: 36,
  });
  chipRow(ctx, circle, {
    items: [["Renters", "key-round"], ["Owners", "house"], ["Agents", "user-round"], ["Professionals", "briefcase"]],
    x: CX, y: BAND, t0: w(11, "renters"), gap: Math.max(0.3, (w(11, "professionals") - w(11, "renters")) / 3.1),
    t1: s(12) - 0.2, size: 31, wrapW: 1000, anchor: "center",
  });
  /* ask: the two tiles that matter, held up and left side by side */
  lift(ctx, H, {
    id: "v3-circle-explore", crop: ASK_TILE, t0: s(12) + 0.3, t1: s(13) - 0.35,
    to: { x: 330, y: 720, s: 1.45, r: -2 }, exit: "left", fly: 0.55, seed: 35, radius: 34,
  });
  lift(ctx, H, {
    id: "v3-circle-explore", crop: AREAS_TILE, t0: w(12, "neighbourhood") - 0.15, t1: s(13) - 0.3,
    to: { x: 760, y: 790, s: 1.45, r: 2 }, exit: "right", fly: 0.55, seed: 36, radius: 34,
  });
  badgeDisc(ctx, circle, { name: "local-talks", kind: "object", x: 925, y: 1250, size: 130, t0: w(12, "move"), t1: s(13) - 0.3, seed: 37 });

  /* ===================== 6. Roommates (s11 - s13) =====================
     CUT 4 -> 5. Seven bars close from alternate sides. */
  shutter(ctx, s(13) - 0.05, { bars: 7, dur: 0.38 });
  ground(ctx, s(13) - 0.05, s(16) - 0.05, { tone: "emerald", y: 20, seed: 15 });
  const room = layer("roommates", s(13) - 0.1, s(16) - 0.1);
  H.show("v3-roommates", s(13) - 0.2, s(14) - 0.1, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-roommates", crop: SAY_BLOCK, t0: w(13, "someone") - 0.05, t1: s(14) + 0.2,
    to: { x: CX, y: 880, s: 0.66, r: -1.4 }, exit: "fade", fly: 0.55, seed: 38, radius: 30,
  });
  popOut(ctx, room, {
    kind: "line", lucide: "users", tab: "Vallo Roommates", title: "A roommate, or a room", line: "Find one. Or offer yours.",
    x: CX, y: TOP, t0: w(14, "roommates") - 0.05, t1: s(15) - 0.1, size: 31, from: "above", seed: 39,
  });
  badgeDisc(ctx, room, { name: "team", kind: "object", x: 930, y: 1250, size: 135, t0: w(14, "roommate") + 0.1, t1: s(15) - 0.15, seed: 40 });
  H.show("v3-schools", s(14) - 0.1, w(15, "safety") - 0.35, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-schools", crop: TABS, t0: w(15, "school") - 0.05, t1: w(15, "safety") - 0.5,
    to: { x: CX, y: 620, s: 0.84, r: 1 }, exit: "up", fly: 0.55, seed: 41, radius: 34,
  });
  H.show("v3-safety", w(15, "safety") - 0.35, s(16) - 0.15, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-safety", crop: CARD_01, t0: w(15, "safety") - 0.05, t1: s(16) - 0.45,
    to: { x: CX, y: 640, s: 0.7, r: -1.2 }, exit: "fade", fly: 0.55, seed: 42, radius: 34,
  });
  lift(ctx, H, {
    id: "v3-safety", crop: CARD_04, t0: w(15, "first") - 0.25, t1: s(16) - 0.4,
    to: { x: CX, y: 910, s: 0.7, r: 1.2 }, exit: "fade", fly: 0.55, seed: 43, radius: 34,
  });

  /* ===================== 7. What was confirmed (s14 - s15) =====================
     CUT 5 -> 6. The slab sweeps left. */
  slabWipe(ctx, s(16) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(16) - 0.05, s(18) - 0.05, { tone: "navy", y: 30, seed: 16 });
  const trust = layer("trust", s(16) - 0.1, s(18) - 0.1);
  H.show("v3-roommates-2", s(16) - 0.2, s(17) - 0.12, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-roommates-2", crop: SAY_BLOCK, t0: w(16, "badge") - 0.05, t1: s(17) - 0.4,
    to: { x: CX, y: 820, s: 0.66, r: -1.2 }, exit: "fade", fly: 0.55, seed: 44, radius: 30,
  });
  popOut(ctx, trust, {
    kind: "counters", tab: "What a badge can say", items: [["graduation-cap", "School email"], ["id-card", "ID"], ["phone", "Phone number"]],
    x: CX, y: BAND - 20, t0: w(16, "confirmed") - 0.1, t1: s(17) - 0.3, size: 28, from: "below", seed: 45,
  });
  H.show("v3-passport", s(17) - 0.2, s(18) - 0.15, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-passport", crop: PASS_HEAD, t0: w(17, "passport") + 0.05, t1: s(18) - 0.45,
    to: { x: CX, y: 860, s: 0.66, r: 1.2 }, exit: "fade", fly: 0.55, seed: 46, radius: 34,
  });
  popOut(ctx, trust, {
    kind: "line", lucide: "toggle-right", tab: "Your Vallo passport", title: "You decide", line: "Switch a line off, any time.",
    x: CX, y: BAND - 20, t0: w(17, "switch") - 0.1, t1: s(18) - 0.4, size: 30, from: "below", seed: 47,
  });

  /* ===================== 8. The workspace (s16 - s17) =====================
     CUT 6 -> 7. The bars of light close once more, into the gold. */
  irisTicks(ctx, s(18) - 0.05, { dur: 0.44 });
  ground(ctx, s(18) - 0.05, s(21) - 0.05, { tone: "gold", y: 28, seed: 17 });
  const work = layer("workspace", s(18) - 0.1, s(21) - 0.1);
  H.show("host-start", s(18) - 0.2, s(21) - 0.15, { enter: "slide" });
  lift(ctx, H, {
    id: "host-start", crop: ROW_HOTEL, t0: w(18, "host") - 0.05, t1: w(18, "becomes") - 0.2,
    to: { x: CX, y: 560, s: 0.62, r: -1.6 }, exit: "left", fly: 0.5, seed: 48, radius: 34,
  });
  lift(ctx, H, {
    id: "host-start", crop: ROW_AGENT, t0: w(18, "manage") - 0.05, t1: w(18, "becomes") - 0.1,
    to: { x: CX, y: 790, s: 0.62, r: 1.4 }, exit: "right", fly: 0.5, seed: 49, radius: 34,
  });
  popOut(ctx, work, {
    kind: "counters", tab: "In your workspace", items: [["calendar-days", "Calendar"], ["bed-double", "Bookings"], ["utensils", "Reservations"]],
    x: CX, y: 1040, t0: w(18, "workspace") - 0.1, t1: s(19) + 0.3, size: 28, from: "below", seed: 50,
  });
  lift(ctx, H, {
    id: "host-start", crop: ROW_OWN, t0: w(19, "place") - 0.1, t1: w(20, "Track") - 0.3,
    to: { x: CX, y: 640, s: 0.66, r: -1.2 }, exit: "fade", fly: 0.55, seed: 51, radius: 34,
  });
  popOut(ctx, work, {
    kind: "line", lucide: "badge-check", tab: "Owners", title: "No agency fee", line: "List it yourself.",
    x: CX, y: 880, t0: w(19, "agency") - 0.1, t1: w(20, "Track") - 0.25, size: 34, from: "right", seed: 52,
  });
  object3d(ctx, work, { name: "keys", size: 190, x: 135, y: 1230, t0: w(19, "list") - 0.1, t1: w(20, "Track") - 0.3, drift: 1, seed: 53 });

  /* TRACK YOUR BOOKINGS. Read reviews, manage listings from anywhere. */
  whipPan(ctx, w(20, "Track") - 0.15, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  popOut(ctx, work, {
    kind: "counters", items: [["calendar-days", "Bookings"], ["star", "Reviews"], ["list", "Listings"]],
    x: CX, y: TOP, t0: w(20, "Track") + 0.1, t1: s(21) - 0.4, size: 30, from: "above", seed: 66, tab: "Manage from anywhere",
  });
  object3d(ctx, work, { name: "toolbox", size: 200, x: 130, y: 1250, t0: w(20, "bookings") + 0.1, t1: s(21) - 0.35, drift: 1, seed: 67 });

  /* ===================== 9. The assistant, in four languages (s18) =====================
     A light whip, no loud cut: this is still the same hand holding the phone. */
  whipPan(ctx, s(21) - 0.04, { dir: "right", dur: 0.24, sound: null });
  ground(ctx, s(21) - 0.05, s(22) - 0.05, { tone: "electric", y: 30, seed: 18 });
  const ask = layer("assistant", s(21) - 0.1, s(22) - 0.1);
  H.show("assistant-caution-2", s(21) - 0.2, s(22) - 0.1, { enter: "slide" });
  lift(ctx, H, {
    id: "assistant-caution-2", crop: BUBBLE, t0: w(21, "assistant") - 0.05, t1: s(22) - 0.45,
    to: { x: 640, y: 600, s: 0.95, r: 1.4 }, exit: "fade", fly: 0.55, seed: 54, radius: 40,
  });
  chipRow(ctx, ask, {
    items: [["English", "languages"], ["Hausa", "languages"], ["Yorùbá", "languages"], ["Igbo", "languages"]],
    x: CX, y: BAND - 10, t0: w(21, "english") - 0.05, gap: Math.max(0.28, (w(21, "igbo") - w(21, "english")) / 3.1),
    t1: s(22) - 0.35, size: 32, wrapW: 1000, anchor: "center",
  });
  badgeDisc(ctx, ask, { name: "assistant", kind: "object", x: 150, y: 360, size: 140, t0: w(21, "ask"), t1: s(22) - 0.4, seed: 55 });

  /* ===================== 10. The start (s19 - s21) =====================
     CUT 7 -> 8. The bars close, the phone leaves, and the words stand alone. */
  shutter(ctx, s(22) - 0.05, { bars: 7, dur: 0.36 });
  ground(ctx, s(22) - 0.05, T.music.logo_hit + 0.6, { tone: "dusk", y: 40, seed: 19 });
  const vision = layer("vision", s(22) - 0.1, T.music.logo_hit + 0.4);
  headline(ctx, vision, {
    lines: [[["This is only", false]], [["the start.", true]]],
    x: CX, y: 560, size: 130, t0: s(22) + 0.05, t1: s(23) - 0.4, align: "center", stagger: 0.07,
  });
  ctx.hideCaptions(s(22) - 0.1, s(23) - 0.3);
  /* the sentence is built word by word, each on the word that says it */
  const lineSize = 118;
  headline(ctx, vision, { lines: [[["How Nigeria", false]]], x: 90, y: 500, size: 84, t0: s(23) + 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["finds,", true]]], x: 90, y: 640, size: lineSize, t0: w(23, "finds") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["understands", true]]], x: 90, y: 780, size: lineSize, t0: w(23, "understands") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["and runs", true]], [["its spaces.", false]]], x: 90, y: 920, size: lineSize, t0: w(23, "runs") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  ctx.hideCaptions(s(23) - 0.25, s(24) - 0.15);
  object3d(ctx, vision, { name: "search", size: 220, x: 850, y: 700, t0: w(23, "finds") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 56 });
  object3d(ctx, vision, { name: "assistant", size: 220, x: 860, y: 1020, t0: w(23, "understands") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 57 });
  object3d(ctx, vision, { name: "toolbox", size: 220, x: 860, y: 1340, t0: w(23, "runs") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 58 });
  /* every home, every room, every table, every neighbour: four discs that
     then fly into the end card's mark */
  const endT = T.music.logo_hit - 0.05;
  gatherDiscs(ctx, vision, {
    to: { x: CX, y: 760 }, tFly: endT - 0.72,
    items: [
      { name: "villa", label: "Home", x: 300, y: 780, t0: w(24, "home") },
      { name: "hotel", label: "Room", x: 780, y: 780, t0: w(24, "room") },
      { name: "restaurant", label: "Table", x: 300, y: 1230, t0: w(24, "table") },
      { name: "local-talks", label: "Neighbour", x: 780, y: 1230, t0: w(24, "neighbour") },
    ],
  });
  ctx.hideCaptions(s(24) - 0.1, e(24) + 0.6);

  /* ===================== 11. The end card =====================
     The mark lands on the music's hit; "Live now" is on screen as the voice
     says it; the line closes the film. */
  ending(ctx, { t0: endT, tLine: w(27, "real") - 0.12, tBadges: Math.max(endT + 0.9, w(25, "app") - 0.15), tUrl: s(26) + 0.15, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: 0.42 });
}
