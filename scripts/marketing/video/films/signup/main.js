/*
 * THE SIGN-UP FILM, "Getting on Vallo takes about a minute" (recorded clock).
 *
 * One phone carries it. It rises out of the opening frame with the real
 * sign-up form on the glass, and the three fields the voice names lift off
 * it one after another. The three things you do not do are struck off a
 * container. The code screen comes, the platform opens, and the one account
 * is followed through the product: homes, stays, restaurants, the shortlist,
 * the conversations, the agreements, a desktop window beside the phone, and
 * at the end the same account turning into a workspace. It closes on the
 * opening frame's own minute.
 *
 * Two formats. Mobile (1080x1920): the phone is the column, held a little
 * smaller than the frame so its readable content ends above the caption
 * pill; a container only ever comes up while the phone has stepped down out
 * of its way. Desktop (1920x1080): the phone stands in the middle and what
 * comes off it travels to the left and right columns, alternating sides.
 *
 * Nothing here refers to a number of seconds: every beat hangs on s(i),
 * e(i) and w(i, "word") from the film's own clock. Claims: video/FACTS-OCT.md.
 * Copy rules: marketing/DESIGN.md section 2.
 */
import {
  anchors, ground, hero, lift, headline, ending, openerClock,
  listingWall, STAY_CARDS, windowRig, object3d, badgeDisc, popOut, figureOut,
  installFocus, leak, flash, slabWipe, shutter, irisTicks, tileFall, whipPan,
} from "../kit.js";
import { strikeList, chips } from "./parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const P = (m, d) => (M ? m : d);
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  /* ---------- the stage ---------- */
  const CX = ctx.W / 2;
  const LX = 410;    // desktop: the left column's centre
  const RX = 1510;   // desktop: the right column's centre
  const TOP = 470;   // mobile: the band a container takes while the phone is LOW
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });

  /* ---------- poses ----------
     Mobile HOME ends its glass at y ~1640: the caption pill (centred 1580)
     only ever sits on the bottom bar of whatever screen is up. */
  const HOME = P({ cx: CX, cy: 1010, height: 1280 }, { cx: CX, cy: 535, height: 800 });
  const LOW = P({ cx: CX, cy: 1110, height: 1000 }, { cx: CX, cy: 535, height: 800 });
  const BACK = P({ cx: CX, cy: 1080, height: 1160 }, { cx: CX, cy: 545, height: 780 });
  const PAIR = P({ cx: CX, cy: 1200, height: 860 }, { cx: 470, cy: 545, height: 780 });
  const PEEK = P({ cx: CX, cy: 2120, height: 1280 }, { cx: 1440, cy: 545, height: 780 });
  const off = (p) => (M ? { ...p, cy: p.cy + 1750 } : { ...p, cy: p.cy + 1150 });

  /* ---------- the crops, measured on the fresh captures (films/blocks.py) ----------
     su-name and su-sent have no display image of their own, so the phone
     carries them as tall captures under the sign-in screen's status bar.
     Their crops are in the capture's own 1320-wide pixels. */
  const SU = (id) => ctx.src.capture(id);
  const NAME_ROW = { x: 34, y: 592, w: 1272, h: 312 };   // "First name" + "Surname", labels, fields, focus ring
  const EMAIL_ROW = { x: 34, y: 888, w: 1272, h: 264 };  // "Email address" and its field
  const PASS_ROW = { x: 34, y: 1182, w: 1272, h: 280 };  // "Password", its field and the strength bars
  /* su-sent, from above "Confirmation code" to under "Confirm and go in":
     the part of that screen with no address anywhere in it. */
  const CODE = { x: 34, y: 1344, w: 1254, h: 496 };
  /* n-home2-full (a 9-screen stitch, 880 wide, carried at 1320): the
     Buy / Rent / Pay / List card on its own rounded edge */
  const QUAD = { x: 108, y: 1856, w: 1104, h: 328 };
  const HOME_SCROLL = 1050;   // the search card's foot and the four tiles; the greeting is above the glass
  const LIST_SCROLL = 3300;   // "Spaces for you" and the first premium listing
  /* the saved screen's own count bar, and the inbox's one thread */
  const SAVED_BAR = { x: 38, y: 758, w: 866, h: 120 };
  const THREAD_ROW = { x: 44, y: 1242, w: 1244, h: 300 };
  /* f-host-start's "I own the property" card, under its own heading */
  const OWN_ROW = { x: 42, y: 2280, w: 1236, h: 315 };
  /* taps, in display px of the screen that is up */
  const TAP_CREATE = [660, 2331];   // su-name: "Create account"
  const TAP_GO_IN = [660, 1919];    // su-sent: "Confirm and go in"
  const TAP_OWN = [660, 2437];      // f-host-start: the "I own the property" card

  /* ---------- the phone's path ---------- */
  H.path([
    [0, { ...off(HOME), opacity: 0 }],
    [e(1) - 0.45, { ...off(HOME), opacity: 1 }, "none"],
    [s(2) + 0.08, { ...HOME }, "power3.out"],
    /* it steps back as the rows rise off it */
    [w(2, "name") + 0.2, { ...HOME }],
    [w(2, "email") + 0.2, { ...BACK }],
    [s(3) - 0.05, { ...BACK }],
    /* it slides away under the struck list, still carrying the short form,
       and comes back for the code */
    [s(3) + 0.45, { ...PEEK }, "power3.out"],
    [s(4) - 0.55, { ...PEEK }],
    [s(4) + 0.05, { ...HOME }, "power3.out"],
    /* it steps down for the one-account container, and returns on the cut */
    [w(5, "all") - 0.4, { ...HOME }],
    [w(5, "all") + 0.15, { ...LOW }],
    [s(6) - 0.2, { ...LOW }],
    [s(6) + 0.35, { ...HOME }],
    [w(6, "stay") - 0.3, { ...HOME }],
    [w(6, "stay") + 0.2, { ...LOW }],
    /* it drops to make room for the desktop window */
    [w(6, "device") - 0.45, { ...LOW }],
    [w(6, "device") + 0.3, { ...PAIR }],
    [s(7) - 0.35, { ...PAIR }],
    [s(7) + 0.2, { ...HOME }, "power3.out"],
    [w(7, "same") - 0.35, { ...HOME }],
    [w(7, "same") + 0.15, { ...LOW }],
    [s(8) - 0.35, { ...LOW }],
    [s(8) - 0.02, { ...off(LOW), rz: -5, ry: 16 }, "power3.in"],
    [ctx.duration, { ...off(LOW), opacity: 0 }, "none"],
  ]);
  H.swing(s(3) - 0.05, s(4) - 0.05, s(5) - 0.05, s(6) - 0.05, s(7) - 0.05);

  /* ===================== 1. The opening frame (0 - s2) ===================== */
  ground(ctx, 0, s(2) + 0.1, { tone: "navy", y: 26, seed: 11 });
  const open = ctx.scene("open", 0, e(1) + 0.06, { z: 760 });
  openerClock(ctx, open, { t1: s(1) - 0.15 });
  headline(ctx, open, {
    lines: [[["Getting on Vallo", false]], [["takes about", false]], [["a minute.", true]]],
    x: M ? 60 : 160, y: M ? 400 : 230, size: M ? 100 : 104, t0: s(1) - 0.05, t1: e(1) - 0.08, stagger: 0, keyStyle: "chip",
  });
  ctx.hideCaptions(s(1) - 0.2, s(2) - 0.04);
  /* the minute is the subject: the clock and the account card stand under the words */
  object3d(ctx, open, { name: "clock", size: P(300, 280), x: P(780, 1420), y: P(1150, 470), t0: s(1) + 0.1, t1: e(1) - 0.12, drift: 1, seed: 31 });
  object3d(ctx, open, { name: "id-check", size: P(210, 200), x: P(300, 1180), y: P(1420, 760), t0: s(1) + 0.35, t1: e(1) - 0.12, drift: 1, seed: 32 });

  /* ===================== 2. Three fields (s2) =====================
     CUT 1 -> 2. A navy slab travels up the frame as the phone rises through
     it with the real form on the glass: it is up and still before "name". */
  slabWipe(ctx, e(1) - 0.14, { dir: "up", dur: 0.42 });
  ground(ctx, e(1) - 0.14, s(3) - 0.05, { tone: "electric", y: 22, seed: 12 });
  H.show("sign-in", e(1) - 0.45, w(4, "email") - 0.03, { enter: "cut", full: "su-name" });
  /* THE FORM'S OWN ROWS, HELD UP. Each lifts on the word that names it, so
     the three of them stack into the account the voice is describing. On
     desktop they alternate sides of the phone. */
  const fields = [
    { crop: NAME_ROW, t0: w(2, "name") - 0.05, t1: s(3) - 0.78, to: P({ x: CX, y: 510, s: 0.645, r: -1.6 }, { x: LX, y: 300, s: 0.5, r: -1.6 }), seed: 1 },
    { crop: EMAIL_ROW, t0: w(2, "email") - 0.05, t1: s(3) - 0.7, to: P({ x: CX, y: 740, s: 0.645, r: 1.4 }, { x: RX, y: 490, s: 0.5, r: 1.4 }), seed: 2 },
    { crop: PASS_ROW, t0: w(2, "password") - 0.05, t1: s(3) - 0.62, to: P({ x: CX, y: 970, s: 0.645, r: -1.2 }, { x: LX, y: 690, s: 0.5, r: -1.2 }), seed: 3 },
  ];
  fields.forEach((f) => lift(ctx, H, {
    id: "su-name", src: SU("su-name"), crop: f.crop, t0: f.t0, t1: f.t1,
    to: f.to, exit: "fade", fly: 0.5, seed: f.seed, radius: 34,
  }));
  if (!M) {
    badgeDisc(ctx, layer("fields-d", s(2), s(3)), { name: "id-check", kind: "object", x: 1560, y: 820, size: 150, t0: w(2, "password") + 0.1, t1: s(3) - 0.2, seed: 41 });
  }

  /* ===================== 3. What you skip (s3) =====================
     CUT 2 -> 3. Seven bars close from alternate sides. The phone does not
     leave: on mobile it slides down under the list, on desktop it steps to
     the right, still carrying the short form. */
  shutter(ctx, s(3) - 0.05, { bars: 7, dur: 0.38 });
  ground(ctx, s(3) - 0.05, s(4) - 0.05, { tone: "navy", y: 30, seed: 13 });
  const skip = layer("skip", s(3) - 0.1, s(4) - 0.1);
  strikeList(ctx, skip, {
    x: P(CX, 640), y: P(950, 520), w: P(880, 820), size: P(36, 34), rot: -1, seed: 15,
    tab: "None of this",
    t0: s(3) + 0.02, t1: s(4) - 0.25,
    items: [
      ["file-text", "A long form", w(3, "No", 1), w(3, "form") + 0.10],
      ["phone", "A call to an agent", w(3, "No", 2), w(3, "first") + 0.10],
      ["wallet", "Anything to pay", w(3, "Nothing"), w(3, "pay") + 0.10],
    ],
  });
  /* the same words are already big on screen, so the caption steps aside */
  ctx.hideCaptions(s(3) - 0.1, s(4) - 0.35);
  badgeDisc(ctx, skip, { name: "clock", kind: "object", x: P(150, 220), y: P(600, 190), size: 150, t0: w(3, "long") + 0.1, t1: s(4) - 0.5, tone: "paper", seed: 16 });
  badgeDisc(ctx, skip, { name: "id-check", kind: "object", x: P(930, 1010), y: P(620, 880), size: 140, t0: w(3, "agent") + 0.1, t1: s(4) - 0.45, seed: 17 });

  /* ===================== 4. Confirm your email (s4) =====================
     CUT 3 -> 4. Four tick brackets close on the centre and bloom as the
     phone comes back: the account is made, the code screen slides in. */
  irisTicks(ctx, s(4) - 0.05, { dur: 0.44 });
  ground(ctx, s(4) - 0.05, s(5) - 0.05, { tone: "emerald", y: 20, seed: 14 });
  H.tap(w(4, "Confirm") + 0.1, ...TAP_CREATE);
  H.show("sign-in", w(4, "email") - 0.03, s(5) - 0.25, { enter: "slide", full: "su-sent" });
  ctx.sfx("chime_notify", w(4, "email") + 0.08, { offset: -3 });
  /* THE CODE, AND NOTHING ELSE: the part of that screen with no address in it */
  lift(ctx, H, {
    id: "su-sent", src: SU("su-sent"), crop: CODE, t0: w(4, "and") + 0.02, t1: w(4, "open") - 0.45,
    to: P({ x: CX, y: 640, s: 0.58, r: -2 }, { x: RX, y: 420, s: 0.5, r: -2 }), exit: "fade", fly: 0.55, seed: 4, radius: 40,
  });
  H.tap(w(4, "open") - 0.3, ...TAP_GO_IN);
  /* desktop: the screen's own promise, said big in the empty column */
  if (!M) {
    headline(ctx, layer("code-d", s(4) - 0.1, s(5) - 0.05), {
      lines: [[["Six digits,", false]], [["and you are", false]], [["in.", true]]],
      x: 110, y: 330, size: 84, t0: w(4, "email") + 0.05, t1: s(5) - 0.3, stagger: 0.06, keyStyle: "chip",
    });
  }
  /* the platform opening, under everything, as the voice gets to it */
  listingWall(ctx, layer("wall", w(4, "open") - 0.2, w(5, "all") + 0.4, 3), {
    t0: w(4, "open") - 0.1, t1: w(5, "all") - 0.3, rows: P(5, 4), opacity: 0.5, seed: 21, y: P(260, 40),
    stays: STAY_CARDS(ctx), stayRows: [1, 3],
  });

  /* ===================== 5. One account, everything (s5) =====================
     CUT 4 -> 5. The slab sweeps left as the platform opens. */
  slabWipe(ctx, s(5) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(5) - 0.05, s(6) - 0.05, { tone: "dusk", y: 80, seed: 15 });
  const plat = layer("platform", s(5) - 0.2, s(6) - 0.1);
  /* homes to rent: the four tiles, held up; homes to buy: the page scrolls
     down to the listings under them */
  H.show("n-home2", s(5) - 0.25, w(5, "hotels") - 0.15, {
    enter: "slide", full: "n-home2-full",
    scroll: [[s(5) - 0.25, HOME_SCROLL], [w(5, "homes", 2) + 0.15, HOME_SCROLL], [w(5, "hotels") - 0.2, LIST_SCROLL]],
  });
  lift(ctx, H, {
    id: "n-home2", src: ctx.src.capture("n-home2-full"), scrolled: HOME_SCROLL, crop: QUAD,
    t0: w(5, "homes") + 0.05, t1: w(5, "homes", 2) + 0.05,
    to: P({ x: CX, y: 640, s: 0.62, r: -1.2 }, { x: LX, y: 380, s: 0.56, r: -1.2 }),
    exit: "fade", fly: 0.45, seed: 5, radius: 50,
  });
  /* hotels, shortlets and restaurants: the phone says them itself, in its
     own pages, with a light whip on each turn; the restaurant page scrolls */
  H.show("n-stays", w(5, "hotels") - 0.15, w(5, "restaurants") - 0.08, { enter: "cut" });
  ctx.sfx("swipe", w(5, "hotels") - 0.15, { offset: -4 });
  whipPan(ctx, w(5, "hotels") - 0.15, { dir: "left", dur: 0.22, sound: null });
  H.show("n-restaurant", w(5, "restaurants") - 0.08, w(5, "all") - 0.1, {
    enter: "cut", full: "n-restaurant-full",
    scroll: [[w(5, "restaurants") - 0.08, 0], [w(5, "all") - 0.2, 1150]],
  });
  ctx.sfx("swipe", w(5, "restaurants") - 0.08, { offset: -4 });
  whipPan(ctx, w(5, "restaurants") - 0.08, { dir: "right", dur: 0.22, sound: null });
  H.show("n-home2", w(5, "all") - 0.1, s(6) - 0.25, { enter: "slide", full: "n-home2-full", scroll: [[w(5, "all") - 0.1, LIST_SCROLL]] });
  /* the three kinds of booking, named above the phone (the chapter pill steps aside) */
  chips(ctx, plat, {
    items: [["Hotels", "bed"], ["Shortlets", "key-round"], ["Restaurants", "utensils-crossed"]],
    x: P(CX, RX), y: P(318, 260), t0: w(5, "hotels") - 0.08, gap: Math.max(0.3, (w(5, "restaurants") - w(5, "hotels")) / 2),
    t1: w(5, "all") - 0.35, size: P(32, 30), wrapW: P(1000, 600),
  });
  ctx.hidePill(w(5, "hotels") - 0.3, s(6) - 0.2);
  [["hotel", P(130, 300), P(700, 640), w(5, "hotels") + 0.1, 22],
    ["shortlet", P(950, 1620), P(770, 640), w(5, "shortlets") + 0.1, 23],
    ["restaurant", P(130, 420), P(1190, 860), w(5, "restaurants") + 0.1, 24]]
    .forEach(([name, bx, by, t0, seed]) => badgeDisc(ctx, plat, { name, kind: "object", x: bx, y: by, size: P(130, 140), t0, t1: w(5, "all") - 0.25, seed }));
  /* "all under the one account" is the one thing none of these screens
     prints in one place, so it is the container's job; the phone has
     stepped down out of its way */
  popOut(ctx, plat, {
    kind: "line", lucide: "user-round-check", tab: "Everything on Vallo",
    title: "Under one account", line: "Homes, hotels, shortlets, restaurants.",
    x: P(CX, RX), y: P(TOP, 520), t0: w(5, "all") - 0.05, t1: s(6) - 0.3, size: P(32, 30), from: P("above", "right"), seed: 25,
  });

  /* ===================== 6. It stays with you (s6) =====================
     CUT 5 -> 6. The frame breaks into tiles and drops away. */
  tileFall(ctx, s(6) - 0.05, { cols: 6, rows: 10, dur: 0.46, seed: 9 });
  ground(ctx, s(6) - 0.05, s(7) - 0.05, { tone: "violet", y: 24, seed: 16 });
  const keep = layer("keep", s(6) - 0.2, s(7) - 0.1);
  H.show("saved", s(6) - 0.25, w(6, "conversations") - 0.1, { enter: "slide" });
  H.show("messages", w(6, "conversations") - 0.1, w(6, "agreements") - 0.1, { enter: "slide" });
  /* the agreements screen as it reads with nothing yet signed (the fresh
     capture caught a connection error, which no film should show) */
  H.show("agreements", w(6, "agreements") - 0.1, s(7) - 0.1, { enter: "slide" });
  /* the shortlist's own count, then the inbox's one conversation */
  lift(ctx, H, {
    id: "saved", crop: SAVED_BAR, t0: w(6, "shortlist") - 0.05, t1: w(6, "conversations") + 0.1,
    to: P({ x: CX, y: 640, s: 0.74, r: -1.5 }, { x: LX, y: 380, s: 0.62, r: -1.5 }), exit: "fade", fly: 0.5, seed: 6,
  });
  lift(ctx, H, {
    id: "messages", crop: THREAD_ROW, t0: w(6, "conversations") + 0.12, t1: w(6, "agreements") - 0.6,
    to: P({ x: CX, y: 900, s: 0.62, r: 1.5 }, { x: RX, y: 600, s: 0.5, r: 1.5 }), exit: "up", fly: 0.5, seed: 7,
  });
  popOut(ctx, keep, {
    kind: "counters", tab: "Kept with your account",
    items: [["heart", "Shortlist"], ["message-circle", "Conversations"], ["file-signature", "Agreements"]],
    x: P(CX, LX + 20), y: P(TOP, 780), t0: w(6, "stay") - 0.05, t1: w(6, "device") - 0.5, size: P(28, 24), from: P("above", "left"), seed: 26,
  });
  ctx.hidePill(w(6, "stay") - 0.25, w(6, "device") - 0.45);
  /* ON EVERY DEVICE. The web app beside the phone, the same account signed
     in on both, the window arriving as the phone steps out of its way. */
  const W = windowRig(ctx);
  const WIN = P({ x: 223, y: 300, s: 0.44 }, { x: 900, y: 175, s: 0.64 });
  const WOFF = P({ x: 1210, y: 300, s: 0.44 }, { x: 1960, y: 175, s: 0.64 });
  W.path([
    [w(6, "device") - 0.45, { ...WOFF, opacity: 1 }],
    [w(6, "device") + 0.25, { ...WIN, opacity: 1 }, "power3.out"],
    [s(7) - 0.5, { ...WIN, opacity: 1 }],
    [s(7) - 0.12, { ...WOFF, opacity: 1 }, "power3.in"],
    [s(7) - 0.04, { ...WOFF, opacity: 0 }, "none"],
    [ctx.duration, { ...WOFF, opacity: 0 }, "none"],
  ]);
  W.show("d-saved", w(6, "device") - 0.45, s(7) - 0.04, { enter: "cut" });

  /* ===================== 7. Or list your own place (s7) =====================
     CUT 6 -> 7. The bars close once more, into the gold. */
  shutter(ctx, s(7) - 0.12, { bars: 7, dur: 0.28 });
  ground(ctx, s(7) - 0.05, s(9) - 0.45, { tone: "gold", y: 28, seed: 17 });
  const host = layer("host", s(7) - 0.1, s(8) + 0.4);
  H.show("f-host-start", s(7) - 0.1, w(7, "workspace") - 0.25, { enter: "slide" });
  H.tap(w(7, "list") + 0.05, ...TAP_OWN);
  /* the row the founder wants lifted, on its card's own edges */
  lift(ctx, H, {
    id: "f-host-start", crop: OWN_ROW, t0: w(7, "own") - 0.05, t1: w(7, "same") - 0.5,
    to: P({ x: CX, y: 620, s: 0.62, r: -2 }, { x: LX, y: 420, s: 0.5, r: -2 }), exit: "fade", fly: 0.5, seed: 8,
  });
  /* the workspace itself: its overview, scrolled down to the day's counters */
  H.show("f-host-home", w(7, "workspace") - 0.25, s(8) + 0.3, {
    enter: "slide", full: "f-host-home-full",
    scroll: [[w(7, "workspace") - 0.25, 0], [s(8) - 0.3, 760]],
  });
  popOut(ctx, host, {
    kind: "line", lucide: "arrow-left-right", tab: "The same account",
    title: "Looking and listing", line: "No second sign-in.",
    x: P(CX, RX), y: P(TOP, 520), t0: w(7, "same") - 0.02, t1: s(8) - 0.3, size: P(30, 28), from: P("above", "right"), seed: 27,
  });
  object3d(ctx, host, { name: "keys", size: P(170, 190), x: P(130, 300), y: P(1300, 780), t0: w(7, "place") - 0.2, t1: s(8) - 0.3, drift: 1, seed: 18 });
  badgeDisc(ctx, host, { name: "list", kind: "object", x: P(955, 1620), y: P(1240, 820), size: 130, t0: w(7, "own") + 0.25, t1: s(8) - 0.3, seed: 19 });

  /* ===================== 8. One minute to start (s8) =====================
     The opening frame comes back: the minute, stroked, and the clock that
     stood beside it. A light leak carries the phone out of the film. */
  flash(ctx, s(8) - 0.08, { sound: "whoosh_short" });
  leak(ctx, s(8) - 0.02, { warm: true, dur: 0.9 });
  const last = layer("last", s(8) - 0.3, s(9) - 0.35, 770);
  figureOut(ctx, last, { text: "1:00", x: CX, y: P(950, 500), size: P(340, 300), rot: -3, t0: s(8) - 0.12, t1: s(9) - 0.62, seed: 28 });
  object3d(ctx, last, { name: "clock", size: P(250, 230), x: P(830, 1420), y: P(600, 330), t0: s(8) + 0.18, t1: s(9) - 0.6, drift: 1, seed: 29 });
  object3d(ctx, last, { name: "id-check", size: P(185, 180), x: P(205, 500), y: P(1330, 720), t0: s(8) + 0.32, t1: s(9) - 0.6, drift: 1, seed: 30 });

  /* ===================== 9. The end card ===================== */
  ending(ctx, { t0: s(9) - 0.5, tLine: w(9, "Real") - 0.12, tBadges: e(9) + 0.15, tUrl: e(9) + 1.0, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: 0.5 });
}
