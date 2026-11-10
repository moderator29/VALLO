/**
 * VIDEO TWO, "The Vallo vision" (films/vision/timeline.json, 3:37), both formats.
 *
 * The same grammar as Video One: one phone carries the film through the live
 * product, now the tools behind it: the owner's "list it yourself", the host
 * desk (rooms, calendar, bookings, deposits), the agent workspace and Pro,
 * the passport, agreements and rent, the wallet and escrow, Local talk and
 * referral rewards; then the vision, Nigeria city by city, and the stores.
 * Claims and figures: FACTS-OCT.md and the founder's rulings of 14 October.
 */
import { nigeriaMap3d, poster, sceneBack, installFocus, sheet, noticeCard, flowRail, momentCard, listCard, proofCard, STAY_CARDS, listingWall, flagCard, anchors, ground, flash, hero, lift, headline, kicker, liveChip, numberCard, notify, chipRow, featureCard, ending, ringBurst, windowRig, nigeriaMap, ramp, during, place, popOut, figureOut, badgeDisc, object3d, slabWipe, shutter, irisTicks, tileFall, whipPan } from "../kit.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  const HOME = M ? { cx: 540, cy: 1075, height: 1380 } : { cx: 590, cy: 575, height: 940 };
  const LOW = M ? { cx: 540, cy: 1255, height: 1180 } : { cx: 560, cy: 585, height: 900 };
  const off = (p, dy = M ? 1750 : 1200) => ({ ...p, cy: p.cy + dy });
  const R = M
    ? { l1: { x: 255, y: 560 }, r1: { x: 825, y: 610 }, l2: { x: 250, y: 1010 }, r2: { x: 830, y: 1060 }, top: 410, cx: 540 }
    : { l1: { x: 1170, y: 330 }, r1: { x: 1580, y: 360 }, l2: { x: 1170, y: 700 }, r2: { x: 1580, y: 730 }, top: 210, cx: 1390 };
  const HX = M ? 60 : 1000;
  const TS = M ? 0.6 : 0.58;
  const RS = M ? 0.66 : 0.6;
  const ROW = (i) => ({ x: R.cx, y: (M ? [500, 730, 960, 1190] : [250, 450, 650, 850])[i] });
  const CHIPS_Y = M ? 1440 : 860;
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });
  const src = (id) => ctx.src.capture(id);

  H.path([
    [0, { ...off(HOME), opacity: 0, rx: 0, ry: 0, rz: 0 }],
    [s(4) - 0.9, { ...off(HOME), opacity: 1 }, "none"],
    [s(4) - 0.1, { ...HOME }, "power3.out"],
    [s(6) - 0.2, { ...HOME }],
    [s(6) + 0.5, { ...LOW }],
    [s(7) - 0.1, { ...LOW }],
    [s(7) + 0.5, { ...HOME }],
    [s(9) - 0.2, { ...HOME }],
    [s(9) + 0.5, { ...LOW }],
    [s(10) - 0.1, { ...LOW }],
    [s(10) + 0.5, { ...HOME }],
    /* the calendar: a push onto its nights */
    [w(10, "calendar") - 0.4, { ...HOME }],
    [w(10, "calendar") + 0.4, (M ? H.aim(660, 2150, 2000, 540, 900) : { ...HOME })],
    [w(10, "bookings") - 0.4, (M ? H.aim(660, 2150, 2000, 540, 900) : { ...HOME })],
    [w(10, "bookings") + 0.3, { ...HOME }],
    [s(14) - 0.2, { ...HOME }],
    [s(14) + 0.5, { ...LOW }],
    [s(16) - 0.3, { ...LOW }],
    [s(16) + 0.4, { ...HOME }],
    /* the promise: the phone leaves, the words carry it */
    [s(21) - 0.3, { ...HOME }],
    [s(21) + 0.4, { ...off(HOME), ry: -18 }, "power3.in"],
    [s(24) - 0.6, { ...off(HOME), ry: 16 }, "none"],
    [s(24) + 0.2, { ...HOME, ry: 0 }, "power3.out"],
    [w(27, "full") - 0.5, { ...HOME }],
    [w(27, "full") + 0.2, { ...LOW }],
    [s(28) - 0.1, { ...LOW }],
    [s(28) + 0.5, { ...HOME }],
    [s(31) - 0.2, { ...HOME }],
    [s(31) + 0.5, { ...LOW }],
    [s(33) - 0.2, { ...LOW }],
    [s(33) + 0.4, { ...HOME }],
    [s(38) - 0.6, { ...HOME }],
    [s(38) + 0.2, { ...off(HOME), rz: -8, ry: 20 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ]);

  H.swing(s(6) + 0.2, s(9) - 0.2, s(11) - 0.1, s(12) - 0.1, s(14) - 0.2, s(16) - 0.2, s(17) - 0.2, s(19) - 0.2, s(28) - 0.2, s(31) - 0.2);

  /* ===================== 1. A place to live, to stay, to meet ===================== */
  ground(ctx, 0, s(3) + 0.1, { tone: "navy", y: 40, seed: 31 });
  const open = layer("open", 0, s(2) + 0.2);
  /* the frame a chat shows before anyone presses play: composed at t = 0 */
  poster(ctx, open, {
    t1: s(1) - 0.15,
    scene: "step-4-dark",
    questions: ["A place to live", "A place to stay", "A place to meet"],
    size: ctx.isMobile ? 56 : 44,
    layout: {
      mobile: [[330, 404, -4, 520], [700, 604, 3, 520], [360, 800, -3, 520]],
      desktop: [[392, 330, -4, 420], [560, 500, 3, 420], [404, 670, -3, 420]],
    },
  });
  await nigeriaMap3d(ctx, open, { x: M ? 130 : 1050, y: M ? 880 : 250, w: M ? 820 : 740, t0: s(1) - 0.05, t1: s(2) - 0.3, tTrails: s(1) + 0.6, gap: 0.28, labels: true, cities: 6 });
  headline(ctx, open, { lines: [[["Every day, people", false]], [["across ", false], ["Nigeria", true]]], x: M ? 60 : 140, y: M ? 420 : 240, size: M ? 88 : 96, t0: s(1), t1: s(2) - 0.35, stagger: 0.05 });
  chipRow(ctx, open, { items: [["A place to live", "house"], ["to stay", "bed-double"], ["to meet", "utensils-crossed"]], x: M ? 540 : 140, y: M ? 1440 : 560, t0: w(1, "live") - 0.1, gap: w(1, "stay") - w(1, "live"), t1: s(2) - 0.35, size: M ? 34 : 34, anchor: M ? "center" : "left", wrapW: M ? 960 : 820 });
  ctx.hideCaptions(s(1) - 0.2, s(1) + 2.4);

  /* ===================== 2. Fake listings, hidden fees, strangers ===================== */
  /* the cut into the problems: a slab falls, and the three cards fall in behind it */
  slabWipe(ctx, s(2) - 0.1, { dir: "down", dur: 0.36 });
  ground(ctx, s(2) - 0.1, s(3) + 0.1, { tone: "gold", y: 50, seed: 32 });
  const prob = layer("problem", s(2) - 0.1, s(3) + 0.1);
  const probs = [
    { t: w(2, "fake"), icon: "image-off", title: "Fake listings", x: M ? 540 : 560, y: M ? 560 : 300, r: -4 },
    { t: w(2, "hidden"), icon: "eye-off", title: "Hidden fees", x: M ? 540 : 1000, y: M ? 860 : 520, r: 3 },
    { t: w(2, "money"), icon: "banknote", title: "Money sent to strangers", x: M ? 540 : 1440, y: M ? 1160 : 740, r: -2 },
  ];
  probs.forEach((p, i) => {
    const card = ctx.el("div", { class: "abs glass-dark", style: { left: "0px", top: "0px", display: "flex", alignItems: "center", gap: "26px", padding: M ? "34px 44px" : "28px 38px", borderRadius: "36px", border: "1.5px solid rgb(255 120 90 / 0.45)", font: `700 ${M ? 54 : 46}px/1 Poppins, Inter, sans-serif`, color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" } }, prob);
    const ic = ctx.icon(p.icon, { size: M ? 60 : 50, stroke: 2.2 }, card); ic.style.color = "#ff8a6b";
    ctx.el("span", { text: p.title }, card);
    during(ctx, s(2) - 0.1, s(3) + 0.1, (t) => {
      const a = ramp(ctx, t, p.t - 0.05, p.t + 0.45, "back.out(1.6)");
      const strike = ramp(ctx, t, s(3) - 0.15 + i * 0.06, s(3) + 0.05 + i * 0.06, "power3.in");
      const jit = t > p.t && t < p.t + 0.25 ? Math.sin(t * 90) * 6 : 0;
      place(card, { x: p.x + jit, y: p.y + (1 - a) * 50 - strike * 80, s: (0.85 + 0.15 * a) * (1 - 0.2 * strike), r: p.r * a, o: Math.min(ramp(ctx, t, p.t - 0.05, p.t + 0.1), 1 - strike) });
    });
    ctx.sfx("pop_low", p.t, { offset: -2 });
  });

  /* ===================== 3. We built Vallo to change that ===================== */
  /* the flash here was standing in for a cut: the brackets close on the mark instead */
  irisTicks(ctx, s(3) - 0.05, { dur: 0.46 });
  ground(ctx, s(3) - 0.05, s(6) + 0.6, { tone: "electric", y: 20, seed: 33 });
  const meet = layer("meet", s(3) - 0.05, s(4) + 0.3, 780);
  const mark = ctx.img(ctx.src.asset("logo-mark.png"), { class: "abs", style: { left: "0px", top: "0px", width: "280px", height: "280px", objectFit: "contain" } }, meet);
  during(ctx, s(3) - 0.05, s(4) + 0.3, (t) => {
    const a = ramp(ctx, t, s(3), s(3) + 0.55, "back.out(1.8)");
    const up = ramp(ctx, t, s(4) - 0.9, s(4) - 0.2, "power3.inOut");
    place(mark, { x: ctx.W / 2, y: (M ? 760 : 380) - up * 300, s: (0.3 + 0.7 * a) * (1 - 0.6 * up), r: (1 - a) * -40, o: ramp(ctx, t, s(3), s(3) + 0.15) * (1 - up) });
  });
  ringBurst(ctx, meet, { cx: ctx.W / 2, cy: M ? 760 : 380, r: 200, t: s(3) + 0.05, seed: 34 });
  headline(ctx, meet, { lines: [[["We built Vallo to ", false], ["change that.", true]]], x: ctx.W / 2, y: M ? 1010 : 600, size: M ? 70 : 76, t0: s(3) + 0.1, t1: s(4) - 0.9, align: "center" });
  ctx.sfx("impact_soft", s(3), { offset: 0 });
  ctx.hideCaptions(s(3) - 0.1, s(4) - 0.3);

  /* ===================== 4. One home for real estate ===================== */
  H.show("n-home2", s(4) - 1.0, w(5, "Homes") - 0.3, { enter: "cut", full: "n-home2-full", scroll: [[s(4) - 0.3, 0], [w(4, "home") - 0.2, 4570, "power3.inOut"]] });
  H.show("n-home-space", w(5, "Homes") - 0.3, w(5, "hotels") - 0.3, { enter: "rise", dur: 0.4 });
  /* every row a real card from the stays results: the drawn listing card cuts
     its own title with an ellipsis at any width (the founder, 16 October) */
  listingWall(ctx, layer("wall1", s(4) - 0.7, s(6), 3), { t0: s(4) - 0.6, t1: s(6) - 0.3, rows: M ? 5 : 3, opacity: 0.6, seed: 12, y: M ? 260 : 60, stays: STAY_CARDS(ctx), stayRows: [0, 1, 2, 3, 4] });
  lift(ctx, H, { id: "n-home2", src: ctx.src.capture("n-home2-full"), scrolled: 4570, crop: { x: 40, y: 5180, w: 1240, h: 1150 }, t0: w(4, "home") - 0.05, t1: w(5, "Homes") - 0.45, to: { x: M ? 290 : 1170, y: M ? 820 : 520, s: M ? 0.38 : 0.3, r: -5 }, seed: 9, radius: 60 });
  H.show("n-stays", w(5, "hotels") - 0.3, s(6) + 0.3, { enter: "slide" });
  if (M) {
    lift(ctx, H, { id: "n-home-space", crop: { x: 0, y: 1300, w: 1320, h: 390 }, t0: w(5, "Homes") + 0.25, t1: w(5, "one") - 0.2, to: { x: R.cx, y: 470, s: RS, r: -3 }, seed: 1 });
    lift(ctx, H, { id: "n-stays", crop: { x: 45, y: 1600, w: 590, h: 420 }, t0: w(5, "hotels"), t1: w(5, "one") - 0.15, to: { x: 800, y: 790, s: TS, r: 5 }, seed: 2 });
    lift(ctx, H, { id: "n-stays", crop: { x: 645, y: 1600, w: 630, h: 420 }, t0: w(5, "shortlets"), t1: w(5, "one") - 0.1, to: { x: 285, y: 1090, s: TS, r: -6 }, seed: 3 });
    /* off the chip row that lands under it on "one app" */
    lift(ctx, H, { id: "n-stays", crop: { x: 45, y: 2045, w: 590, h: 420 }, t0: w(5, "restaurants"), t1: w(5, "one") - 0.05, to: { x: 800, y: 1255, s: TS, r: 4 }, seed: 4 });
  } else {
    /* the desktop cut covers this ground on the site itself, beside the phone */
    const WS = windowRig(ctx);
    WS.path([
      [w(5, "Homes") - 0.5, { x: 2000, y: 170, s: 0.62, opacity: 1 }],
      [w(5, "Homes") + 0.3, { x: 960, y: 170, s: 0.62, opacity: 1 }, "power3.out"],
      [w(5, "one") - 0.45, { x: 960, y: 170, s: 0.62, opacity: 1 }],
      [w(5, "one") + 0.15, { x: 2000, y: 170, s: 0.62, opacity: 1 }, "power3.in"],
      [w(5, "one") + 0.25, { x: 2000, y: 170, s: 0.62, opacity: 0 }, "none"],
      [ctx.duration, { x: 2000, y: 170, s: 0.62, opacity: 0 }, "none"],
    ]);
    WS.show("d-n-home", w(5, "Homes") - 0.5, w(5, "one") + 0.25, { enter: "cut" });
    WS.show("d-n-stay", w(5, "shortlets") - 0.2, w(5, "one") + 0.25, { enter: "rise", dur: 0.6 });
  }
  const one = layer("one", s(4), s(6));
  kicker(ctx, one, { text: "One home for real estate in Nigeria", icon: "house", x: R.cx, y: CHIPS_Y, t0: w(4, "home") - 0.1, t1: w(5, "Homes") - 0.1, size: M ? 30 : 28, anchor: "center" });
  chipRow(ctx, one, { items: [["One app", "smartphone"], ["One account", "user-round-check"]], x: R.cx, y: CHIPS_Y, t0: w(5, "one"), gap: 0.5, t1: s(6) - 0.2, size: M ? 34 : 30, anchor: "center" });
  kicker(ctx, one, { text: "Featured listings", icon: "star", x: R.cx, y: M ? 296 : 200, t0: w(4, "home") + 0.1, t1: w(5, "Homes") - 0.2, size: M ? 32 : 28, anchor: "center" });
  kicker(ctx, one, { text: "The good ones don't wait", icon: "flame", x: R.cx, y: M ? 296 : 200, t0: w(5, "one") - 0.1, t1: s(6) - 0.2, size: M ? 34 : 30, anchor: "center" });

  /* ===================== 5. Owners: list it yourself ===================== */
  slabWipe(ctx, s(6) - 0.05, { dir: "left", dur: 0.4 });
  ground(ctx, s(6) - 0.05, s(9) + 0.3, { tone: "navy", y: 15, seed: 35 });
  const own = layer("owners", s(6) - 0.1, s(9));
  headline(ctx, own, { lines: [[["For owners and", false]], [["landlords", true]]], x: M ? R.cx : HX, y: M ? R.top : 180, size: M ? 74 : 76, t0: s(6), t1: s(7) - 0.3, align: M ? "center" : "left" });
  H.show("f-host-start", s(6) + 0.2, w(8, "photos") - 0.3, { enter: "slide" });
  H.tap(w(7, "List") - 0.15, 660, 2360);
  lift(ctx, H, { id: "f-host-start", crop: { x: 40, y: 2235, w: 1240, h: 260 }, t0: w(7, "List") + 0.1, t1: s(8) - 0.2, to: { ...ROW(0), s: RS * 1.05, r: -2 }, seed: 5 });
  liveChip(ctx, own, { text: "No agency fee", x: R.cx, y: CHIPS_Y, t0: w(7, "agency") - 0.1, t1: s(8) - 0.2, size: M ? 36 : 32, anchor: "center" });
  H.show("sc-listing", w(8, "photos") - 0.3, s(9) + 0.3, { enter: "slide" });
  chipRow(ctx, own, { items: [["Add your photos", "camera"], ["Set your price", "tag"], ["Ownership checked", "file-check-2"]], x: R.cx, y: M ? R.top : 200, t0: w(8, "photos"), gap: (w(8, "checked") - w(8, "photos")) / 2, t1: s(9) - 0.3, size: M ? 30 : 28, wrapW: M ? 980 : 860, anchor: "center" });
  lift(ctx, H, { id: "sc-listing", crop: { x: 60, y: 300, w: 1180, h: 770 }, t0: w(8, "photos") + 0.05, t1: w(8, "listing") - 0.2, to: { x: M ? 300 : 1160, y: M ? 820 : 560, s: M ? 0.36 : 0.3, r: -5 }, seed: 6 });
  lift(ctx, H, { id: "sc-listing", crop: { x: 30, y: 1170, w: 1260, h: 330 }, t0: w(8, "price") - 0.05, t1: w(8, "listing") - 0.15, to: { x: M ? 780 : 1600, y: M ? 1080 : 640, s: M ? 0.42 : 0.33, r: 4 }, seed: 7 });
  const seen = layer("seen", w(8, "Ownership", 2) - 0.3, s(9));
  const badge = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", display: "flex", alignItems: "center", gap: "22px", padding: M ? "30px 44px" : "26px 38px", borderRadius: "999px", background: "linear-gradient(150deg, #2f7cff, #003f98)", boxShadow: "0 30px 70px -20px rgb(0 60 200 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.3)", font: `700 ${M ? 50 : 44}px/1 Poppins, Inter, sans-serif`, color: "#fff", whiteSpace: "nowrap" } }, seen);
  const bi = ctx.icon("badge-check", { size: M ? 60 : 52, stroke: 2.2 }, badge); bi.style.color = "#fff";
  ctx.el("span", { text: "Ownership seen" }, badge);
  during(ctx, w(8, "Ownership", 2) - 0.3, s(9), (t) => {
    const a = ramp(ctx, t, w(8, "Ownership", 2) - 0.2, w(8, "Ownership", 2) + 0.4, "back.out(1.9)");
    const b = ramp(ctx, t, s(9) - 0.4, s(9) - 0.1, "power2.in");
    place(badge, { x: M ? 540 : 1390, y: M ? 820 : 520, s: 0.5 + 0.5 * a, r: (1 - a) * 12, o: Math.min(ramp(ctx, t, w(8, "Ownership", 2) - 0.2, w(8, "Ownership", 2)), 1 - b) });
  });
  ringBurst(ctx, seen, { cx: M ? 540 : 1390, cy: M ? 820 : 520, r: M ? 300 : 260, t: w(8, "Ownership", 2) + 0.05, seed: 36 });
  ctx.sfx("stamp", w(8, "Ownership", 2) + 0.05, { offset: -2 });

  /* ===================== 6. The host desk ===================== */
  /* the loudest cut in the film, into the widest gap in the voice */
  tileFall(ctx, s(9) - 0.05, { cols: 6, rows: 10, dur: 0.4, seed: 9 });
  ground(ctx, s(9) - 0.05, s(12) + 0.3, { tone: "dusk", y: 85, seed: 37 });
  const desk = layer("desk", s(9) - 0.1, s(12));
  listingWall(ctx, layer("hostwall", s(9) - 0.4, w(10, "wizard") + 0.6, 3), { t0: s(9) - 0.3, t1: w(10, "wizard"), rows: M ? 5 : 3, opacity: 0.5, seed: 22, y: M ? 260 : 60, stays: STAY_CARDS(ctx), stayRows: [0, 1, 2, 3, 4] });
  headline(ctx, desk, { lines: [[["Hosts get a ", false], ["full desk.", true]]], x: M ? R.cx : HX, y: M ? R.top : 200, size: M ? 84 : 80, t0: s(9), t1: s(10) - 0.2, align: M ? "center" : "left" });
  H.show("f-host-home", s(9) - 0.2, w(10, "wizard") - 0.2, { enter: "slide" });
  /* the rooms screen is gone before the calendar slides on: the two used to
     overlap, and the phone carried two status bars at once */
  H.show("f-host-rooms", w(10, "wizard") - 0.2, w(10, "calendar") - 0.75, { enter: "slide" });
  H.show("f-host-calendar", w(10, "calendar") - 0.05, w(10, "bookings") - 0.2, { enter: "slide", dur: 0.35 });
  H.show("f-host-bookings", w(10, "bookings") - 0.2, w(10, "earnings") - 0.2, { enter: "slide" });
  H.show("f-host-settings", w(10, "earnings") - 0.2, s(11) - 0.1, { enter: "slide" });
  H.tap(w(10, "wizard") - 0.35, 1033, 430);
  lift(ctx, H, { id: "f-host-rooms", crop: { x: 40, y: 1610, w: 1240, h: 400 }, label: "Rooms on sale", exit: "left", t0: w(10, "rooms") - 0.05, t1: w(10, "calendar") - 0.25, to: { x: R.cx, y: M ? 700 : 430, s: RS, r: -2 }, seed: 8 });
  H.tap(w(10, "calendar") - 0.4, 1270, 430);
  /* the rate row, lifted on its own edges and dropped back over the place it
     came from. The old crop stopped 2 px under "unless a night says
     otherwise" and sliced the line; this one carries the whole sentence.
     The pill goes while the phone fills the frame: the row rises through the
     band the pill sits in. */
  ctx.hidePill(w(10, "calendar") - 0.5, w(10, "bookings") + 0.1);
  lift(ctx, H, { id: "f-host-calendar", crop: { x: 32, y: 1336, w: 1260, h: 232 }, label: "Rates", t0: w(10, "night") - 0.3, t1: w(10, "bookings") - 0.2, to: M ? { ...ROW(0), s: RS, r: -2 } : { x: 1480, y: 175, s: RS * 0.8, r: -2 }, seed: 9 });
  lift(ctx, H, { id: "f-host-bookings", crop: { x: 40, y: 1425, w: 1240, h: 840 }, t0: w(10, "bookings") + 0.1, t1: w(10, "earnings") - 0.2, to: { x: R.cx, y: M ? 780 : 480, s: RS * 0.7, r: 2 }, seed: 10 });
  chipRow(ctx, desk, { items: [["Bookings", "calendar-check"], ["Reservations", "utensils"], ["Earnings", "wallet"]], x: R.cx, y: CHIPS_Y, t0: w(10, "bookings"), gap: (w(10, "earnings") - w(10, "bookings")) / 2, t1: w(10, "cancellation") - 0.3, size: M ? 32 : 28, anchor: "center" });
  /* on the business card's own rounded edges, and clear of the pill */
  lift(ctx, H, { id: "f-host-settings", crop: { x: 36, y: 1086, w: 1248, h: 650 }, t0: w(10, "place") - 0.3, t1: s(11) - 0.2, to: { ...ROW(0), y: M ? 600 : 330, s: RS * 0.85, r: -2 }, seed: 11 });
  /* the four desks live on four screens; nothing shows them in one place */
  popOut(ctx, desk, {
    kind: "counters", x: R.cx, y: M ? 1150 : 700, t0: w(10, "place") + 0.1, t1: s(11) - 0.2,
    size: M ? 34 : 28, from: "below", tab: "All in one place", seed: 4,
    items: [["layout-grid", "Rooms"], ["calendar-days", "Calendar"], ["calendar-check", "Bookings"], ["wallet", "Earnings"]],
  });
  kicker(ctx, desk, { text: "Cancellation rules you choose", icon: "calendar-x-2", x: R.cx, y: CHIPS_Y, t0: w(10, "cancellation") - 0.1, t1: s(11) - 0.2, size: M ? 32 : 28, anchor: "center" });
  if (!M) {
    const W = windowRig(ctx);
    W.path([
      [w(10, "calendar") - 0.3, { x: 1960, y: 300, s: 0.6, opacity: 1 }],
      [w(10, "calendar") + 0.4, { x: 1010, y: 300, s: 0.6, opacity: 1 }, "power3.out"],
      [w(10, "bookings") - 0.4, { x: 1010, y: 300, s: 0.6, opacity: 1 }],
      [w(10, "bookings") + 0.2, { x: 1960, y: 300, s: 0.6, opacity: 1 }, "power3.in"],
      [w(10, "bookings") + 0.3, { x: 1960, y: 300, s: 0.6, opacity: 0 }, "none"],
    ]);
    W.show("d-f-host-home", w(10, "calendar") - 0.3, w(10, "bookings") + 0.3, { enter: "cut" });
  }

  /* ===================== 7. Table deposits ===================== */
  H.show("f-host-reservations", s(11) - 0.1, s(12) + 0.3, { enter: "slide" });
  H.tap(s(11) + 0.8, 1029, 430);
  const dep = layer("deposits", s(11), s(12));
  /* the deposit rule, drawn: the crop of this sheet ended mid-sentence */
  sheet(ctx, dep, {
    icon: "credit-card",
    title: "Table deposits",
    body: ["Ask for a card deposit on the tables that matter most.", "It comes off the guest's bill, and it is yours if they do not come."],
    note: "You choose which tables ask for one.",
    x: R.cx, y: M ? 640 : 380, w: M ? 880 : 760, t0: w(11, "deposits") - 0.1, t1: s(12) - 0.2, size: M ? 38 : 32, anchor: "center",
  });
  liveChip(ctx, dep, { text: "Every reservation counts", x: R.cx, y: CHIPS_Y, t0: w(11, "counts") - 0.4, t1: s(12) - 0.2, size: M ? 34 : 30, anchor: "center" });
  /* the stage beside the rule is empty: one object drifts through it, half off the frame */
  object3d(ctx, dep, { name: "restaurant", size: M ? 230 : 190, x: M ? 40 : 150, y: M ? 1230 : 760, t0: w(11, "deposits") + 0.2, t1: s(12) - 0.4, drift: 1.1, seed: 51 });

  /* ===================== 8. Agents and firms ===================== */
  shutter(ctx, s(12) - 0.05, { bars: 7, dur: 0.34 });
  ground(ctx, s(12) - 0.05, s(14) + 0.3, { tone: "violet", y: 20, seed: 38 });
  const ag = layer("agents", s(12) - 0.1, s(14));
  headline(ctx, ag, { lines: [[["Agents and firms", false]], [["get their own ", false], ["tools.", true]]], x: M ? R.cx : HX, y: M ? 390 : 200, size: M ? 70 : 76, t0: s(12), t1: s(13) - 0.1, align: M ? "center" : "left", lineGap: 1.1 });
  H.show("f-agent-dashboard", s(12) - 0.1, w(13, "portfolio") - 0.2, { enter: "slide", full: "f-agent-dashboard-full", scroll: [[s(12) + 0.5, 0], [s(12) + 1.4, 1000]] });
  H.show("f-agent-dashboard", w(13, "portfolio") - 0.2, w(13, "analytics") - 0.2, { enter: "cut", full: "f-agent-dashboard-full", scroll: [[w(13, "portfolio") - 0.2, 1000], [w(13, "analytics") - 0.4, 1700]] });
  /* ONE row of the portfolio, on its own edges between the two hairlines, blown
     up and dropped back over the list. The old crop cut the title above it and
     the title below it. */
  lift(ctx, H, { id: "f-agent-dashboard", src: src("f-agent-dashboard-full"), crop: { x: 64, y: 2122, w: 836, h: 168 }, scrolled: 1000, t0: w(13, "portfolio"), t1: w(13, "analytics") - 0.2, to: { x: R.cx, y: M ? 620 : 340, s: M ? 0.85 : RS * 0.9, r: -2 }, seed: 13 });
  H.show("f-agent-analytics", w(13, "analytics") - 0.2, w(13, "Pro") - 0.3, { enter: "slide" });
  lift(ctx, H, { id: "f-agent-analytics", crop: { x: 30, y: 1500, w: 1260, h: 680 }, t0: w(13, "working") - 0.3, t1: w(13, "Pro") - 0.3, to: { x: R.cx, y: M ? 620 : 380, s: M ? 0.6 : 0.5, r: 2 }, seed: 27 });
  chipRow(ctx, ag, { items: [["Portfolio", "folder-kanban"], ["Analytics", "chart-column"], ["Firm desk", "building-2"]], x: R.cx, y: CHIPS_Y, t0: w(13, "portfolio"), gap: (w(13, "firm") - w(13, "portfolio")) / 2, t1: w(13, "Pro") - 0.3, size: M ? 32 : 28, anchor: "center" });
  H.show("f-pro", w(13, "Pro") - 0.3, s(14) + 0.3, { enter: "slide" });
  /* the Pro view card on its own rounded edges: the old crop cut its top chip and its foot */
  lift(ctx, H, { id: "f-pro", crop: { x: 206, y: 1092, w: 912, h: 672 }, t0: w(13, "Pro") + 0.1, t1: s(14) - 0.2, to: { x: R.cx, y: M ? 770 : 360, s: M ? 0.7 : 0.55, r: -3 }, seed: 14 });
  chipRow(ctx, ag, { items: [["Vallo Pro", "sparkles"], ["Vallo Business", "briefcase"]], x: R.cx, y: M ? 430 : 120, t0: w(13, "Pro"), gap: w(13, "Business") - w(13, "Pro"), t1: s(14) - 0.2, size: M ? 34 : 30, anchor: "center", wrapW: M ? 1000 : 860 });
  liveChip(ctx, ag, { text: "Free trial to start", x: R.cx, y: CHIPS_Y, t0: w(13, "free") - 0.1, t1: s(14) - 0.2, size: M ? 34 : 30, anchor: "center" });
  if (!M) {
    const W = windowRig(ctx);
    W.path([
      [w(13, "analytics") - 0.3, { x: 1960, y: 300, s: 0.6, opacity: 1 }],
      [w(13, "analytics") + 0.4, { x: 1010, y: 300, s: 0.6, opacity: 1 }, "power3.out"],
      [w(13, "Pro") - 0.5, { x: 1010, y: 300, s: 0.6, opacity: 1 }],
      [w(13, "Pro") + 0.1, { x: 1960, y: 300, s: 0.6, opacity: 1 }, "power3.in"],
      [w(13, "Pro") + 0.2, { x: 1960, y: 300, s: 0.6, opacity: 0 }, "none"],
    ]);
    W.show("d-f-agent-analytics", w(13, "analytics") - 0.3, w(13, "Pro") + 0.2, { enter: "cut" });
  }

  /* ===================== 9. A no-show, fairly ===================== */
  slabWipe(ctx, s(14) - 0.05, { dir: "right", dur: 0.4 });
  ground(ctx, s(14) - 0.05, s(16) + 0.3, { tone: "navy", y: 30, seed: 39 });
  H.show("sc-thread", s(14) - 0.2, s(16) + 0.3, { enter: "slide" });
  const fair = layer("fair", s(14) - 0.1, s(16));
  kicker(ctx, fair, { text: "Booked a viewing, didn't show", icon: "calendar-x", x: R.cx, y: M ? R.top : 200, t0: w(14, "viewing") - 0.1, t1: w(14, "report") - 0.2, size: M ? 30 : 28, anchor: "center" });
  featureCard(ctx, fair, { icon: "flag", title: "Report a no-show", line: "A person reads every report.", x: R.cx, y: M ? R.top - 30 : 170, w: M ? 860 : 700, t0: w(14, "report") - 0.1, t1: s(15) - 0.2, size: M ? 38 : 34, anchor: "center" });
  /* everything in this chapter is clear of the frame before the next cut lands:
     the brackets that carry it close on an empty stage, not on a pile-up */
  numberCard(ctx, fair, { value: 48, prefix: "", label: "hours for them to respond", x: R.cx, y: M ? 1280 : 560, t0: w(14, "forty-eight") - 0.1, t1: w(14, "forty-eight") + 0.7, tOut: s(16) - 0.6, size: M ? 120 : 110 });
  liveChip(ctx, fair, { text: "Fair for everyone", x: R.cx, y: M ? R.top : 200, t0: s(15) - 0.05, t1: s(16) - 0.45, size: M ? 36 : 32, anchor: "center" });
  /* the chapter stood on empty navy either side of the phone: three coins come
     in on "report" and go with the chapter, and the figure stands in the margin */
  if (M) {
    badgeDisc(ctx, fair, { name: "report-flag", kind: "object", x: 130, y: 760, size: 140, t0: w(14, "report") - 0.1, t1: s(16) - 0.9, seed: 52 });
    badgeDisc(ctx, fair, { name: "clock", kind: "object", x: 950, y: 760, size: 130, t0: w(14, "report") + 0.15, t1: s(16) - 0.9, seed: 53 });
    badgeDisc(ctx, fair, { name: "shield", kind: "object", x: 120, y: 1180, size: 150, t0: w(14, "report") + 0.4, t1: s(16) - 0.9, seed: 54 });
    figureOut(ctx, fair, { text: "48", x: 935, y: 1120, size: 140, rot: -5, t0: w(14, "forty-eight") - 0.05, t1: s(16) - 0.9, seed: 55 });
  }

  /* ===================== 10. The Vallo passport ===================== */
  irisTicks(ctx, s(16) - 0.05, { dur: 0.44 });
  ground(ctx, s(16) - 0.05, s(17) + 0.3, { tone: "electric", y: 25, seed: 40 });
  H.show("f-passport", s(16) - 0.2, s(17) + 0.2, { enter: "rise" });
  const pass = layer("passport", s(16) - 0.1, s(17));
  /* the passport, said in words: the lifted crop was the same card the phone
     already shows, dead centre over it, and its last row came out half cut */
  listCard(ctx, pass, {
    title: "What your passport carries",
    items: [
      ["Your verified details", "Your name, your role and when you joined, in one card."],
      ["Shared when you choose", "You decide who you show it to, and when."],
      ["Faster every time", "Applying for your next place does not start from nothing."],
    ],
    x: M ? 590 : 1330, y: M ? 1040 : 470, w: M ? 820 : 720, t0: w(16, "verified") - 0.1, t1: s(17) - 0.2, rot: -2, size: M ? 34 : 30, seed: 15, stagger: 0.22,
  });
  chipRow(ctx, pass, { items: [["Applying is faster", "zap"], ["You choose who sees it", "eye"]], x: R.cx, y: CHIPS_Y, t0: w(16, "faster") - 0.2, gap: w(16, "choose") - w(16, "faster"), t1: s(17) - 0.2, size: M ? 30 : 28, anchor: "center", wrapW: M ? 980 : 860 });

  /* ===================== 11. Tenancy file, agreements, rent ===================== */
  slabWipe(ctx, s(17) - 0.05, { dir: "up", dur: 0.38 });
  ground(ctx, s(17) - 0.05, s(19) + 0.3, { tone: "emerald", y: 20, seed: 41 });
  H.show("f-agreements", s(17) - 0.2, s(19) + 0.3, { enter: "slide" });
  const ten = layer("tenancy", s(17) - 0.1, s(19));
  chipRow(ctx, ten, { items: [["Tenancy file", "folder-open"], ["Agreement", "file-signature"], ["Records", "archive"]], x: R.cx, y: M ? R.top : 200, t0: w(17, "tenancy") - 0.1, gap: (w(17, "records") - w(17, "tenancy")) / 2, t1: s(18) + 1.0, size: M ? 30 : 28, anchor: "center", wrapW: M ? 980 : 860 });
  listCard(ctx, ten, {
    title: "When your rent payment opens",
    items: [
      ["The inspection report is in", "And you have both confirmed the agreement."],
      ["Escrow opens straight away", "A direct payment waits only when the deal needs a second look."],
    ],
    x: M ? 540 : 1330, y: M ? 700 : 380, w: M ? 880 : 740, t0: w(18, "approved") - 0.2, t1: w(18, "reminds") - 0.25, rot: -1, size: M ? 35 : 30, seed: 16,
  });
  kicker(ctx, ten, { text: "Pay your rent in the app", icon: "house", x: R.cx, y: CHIPS_Y, t0: w(18, "rent") - 0.15, t1: w(18, "reminds") - 0.1, size: M ? 32 : 28, anchor: "center" });
  /* gone before the next chapter's brackets close */
  noticeCard(ctx, ten, { object: "bell", title: "Rent due in 7 days", line: "Your tenancy, and Vallo reminds you first.", x: M ? 540 : 1330, y: M ? 1150 : 660, w: M ? 860 : 720, t0: w(18, "reminds") - 0.05, t1: s(19) - 0.6, size: M ? 36 : 32, seed: 17, from: "below" });

  /* ===================== 12. Wallet and escrow ===================== */
  irisTicks(ctx, s(19) - 0.05, { dur: 0.42 });
  ground(ctx, s(19) - 0.05, s(21) + 0.2, { tone: "electric", y: 18, seed: 42 });
  const WALLET_PATCH = [{ x: 274, y: 2128, w: 870, h: 66, bg: "rgb(5 11 32)", size: 46, weight: 600, lh: 1.3, color: "rgb(222 227 255)", lines: ["Open your account with our partner"] }];
  H.show("n-wallet", s(19) - 0.2, s(20) + 0.2, { enter: "slide", patch: WALLET_PATCH });
  H.show("f-agreements", s(20) + 0.2, s(21) + 0.3, { enter: "fade", dur: 0.3 });
  const wal = layer("wallet", s(19) - 0.1, s(21));
  H.tap(w(19, "add") - 0.3, 1188, 2508);
  /* the step card on its own rounded edges */
  lift(ctx, H, { id: "n-wallet", crop: { x: 34, y: 2394, w: 1252, h: 340 }, t0: w(19, "add") - 0.05, t1: s(20) - 0.2, to: { x: R.cx, y: M ? 700 : 420, s: RS, r: -2 }, seed: 17 });
  /* above the card, not across it */
  chipRow(ctx, wal, { items: [["Add money", "plus"], ["Pay", "credit-card"], ["Send", "send"], ["Withdraw", "arrow-down-to-line"]], x: R.cx, y: M ? R.top + 20 : 520, t0: w(19, "add"), gap: (w(19, "withdraw") - w(19, "add")) / 3, t1: s(20) - 0.2, size: M ? 32 : 28, anchor: "center", wrapW: M ? 980 : 860 });


  featureCard(ctx, wal, { icon: "shield-check", title: "Protected payment", line: "Your money waits in escrow until the deal is done.", x: R.cx, y: M ? 1250 : 380, w: M ? 900 : 760, t0: w(20, "Protected") - 0.1, t1: s(21) - 0.2, size: M ? 38 : 34, anchor: "center" });
  ctx.sfx("lock_click", w(20, "escrow"), { offset: -2 });

  /* ===================== 13. The promise ===================== */
  shutter(ctx, s(21) - 0.05, { bars: 9, dur: 0.38 });
  ground(ctx, s(21) - 0.05, s(22) - 0.25, { tone: "navy", y: 45, seed: 43, sparkle: 8 });
  const pr = layer("promise", s(21) - 0.05, s(24) + 0.1, 800);
  const size = M ? 84 : 84;
  /* the cut's own promise: the one headline that takes the blueprint's chip */
  headline(ctx, pr, { lines: [[["Here's the ", false], ["promise.", true]]], x: ctx.W / 2, y: M ? 720 : 400, size: size * 1.2, t0: s(21), t1: s(22) - 0.45, align: "center", keyStyle: "chip" });
  /* daylight, and one line at a time in one slot: the four stacked headlines
     used to print over each other as they changed */
  const DAY0 = s(22) - 0.35;
  const DAY1 = s(24) - 0.12;
  /* light only, inside the chapter, on the phone's own exit: daylight arrives under it */
  whipPan(ctx, DAY0, { dir: "left", dur: 0.24 });
  ground(ctx, DAY0, DAY1, { tone: "day", y: 40, seed: 44, sparkle: 0, z: 2 });
  const SLOT = { x: M ? 70 : ctx.W / 2, y: M ? 300 : 150, align: M ? "left" : "center", color: "#0b1230", key: "#0069fe", sheen: false };
  headline(ctx, pr, { ...SLOT, lines: [[["All funds,", true]], [["in your wallet,", false]], [["in escrow,", false]], [["in every payment,", false]]], size, t0: s(22), t1: w(22, "held") - 0.4, stagger: 0.045 });
  headline(ctx, pr, { ...SLOT, lines: [[["held by our", false]], [["licensed provider.", true]]], size, t0: w(22, "held") - 0.05, t1: s(23) - 0.35, stagger: 0.07 });
  /* the ink has to be gone before the paper is: left a moment longer it
     was dark blue on dark navy */
  headline(ctx, pr, { ...SLOT, lines: [[["Vallo never holds", false]], [["your ", false], ["money.", true]]], size, t0: s(23), t1: s(24) - 1.05, stagger: 0.05 });
  /* the three places the voice names, in one row, before the rail draws the
     route: the promise is the one thing no screen shows in one place */
  popOut(ctx, pr, {
    kind: "counters", x: M ? 560 : ctx.W / 2, y: M ? 760 : 760, t0: s(22) + 0.45, t1: w(22, "held") - 0.25,
    size: M ? 34 : 28, from: "below", tone: "day", tab: "Held by our licensed provider", seed: 6,
    items: [["wallet", "Your wallet"], ["lock", "Escrow"], ["receipt", "Every payment"]],
  });
  flowRail(ctx, pr, {
    steps: ["Your card", "Our licensed provider", "The owner's bank"],
    x: M ? 170 : 660, y: M ? 880 : 540, gap: M ? 250 : 168, size: M ? 44 : 36,
    t0: w(22, "held") + 0.1, t1: s(24) - 0.45, seed: 45,
  });
  if (M) {
    /* the blueprint's coins, on the one stage with room for them */
    badgeDisc(ctx, pr, { name: "card-secure", kind: "object", x: 960, y: 900, size: 140, t0: s(22) + 0.6, t1: s(24) - 0.6, seed: 56 });
    badgeDisc(ctx, pr, { name: "bank", kind: "object", x: 900, y: 1250, size: 130, t0: w(22, "escrow") - 0.1, t1: s(24) - 0.6, seed: 57 });
    badgeDisc(ctx, pr, { name: "shield", kind: "object", x: 130, y: 1700, size: 130, t0: w(22, "payment") - 0.1, t1: s(24) - 0.6, seed: 58 });
    object3d(ctx, pr, { name: "pay", size: 240, x: 1010, y: 1580, t0: w(22, "escrow") - 0.3, t1: s(24) - 0.6, drift: 1.2, seed: 59 });
  }
  ctx.sfx("stamp", w(23, "never") + 0.05, { offset: 0 });
  ctx.hideCaptions(s(21) - 0.1, s(24) - 0.3);
  ctx.hidePill(s(21) - 0.2, s(24) - 0.1);

  /* ===================== 14. Trust at every step ===================== */
  /* the white paper breaks up and drops away into the night again */
  tileFall(ctx, s(24) - 0.05, { cols: 6, rows: 10, dur: 0.34, seed: 14 });
  ground(ctx, s(24) - 0.05, s(28) + 0.3, { tone: "electric", y: 25, seed: 45 });
  sceneBack(ctx, ctx.scene("trust-back", s(24) - 0.3, s(26) + 0.5, { z: 3 }), { scene: "step-2-dark", t0: s(24), t1: s(26) - 0.1, opacity: 0.40 });
  H.show("sc-verification", s(24) - 0.6, w(26, "flagged") - 0.4, { enter: "cut" });
  H.show("sc-listing-cost", w(27, "full") - 0.4, s(28) + 0.3, { enter: "slide" });
  H.show("sc-thread", w(26, "flagged") - 0.4, w(27, "full") - 0.4, { enter: "slide" });
  const tr = layer("trust", s(24) - 0.1, s(28));
  kicker(ctx, tr, { text: "Trust, built into every step", icon: "shield", x: R.cx, y: M ? R.top : 200, t0: s(24), t1: s(25) - 0.1, size: M ? 32 : 28, anchor: "center" });
  /* each step on the step card's own rounded edges: the second crop used to
     stop halfway through "a reachable contact at it." */
  const steps = [
    { crop: { x: 168, y: 916, w: 1120, h: 378 }, y: M ? 520 : 260 },
    { crop: { x: 168, y: 1302, w: 1120, h: 442 }, y: M ? 820 : 470 },
  ];
  steps.forEach((st, i) => lift(ctx, H, { id: "sc-verification", crop: st.crop, t0: s(25) + i * 0.5, t1: w(26, "flagged") - 0.5, to: { x: R.cx + (i ? 16 : -16), y: st.y, s: RS, r: i ? 1.5 : -1.5 }, seed: 21 + i }));
  liveChip(ctx, tr, { text: "Checked by a real person", x: R.cx, y: CHIPS_Y, t0: w(25, "person") - 0.2, t1: w(26, "flagged") - 0.4, size: M ? 32 : 28, anchor: "center" });
  const fc = flagCard(ctx, tr, M);
  during(ctx, s(24) - 0.1, s(28), (t) => {
    const a = ramp(ctx, t, w(26, "flagged") - 0.35, w(26, "flagged") + 0.25, "back.out(1.5)");
    const b = ramp(ctx, t, s(27) - 0.3, s(27), "power2.in");
    place(fc, { x: R.cx, y: (M ? 760 : 520) + (1 - a) * 60, s: 0.94 + 0.06 * a, o: Math.min(ramp(ctx, t, w(26, "flagged") - 0.35, w(26, "flagged") - 0.1), 1 - b) });
  });
  ctx.sfx("stamp", w(26, "flagged"), { offset: -3 });
  numberCard(ctx, tr, { value: 26100000, label: "The full cost, before anyone pays", x: R.cx, y: M ? R.top : 300, t0: w(27, "full") - 0.1, t1: w(27, "full") + 1.2, tOut: s(28) - 0.2, size: M ? 92 : 84 });
  ctx.hidePill(w(27, "full") - 0.3, s(28) - 0.1);

  /* ===================== 15. Community: Local talk ===================== */
  slabWipe(ctx, s(28) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(28) - 0.05, s(31) + 0.3, { tone: "violet", y: 25, seed: 46 });
  H.show("f-around", s(28) - 0.2, s(31) + 0.3, { enter: "slide" });
  const com = layer("community", s(28) - 0.1, s(31));
  headline(ctx, com, { lines: [[["Vallo is also a ", false], ["community.", true]]], x: M ? R.cx : HX, y: M ? R.top : 200, size: M ? 68 : 72, t0: s(28), t1: s(29) - 0.1, align: M ? "center" : "left" });
  lift(ctx, H, { id: "f-around", crop: { x: 40, y: 1260, w: 1240, h: 1060 }, t0: w(29, "neighbourhood") - 0.2, t1: w(30, "stories") - 0.3, to: { x: R.cx, y: M ? 700 : 450, s: M ? 0.56 : 0.48, r: -2 }, seed: 23 });
  H.tap(w(30, "stories") - 0.1, 390, 780);
  /* in from the left edge: at x 255 the card hung off the frame */
  lift(ctx, H, { id: "f-around", crop: { x: 30, y: 660, w: 560, h: 320 }, t0: w(30, "stories") + 0.25, t1: s(31) - 0.85, to: { ...R.l1, x: M ? 320 : R.l1.x, s: M ? 0.85 : 0.7, r: -4 }, seed: 24 });
  chipRow(ctx, com, { items: [["Local talk", "messages-square"], ["Stories", "circle-play"], ["Follow", "user-plus"], ["What's new around you", "map-pin"]], x: R.cx, y: CHIPS_Y - (M ? 60 : 0), t0: w(29, "Local"), gap: (w(30, "new") - w(29, "Local")) / 3, t1: s(31) - 0.55, size: M ? 28 : 26, wrapW: M ? 980 : 860, anchor: "center" });
  if (!M) {
    const W = windowRig(ctx);
    W.path([
      [w(30, "follow") - 0.4, { x: 1960, y: 300, s: 0.6, opacity: 1 }],
      [w(30, "follow") + 0.3, { x: 1010, y: 300, s: 0.6, opacity: 1 }, "power3.out"],
      [s(31) - 0.5, { x: 1010, y: 300, s: 0.6, opacity: 1 }],
      [s(31) + 0.1, { x: 1960, y: 300, s: 0.6, opacity: 1 }, "power3.in"],
      [s(31) + 0.2, { x: 1960, y: 300, s: 0.6, opacity: 0 }, "none"],
    ]);
    W.show("d-f-around", w(30, "follow") - 0.4, s(31) + 0.2, { enter: "cut" });
  }

  /* ===================== 16. Referral rewards ===================== */
  /* the flash was the cut: the brackets close and bloom gold instead */
  irisTicks(ctx, s(31) - 0.05, { dur: 0.46 });
  ground(ctx, s(31) - 0.05, s(38) + 0.3, { tone: "gold", y: 25, seed: 47 });
  const rw = layer("rewards", s(31) - 0.1, s(38));
  headline(ctx, rw, { lines: [[["Referral rewards", false]], [["are ", false], ["live.", true]]], x: M ? R.cx : HX, y: M ? 390 : 200, size: M ? 78 : 80, t0: w(31, "referral") - 0.1, t1: s(32) + 0.6, align: M ? "center" : "left", lineGap: 1.1 });
  liveChip(ctx, rw, { text: "Live now", x: R.cx, y: CHIPS_Y, t0: w(31, "live") - 0.1, t1: s(33) - 0.2, size: M ? 36 : 32, anchor: "center" });
  H.show("f-rewards", s(31) - 0.2, w(34, "friend") - 0.3, { enter: "rise" });
  H.show("f-rewards-how", w(34, "friend") - 0.3, w(36, "withdraw") - 0.3, { enter: "rise" });
  H.show("f-rewards-withdraw", w(36, "withdraw") - 0.3, s(38) + 0.3, { enter: "slide" });
  kicker(ctx, rw, { text: "Share your invite link", icon: "link", x: R.cx, y: M ? 430 : 190, t0: w(33, "invite") - 0.3, t1: w(34, "earn") - 0.4, size: M ? 34 : 30, anchor: "center" });
  ctx.sfx("bubble_send", w(33, "link"), { offset: -3 });
  /* the Rewards card on its own rounded edges: the old crop cut its top rule off */
  lift(ctx, H, { id: "f-rewards-how", crop: { x: 150, y: 1010, w: 1024, h: 482 }, label: "What a referral pays", t0: w(34, "verified") - 0.1, t1: s(35) + 0.8, to: { x: R.cx, y: M ? 740 : 430, s: M ? 0.68 : 0.62, r: -3 }, seed: 25 });
  numberCard(ctx, rw, { value: 80, label: "for each friend who joins and gets verified", x: R.cx, y: CHIPS_Y - (M ? 180 : 140), t0: w(34, "earn") - 0.05, t1: w(34, "earn") + 0.6, tOut: s(35) + 1.0, size: M ? 110 : 96 });
  kicker(ctx, rw, { text: "Ready after 7 days", icon: "clock", x: R.cx, y: M ? 430 : 190, t0: w(35, "seven") - 0.1, t1: s(36) - 0.1, size: M ? 34 : 30, anchor: "center" });
  numberCard(ctx, rw, { value: 1000, label: "withdraw it straight to your bank", x: R.cx, y: M ? R.top - 30 : 170, t0: w(36, "thousand") - 0.1, t1: w(36, "thousand") + 0.6, tOut: s(37) - 0.2, size: M ? 96 : 88 });
  /* the withdrawal rule in words: the lift of this screen was a hard-edged
     slice of the very message the phone was already showing */
  listCard(ctx, rw, {
    title: "Withdrawing your rewards",
    items: [
      ["Withdraw at ₦1,000", "Your rewards balance has to reach ₦1,000 first."],
      ["Straight to your bank", "Your rewards go out to your own bank account."],
    ],
    x: R.cx, y: M ? 1075 : 640, w: M ? 860 : 720, t0: w(36, "withdraw") - 0.3, t1: s(37) - 0.15, rot: 2, size: M ? 34 : 30, seed: 26, stagger: 0.16,
  });
  /* the two figures sit on two different screens: this is the only place they meet */
  popOut(ctx, rw, {
    kind: "cells", x: R.cx, y: M ? 780 : 460, t0: s(37) - 0.1, t1: s(38) - 0.4,
    size: M ? 34 : 28, from: "below", tab: "Rewards", lucide: "coins", title: "What you earn",
    cells: [["Each referral", "₦80"], ["Withdraw at", "₦1,000"]], seed: 7,
  });
  /* in the margin beside the container, never over the phone's screen */
  if (M) figureOut(ctx, rw, { text: "₦80", x: 120, y: 780, size: 100, rot: -6, t0: s(37) + 0.15, t1: s(38) - 0.5, seed: 60 });
  chipRow(ctx, rw, { items: [["Invite", "send"], ["They join", "user-plus"], ["You earn", "coins"]], x: R.cx, y: CHIPS_Y, t0: s(37), gap: 0.35, t1: s(38) - 0.3, size: M ? 34 : 30, anchor: "center" });
  ringBurst(ctx, rw, { cx: R.cx, cy: M ? 900 : 540, r: M ? 360 : 300, t: w(37, "earn", 1) + 0.1, seed: 48 });

  /* ===================== 17. The beginning ===================== */
  slabWipe(ctx, s(38) - 0.05, { dir: "up", dur: 0.42 });
  ground(ctx, s(38) - 0.05, s(42) + 0.2, { tone: "navy", y: 40, seed: 49, sparkle: 10 });
  const vis = layer("vision", s(38) - 0.1, s(42), 800);
  headline(ctx, vis, { lines: [[["This is just the ", false], ["beginning.", true]]], x: ctx.W / 2, y: M ? 820 : 440, size: M ? 78 : 92, t0: s(38), t1: s(39) - 0.1, align: "center" });
  headline(ctx, vis, { lines: [[["The infrastructure", false]], [["for how Nigeria", false]]], x: M ? 60 : 160, y: M ? 430 : 180, size: M ? 80 : 88, t0: w(39, "infrastructure") - 0.1, t1: s(40) - 0.3, stagger: 0.07 });
  const verbs = [["finds", "search"], ["understands", "lightbulb"], ["pays for", "credit-card"], ["runs", "settings-2"]];
  verbs.forEach(([v, ic], i) => {
    const t = w(39, v.split(" ")[0]);
    featureCard(ctx, vis, { icon: ic, title: `${v[0].toUpperCase()}${v.slice(1)}`, line: null, x: M ? 60 + (i % 2) * 500 : 160 + i * 400, y: M ? 720 + Math.floor(i / 2) * 210 : 470, w: M ? 460 : 360, t0: t - 0.1, t1: s(40) - 0.3 + i * 0.04, size: M ? 44 : 40 });
  });
  if (M) {
    /* the verbs stand on empty navy for six seconds: coins at the edges and one
       object running off the frame give the stage something to do */
    badgeDisc(ctx, vis, { name: "search", kind: "object", x: 140, y: 270, size: 130, tone: "paper", t0: w(39, "infrastructure") - 0.1, t1: s(40) - 0.4, seed: 61 });
    badgeDisc(ctx, vis, { name: "keys", kind: "object", x: 150, y: 1330, size: 150, t0: w(39, "how") - 0.1, t1: s(40) - 0.4, seed: 62 });
    badgeDisc(ctx, vis, { name: "analytics", kind: "object", x: 930, y: 1300, size: 140, t0: w(39, "Nigeria") - 0.1, t1: s(40) - 0.4, seed: 63 });
    object3d(ctx, vis, { name: "city", size: 250, x: 1055, y: 330, t0: w(39, "infrastructure") - 0.2, t1: s(40) - 0.4, drift: 1.15, seed: 64 });
  }
  ctx.el("div", {}, vis);
  /* every home, every room, every table: three real photographs from the screens */
  const photos = [
    { id: "sc-listing", crop: { x: 60, y: 300, w: 1180, h: 770 }, word: "home", x: M ? 300 : 520, y: M ? 600 : 420, r: -6 },
    { id: "f-stay-checkout", crop: { x: 0, y: 200, w: 1320, h: 860 }, word: "room", x: M ? 780 : 960, y: M ? 820 : 470, r: 4 },
    /* lower on this screen: the old crop carried the empty photo state over the picture */
    { id: "sc-restaurant", crop: { x: 0, y: 730, w: 1320, h: 890 }, word: "table", x: M ? 360 : 1400, y: M ? 1080 : 420, r: -3 },
  ];
  photos.forEach((p, i) => {
    const t0 = w(40, p.word) - 0.1;
    const body = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${p.crop.w * (M ? 0.42 : 0.33)}px`, height: `${p.crop.h * (M ? 0.42 : 0.33)}px`, borderRadius: "34px", overflow: "hidden", boxShadow: "0 40px 80px -26px rgb(0 0 20 / 0.85), 0 0 0 1.5px rgb(143 211 255 / 0.25)" } }, vis);
    const S = M ? 0.42 : 0.33;
    ctx.img(ctx.src.display(p.id), { style: { position: "absolute", left: `${-p.crop.x * S}px`, top: `${-p.crop.y * S}px`, width: `${1320 * S}px`, height: `${2868 * S}px`, maxWidth: "none" } }, body);
    body.style.visibility = "hidden";
    during(ctx, s(38) - 0.1, s(42), (t) => {
      const a = ramp(ctx, t, t0, t0 + 0.6, "back.out(1.5)");
      const b = ramp(ctx, t, s(41) - 0.5 + i * 0.05, s(41) - 0.1 + i * 0.05, "power2.in");
      place(body, { x: p.x, y: p.y + (1 - a) * 80 + Math.sin(t * 1.8 + i) * 6, s: 0.8 + 0.2 * a, r: p.r * a, o: Math.min(ramp(ctx, t, t0, t0 + 0.15), 1 - b) });
    });
    ctx.sfx("card_slide", t0, { offset: -4 });
  });
  chipRow(ctx, vis, { items: [["Real people", "users"], ["Real prices", "tag"], ["Real trust", "shield-check"]], x: R.cx, y: CHIPS_Y - (M ? 120 : 140), t0: w(40, "people") - 0.1, gap: (w(40, "trust") - w(40, "people")) / 2, t1: s(41) - 0.2, size: M ? 34 : 30, anchor: "center" });
  listingWall(ctx, layer("wall2", s(40) - 0.6, s(41) + 0.2, 795), { t0: s(40) - 0.5, t1: s(41) - 0.4, rows: M ? 6 : 4, opacity: 0.55, seed: 13, tilt: -11, speed: 70, y: M ? 120 : 20, stays: STAY_CARDS(ctx), stayRows: [0, 1, 2, 3, 4, 5] });
  const map2 = layer("map2", s(41) - 0.3, s(42), 790);
  await nigeriaMap3d(ctx, map2, { x: M ? 90 : 600, y: M ? 600 : 170, w: M ? 900 : 720, t0: s(41) - 0.3, t1: s(42) - 0.3, tTrails: w(41, "city") - 0.4, gap: 0.24, labels: true });
  headline(ctx, map2, { lines: [[["Vallo is ", false], ["growing.", true]]], x: ctx.W / 2, y: M ? 1300 : 780, size: M ? 76 : 72, t0: w(41, "growing") - 0.2, t1: s(42) - 0.3, align: "center" });
  ctx.hideCaptions(s(38) - 0.1, s(39) + 0.4);

  /* ===================== 18. The end card ===================== */
  ending(ctx, { t0: s(42), tLine: s(43) - 0.05, tBadges: s(44) - 0.1, tUrl: s(45) + 0.4, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx);
  void e;
}
