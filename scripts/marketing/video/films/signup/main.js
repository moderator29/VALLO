/*
 * THE SIGN-UP FILM, "Getting on Vallo takes about a minute" (43.8 s).
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
 * Nothing here refers to a number of seconds: every beat hangs on s(i),
 * e(i) and w(i, "word") from the film's own clock, so when the voice moves
 * the film moves with it. Claims: video/FACTS-OCT.md. Copy rules:
 * marketing/DESIGN.md section 2 (no real address, name or number on screen).
 */
import {
  anchors, ground, hero, lift, headline, chipRow, ending, openerClock,
  listingWall, STAY_CARDS, windowRig, object3d, badgeDisc, popOut, figureOut,
  installFocus, leak, flash, slabWipe, shutter, irisTicks, tileFall, whipPan,
} from "../kit.js";
import { strikeList } from "./parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  /* ---------- the stage ---------- */
  const CX = ctx.W / 2;
  const TOP = 470;    // the band under the chapter pill, where a container sits
  const BAND = 1425;  // the label band, under the phone's content
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });

  /* ---------- poses ---------- */
  const HOME = { cx: CX, cy: 1075, height: 1380 };
  const LOW = { cx: CX, cy: 1255, height: 1180 };
  const BACK = { cx: CX, cy: 1300, height: 1150 };   // pushed back while the form's rows float
  const PAIR = { cx: CX, cy: 1430, height: 980 };    // low, with the desktop window above it
  const PEEK = { cx: CX, cy: 2170, height: 1380 };   // only its top edge, under the struck list
  const off = (p, dy = 1750) => ({ ...p, cy: p.cy + dy });

  /* ---------- the crops, measured (films/blocks.py), never eyeballed ----------
     su-name and su-sent have no display image of their own, so the phone
     carries them as tall captures under the sign-in screen's status bar
     (the same bright blue top edge, so the bar is the screen's own colour).
     Their crops are therefore in the capture's own 1320-wide pixels. */
  const SU = (id) => ctx.src.capture(id);
  const NAME_ROW = { x: 34, y: 596, w: 1272, h: 312 };   // "First name" + "Surname", labels and fields
  const EMAIL_ROW = { x: 34, y: 888, w: 1272, h: 266 };  // "Email address" and its field
  const PASS_ROW = { x: 34, y: 1182, w: 1272, h: 278 };  // "Password", its field and the strength bars
  /* su-sent, from above "Confirmation code" to under "Confirm and go in":
     the part of that screen with no address anywhere in it. */
  const CODE = { x: 34, y: 1344, w: 1254, h: 496 };
  /* n-home2's Buy / Rent / Pay / List row, in the tall capture's 1320-wide space */
  const QUAD = { x: 98, y: 2414, w: 1134, h: 341 };
  const HOME_SCROLL = 1550;
  /* the saved screen's own count bar, and the inbox's one thread */
  const SAVED_BAR = { x: 38, y: 758, w: 866, h: 120 };
  const THREAD_ROW = { x: 44, y: 1242, w: 1244, h: 300 };
  /* f-host-start's "I own the property" row, on the card's own edges */
  const OWN_ROW = { x: 38, y: 2237, w: 1244, h: 244 };

  /* ---------- the phone's path ---------- */
  H.path([
    [0, { ...off(HOME), opacity: 0 }],
    [s(2) - 0.9, { ...off(HOME), opacity: 1 }, "none"],
    [s(2) - 0.02, { ...HOME }, "power3.out"],
    /* it drifts back as the rows rise off it, so no row is left sitting a
       finger under the card that came out of it */
    [w(2, "name") + 0.25, { ...HOME }],
    [w(2, "password") + 0.05, { ...BACK }],
    [s(3) - 0.05, { ...BACK }],
    /* it slides down under the struck list, still carrying the short form,
       and rises back out of it for the code */
    [s(3) + 0.45, { ...PEEK }, "power3.out"],
    [s(4) - 0.55, { ...PEEK }],
    [s(4) + 0.05, { ...HOME }, "power3.out"],
    /* it steps back for the one-account container, and returns on the cut */
    [w(5, "all") - 0.35, { ...HOME }],
    [w(5, "all") + 0.25, { ...LOW }],
    [s(6) - 0.2, { ...LOW }],
    [s(6) + 0.35, { ...HOME }],
    /* it drops to make room for the desktop window above it */
    [w(6, "device") - 0.45, { ...HOME }],
    [w(6, "device") + 0.3, { ...PAIR }],
    [s(7) - 0.35, { ...PAIR }],
    [s(7) + 0.2, { ...HOME }, "power3.out"],
    [s(8) - 0.35, { ...HOME }],
    [s(8) - 0.02, { ...off(HOME), rz: -5, ry: 16 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ]);
  H.swing(s(3) - 0.05, s(4) - 0.05, s(5) - 0.05, w(5, "all") - 0.1, s(6) - 0.05, s(7) - 0.05);

  /* ===================== 1. The opening frame (0 - s2) ===================== */
  ground(ctx, 0, s(2) + 0.1, { tone: "navy", y: 26, seed: 11 });
  const open = ctx.scene("open", 0, s(2) + 0.1, { z: 760 });
  openerClock(ctx, open, { t1: s(1) - 0.15 });
  headline(ctx, open, {
    lines: [[["Getting on Vallo", false]], [["takes about", false]], [["a minute.", true]]],
    x: M ? 60 : 160, y: M ? 400 : 230, size: M ? 100 : 104, t0: s(1) - 0.05, t1: s(2) - 0.22, stagger: 0, keyStyle: "chip",
  });
  ctx.hideCaptions(s(1) - 0.2, s(2) - 0.3);

  /* ===================== 2. Three fields (s2) =====================
     CUT 1 -> 2. A navy slab travels up the frame as the phone rises through
     it with the real form on the glass. */
  slabWipe(ctx, s(2) - 0.05, { dir: "up", dur: 0.42 });
  ground(ctx, s(2) - 0.05, s(3) - 0.05, { tone: "electric", y: 22, seed: 12 });
  H.show("sign-in", s(2) - 0.35, w(4, "email") - 0.03, { enter: "cut", full: "su-name" });
  /* THE FORM'S OWN ROWS, HELD UP. Each lifts on the word that names it and
     flies to its own band, so the three of them stack into the account the
     voice is describing, and each one is the product at size inside one
     heavy rule (UPGRADE section 6). The phone drifts back as they rise, so
     the rows they came from are never left sitting a finger under them. */
  const fields = [
    { crop: NAME_ROW, t0: w(2, "name") - 0.05, t1: w(2, "choose") + 0.25, y: 545, r: -1.6, seed: 1 },
    { crop: EMAIL_ROW, t0: w(2, "email") - 0.05, t1: w(2, "choose") + 0.45, y: 805, r: 1.4, seed: 2 },
    { crop: PASS_ROW, t0: w(2, "password") - 0.05, t1: w(2, "choose") + 0.65, y: 1065, r: -1.2, seed: 3 },
  ];
  fields.forEach((f) => lift(ctx, H, {
    id: "su-name", src: SU("su-name"), crop: f.crop, t0: f.t0, t1: f.t1,
    to: { x: CX, y: f.y, s: 0.645, r: f.r }, exit: "fade", fly: 0.52, seed: f.seed, radius: 34,
  }));

  /* ===================== 3. What you skip (s3) =====================
     CUT 2 -> 3. Seven bars close from alternate sides. The phone does not
     leave: it slides down under the list, still carrying the short form, so
     the thing being talked about is in the frame while the three things that
     are not are struck off above it. */
  shutter(ctx, s(3) - 0.05, { bars: 7, dur: 0.38 });
  ground(ctx, s(3) - 0.05, s(4) - 0.05, { tone: "navy", y: 30, seed: 13 });
  const skip = layer("skip", s(3) - 0.1, s(4) - 0.1);
  strikeList(ctx, skip, {
    x: CX, y: 950, w: 880, size: 36, rot: -1, seed: 15,
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
  /* the frame is wide open beside the container: two badges ride the margins */
  badgeDisc(ctx, skip, { name: "clock", kind: "object", x: 150, y: 600, size: 150, t0: w(3, "long") + 0.1, t1: s(4) - 0.5, tone: "paper", seed: 16 });
  badgeDisc(ctx, skip, { name: "id-check", kind: "object", x: 930, y: 620, size: 140, t0: w(3, "agent") + 0.1, t1: s(4) - 0.45, seed: 17 });

  /* ===================== 4. Confirm your email (s4) =====================
     CUT 3 -> 4. Four tick brackets close on the centre and bloom as the
     phone comes back. */
  irisTicks(ctx, s(4) - 0.05, { dur: 0.44 });
  ground(ctx, s(4) - 0.05, s(5) - 0.05, { tone: "emerald", y: 20, seed: 14 });
  H.tap(w(4, "Confirm") + 0.12, 660, 2336);
  H.show("sign-in", w(4, "email") - 0.03, s(5) - 0.25, { enter: "slide", full: "su-sent" });
  ctx.sfx("chime_notify", w(4, "email") + 0.08, { offset: -3 });
  /* THE CODE, AND NOTHING ELSE. The crop opens above "Confirmation code"
     and closes under "Confirm and go in": the part of that screen that
     carries no address at all (DESIGN.md section 2). */
  lift(ctx, H, {
    id: "su-sent", src: SU("su-sent"), crop: CODE, t0: w(4, "and") + 0.05, t1: s(5) - 0.35,
    to: { x: CX, y: 720, s: 0.58, r: -2 }, exit: "fade", fly: 0.6, seed: 4, radius: 40,
  });
  /* the platform opening, under everything, before the voice gets to it */
  listingWall(ctx, layer("wall", w(4, "open") - 0.2, w(5, "all") + 0.4, 3), {
    t0: w(4, "open") - 0.1, t1: w(5, "all") - 0.3, rows: 5, opacity: 0.5, seed: 21, y: 260,
    stays: STAY_CARDS(ctx), stayRows: [1, 3],
  });

  /* ===================== 5. One account, everything (s5) =====================
     CUT 4 -> 5. The slab sweeps left as the platform opens. */
  slabWipe(ctx, s(5) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(5) - 0.05, s(6) - 0.05, { tone: "dusk", y: 80, seed: 15 });
  const plat = layer("platform", s(5) - 0.2, s(6) - 0.1);
  H.show("n-home2", s(5) - 0.25, w(5, "hotels") - 0.15, { enter: "slide", full: "n-home2-full", scroll: [[s(5) - 0.25, HOME_SCROLL]] });
  /* rent and buy: the home's own row, held up over the row it came from */
  lift(ctx, H, {
    id: "n-home2", src: ctx.src.capture("n-home2-full"), scrolled: HOME_SCROLL, crop: QUAD,
    t0: w(5, "homes") + 0.13, t1: w(5, "hotels") - 0.3, to: { x: CX, y: 975, s: 0.56, r: -1.2 },
    exit: "fade", fly: 0.5, seed: 5, radius: 50,
  });
  /* hotels, shortlets and restaurants: the phone says them itself, in its
     own tiles and its own pages, with a light whip on each turn */
  [["n-stays", w(5, "hotels") - 0.15, w(5, "restaurants") - 0.08],
    ["n-restaurant", w(5, "restaurants") - 0.08, w(5, "all") - 0.1]].forEach(([id, t0, t1], i) => {
    H.show(id, t0, t1, { enter: "cut" });
    ctx.sfx("swipe", t0, { offset: -4 });
    whipPan(ctx, t0, { dir: i ? "right" : "left", dur: 0.22, sound: null });
  });
  H.show("n-home2", w(5, "all") - 0.1, s(6) - 0.25, { enter: "slide" });
  chipRow(ctx, plat, {
    items: [["Hotels", "bed"], ["Shortlets", "key-round"], ["Restaurants", "utensils-crossed"]],
    x: CX, y: BAND, t0: w(5, "hotels") - 0.08, gap: Math.max(0.3, (w(5, "restaurants") - w(5, "hotels")) / 2),
    t1: w(5, "all") - 0.25, size: 32, wrapW: 1000, anchor: "center",
  });
  [["hotel", 130, 700, w(5, "hotels") + 0.1, 22], ["shortlet", 950, 770, w(5, "shortlets") + 0.1, 23], ["restaurant", 130, 1190, w(5, "restaurants") + 0.1, 24]]
    .forEach(([name, bx, by, t0, seed]) => badgeDisc(ctx, plat, { name, kind: "object", x: bx, y: by, size: 130, t0, t1: w(5, "all") - 0.25, seed }));
  /* "all under the one account" is the one thing none of these screens
     prints in one place, so it is the container's job */
  popOut(ctx, plat, {
    kind: "line", lucide: "user-round-check", tab: "Everything on Vallo",
    title: "Under one account", line: "Homes, hotels, shortlets, restaurants.",
    x: CX, y: TOP, t0: w(5, "all") - 0.05, t1: s(6) - 0.3, size: 32, from: "above", seed: 25,
  });
  ctx.hidePill(w(5, "all") - 0.3, s(6) - 0.2);

  /* ===================== 6. It stays with you (s6) =====================
     CUT 5 -> 6. The frame breaks into tiles and drops away. */
  tileFall(ctx, s(6) - 0.05, { cols: 6, rows: 10, dur: 0.46, seed: 9 });
  ground(ctx, s(6) - 0.05, s(7) - 0.05, { tone: "violet", y: 24, seed: 16 });
  const keep = layer("keep", s(6) - 0.2, s(7) - 0.1);
  H.show("saved", s(6) - 0.25, w(6, "conversations") - 0.1, { enter: "slide" });
  H.show("messages", w(6, "conversations") - 0.1, w(6, "agreements") - 0.1, { enter: "slide" });
  H.show("f-agreements", w(6, "agreements") - 0.1, s(7) - 0.1, { enter: "slide" });
  /* the shortlist's own count, then the inbox's one conversation under it:
     the second arrives while the first is still leaving */
  lift(ctx, H, {
    id: "saved", crop: SAVED_BAR, t0: w(6, "shortlist") - 0.05, t1: w(6, "conversations") + 0.2,
    to: { x: CX, y: 784, s: 0.74, r: -1.5 }, exit: "fade", fly: 0.5, seed: 6,
  });
  lift(ctx, H, {
    /* It leaves BEFORE the agreements screen lands, not after. Held to
       +0.3 it was still standing over the agreements paragraph, so a
       conversation card sat across a page about agreements for half a
       second: the hand-off read as a pile-up. */
    id: "messages", crop: THREAD_ROW, t0: w(6, "conversations") + 0.12, t1: w(6, "agreements") - 0.22,
    to: { x: CX, y: 1050, s: 0.62, r: 1.5 }, exit: "up", fly: 0.5, seed: 7,
  });
  popOut(ctx, keep, {
    kind: "counters", tab: "Kept with your account",
    items: [["heart", "Shortlist"], ["message-circle", "Conversations"], ["file-signature", "Agreements"]],
    x: CX, y: BAND - 10, t0: w(6, "stay") - 0.05, t1: w(6, "device") - 0.5, size: 28, from: "below", seed: 26,
  });
  ctx.hidePill(w(6, "stay") - 0.25, w(6, "device") - 0.45);
  /* ON EVERY DEVICE. The one place in this film where a second screen earns
     its keep: the web app beside the phone, the same account signed in on
     both, the window arriving as the phone drops away under it. */
  const W = windowRig(ctx);
  W.path([
    [w(6, "device") - 0.45, { x: 1210, y: 430, s: 0.44, opacity: 1 }],
    [w(6, "device") + 0.25, { x: 223, y: 430, s: 0.44, opacity: 1 }, "power3.out"],
    [s(7) - 0.5, { x: 223, y: 430, s: 0.44, opacity: 1 }],
    [s(7) - 0.12, { x: 1210, y: 430, s: 0.44, opacity: 1 }, "power3.in"],
    [s(7) - 0.04, { x: 1210, y: 430, s: 0.44, opacity: 0 }, "none"],
    [ctx.duration, { x: 1210, y: 430, s: 0.44, opacity: 0 }, "none"],
  ]);
  W.show("d-saved", w(6, "device") - 0.45, s(7) - 0.04, { enter: "cut" });

  /* ===================== 7. Or list your own place (s7) =====================
     CUT 6 -> 7. The bars close once more, into the gold. */
  shutter(ctx, s(7) - 0.05, { bars: 7, dur: 0.36 });
  ground(ctx, s(7) - 0.05, s(9) - 0.45, { tone: "gold", y: 28, seed: 17 });
  const host = layer("host", s(7) - 0.1, s(8) + 0.4);
  H.show("f-host-start", s(7) - 0.1, w(7, "workspace") - 0.25, { enter: "slide" });
  H.tap(w(7, "list") + 0.35, 660, 2360);
  /* the row the founder wants lifted, on its card's own edges */
  lift(ctx, H, {
    id: "f-host-start", crop: OWN_ROW, t0: w(7, "own") - 0.05, t1: w(7, "workspace") - 0.45,
    to: { x: CX, y: 700, s: 0.62, r: -2 }, exit: "fade", fly: 0.55, seed: 8,
  });
  H.show("f-host-home", w(7, "workspace") - 0.25, s(8) + 0.3, { enter: "slide" });
  popOut(ctx, host, {
    kind: "line", lucide: "arrow-left-right", tab: "The same account",
    title: "Looking and listing", line: "No second sign-in.",
    x: CX, y: BAND - 20, t0: w(7, "same") - 0.05, t1: s(8) - 0.3, size: 30, from: "below", seed: 27,
  });
  object3d(ctx, host, { name: "keys", size: 190, x: 135, y: 1290, t0: w(7, "place") - 0.2, t1: w(7, "workspace") - 0.2, drift: 1, seed: 18 });
  badgeDisc(ctx, host, { name: "list", kind: "object", x: 950, y: 1210, size: 130, t0: w(7, "own") + 0.25, t1: w(7, "workspace") - 0.2, seed: 19 });

  /* ===================== 8. One minute to start (s8) =====================
     The opening frame comes back: the minute, stroked, and the clock that
     stood beside it. A light leak carries the phone out of the film. */
  flash(ctx, s(8) - 0.08, { sound: "whoosh_short" });
  leak(ctx, s(8) - 0.02, { warm: true, dur: 0.9 });
  const last = layer("last", s(8) - 0.3, s(9) - 0.35, 770);
  figureOut(ctx, last, { text: "1:00", x: CX, y: 950, size: 340, rot: -3, t0: s(8) - 0.12, t1: s(9) - 0.62, seed: 28 });
  object3d(ctx, last, { name: "clock", size: 250, x: 830, y: 600, t0: s(8) + 0.18, t1: s(9) - 0.6, drift: 1, seed: 29 });
  object3d(ctx, last, { name: "id-check", size: 185, x: 205, y: 1330, t0: s(8) + 0.42, t1: s(9) - 0.6, drift: 1, seed: 30 });

  /* ===================== 9. The end card ===================== */
  ending(ctx, { t0: s(9) - 0.5, tLine: w(9, "Real") - 0.12, tBadges: e(9) + 0.15, tUrl: e(9) + 1.0, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: 0.5 });
}
