/*
 * VIDEO ONE, "How Vallo works" (November 2026, on the upgraded platform).
 * Vertical, one cut, about 88 seconds, clock in films/how2/timeline.json.
 *
 * ONE PURPOSE: make a Nigerian viewer want to open Vallo today. The film is a
 * walk through what the app really does now, in the order a person meets it:
 *
 *   1  the hook: the asking price and the move-in total, side by side
 *   2  Meet Vallo (the phone arrives)
 *   3  search and filter ("See 52 homes")
 *   4-6 the whole move-in cost: the rows, then the total, rolling
 *   7  for-sale listings, same full cost
 *   8  save and compare       9  split the cost, person by person
 *   10 the AI assistant
 *   11-12 a stay, then a table  13 see the room, read the menu
 *   14 Vallo Circle        15-16 Vallo Roommates and its badges
 *   17 Vallo never holds your money
 *   18-19 one app, one account, download it     20 the end card (live)
 *
 * Every figure on a card is a figure a screen prints (FACTS-OCT.md and
 * DESIGN.md section 2): the example villa's rent of N18m and move-in total of
 * N26.1m, Lagoon Crest Resort's N150,000 a night, "See 52 homes". Every
 * listing, stay and table is the platform's own example stock, and a card
 * that shows a stay or a table carries the Example chip.
 * "Verified" is never said about a home. Rental payment is not open yet, so
 * nothing here promises a payment or a refund: the caution deposit is shown
 * as the listing prints it ("refundable").
 *
 * Nothing refers to a number of seconds. Every beat hangs on s(i), e(i) or
 * w(i, "word") from the clock, so when the recording replaces the provisional
 * clock the film re-anchors itself (films/provisional.mjs).
 */
