/**
 * VIDEO TWO, "Vision and what's coming" (films/vision2, rebuilt 11 November
 * 2026 on the upgraded platform, re-cut 12 November on the recorded voice and
 * the fresh captures). About 108 seconds, one cut, in both formats: vertical
 * (1080x1920) and landscape (1920x1080).
 *
 * One phone carries the film through what Vallo is now: the full cost of a
 * home, saving and splitting it, stays and tables, then the part that is more
 * than listings (Vallo Circle, Roommates), what was actually confirmed
 * (badges, the passport), the workspace for owners, hosts and agents, the AI
 * assistant, and the direction. It ends on the store card, live on both
 * stores.
 *
 * Nothing here refers to a number of seconds: every beat hangs on s(i), e(i)
 * and w(i, "word") from the film's own clock. Claims: video/FACTS.md,
 * FACTS-OCT.md and HANDOFF.md (docs/marketing/voiceover/VIDEO-2-ELEVENLABS.md
 * gives the source of each line). Copy rules: marketing/DESIGN.md section 2.
 * The account's own name and passport number are redrawn out of the screens
 * that print them (how2/parts.js PATCH), and no lift is ever cut from a part
 * of a screen that carries them.
 *
 * Every crop below sits on the component's own edges in the 12 November
 * captures (measured, not eyeballed), and every lift starts after its screen
 * has landed, so the glow that marks where it came from is on the right row.
 */