import {
  anchors, ground, hero, lift, headline, ending, popOut, badgeDisc, figureOut,
  object3d, installFocus, slabWipe, shutter, irisTicks, tileFall, whipPan,
} from "../kit.js";
import { odometer } from "../../engine/components.js";
import { placeBack, standingHeadline, examplePill, shower } from "./parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });
  const show = shower(H);

  const cut = (i) => s(i) - 0.12;
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });
  const CX = 540;
  /* the landscape cut: the phone stands in the middle (glass y ~145..945, clear
     of the chapter pill at y 36..96 and the captions at y ~1012), and every
     card, lift and headline moves to the left (x ~60..760) or right column
     (x ~1160..1860), alternating chapter by chapter */
  const Dk = (m, d) => (M ? m : d);
  const LX = 410, RX = 1510;
  /* a list of three chips is wide: in the side columns it is set smaller than a single card */
  const pop = (parent, o) => popOut(ctx, parent, M ? o : { ...o, size: (o.size ?? 32) * (o.kind === "counters" ? 0.84 : 1.16), x: o.kind === "counters" ? o.x + (o.x > 960 ? 20 : -20) : o.x });

  /* ---------- the stage ---------- */
  /* HOME: the phone at reading size (glass y 398..1752). LOW: stepped back,
     so the band from the pill down to y 700 is free for a container. */
  const HOME = Dk({ cx: CX, cy: 1075, height: 1380 }, { cx: 960, cy: 540, height: 858 });
  const LOW = Dk({ cx: CX, cy: 1265, height: 1150 }, { cx: 960, cy: 545, height: 840 });
  const off = (p) => ({ ...p, cy: p.cy + Dk(1750, 1150) });
  /* the push onto the cost rows: the middle of the breakdown at the middle of the frame */
  const COST = Dk(H.aim(660, 1830, 1850, CX, 1010), H.aim(660, 1830, 1300, 960, 560));

  /* A pose with its turn reset: keyframes carry every property forward, so a
     tilted key must be followed by keys that say they are square again. */
  const at = (p, extra = {}) => ({ rx: 0, ry: 0, rz: 0, ...p, ...extra });
  /* the handset turned a few degrees one way or the other: the 3D studio's own
     phone, so the glass and the bezel turn with it */
  const TURN_L = (p = LOW) => at(p, { cx: p.cx - Dk(38, 26), ry: 12, rz: -2.2 });
  const TURN_R = (p = LOW) => at(p, { cx: p.cx + Dk(38, 26), ry: -12, rz: 2.2 });
  const E = "power3.inOut";

  H.path([
    [0, { ...at(off(HOME)), opacity: 0 }],
    [cut(2) - 0.13, { ...at(off(HOME)), opacity: 0 }, "none"],
    /* THE ARRIVAL, behind the opening wipe: the handset rises already turned,
       and settles square on "Meet Vallo" */
    [cut(2) - 0.12, { ...at(off(HOME), { ry: -16, rz: 5 }), opacity: 1 }, "none"],
    [cut(2) + 0.85, at(HOME), "power3.out"],
    [s(3) - 0.05, at(HOME)],
    [s(3) + 0.65, TURN_R(LOW), E],
    [cut(4) - 0.05, TURN_R(LOW)],
    /* the listing: reading size, then the push onto its price sheet */
    [cut(4) + 0.55, at(HOME), "power3.out"],
    /* it steps back as the cost container arrives, so the container sits in
       the clear band between the pill and the handset */
    [w(4, "whole") - 0.6, at(HOME)],
    [w(4, "whole") - 0.05, at(LOW), E],
    [w(5, "Rent") - 0.55, at(LOW)],
    [w(5, "Rent") + 0.35, at(COST), "power2.inOut"],
    [w(5, "added") + 0.25, at(COST)],
    [w(6, "On") + 0.30, TURN_L(LOW), E],
    [cut(8) - 0.05, TURN_L(LOW)],
    /* save and compare, ask the assistant, a stay, a table: each chapter
       turns the handset the other way */
    [cut(8) + 0.55, TURN_R(LOW), "power3.out"],
    [cut(10) - 0.05, TURN_R(LOW)],
    [cut(10) + 0.55, TURN_L(LOW), "power3.out"],
    [cut(11) - 0.05, TURN_L(LOW)],
    [cut(11) + 0.55, TURN_R(LOW), "power3.out"],
    [s(12) - 0.2, TURN_R(LOW)],
    [s(12) + 0.5, TURN_L(LOW), E],
    [cut(14) - 0.05, TURN_L(LOW)],
    [cut(14) + 0.55, at(LOW), "power3.out"],
    [cut(15) - 0.05, at(LOW)],
    [cut(15) + 0.55, TURN_R(LOW), "power3.out"],
    [s(16) - 0.25, TURN_R(LOW)],
    [s(16) + 0.45, TURN_L(LOW), E],
    [cut(17) - 0.35, TURN_L(LOW)],
    /* the vow: the phone steps down and the money line stands over it */
    [cut(17) + 0.05, at(LOW, { cy: LOW.cy + Dk(120, 0) }), "power3.out"],
    [cut(18) - 0.05, at(LOW, { cy: LOW.cy + Dk(120, 0) })],
    [cut(18) + 0.5, at(LOW), "power3.out"],
    [cut(20) - 0.2, at(LOW)],
    [cut(20) + 0.2, at(off(LOW), { ry: 18, rz: -5 }), "power3.in"],
    [cut(20) + 0.5, { ...at(off(LOW)), opacity: 0 }, "none"],
    [ctx.duration, { ...at(off(LOW)), opacity: 0 }, "none"],
  ]);
  H.swing(cut(4), cut(8), cut(10), cut(11), cut(14), cut(15), cut(17));

  /* ---------- the screens (the upgraded platform's own captures) ---------- */
  show("v3-home", cut(2) + 0.05, w(3, "Search") - 0.05, { enter: "cut" });
  show("v3-search", w(3, "Search") - 0.05, w(3, "filter") - 0.05, { enter: "slide" });
  show("v3-filters", w(3, "filter") - 0.05, cut(4) + 0.05, { enter: "rise" });
  show("v3-listing", cut(4) + 0.05, w(4, "whole") - 0.1, { enter: "cut" });
  show("v3-listing-cost", w(4, "whole") - 0.1, w(6, "and") - 0.2, { enter: "slide" });
  show("v3-listing-total", w(6, "and") - 0.2, w(7, "buy") - 0.1, { enter: "slide" });
  show("v3-listing-sale", w(7, "buy") - 0.1, cut(8) + 0.05, { enter: "slide" });
  show("v3-saved", cut(8) + 0.05, cut(9) + 0.05, { enter: "cut" });
  show("v3-split", cut(9) + 0.05, cut(10) + 0.05, { enter: "cut" });
  show("assistant", cut(10) + 0.05, cut(11) + 0.05, { enter: "cut" });
  show("v3-stays", cut(11) + 0.05, w(11, "few") - 0.35, { enter: "cut" });
  show("sc-stay", w(11, "few") - 0.35, s(12) - 0.15, { enter: "slide" });
  show("sc-restaurant", s(12) - 0.15, cut(13) + 0.05, { enter: "slide" });
  show("v3-stay", cut(13) + 0.05, cut(14) + 0.05, { enter: "cut" });
  show("v3-circle", cut(14) + 0.05, w(14, "where") - 0.3, { enter: "cut" });
  show("v3-circle-explore", w(14, "where") - 0.3, cut(15) + 0.05, { enter: "slide" });
  show("v3-roommates", cut(15) + 0.05, w(15, "share") - 0.05, { enter: "cut" });
  show("v3-schools", w(15, "share") - 0.05, e(15) - 0.25, { enter: "slide" });
  show("v3-roommates-2", e(15) - 0.25, cut(17) + 0.05, { enter: "slide" });
  show("v3-payments", cut(17) + 0.05, cut(18) + 0.05, { enter: "cut" });
  show("v3-home", cut(18) + 0.05, s(19) - 0.15, { enter: "cut" });
  show("v3-welcome", s(19) - 0.15, ctx.duration, { enter: "slide" });

  /* ===================== 1. The hook (built, still on frame one) ============ */
  ground(ctx, 0, cut(2), { tone: "navy", y: 26, seed: 11 });
  const openRoot = layer("open", 0, cut(2));
  /* frame one is never still: the whole opening drifts up slowly while the
     line is spoken (a pure function of t) */
  const open = ctx.el("div", { class: "fill", style: { transformOrigin: "50% 42%" } }, openRoot);
  ctx.onFrame((t) => {
    const u = Math.min(1, Math.max(0, t / cut(2)));
    const k = u * u * (3 - 2 * u);
    /* a drift in whole pixels, not a zoom or a transform: text on a moving
       composited layer anti-aliases differently with the frames painted before */
    open.style.top = `${Math.round(-44 * k)}px`;
  });
  placeBack(ctx, ctx.scene("open-place", 0, cut(2), { z: 3 }), { scene: "villa", t0: -1, t1: s(2) - 0.5, y: Dk(960, 560), opacity: 0.5 });
  standingHeadline(ctx, open, {
    lines: [[["Finding a home", false]], [["in Nigeria should", false]], [["not feel like", false]], [["a ", false], ["gamble.", true]]],
    x: Dk(64, 120), y: Dk(250, 250), size: M ? 108 : 96, t1: s(2) - 0.5,
  });
  /* THE TWO FIGURES THE FILM IS ABOUT, drawn standing on frame one: what the
     home asks, and what it costs to move in. Both are the example villa's own
     numbers (the listing prints rent N18,000,000 a year and a move-in total of
     N26,100,000). The viewer sees the gap before the first word. */
  pop(open, {
    kind: "stat", lucide: "key-round", tab: "Asking", figure: "₦18m", unit: "a year",
    x: Dk(372, 1240), y: Dk(1010, 330), t0: w(1, "home") - 0.1, t1: s(2) - 0.35, size: 34, from: "left", rot: -3, seed: 2,
  });
  pop(open, {
    kind: "stat", lucide: "receipt-text", tab: "Move-in total", figure: "₦26.1m",
    x: Dk(640, 1500), y: Dk(1330, 590), t0: w(1, "feel") - 0.15, t1: s(2) - 0.3, size: 40, from: "right", rot: 2.6, accent: "electric", seed: 3,
  });
  examplePill(ctx, open, { x: Dk(540, 1480), y: Dk(1560, 790), t0: w(1, "gamble") - 0.2, t1: s(2) - 0.4, size: 28, label: "Example home in Maitama" });
  object3d(ctx, open, { name: "keys", size: 250, x: Dk(140, 300), y: Dk(1650, 850), t0: 0.35, t1: s(2) - 0.35, drift: 1, seed: 14 });
  object3d(ctx, open, { name: "villa", size: 240, x: Dk(935, 1760), y: Dk(700, 210), t0: 0.7, t1: s(2) - 0.35, drift: 1, seed: 15 });
  ctx.hideCaptions(0, s(2) - 0.1);

  /* ===================== 2. Meet Vallo ==================================== */
  /* CUT 1 -> 2. A navy slab travels up the frame, its lit edge leading, and
     the phone rises into place behind it. */
  slabWipe(ctx, cut(2), { dir: "up", dur: 0.34 });
  ground(ctx, cut(2), cut(4), { tone: "electric", y: 24, seed: 12 });
  const hello = layer("hello", cut(2), cut(4));
  headline(ctx, hello, {
    lines: [[["Meet ", false], ["Vallo.", true]]],
    x: Dk(CX, LX), y: Dk(150, 420), size: Dk(128, 116), t0: s(2) - 0.05, t1: s(3) + 0.15, align: "center", stagger: 0.07, keyStyle: "chip",
  });
  badgeDisc(ctx, hello, { name: "vallo", kind: "mark", x: Dk(120, 1440), y: Dk(900, 330), size: 138, t0: s(2) + 0.25, t1: s(3) + 0.2, tone: "paper", seed: 4 });
  badgeDisc(ctx, hello, { name: "explore", x: Dk(960, 1640), y: Dk(1180, 700), size: 138, t0: s(2) + 0.4, t1: s(3) + 0.25, seed: 5 });
  ctx.hideCaptions(s(2) - 0.2, s(3) + 0.1);

  /* ===================== 3. Search, then filter =========================== */
  /* a light whip carries the screen from the home to the search: a quick move
     inside a chapter, never a chapter change */
  whipPan(ctx, w(3, "Search") - 0.1, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  const find = layer("find", s(3) - 0.2, cut(4) + 0.1);
  H.tap(w(3, "Search") - 0.3, 600, 1865);
  lift(ctx, H, {
    id: "v3-search", crop: { x: 40, y: 387, w: 1240, h: 165 },
    t0: w(3, "Search") + 0.6, t1: w(3, "filter") - 0.35,
    to: Dk({ x: CX, y: 540, s: 0.76, r: -1.5 }, { x: RX, y: 380, s: 0.56, r: -1.5 }), seed: 31, radius: 30,
  });
  H.tap(w(3, "filter") - 0.55, 1065, 474);
  pop(find, {
    kind: "counters", items: [["banknote", "Price range"], ["bed-double", "Bedrooms"], ["bath", "Bathrooms"]],
    x: Dk(CX, RX), y: Dk(540, 380), t0: w(3, "exactly") - 0.55, t1: w(3, "need") - 0.22, size: 32, from: "above", seed: 32, tab: "Filter by",
  });
  lift(ctx, H, {
    id: "v3-filters", crop: { x: 40, y: 2659, w: 1240, h: 190 },
    t0: w(3, "need") - 0.12, t1: cut(4) - 0.66,
    to: Dk({ x: CX, y: 555, s: 0.78, r: 1.5 }, { x: RX, y: 420, s: 0.56, r: 1.5 }), seed: 33, radius: 40,
  });
  object3d(ctx, find, { name: "search", size: 220, x: Dk(135, 380), y: Dk(1010, 760), t0: w(3, "Search") + 0.1, t1: cut(4) - 0.3, drift: 1, seed: 34 });
  ctx.hidePill(w(3, "need") - 0.4, cut(4));

  /* ===================== 4. Open a home, see the whole cost ================ */
  /* CUT 3 -> 4. Four tick brackets close on the centre and bloom. */
  irisTicks(ctx, cut(4), { dur: 0.34 });
  ground(ctx, cut(4), cut(8), { tone: "violet", y: 22, seed: 13 });
  const cost = layer("cost", cut(4), cut(8) + 0.1);
  object3d(ctx, cost, { name: "villa", size: 230, x: Dk(930, 1680), y: Dk(520, 700), t0: cut(4) + 0.35, t1: w(4, "whole") + 0.3, drift: 1, seed: 41 });
  pop(cost, {
    kind: "line", lucide: "receipt-text", tab: "Move-in cost", title: "Every fee, added up", line: "Every cost the lister declared.",
    x: Dk(CX, RX), y: Dk(505, 330), t0: w(4, "whole") - 0.55, t1: w(4, "before") - 0.62, size: 31, from: "above", seed: 42,
  });
  /* the figure a renter has already seen before anybody picks up a phone: the
     listing's own sticky bar */
  pop(cost, {
    kind: "stat", lucide: "receipt-text", tab: "Move-in total", figure: "₦26.1m", unit: "before the call",
    x: Dk(400, LX), y: Dk(545, 400), t0: w(4, "before") - 0.2, t1: w(5, "Rent") - 0.7, size: 32, from: "left", rot: -2, accent: "electric", seed: 43,
  });
  badgeDisc(ctx, cost, { name: "phone", kind: "glyph", x: Dk(900, 560), y: Dk(560, 640), size: 128, t0: w(4, "call") - 0.1, t1: w(5, "Rent") - 0.7, seed: 44 });
  ctx.hidePill(cut(4), cut(4) + 0.3);

  /* 5. THE ROWS, one by one on the word that names each. The camera is
     pushed onto the breakdown, and a ring walks down it. */
  /* the screen's wrappers stack by their start time, so a ring has to sit above them all */
  const ringBox = (t0, t1, { x, y, w: bw, h, r = 48 }) => {
    const el = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${h}px`, borderRadius: `${r}px`, border: "7px solid #8FD3FF", boxShadow: "0 0 50px 4px rgb(143 211 255 / 0.5), inset 0 0 36px rgb(0 105 254 / 0.28)", zIndex: 99999, visibility: "hidden" } }, H.p.screen);
    ctx.onFrame((t) => {
      const o = Math.min(1, Math.max(0, (t - t0) / 0.22)) * (1 - Math.min(1, Math.max(0, (t - (t1 - 0.22)) / 0.22)));
      el.style.visibility = o > 0.001 ? "inherit" : "hidden";
      el.style.opacity = o.toFixed(3);
    });
    ctx.sfx("pop_low", t0, { offset: -3 });
    return el;
  };
  const row = (y0, y1) => ({ x: 42, y: y0 + 8, w: 1236, h: y1 - y0 - 16, r: 36 });
  ringBox(w(5, "Rent") - 0.05, w(5, "agency") - 0.05, row(1074, 1395));
  ringBox(w(5, "agency") - 0.05, w(5, "legal") - 0.05, row(1395, 1665));
  ringBox(w(5, "legal") - 0.05, w(5, "agreement") - 0.05, row(1665, 1935));
  ringBox(w(5, "agreement") - 0.05, w(5, "refundable") - 0.05, row(1935, 2205));
  ringBox(w(5, "refundable") - 0.05, w(5, "all") + 0.05, row(2205, 2595));
  pop(cost, {
    kind: "line", lucide: "undo-2", tab: "Caution deposit", title: "Refundable", line: "Owed back at the end of the tenancy.",
    x: Dk(CX, RX), y: Dk(235, 420), t0: w(5, "refundable") - 0.5, t1: cut(6) + 0.1, size: 29, from: "above", accent: "electric", seed: 46,
  });
  ctx.hidePill(w(5, "Rent") - 0.6, cut(8));

  /* 6. THE NUMBERS. The rent first, then the total rolls into place. */
  pop(cost, {
    kind: "stat", lucide: "key-round", tab: "Rent", figure: "₦18m", unit: "a year",
    x: Dk(330, LX), y: Dk(560, 380), t0: w(6, "rent") - 0.5, t1: w(6, "total") - 0.58, size: 30, from: "left", seed: 47, rot: -2,
  });
  lift(ctx, H, {
    id: "v3-listing-total", crop: { x: 38, y: 1200, w: 1240, h: 170 },
    t0: w(6, "total") + 0.15, t1: w(7, "buy") - 0.45,
    to: Dk({ x: CX, y: 665, s: 0.8, r: -1.2 }, { x: RX, y: 470, s: 0.56, r: -1.2 }), seed: 48, radius: 30, fly: 0.8,
  });
  const roll = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W}px`, visibility: "hidden" } }, cost);
  const fig = odometer(ctx, roll, { value: 26100000, t0: w(6, "twenty-six") - 0.05, t1: w(6, "one") + 0.35, fontSize: Dk(124, 84) });
  Object.assign(fig.style, M ? { left: "50%", top: "372px", transform: "translateX(-50%)" } : { left: `${RX}px`, top: "290px", transform: "translateX(-50%)" });
  ctx.onFrame((t) => {
    const on = t >= w(6, "twenty-six") - 0.3 && t < w(7, "buy") - 0.1;
    roll.style.visibility = on ? "inherit" : "hidden";
    const a = Math.min(1, Math.max(0, (t - (w(6, "twenty-six") - 0.3)) / 0.3));
    const b = Math.min(1, Math.max(0, (t - (w(7, "buy") - 0.45)) / 0.35));
    roll.style.opacity = String(Math.min(a, 1 - b).toFixed(3));
  });
  for (let k = 0; k < 6; k += 1) ctx.sfx("counter_tick", w(6, "twenty-six") + k * 0.17, { offset: -4 - k * 0.5 });
  ctx.sfx("success", w(6, "one") + 0.3, { offset: -1 });
  object3d(ctx, cost, { name: "receipt", size: 220, x: Dk(925, 380), y: Dk(1090, 680), t0: w(6, "total") + 0.1, t1: w(7, "buy") - 0.3, drift: 1, seed: 49 });
  badgeDisc(ctx, cost, { name: "price-tag", x: Dk(125, 640), y: Dk(1240, 840), size: 134, t0: w(6, "rent") + 0.1, t1: w(7, "buy") - 0.3, seed: 50 });
  ctx.hidePill(w(6, "On") - 0.1, cut(8));

  /* 7. WANT TO BUY? A for-sale listing shows the same full cost. */
  whipPan(ctx, w(7, "buy") - 0.15, { dir: "right", dur: 0.24, sound: "whoosh_short" });
  pop(cost, {
    kind: "line", lucide: "home", tab: "For Sale", title: "Same full cost", line: "Every home for sale, the same breakdown.",
    x: Dk(CX, RX), y: Dk(430, 330), t0: w(7, "buy") + 0.2, t1: w(7, "sale") - 0.15, size: 31, from: "above", seed: 55,
  });
  lift(ctx, H, {
    id: "v3-listing-sale", crop: { x: 40, y: 1104, w: 1240, h: 1026 },
    t0: w(7, "sale") - 0.05, t1: cut(8) - 0.45,
    to: Dk({ x: CX, y: 690, s: 0.56, r: -1.4 }, { x: RX, y: 500, s: 0.54, r: -1.4 }), seed: 53, radius: 40,
  });
  object3d(ctx, cost, { name: "villa", size: 220, x: Dk(135, 380), y: Dk(1100, 620), t0: w(7, "buy") + 0.1, t1: cut(8) - 0.35, drift: 1, seed: 56 });

  /* ===================== 8. Save, then compare ============================== */
  /* CUT 4 -> 5. The slab sweeps left into the emerald. */
  slabWipe(ctx, cut(8), { dir: "left", dur: 0.34 });
  ground(ctx, cut(8), cut(10), { tone: "emerald", y: 20, seed: 14 });
  const keep = layer("keep", cut(8), cut(10) + 0.1);
  pop(keep, {
    kind: "line", lucide: "heart", tab: "Your shortlist", title: "Kept on your phone", line: "Opens even without signal.",
    x: Dk(CX, LX), y: Dk(470, 360), t0: s(8) - 0.4, t1: w(8, "compare") - 0.3, size: 30, from: "above", seed: 51,
  });
  lift(ctx, H, {
    id: "v3-saved", crop: { x: 40, y: 1166, w: 884, h: 280 },
    t0: w(8, "compare") - 0.2, t1: cut(9) - 0.3,
    to: Dk({ x: CX, y: 520, s: 0.8, r: -1.5 }, { x: LX, y: 420, s: 0.7, r: -1.5 }), seed: 52, radius: 30,
  });
  H.tap(w(8, "side") - 0.1, 210, 1376);
  object3d(ctx, keep, { name: "saved-heart", size: 230, x: Dk(930, 1600), y: Dk(1050, 620), t0: s(8) + 0.1, t1: cut(9) - 0.2, drift: 1, seed: 53 });
  badgeDisc(ctx, keep, { name: "scale", kind: "glyph", x: Dk(120, 1420), y: Dk(1000, 300), size: 132, t0: w(8, "compare") - 0.05, t1: cut(9) - 0.2, seed: 54 });

  /* 9. SPLIT THE COST. The move-in total, person by person. */
  whipPan(ctx, cut(9) - 0.05, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  H.tap(s(9) + 0.35, 358, 532);
  lift(ctx, H, {
    id: "v3-split", crop: { x: 40, y: 978, w: 1240, h: 276 },
    t0: w(9, "Split") - 0.1, t1: w(9, "person") - 0.45,
    to: Dk({ x: CX, y: 700, s: 0.78, r: 1.2 }, { x: RX, y: 360, s: 0.56, r: 1.2 }), seed: 57, radius: 30,
  });
  lift(ctx, H, {
    id: "v3-split", crop: { x: 40, y: 1278, w: 1240, h: 640 },
    t0: w(9, "person") - 0.25, t1: cut(10) - 0.45,
    to: Dk({ x: CX, y: 650, s: 0.6, r: -1.2 }, { x: RX, y: 560, s: 0.56, r: -1.2 }), seed: 58, radius: 40,
  });
  object3d(ctx, keep, { name: "team", size: 220, x: Dk(930, 380), y: Dk(1050, 600), t0: w(9, "Split") + 0.1, t1: cut(10) - 0.35, drift: 1, seed: 59 });
  ctx.hidePill(cut(9) - 0.1, cut(10));

  /* ===================== 10. The AI assistant =============================== */
  shutter(ctx, cut(10), { bars: 7, dur: 0.28 });
  ground(ctx, cut(10), cut(11), { tone: "electric", y: 24, seed: 15 });
  const ask = layer("ask", cut(10), cut(11) + 0.1);
  pop(ask, {
    kind: "line", lucide: "sparkles", tab: "AI assistant", title: "Always here.", line: "Ask anything.",
    x: Dk(CX, LX), y: Dk(450, 330), t0: s(10) - 0.4, t1: cut(11) - 0.4, size: 32, from: "above", accent: "electric", seed: 61,
  });
  lift(ctx, H, {
    id: "assistant", crop: { x: 42, y: 2421, w: 732, h: 168 },
    t0: w(10, "assistant") - 0.2, t1: cut(11) - 0.66,
    to: Dk({ x: CX, y: 652, s: 1.04, r: 1.2 }, { x: LX, y: 560, s: 0.85, r: 1.2 }), seed: 62, radius: 40,
  });
  H.tap(w(10, "Ask") + 0.05, 400, 2505);
  object3d(ctx, ask, { name: "assistant", size: 240, x: Dk(120, 1620), y: Dk(1520, 700), t0: s(10) + 0.2, t1: cut(11) - 0.35, drift: 1, seed: 63 });
  badgeDisc(ctx, ask, { name: "clock", x: Dk(960, 1440), y: Dk(1010, 330), size: 134, t0: w(10, "any") - 0.1, t1: cut(11) - 0.4, seed: 64 });

  /* ===================== 11. A stay, then a table ============================ */
  tileFall(ctx, cut(11), { cols: 6, rows: 10, dur: 0.28, seed: 9 });
  ground(ctx, cut(11), cut(14), { tone: "dusk", y: 22, seed: 16 });
  const stay = layer("stay", cut(11), cut(14) + 0.1);
  lift(ctx, H, {
    id: "v3-stays", crop: { x: 40, y: 1600, w: 1240, h: 424 },
    t0: w(11, "hotel") - 0.25, t1: w(11, "few") - 0.7,
    to: Dk({ x: CX, y: 545, s: 0.6, r: -1.2 }, { x: RX, y: 400, s: 0.54, r: -1.2 }), seed: 71, radius: 40,
  });
  H.tap(w(11, "hotel") + 0.15, 345, 1815);
  pop(stay, {
    kind: "line", lucide: "bed-double", tab: "Per night", title: "Lagoon Crest Resort", amount: "₦150,000", example: true,
    x: Dk(CX, RX), y: Dk(470, 360), t0: w(11, "few") - 0.3, t1: cut(12) - 0.2, size: 30, from: "above", seed: 72,
  });
  object3d(ctx, stay, { name: "hotel", size: 230, x: Dk(935, 380), y: Dk(1030, 620), t0: w(11, "hotel") - 0.2, t1: cut(12) - 0.3, drift: 1, seed: 73 });
  whipPan(ctx, s(12) - 0.2, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  pop(stay, {
    kind: "line", lucide: "utensils", tab: "Reserve a table", title: "Table for 2", line: "The restaurant confirms.", line2: "Harbour Lights Kitchen", example: true,
    x: Dk(CX, LX), y: Dk(480, 360), t0: s(12) + 0.0, t1: cut(13) - 0.4, size: 31, from: "right", seed: 74, accent: "electric",
  });
  object3d(ctx, stay, { name: "restaurant", size: 230, x: Dk(135, 1600), y: Dk(1040, 620), t0: s(12) + 0.3, t1: cut(13) - 0.35, drift: 1, seed: 75 });
  H.tap(w(12, "table") + 0.1, 385, 2752);

  /* 13. THE DETAIL. See the room, read the menu, check every detail. */
  whipPan(ctx, cut(13) - 0.05, { dir: "right", dur: 0.24, sound: "whoosh_short" });
  pop(stay, {
    kind: "counters", items: [["eye", "See the room"], ["book-open", "Read the menu"], ["check-circle", "Check details"]],
    x: Dk(CX, RX), y: Dk(470, 330), t0: s(13) + 0.1, t1: w(13, "check") - 0.25, size: 30, from: "above", seed: 77, tab: "Before you go",
  });
  lift(ctx, H, {
    id: "v3-stay", crop: { x: 40, y: 1234, w: 1240, h: 730 },
    t0: w(13, "check") - 0.1, t1: cut(14) - 0.66,
    to: Dk({ x: CX, y: 580, s: 0.54, r: -1.2 }, { x: RX, y: 520, s: 0.54, r: -1.2 }), seed: 76, radius: 40,
  });
  object3d(ctx, stay, { name: "hotel", size: 230, x: Dk(935, 380), y: Dk(1530, 640), t0: s(13) + 0.2, t1: cut(14) - 0.35, drift: 1, seed: 78 });
  ctx.hidePill(cut(13) - 0.1, cut(14));

  /* ===================== 14. Vallo Circle ================================== */
  irisTicks(ctx, cut(14), { dur: 0.34 });
  ground(ctx, cut(14), cut(15), { tone: "navy", y: 20, seed: 17 });
  const circle = layer("circle", cut(14), cut(15) + 0.1);
  H.tap(w(14, "Circle") + 0.25, 625, 1720);
  pop(circle, {
    kind: "counters", items: [["users", "Renters"], ["key-round", "Owners"], ["briefcase", "Agents"]],
    x: Dk(CX, LX), y: Dk(470, 330), t0: s(14) + 0.1, t1: w(14, "ask") - 0.4, size: 31, from: "above", seed: 81, tab: "Vallo Circle",
  });
  lift(ctx, H, {
    id: "v3-circle-explore", crop: { x: 40, y: 584, w: 1240, h: 650 },
    t0: w(14, "ask") + 0.1, t1: cut(15) - 0.66,
    to: Dk({ x: CX, y: 580, s: 0.54, r: 1.2 }, { x: LX, y: 540, s: 0.54, r: 1.2 }), seed: 82, radius: 40,
  });
  object3d(ctx, circle, { name: "local-talks", size: 230, x: Dk(930, 1600), y: Dk(1100, 620), t0: s(14) + 0.2, t1: cut(15) - 0.3, drift: 1, seed: 83 });
  ctx.hidePill(w(14, "ask") - 0.2, cut(15));

  /* ===================== 15. Vallo Roommates, and its badges ================ */
  slabWipe(ctx, cut(15), { dir: "down", dur: 0.34 });
  ground(ctx, cut(15), cut(17), { tone: "violet", y: 22, seed: 18 });
  const mates = layer("mates", cut(15), cut(17) + 0.1);
  pop(mates, {
    kind: "counters", items: [["door-open", "A room"], ["users", "A roommate"], ["share-2", "A place to share"]],
    x: Dk(CX, RX), y: Dk(470, 330), t0: s(15) + 0.2, t1: w(15, "near") - 0.3, size: 30, from: "above", seed: 91, tab: "Say what you need",
  });
  lift(ctx, H, {
    id: "v3-schools", crop: { x: 40, y: 640, w: 1240, h: 440 },
    t0: w(15, "near") + 0.05, t1: e(15) + 0.1,
    to: Dk({ x: CX, y: 560, s: 0.62, r: -1.5 }, { x: RX, y: 500, s: 0.54, r: -1.5 }), seed: 92, radius: 40,
  });
  lift(ctx, H, {
    id: "v3-roommates-2", crop: { x: 40, y: 1188, w: 1240, h: 580 },
    t0: w(16, "says") - 0.05, t1: cut(17) - 0.45,
    to: Dk({ x: CX, y: 640, s: 0.66, r: -1.2 }, { x: LX, y: 470, s: 0.54, r: -1.2 }), seed: 93, radius: 40,
  });
  object3d(ctx, mates, { name: "team", size: 230, x: Dk(930, 1660), y: Dk(1070, 800), t0: s(15) + 0.3, t1: cut(17) - 0.3, drift: 1, seed: 94 });
  ctx.hidePill(s(16) - 0.35, cut(17));

  /* ===================== 17. Vallo never holds your money =================== */
  shutter(ctx, cut(17), { bars: 7, dur: 0.28 });
  ground(ctx, cut(17), cut(18), { tone: "electric", y: 28, seed: 19, sparkle: 7 });
  const vow = layer("vow", cut(17), cut(18) + 0.1, 800);
  headline(ctx, vow, {
    lines: [[["Vallo ", false], ["never", true]], [["holds your money.", false]]],
    x: Dk(CX, LX), y: Dk(150, 380), size: Dk(92, 78), t0: w(17, "Vallo") - 0.1, t1: cut(18) - 0.3, align: "center", stagger: 0.04, keyStyle: "chip",
  });
  lift(ctx, H, {
    id: "v3-payments", crop: { x: 40, y: 970, w: 1240, h: 486 },
    t0: w(17, "holds") - 0.1, t1: cut(18) - 0.55,
    to: Dk({ x: CX, y: 640, s: 0.7, r: -1.2 }, { x: RX, y: 470, s: 0.54, r: -1.2 }), seed: 101, radius: 30, label: "The Payments screen, word for word",
  });
  ctx.sfx("lock_click", w(17, "holds"), { offset: -2 });
  ctx.hideCaptions(cut(17), cut(18) - 0.1);
  ctx.hidePill(cut(17), cut(18));

  /* ===================== 18. One app, one account =========================== */
  whipPan(ctx, cut(18), { dir: "right", dur: 0.26, sound: "whoosh_short" });
  ground(ctx, cut(18), s(20) + 0.3, { tone: "navy", y: 24, seed: 20 });
  const one = layer("one", cut(18), s(20) + 0.1, 800);
  [
    ["keys", "homes", Dk(120, 640), Dk(820, 210), 15, 111],
    ["hotel", "stays", Dk(960, 1280), Dk(960, 210), 14, 112],
    ["restaurant", "tables", Dk(120, 640), Dk(1230, 870), 16, 113],
    ["team", "people", Dk(960, 1280), Dk(1240, 870), 15, 114],
  ].forEach(([name, word, x, y, rot, seed]) => {
    badgeDisc(ctx, one, { name, x, y, size: 150, t0: w(18, word) - 0.05, t1: s(19) - 0.3, rot: rot * 0.2, seed });
  });
  headline(ctx, one, {
    lines: [[["One app. ", false]], [["One ", false], ["account.", true]]],
    x: Dk(CX, LX - 60), y: Dk(150, 450), size: Dk(108, 88), t0: w(18, "in") - 0.05, t1: s(19) - 0.35, align: "center", stagger: 0.05, keyStyle: "chip",
  });
  ctx.hideCaptions(w(18, "in") - 0.1, s(19) - 0.2);
  /* the last ask, big, over the same stage */
  headline(ctx, one, {
    lines: [[["Download ", false], ["Vallo", true]], [["today.", false]]],
    x: Dk(CX, RX + 40), y: Dk(150, 400), size: Dk(116, 92), t0: s(19) - 0.05, t1: s(20) - 0.15, align: "center", stagger: 0.05, keyStyle: "chip",
  });
  ctx.hideCaptions(s(19) - 0.1, s(20) + 0.1);
  ctx.hidePill(cut(17), s(20));

  /* ===================== 20. The end card =================================== */
  ending(ctx, { t0: s(20) + 0.08, tLine: w(20, "Real") - 0.05, tBadges: s(20) + 1.05, tUrl: s(20) + 1.65, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: 0.5 });
}

void 0;