import {
  anchors, ground, hero, lift, headline, ending, popOut,
  badgeDisc, object3d, installFocus, leak, flash, slabWipe, shutter, irisTicks,
  tileFall, whipPan, windowRig,
} from "../kit.js";
import { openerWords, totalPlate, gatherDiscs, chipLine } from "./parts.js";
import { shower } from "../how2/parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });
  const show = shower(H);
  const CX = ctx.W / 2;
  /* the landscape cut: the phone in the middle under the pill, every card in
     the left (x ~60..760) or right column (x ~1160..1860) */
  const Dk = (m, d) => (M ? m : d);
  const LX = 410, RX = 1510;
  const TOP = 470;     // mobile: the band under the chapter pill, where a container sits
  const BAND = 1440;   // mobile: the label band under the phone's content
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });
  const T = ctx.T;
  const pop = (parent, o) => popOut(ctx, parent, M ? o : { ...o, size: (o.size ?? 32) * (o.kind === "counters" ? 0.84 : 1.16), x: o.kind === "counters" ? o.x + (o.x > 960 ? 20 : -20) : o.x });
  const chips = (parent, o) => chipLine(ctx, parent, M ? o : { ...o, size: Math.round((o.size ?? 32) * 0.9), wrapW: o.wrapW ?? 640 });

  /* ---------- poses ---------- */
  const HOME = Dk({ cx: CX, cy: 1075, height: 1380 }, { cx: 960, cy: 540, height: 858 });
  const LOW = Dk({ cx: CX, cy: 1255, height: 1180 }, { cx: 960, cy: 545, height: 840 });
  const BACK = Dk({ cx: CX, cy: 1300, height: 1150 }, { cx: 960, cy: 552, height: 820 });
  const PEEK = Dk({ cx: CX, cy: 1990, height: 1380 }, { cx: 1290, cy: 1120, height: 900 });   // the top of the phone, rising out of the frame's foot
  const off = (p, dy = Dk(1750, 1150)) => ({ ...p, cy: p.cy + dy });
  /* the dock's centre icon, Vallo Circle, in display px */
  const DOCK = { x: 545, y: 2722 };
  const PUSH = Dk(H.aim(DOCK.x, DOCK.y, 1500, CX, 1480), H.aim(DOCK.x, DOCK.y, 880, 960, 900));

  /* ---------- the crops, in the displays' own pixels (1320 x 2868) ---------- */
  const CELLS = { x: 40, y: 808, w: 1240, h: 206 };             // v3-listing-cost: RENT, FEES, REFUNDABLE
  const SHORTLIST = { x: 48, y: 872, w: 700, h: 316 };          // v3-home: "On your shortlist ... Compare two side by side"
  const STAYS_TOP = { x: 40, y: 1600, w: 1240, h: 424 };        // v3-stays: Hotels and Shortlets
  const REST_ROW = { x: 140, y: 1446, w: 1040, h: 188 };        // v3-restaurant: seafood, smart casual, seats 80
  const EXPLORE = { x: 40, y: 484, w: 1240, h: 750 };           // v3-circle-explore: "Explore Circle" and its eight tiles
  const ASK_TILE = { x: 352, y: 584, w: 300, h: 290 };
  const AREAS_TILE = { x: 694, y: 584, w: 244, h: 284 };
  const SAY_BLOCK = { x: 40, y: 1188, w: 1240, h: 584 };        // v3-roommates and -2: the numeral, heading and paragraph
  const TABS = { x: 236, y: 486, w: 1044, h: 140 };             // v3-schools: Groups, Schools, Corps members
  const CARD_01 = { x: 40, y: 992, w: 1240, h: 318 };           // v3-safety: "View the home in person..."
  const CARD_04 = { x: 40, y: 2020, w: 1240, h: 318 };          // v3-safety: "Never send money to an account you cannot verify."
  const PASS_HEAD = { x: 40, y: 470, w: 1240, h: 492 };         // v3-passport: the heading and what it says (no name in it)
  const ROW_HOTEL = { x: 40, y: 1096, w: 1240, h: 318 };        // host-start: "We are a hotel"
  const ROW_OWN = { x: 40, y: 2278, w: 1240, h: 318 };          // host-start: "I own the property. List it yourself. No agency fee."
  const BUBBLE = { x: 664, y: 594, w: 616, h: 130 };            // assistant-caution-2: the member's question
  const ANSWER = { x: 40, y: 776, w: 1240, h: 806 };            // assistant-caution-2: Vallo AI's answer
  const SPLIT_TILES = { x: 40, y: 978, w: 1240, h: 276 };       // v3-split: to move in, every month, per person
  const SPLIT_LIST = { x: 40, y: 1278, w: 1240, h: 640 };       // v3-split: person 1, 2, 3
  const STAY_INFO = { x: 40, y: 1234, w: 1240, h: 730 };        // v3-stay: the summary card under the photo
  const HOST_TILES = { x: 100, y: 1736, w: 1120, h: 800 };      // f-host-home: arriving, staying, requests, messages

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
    /* it settles back only once the explore page has slid fully in: a slide
       under a 3D re-mapping paints differently depending on the frames before */
    [s(11) + 0.45, { ...PUSH }],
    [s(11) + 1.1, { ...LOW }, "glide"],
    [s(14) - 0.1, { ...LOW }],
    [s(14) + 0.5, { ...LOW }, "glide"],
    [s(16) - 0.2, { ...LOW }],
    [s(16) + 0.4, { ...HOME }, "glide"],
    [s(18) - 0.2, { ...HOME }],
    [s(18) + 0.45, { ...BACK }, "glide"],
    [s(21) - 0.2, { ...BACK }],
    [s(21) + 0.4, { ...LOW }, "glide"],
    [s(22) - 0.35, { ...LOW }],
    [s(22) + 0.1, { ...off(HOME), rz: -8, ry: 20 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ]);
  H.swing(s(7) + 0.05, s(13) + 0.05, s(16) + 0.05, s(18) + 0.05, s(21) + 0.05);

  /* ===================== 1. The opening frame (0 - s3) =====================
     The voice's first line sets the key word in its box; the second line
     replaces the words and the phone rises. */
  ground(ctx, 0, s(3) - 0.05, { tone: "navy", y: 26, seed: 11 });
  const open = layer("open", 0, s(3) - 0.2);
  /* the first line has fully lifted away before the second one types in */
  const openOut = Math.min(s(2) - 0.3, e(1) - 0.25);
  openerWords(ctx, open, { x: Dk(70, 110), y: Dk(470, 300), size: Dk(114, 104), tKey: w(1, "moving") - 0.05, t1: openOut });
  ctx.hideCaptions(0, s(2) - 0.15);
  headline(ctx, open, {
    lines: [[["Vallo is where", false]], [["it is going.", true]]],
    x: Dk(70, 90), y: Dk(280, 300), size: Dk(104, 80), t0: Math.max(s(2) - 0.08, openOut + 0.62), t1: s(3) - 0.45, stagger: 0.05,
  });
  ctx.hideCaptions(s(2) - 0.15, s(3) - 0.5);
  show("v3-welcome", 0, s(3) + 0.2, { enter: "cut" });
  badgeDisc(ctx, open, { name: "villa", kind: "object", x: Dk(905, 1720), y: Dk(330, 240), size: 150, t0: s(1) + 0.35, t1: s(2) - 0.3, seed: 12 });
  badgeDisc(ctx, open, { name: "keys", kind: "object", x: Dk(160, 260), y: Dk(1450, 820), size: 130, t0: s(2) + 0.2, t1: s(3) - 0.5, seed: 13, tone: "paper" });
  badgeDisc(ctx, open, { name: "city", kind: "object", x: Dk(930, 1720), y: Dk(1390, 420), size: 140, t0: s(2) + 0.45, t1: s(3) - 0.5, seed: 14 });

  /* ===================== 2. The full cost (s3 - s5) =====================
     CUT 1 -> 2. A navy slab travels up the frame as the phone rises into
     its next pose with the listing on the glass. */
  slabWipe(ctx, s(3) - 0.05, { dir: "up", dur: 0.42 });
  ground(ctx, s(3) - 0.05, s(7) - 0.05, { tone: "electric", y: 22, seed: 12 });
  const cost = layer("cost", s(3) - 0.1, s(7) - 0.1);
  show("v3-listing", s(3) - 0.2, w(3, "before") - 0.1, { enter: "slide" });
  /* the listing's own Costs tab is pressed as the voice reaches the cost */
  H.tap(w(3, "cost") - 0.2, 150, 2752);
  pop(cost, {
    kind: "line", lucide: "receipt-text", tab: "Before you call", title: "The full cost, up front", line: "Nothing left for later.",
    x: Dk(CX, RX), y: Dk(TOP, 330), t0: w(3, "full") - 0.15, t1: s(4) - 0.2, size: 31, from: "above", seed: 21,
  });
  show("v3-listing-cost", w(3, "before") - 0.1, w(4, "all") - 0.1, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-listing-cost", crop: CELLS, t0: w(4, "rent") - 0.02, t1: w(4, "caution") - 0.1,
    to: Dk({ x: CX, y: 620, s: 0.72, r: -1.4 }, { x: RX, y: 420, s: 0.54, r: -1.4 }), exit: "up", fly: 0.55, seed: 22, radius: 34,
  });
  show("v3-listing-total", w(4, "all") - 0.1, s(5) - 0.22, { enter: "slide" });
  totalPlate(ctx, cost, {
    x: Dk(CX, RX), y: Dk(640, 560), t0: w(4, "all") - 0.1, t1: s(5) - 0.32, tRoll0: w(4, "added") + 0.05, tRoll1: w(4, "added") + 0.72, size: Dk(40, 36),
  });
  badgeDisc(ctx, cost, { name: "receipt", kind: "object", x: Dk(150, 380), y: Dk(1450, 420), size: 130, t0: w(4, "refundable"), t1: s(5) - 0.3, seed: 23 });
  badgeDisc(ctx, cost, { name: "coin", kind: "object", x: Dk(940, 520), y: Dk(1380, 760), size: 120, t0: w(4, "caution"), t1: s(5) - 0.3, seed: 24, tone: "paper" });

  /* SAVE AND COMPARE. A light whip, then the home's own shortlist line held up. */
  /* the cut waits for the total to fly off the glass */
  whipPan(ctx, s(5) - 0.22, { dir: "left", dur: 0.24, sound: null });
  ctx.sfx("swipe", s(5) - 0.27, { offset: -3 });
  show("v3-home", s(5) - 0.22, s(6) - 0.1, { enter: "cut" });
  lift(ctx, H, {
    id: "v3-home", crop: SHORTLIST, t0: w(5, "homes") + 0.1, t1: s(6) - 0.6,
    to: Dk({ x: CX, y: 760, s: 0.9, r: 1.2 }, { x: LX, y: 420, s: 0.86, r: 1.2 }), exit: "fade", fly: 0.6, seed: 25, radius: 40,
  });
  pop(cost, {
    kind: "line", lucide: "scale", tab: "Your shortlist", title: "Two homes, side by side", line: "Compare before you decide.",
    x: Dk(CX, LX), y: Dk(TOP, 720), t0: w(5, "compare") - 0.1, t1: s(6) - 0.2, size: 31, from: "above", seed: 26,
  });
  H.tap(w(5, "side") + 0.1, 330, 1155);
  object3d(ctx, cost, { name: "saved-heart", size: 200, x: Dk(930, 1640), y: Dk(1300, 840), t0: w(5, "save") + 0.1, t1: s(6) - 0.25, drift: 1, seed: 59 });

  /* SPLIT THE TOTAL, line by line: three people chosen, the per-person
     figures held up, then the list of each person. */
  whipPan(ctx, s(6) - 0.15, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  show("v3-split", s(6) - 0.1, s(7) - 0.2, { enter: "cut" });
  H.tap(s(6) + 0.45, 358, 532);
  lift(ctx, H, {
    id: "v3-split", crop: SPLIT_TILES, t0: w(6, "Split") + 0.05, t1: w(6, "line") - 0.3,
    to: Dk({ x: CX, y: 620, s: 0.78, r: 1.2 }, { x: RX, y: 380, s: 0.56, r: 1.2 }), exit: "fade", fly: 0.55, seed: 60, radius: 30,
  });
  lift(ctx, H, {
    id: "v3-split", crop: SPLIT_LIST, t0: w(6, "line") - 0.15, t1: s(7) - 0.4,
    to: Dk({ x: CX, y: 640, s: 0.6, r: -1.2 }, { x: RX, y: 580, s: 0.54, r: -1.2 }), exit: "fade", fly: 0.55, seed: 61, radius: 40,
  });
  object3d(ctx, cost, { name: "team", size: 200, x: Dk(930, 380), y: Dk(1250, 640), t0: w(6, "Split") + 0.1, t1: s(7) - 0.35, drift: 1, seed: 62 });

  /* ===================== 3. Stays and tables (s7) =====================
     CUT 2 -> 3. Four tick brackets close on the centre and bloom. */
  irisTicks(ctx, s(7) - 0.05, { dur: 0.44 });
  ground(ctx, s(7) - 0.05, s(9) - 0.05, { tone: "dusk", y: 70, seed: 13 });
  const stays = layer("stays", s(7) - 0.1, s(9) - 0.1);
  show("v3-stays", s(7) - 0.2, w(7, "going", 2) - 0.1, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-stays", crop: STAYS_TOP, t0: w(7, "hotel") - 0.02, t1: w(7, "going", 2) - 0.25,
    to: Dk({ x: CX, y: 690, s: 0.66, r: -1.2 }, { x: RX, y: 420, s: 0.54, r: -1.2 }), exit: "fade", fly: 0.55, seed: 27, radius: 36,
  });
  show("v3-restaurant", w(7, "going", 2) - 0.1, w(8, "See") - 0.2, { enter: "slide" });
  show("v3-stay", w(8, "See") - 0.2, s(9) - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-restaurant", crop: REST_ROW, t0: w(7, "table") + 0.0, t1: w(8, "See") - 0.55,
    to: Dk({ x: CX, y: 640, s: 0.78, r: 1.1 }, { x: LX, y: 420, s: 0.6, r: 1.1 }), exit: "fade", fly: 0.55, seed: 28, radius: 36,
  });
  H.tap(w(7, "table") + 0.45, 385, 2752);
  chips(stays, {
    items: [["Hotels", "hotel"], ["Shortlets", "key-round"], ["Tables", "utensils"]],
    x: Dk(CX, RX), y: Dk(425, 780), t0: w(7, "hotel") + 0.05, gap: Math.max(0.35, (w(7, "table") - w(7, "hotel")) / 3.2),
    t1: w(8, "See") - 0.3, size: 32, wrapW: Dk(1000, 640), anchor: "center",
  });
  object3d(ctx, stays, { name: "hotel", size: 190, x: Dk(130, 380), y: Dk(1170, 760), t0: w(7, "hotel") + 0.1, t1: w(7, "going", 2) - 0.2, drift: 1, seed: 29 });
  object3d(ctx, stays, { name: "restaurant", size: 190, x: Dk(940, 1660), y: Dk(1190, 420), t0: w(7, "table") + 0.1, t1: w(8, "See") - 0.3, drift: 1, seed: 30 });

  /* SEE THE ROOM, READ THE MENU. Every detail before you book. */
  whipPan(ctx, w(8, "See") - 0.15, { dir: "right", dur: 0.24, sound: "whoosh_short" });
  pop(stays, {
    kind: "counters", items: [["eye", "See the room"], ["book-open", "Read the menu"], ["check-circle", "Check details"]],
    x: Dk(CX, RX), y: Dk(TOP, 330), t0: w(8, "See") + 0.1, t1: w(8, "check") - 0.2, size: 30, from: "above", seed: 63, tab: "Before you book",
  });
  lift(ctx, H, {
    id: "v3-stay", crop: STAY_INFO, t0: w(8, "check") - 0.1, t1: s(9) - 0.55,
    to: Dk({ x: CX, y: 620, s: 0.54, r: -1.2 }, { x: RX, y: 540, s: 0.54, r: -1.2 }), exit: "fade", fly: 0.55, seed: 64, radius: 40,
  });
  object3d(ctx, stays, { name: "hotel", size: 200, x: Dk(935, 380), y: Dk(1300, 640), t0: w(8, "See") + 0.2, t1: s(9) - 0.3, drift: 1, seed: 65 });
  ctx.hidePill(w(8, "See") - 0.2, s(9));

  /* ===================== 4. More than listings (s9) =====================
     CUT 3 -> 4. The frame breaks into tiles and drops away. The phone is
     gone; the words carry the beat. */
  ctx.sfx("riser", s(9) - 0.95, { offset: -4 });
  tileFall(ctx, s(9) - 0.05, { cols: Dk(6, 10), rows: Dk(10, 6), dur: 0.46, seed: 9 });
  ground(ctx, s(9) - 0.05, s(13) - 0.05, { tone: "violet", y: 24, seed: 14 });
  const more = layer("more", s(9) - 0.1, s(10) - 0.05);
  headline(ctx, more, {
    lines: [[["More than", false]], [["listings.", true]]],
    x: CX, y: Dk(520, 250), size: Dk(146, 136), t0: s(9) + 0.04, t1: s(10) - 0.32, align: "center", keyStyle: "chip", stagger: 0.07,
  });
  ctx.hideCaptions(s(9) - 0.1, s(10) - 0.3);
  chipLine(ctx, more, {
    items: [["Community", "users"], ["Roommates", "house"], ["Workspaces", "briefcase"]],
    x: CX, y: Dk(1010, 640), t0: s(9) + 0.7, gap: 0.3, t1: s(10) - 0.4, size: 36, wrapW: Dk(1000, 1400), anchor: "center",
  });
  object3d(ctx, more, { name: "city", size: 240, x: Dk(830, 1560), y: Dk(1420, 830), t0: s(9) + 0.35, t1: s(10) - 0.35, drift: 1, seed: 31 });
  object3d(ctx, more, { name: "local-talks", size: 200, x: Dk(220, 380), y: Dk(1380, 830), t0: s(9) + 0.55, t1: s(10) - 0.35, drift: 1, seed: 32 });

  /* ===================== 5. Vallo Circle (s10 - s12) =====================
     A bloom, not a cut: the phone is back, pushed onto the dock, and the
     dock's centre icon is Circle. */
  flash(ctx, s(10) - 0.08, { sound: "whoosh_short" });
  leak(ctx, s(10) - 0.02, { warm: false, dur: 0.9 });
  const circle = layer("circle", s(10) - 0.2, s(13) - 0.1);
  show("v3-circle", s(10) - 0.5, s(11) - 0.05, { enter: "cut" });
  ctx.hidePill(s(10) - 0.1, s(11) + 0.7);
  H.ring(s(10) + 0.55, s(11) - 0.25, { x: 455, y: 2632, w: 180, h: 180, r: 90 });
  pop(circle, {
    kind: "line", lucide: "users", tab: "Community", title: "Ask, share, learn", line: "About homes and areas.",
    x: Dk(CX, LX), y: Dk(1745, 330), t0: w(10, "circle") - 0.1, t1: s(11) - 0.1, size: 31, from: Dk("below", "above"), seed: 33,
  });
  /* who is in it, one chip on each word */
  show("v3-circle-explore", s(11) - 0.1, s(13) - 0.2, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-circle-explore", crop: EXPLORE, t0: w(11, "sharing") - 0.1, t1: s(12) - 0.55,
    to: Dk({ x: CX, y: 860, s: 0.66, r: -1.2 }, { x: LX, y: 470, s: 0.52, r: -1.2 }), exit: "fade", fly: 0.6, seed: 34, radius: 36,
  });
  chips(circle, {
    items: [["Renters", "key-round"], ["Owners", "house"], ["Agents", "user-round"], ["Professionals", "briefcase"]],
    x: Dk(CX, RX), y: Dk(425, 420), t0: w(11, "renters"), gap: Math.max(0.3, (w(11, "professionals") - w(11, "renters")) / 3.1),
    t1: s(12) - 0.2, size: 31, wrapW: Dk(1000, 600), anchor: "center",
  });
  /* ask: the two tiles that matter, held up and left side by side */
  lift(ctx, H, {
    id: "v3-circle-explore", crop: ASK_TILE, t0: s(12) + 0.3, t1: s(13) - 0.35,
    to: Dk({ x: 330, y: 720, s: 1.45, r: -2 }, { x: 400, y: 470, s: 1.2, r: -2 }), exit: "fade", fly: 0.55, seed: 35, radius: 34,
  });
  lift(ctx, H, {
    id: "v3-circle-explore", crop: AREAS_TILE, t0: w(12, "neighbourhood") - 0.15, t1: s(13) - 0.3,
    to: Dk({ x: 760, y: 790, s: 1.45, r: 2 }, { x: 1520, y: 470, s: 1.2, r: 2 }), exit: "fade", fly: 0.55, seed: 36, radius: 34,
  });
  badgeDisc(ctx, circle, { name: "local-talks", kind: "object", x: Dk(925, 1560), y: Dk(1250, 820), size: 130, t0: w(12, "move"), t1: s(13) - 0.3, seed: 37 });

  /* ===================== 6. Roommates (s13 - s15) =====================
     CUT 4 -> 5. Seven bars close from alternate sides. */
  shutter(ctx, s(13) - 0.05, { bars: 7, dur: 0.38 });
  ground(ctx, s(13) - 0.05, s(16) - 0.05, { tone: "emerald", y: 20, seed: 15 });
  const room = layer("roommates", s(13) - 0.1, s(16) - 0.1);
  show("v3-roommates", s(13) - 0.12, s(14) - 0.1, { enter: "cut" });
  lift(ctx, H, {
    id: "v3-roommates", crop: SAY_BLOCK, t0: w(13, "share") - 0.1, t1: s(14) + 0.2,
    to: Dk({ x: CX, y: 860, s: 0.66, r: -1.4 }, { x: RX, y: 470, s: 0.5, r: -1.4 }), exit: "fade", fly: 0.55, seed: 38, radius: 30,
  });
  pop(room, {
    kind: "line", lucide: "users", tab: "Vallo Roommates", title: "A roommate, or a room", line: "Find one. Or offer yours.",
    x: Dk(CX, RX), y: Dk(TOP, 330), t0: w(14, "roommates") - 0.05, t1: s(15) - 0.1, size: 31, from: "above", seed: 39,
  });
  badgeDisc(ctx, room, { name: "team", kind: "object", x: Dk(930, 400), y: Dk(1250, 700), size: 135, t0: w(14, "roommate") + 0.1, t1: s(15) - 0.15, seed: 40 });
  show("v3-schools", s(14) - 0.1, w(15, "read") - 0.3, { enter: "slide" });
  H.tap(w(14, "room") + 0.1, 520, 765);
  lift(ctx, H, {
    id: "v3-schools", crop: TABS, t0: w(15, "school") - 0.05, t1: w(15, "read") - 0.35,
    to: Dk({ x: CX, y: 620, s: 0.84, r: 1 }, { x: LX, y: 420, s: 0.6, r: 1 }), exit: "up", fly: 0.55, seed: 41, radius: 34,
  });
  show("v3-safety", w(15, "read") - 0.3, s(16) - 0.15, { enter: "slide" });
  lift(ctx, H, {
    id: "v3-safety", crop: CARD_01, t0: w(15, "safety") + 0.15, t1: s(16) - 0.45,
    to: Dk({ x: CX, y: 640, s: 0.7, r: -1.2 }, { x: RX, y: 360, s: 0.54, r: -1.2 }), exit: "fade", fly: 0.55, seed: 42, radius: 34,
  });
  lift(ctx, H, {
    id: "v3-safety", crop: CARD_04, t0: w(15, "first") - 0.1, t1: s(16) - 0.4,
    to: Dk({ x: CX, y: 910, s: 0.7, r: 1.2 }, { x: RX, y: 640, s: 0.54, r: 1.2 }), exit: "fade", fly: 0.55, seed: 43, radius: 34,
  });

  /* ===================== 7. What was confirmed (s16 - s17) =====================
     CUT 5 -> 6. The slab sweeps left. */
  slabWipe(ctx, s(16) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(16) - 0.05, s(18) - 0.05, { tone: "navy", y: 30, seed: 16 });
  const trust = layer("trust", s(16) - 0.1, s(18) - 0.1);
  show("v3-roommates-2", s(16) - 0.1, s(17) - 0.15, { enter: "cut" });
  lift(ctx, H, {
    id: "v3-roommates-2", crop: SAY_BLOCK, t0: w(16, "says") - 0.02, t1: s(17) - 0.75,
    to: Dk({ x: CX, y: 820, s: 0.66, r: -1.2 }, { x: LX, y: 420, s: 0.5, r: -1.2 }), exit: "fade", fly: 0.55, seed: 44, radius: 30,
  });
  pop(trust, {
    kind: "counters", tab: "What a badge can say", items: [["graduation-cap", "School email"], ["id-card", "ID"], ["phone", "Phone number"]],
    x: Dk(CX, LX), y: Dk(TOP, 760), t0: w(16, "confirmed") - 0.1, t1: s(17) - 0.5, size: 28, from: Dk("above", "below"), seed: 45,
  });
  show("v3-passport", s(17) - 0.15, s(18) - 0.15, { enter: "cut" });
  ctx.sfx("swipe", s(17) - 0.15, { offset: -4 });
  lift(ctx, H, {
    id: "v3-passport", crop: PASS_HEAD, t0: w(17, "passport") + 0.15, t1: s(18) - 0.75,
    to: Dk({ x: CX, y: 860, s: 0.66, r: 1.2 }, { x: RX, y: 420, s: 0.5, r: 1.2 }), exit: "fade", fly: 0.55, seed: 46, radius: 34,
  });
  pop(trust, {
    kind: "line", lucide: "toggle-right", tab: "Your Vallo passport", title: "You decide", line: "Switch a line off, any time.",
    x: Dk(CX, RX), y: Dk(TOP, 760), t0: w(17, "switch") - 0.1, t1: s(18) - 0.5, size: 30, from: Dk("above", "below"), seed: 47,
  });

  /* ===================== 8. The workspace (s18 - s20) =====================
     CUT 6 -> 7. The tick brackets close once more, into the gold. */
  irisTicks(ctx, s(18) - 0.05, { dur: 0.44 });
  ground(ctx, s(18) - 0.05, s(21) - 0.05, { tone: "gold", y: 28, seed: 17 });
  const work = layer("workspace", s(18) - 0.1, s(21) - 0.1);
  show("host-start", s(18) - 0.1, w(20, "Track") + 0.5, { enter: "cut" });
  show("f-host-home", w(20, "Track") + 0.5, s(21) - 0.15, { enter: "slide" });
  lift(ctx, H, {
    id: "host-start", crop: ROW_HOTEL, t0: w(18, "host") - 0.05, t1: w(18, "becomes") - 0.2,
    to: Dk({ x: CX, y: 600, s: 0.66, r: -1.6 }, { x: LX, y: 400, s: 0.54, r: -1.6 }), exit: "fade", fly: 0.5, seed: 48, radius: 34,
  });
  pop(work, {
    kind: "counters", tab: "In your workspace", items: [["calendar-days", "Calendar"], ["bed-double", "Bookings"], ["utensils", "Reservations"]],
    x: Dk(CX, LX), y: Dk(TOP, 700), t0: w(18, "workspace") - 0.1, t1: s(19) + 0.3, size: 28, from: "above", seed: 50,
  });
  /* "I own the property" is pressed, and the row that says it is held up */
  H.tap(w(19, "List") - 0.05, 1190, 2355);
  lift(ctx, H, {
    id: "host-start", crop: ROW_OWN, t0: w(19, "place") + 0.1, t1: w(20, "Track") - 0.3,
    to: Dk({ x: CX, y: 735, s: 0.66, r: -1.2 }, { x: RX, y: 420, s: 0.54, r: -1.2 }), exit: "fade", fly: 0.55, seed: 51, radius: 34,
  });
  pop(work, {
    kind: "line", lucide: "badge-check", tab: "Owners", title: "No agency fee", line: "List it yourself.",
    x: Dk(CX, RX), y: Dk(TOP, 720), t0: w(19, "agency") - 0.1, t1: w(20, "Track") - 0.25, size: 34, from: "above", seed: 52,
  });
  object3d(ctx, work, { name: "keys", size: 190, x: Dk(135, 300), y: Dk(1230, 420), t0: w(19, "list") - 0.1, t1: w(20, "Track") - 0.3, drift: 1, seed: 53 });

  /* TRACK YOUR BOOKINGS. Read reviews, manage listings from anywhere. */
  whipPan(ctx, w(20, "Track") - 0.15, { dir: "left", dur: 0.24, sound: "whoosh_short" });
  H.tap(w(20, "Track") + 0.25, 1045, 2765);
  pop(work, {
    kind: "counters", items: [["calendar-days", "Bookings"], ["star", "Reviews"], ["list", "Listings"]],
    x: Dk(CX, LX), y: Dk(TOP, 300), t0: w(20, "Track") + 0.1, t1: s(21) - 0.4, size: 30, from: "above", seed: 66, tab: "Manage from anywhere",
  });
  /* the workspace's own day: what is arriving, staying, waiting, unread */
  lift(ctx, H, {
    id: "f-host-home", crop: HOST_TILES, t0: w(20, "reviews") - 0.05, t1: s(21) - 0.45,
    to: Dk({ x: CX, y: 840, s: 0.7, r: 1.2 }, { x: LX, y: 660, s: 0.52, r: 1.2 }), exit: "fade", fly: 0.55, seed: 69, radius: 40,
  });
  /* from anywhere: in the landscape cut the same workspace opens in a
     browser beside the phone (the desktop page, captured live) */
  if (!M) {
    const Wd = windowRig(ctx);
    Wd.path([
      [w(20, "Track") + 0.3, { x: 1960, y: 250, s: 0.46, opacity: 1 }],
      [w(20, "bookings") + 0.7, { x: 1190, y: 250, s: 0.46, opacity: 1 }, "power3.out"],
      [s(21) - 0.45, { x: 1190, y: 250, s: 0.46, opacity: 1 }],
      [s(21) - 0.1, { x: 1960, y: 250, s: 0.46, opacity: 1 }, "power3.in"],
      [s(21) - 0.05, { x: 1960, y: 250, s: 0.46, opacity: 0 }, "none"],
      [ctx.duration, { x: 1960, y: 250, s: 0.46, opacity: 0 }, "none"],
    ]);
    Wd.show("d-host-bookings", w(20, "Track") + 0.3, s(21) - 0.05, { enter: "cut" });
  }
  object3d(ctx, work, { name: "toolbox", size: 200, x: Dk(130, 1640), y: Dk(1250, 860), t0: w(20, "bookings") + 0.1, t1: s(21) - 0.35, drift: 1, seed: 67 });

  /* ===================== 9. The assistant, in four languages (s21) =====================
     A light whip, no loud cut: this is still the same hand holding the phone.
     The member's question is held up, then the assistant's own answer. */
  whipPan(ctx, s(21) - 0.04, { dir: "right", dur: 0.24, sound: null });
  ground(ctx, s(21) - 0.05, s(22) - 0.05, { tone: "electric", y: 30, seed: 18 });
  const ask = layer("assistant", s(21) - 0.1, s(22) - 0.1);
  show("assistant-caution-2", s(21) - 0.1, s(22) - 0.1, { enter: "cut" });
  lift(ctx, H, {
    id: "assistant-caution-2", crop: BUBBLE, t0: w(21, "assistant") + 0.1, t1: w(21, "renting") - 0.3,
    to: Dk({ x: 640, y: 560, s: 0.95, r: 1.4 }, { x: LX, y: 330, s: 0.9, r: 1.4 }), exit: "fade", fly: 0.55, seed: 54, radius: 40,
  });
  lift(ctx, H, {
    id: "assistant-caution-2", crop: ANSWER, t0: w(21, "renting") - 0.1, t1: s(22) - 0.45,
    to: Dk({ x: CX, y: 850, s: 0.62, r: -1 }, { x: LX, y: 560, s: 0.5, r: -1 }), exit: "fade", fly: 0.6, seed: 68, radius: 40,
  });
  chips(ask, {
    items: [["English", "languages"], ["Hausa", "languages"], ["Yorùbá", "languages"], ["Igbo", "languages"]],
    x: Dk(CX, RX), y: Dk(425, 480), t0: w(21, "english") - 0.05, gap: Math.max(0.28, (w(21, "igbo") - w(21, "english")) / 3.1),
    t1: s(22) - 0.35, size: 32, wrapW: Dk(1000, 560), anchor: "center",
  });
  badgeDisc(ctx, ask, { name: "assistant", kind: "object", x: Dk(965, 1640), y: Dk(1250, 800), size: 140, t0: w(21, "ask"), t1: s(22) - 0.4, seed: 55 });

  /* ===================== 10. The start (s22 - s24) =====================
     CUT 7 -> 8. The bars close, the phone leaves, and the words stand alone. */
  shutter(ctx, s(22) - 0.05, { bars: 7, dur: 0.36 });
  ground(ctx, s(22) - 0.05, T.music.logo_hit + 0.6, { tone: "dusk", y: 40, seed: 19 });
  const vision = layer("vision", s(22) - 0.1, T.music.logo_hit + 0.4);
  headline(ctx, vision, {
    lines: [[["This is only", false]], [["the start.", true]]],
    x: CX, y: Dk(560, 330), size: Dk(130, 124), t0: s(22) + 0.05, t1: s(23) - 0.4, align: "center", stagger: 0.07,
  });
  ctx.hideCaptions(s(22) - 0.1, s(23) - 0.3);
  /* the sentence is built word by word, each on the word that says it */
  const lineSize = Dk(118, 100);
  const vx = Dk(90, 180);
  headline(ctx, vision, { lines: [[["How Nigeria", false]]], x: vx, y: Dk(500, 200), size: Dk(84, 72), t0: s(23) + 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["finds,", true]]], x: vx, y: Dk(640, 320), size: lineSize, t0: w(23, "finds") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["understands", true]]], x: vx, y: Dk(780, 450), size: lineSize, t0: w(23, "understands") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  headline(ctx, vision, { lines: [[["and runs", true]], [["its spaces.", false]]], x: vx, y: Dk(920, 580), size: lineSize, t0: w(23, "runs") - 0.12, t1: s(24) - 0.5, stagger: 0.04 });
  ctx.hideCaptions(s(23) - 0.25, s(24) - 0.15);
  object3d(ctx, vision, { name: "search", size: 220, x: Dk(850, 1300), y: Dk(700, 330), t0: w(23, "finds") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 56 });
  object3d(ctx, vision, { name: "assistant", size: 220, x: Dk(860, 1540), y: Dk(1020, 520), t0: w(23, "understands") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 57 });
  object3d(ctx, vision, { name: "toolbox", size: 220, x: Dk(860, 1300), y: Dk(1340, 740), t0: w(23, "runs") - 0.1, t1: s(24) - 0.45, drift: 1, seed: 58 });
  /* every home, every room, every table, every neighbour: four discs that
     then fly into the end card's mark */
  const endT = T.music.logo_hit - 0.05;
  gatherDiscs(ctx, vision, {
    to: Dk({ x: CX, y: 760 }, { x: 960, y: 460 }), tFly: endT - 0.72, size: Dk(210, 190),
    items: [
      { name: "villa", label: "Home", x: Dk(300, 560), y: Dk(780, 300), t0: w(24, "home") },
      { name: "hotel", label: "Room", x: Dk(780, 1360), y: Dk(780, 300), t0: w(24, "room") },
      { name: "restaurant", label: "Table", x: Dk(300, 560), y: Dk(1230, 700), t0: w(24, "table") },
      { name: "local-talks", label: "Neighbour", x: Dk(780, 1360), y: Dk(1230, 700), t0: w(24, "neighbour") },
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
