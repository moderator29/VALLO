/**
 * VIDEO TWO ON A DESKTOP (films/vision/timeline.json, 3:37, 1920 x 1080).
 *
 * The desktop cut is its own film, the way Video One's desktop cut is. There
 * is no phone in it: the hero is a browser window on vallospaces.com carrying
 * the real desktop pages captured on 14 October, with a cursor that clicks and
 * a home page that scrolls. The tools behind the product are shown on the site
 * itself, and the parts the film holds up are either lifted off those pages or
 * drawn from scratch on white paper.
 *
 * It tells the same story as the phone cut, in the same order and with the
 * same words: the opening map, the promise on daylight, the map again for
 * "across Nigeria", the end card. Every figure comes from vision/main.js.
 *
 * Grammar (Video One's, kept)
 *   SIDE   the window left, a column of parts on the right
 *   FULL   the window taking the frame
 *   RIGHT  the window right, the words to its left
 *   OFF    away to the right, for the typographic beats
 *
 * The 16 October upgrade (films/UPGRADE.md), in this cut
 *   CUTS       fourteen, one on every ground handover, marked CUT 1..14 below.
 *              slabWipe six (left, up, right, down, left, right), irisTicks
 *              four, shutter two and tileFall two; the two loud kinds sit in
 *              the four longest silences, and no two cuts in a row are alike.
 *              The opening second is the founder's frame and carries nothing.
 *   LIFTS      twelve windowLifts, each cropped on the component's own edges
 *              (section 6). Chapter 8's Table deposits rule is the frame the
 *              founder sent back, and it now comes up as the page's own panel.
 *   CONTAINERS three popOuts, only where the page never shows the thing in one
 *              place, and eight badgeDiscs in two sets of four.
 */
import {
  poster, installFocus, sceneBack, nigeriaMap3d, windowLift, listCard, noticeCard,
  proofCard, flowRail, listingWall, STAY_CARDS, flagCard, anchors, ground, headline,
  kicker, liveChip, numberCard, chipRow, featureCard, ending, ringBurst, windowRig,
  popOut, badgeDisc, object3d, slabWipe, shutter, irisTicks, tileFall,
  ramp, during, place, mix,
} from "../kit.js";

export async function build(ctx) {
  const { s, w } = anchors(ctx);
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });

  /* ---------- the window's poses ---------- */
  const SIDE = { x: 54, y: 150, s: 0.84, opacity: 1 };
  /* lower than Video One's FULL: Video Two carries a chapter pill at the top
     centre for most of its length, and the window's title bar sat under it */
  const FULL = { x: 298, y: 124, s: 0.92, opacity: 1 };
  const OFF = { x: 2120, y: 168, s: 0.80, opacity: 1 };
  const RIGHT = { x: 900, y: 230, s: 0.66, opacity: 1 };
  const GONE = { ...OFF, opacity: 0 };
  /* the column of parts, to the right of the window in SIDE */
  const COL = 1578;
  const HX = 170; // a headline's left edge when the window is away or right

  const W = windowRig(ctx);
  W.path([
    [0, { ...GONE }],
    [s(4) - 0.7, { ...GONE }],
    [s(4) - 0.2, { ...RIGHT }, "power3.out"],
    [w(5, "Homes") - 0.35, { ...RIGHT }],
    [w(5, "Homes") + 0.05, { ...FULL }, "power3.inOut"],
    [w(5, "restaurants") - 0.5, { ...FULL }],
    [w(5, "restaurants") - 0.1, { ...SIDE }, "power3.inOut"],
    [s(6) - 0.5, { ...SIDE }],
    [s(6) - 0.1, { ...GONE }, "power3.in"],
    /* back while the line is still on "one simple choice": the page the
       owner chooses from is the choice, and the frame never sits bare */
    [s(7) - 1.25, { ...GONE }],
    [s(7) - 0.85, { ...SIDE }, "power3.out"],
    [s(9) - 0.6, { ...SIDE }],
    [s(9) - 0.2, { ...RIGHT }, "power3.inOut"],
    [s(10) - 0.3, { ...RIGHT }],
    [s(10) + 0.1, { ...SIDE }, "power3.inOut"],
    [s(12) - 0.6, { ...SIDE }],
    [s(12) - 0.2, { ...RIGHT }, "power3.inOut"],
    [s(13) - 0.3, { ...RIGHT }],
    [s(13) + 0.1, { ...SIDE }, "power3.inOut"],
    /* the promise: the window leaves, the words carry it */
    [s(21) - 0.5, { ...SIDE }],
    [s(21) - 0.1, { ...GONE }, "power3.in"],
    /* the window waits for the white to go: sliding in over the paper put a
       grey rectangle on the promise */
    [s(24) + 0.08, { ...GONE }],
    [s(24) + 0.6, { ...SIDE }, "power3.out"],
    [w(26, "flagged") - 0.6, { ...SIDE }],
    [w(26, "flagged") - 0.2, { ...FULL }, "power3.inOut"],
    [w(27, "full") - 0.6, { ...FULL }],
    [w(27, "full") - 0.2, { ...SIDE }, "power3.inOut"],
    [s(28) - 0.5, { ...SIDE }],
    [s(28) - 0.1, { ...OFF }, "power3.in"],
    [s(29) - 0.5, { ...OFF }],
    [s(29) - 0.1, { ...SIDE }, "power3.out"],
    [s(31) - 0.5, { ...SIDE }],
    [s(31) - 0.1, { ...OFF }, "power3.in"],
    [s(32) + 0.25, { ...OFF }],
    [s(32) + 0.75, { ...SIDE }, "power3.out"],
    [s(38) - 0.5, { ...SIDE }],
    [s(38) - 0.1, { ...GONE }, "power3.in"],
    [s(40) - 0.5, { ...GONE }],
    [s(40) - 0.1, { ...RIGHT }, "power3.out"],
    [s(41) - 0.6, { ...RIGHT }],
    [s(41) - 0.2, { ...GONE }, "power3.in"],
    [ctx.duration, { ...GONE }, "none"],
  ]);

  /* ===================== 1. What people look for (0 - 9.4) ===================== */
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
  await nigeriaMap3d(ctx, open, { x: 1050, y: 250, w: 740, t0: s(1) - 0.05, t1: s(2) - 0.3, tTrails: s(1) + 0.6, gap: 0.28, labels: true, cities: 6 });
  headline(ctx, open, { lines: [[["Every day, people", false]], [["across ", false], ["Nigeria", true]]], x: HX, y: 240, size: 96, t0: s(1), t1: s(2) - 0.35, stagger: 0.05 });
  chipRow(ctx, open, { items: [["A place to live", "house"], ["to stay", "bed-double"], ["to meet", "utensils-crossed"]], x: HX, y: 620, t0: w(1, "live") - 0.1, gap: w(1, "stay") - w(1, "live"), t1: s(2) - 0.35, size: 34, anchor: "left", wrapW: 760 });
  ctx.hideCaptions(s(1) - 0.2, s(1) + 2.4);

  /* ===================== 2. Fake listings, hidden fees, strangers (9.4 - 16.2) ===================== */
  /* CUT 1 of 14 (UPGRADE.md section 1). The opening frame is the founder's and
     carries nothing over it; every ground handover after it carries one deep
     transition, and no two in a row are the same. */
  slabWipe(ctx, s(2) - 0.1, { dir: "left", dur: 0.42 });
  ground(ctx, s(2) - 0.1, s(3) + 0.1, { tone: "gold", y: 50, seed: 32 });
  const prob = layer("problem", s(2) - 0.1, s(3) + 0.1);
  const probs = [
    { t: w(2, "fake"), icon: "image-off", title: "Fake listings", x: 560, y: 300, r: -4 },
    { t: w(2, "hidden"), icon: "eye-off", title: "Hidden fees", x: 1000, y: 520, r: 3 },
    { t: w(2, "money"), icon: "banknote", title: "Money sent to strangers", x: 1400, y: 740, r: -2 },
  ];
  probs.forEach((p, i) => {
    const card = ctx.el("div", { class: "abs glass-dark", style: { left: "0px", top: "0px", display: "flex", alignItems: "center", gap: "26px", padding: "28px 38px", borderRadius: "36px", border: "1.5px solid rgb(255 120 90 / 0.45)", font: "700 46px/1 Poppins, Inter, sans-serif", color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" } }, prob);
    const ic = ctx.icon(p.icon, { size: 50, stroke: 2.2 }, card); ic.style.color = "#ff8a6b";
    ctx.el("span", { text: p.title }, card);
    during(ctx, s(2) - 0.1, s(3) + 0.1, (t) => {
      const a = ramp(ctx, t, p.t - 0.05, p.t + 0.45, "back.out(1.6)");
      const strike = ramp(ctx, t, s(3) - 0.15 + i * 0.06, s(3) + 0.05 + i * 0.06, "power3.in");
      const jit = t > p.t && t < p.t + 0.25 ? Math.sin(t * 90) * 6 : 0;
      /* ANTICIPATION (section 4, rule 3): each card sinks back a few pixels and
         loses a little size before it is struck up and away, one after another */
      const pull = ramp(ctx, t, s(3) - 0.46 + i * 0.06, s(3) - 0.15 + i * 0.06, "power2.out") * (1 - strike);
      place(card, { x: p.x + jit, y: p.y + (1 - a) * 50 + pull * 15 - strike * 80, s: (0.85 + 0.15 * a) * (1 - 0.035 * pull) * (1 - 0.2 * strike), r: p.r * a, o: Math.min(ramp(ctx, t, p.t - 0.05, p.t + 0.1), 1 - strike) });
    });
    ctx.sfx("pop_low", p.t, { offset: -2 });
  });

  /* ===================== 3. We built Vallo to change that (16.2 - 19.0) ===================== */
  /* CUT 2. The flash that stood here was standing in for the cut, so the deep
     transition takes its place: the tick brackets close on the frame and bloom. */
  irisTicks(ctx, s(3) - 0.05, { dur: 0.46 });
  ground(ctx, s(3) - 0.05, s(6) + 0.6, { tone: "electric", y: 20, seed: 33 });
  const meet = layer("meet", s(3) - 0.05, s(4) + 0.3, 780);
  const mark = ctx.img(ctx.src.asset("logo-mark.png"), { class: "abs", style: { left: "0px", top: "0px", width: "280px", height: "280px", objectFit: "contain" } }, meet);
  during(ctx, s(3) - 0.05, s(4) + 0.3, (t) => {
    const a = ramp(ctx, t, s(3), s(3) + 0.55, "back.out(1.8)");
    const up = ramp(ctx, t, s(4) - 0.9, s(4) - 0.2, "power3.inOut");
    place(mark, { x: ctx.W / 2, y: 380 - up * 300, s: (0.3 + 0.7 * a) * (1 - 0.6 * up), r: (1 - a) * -40, o: ramp(ctx, t, s(3), s(3) + 0.15) * (1 - up) });
  });
  ringBurst(ctx, meet, { cx: ctx.W / 2, cy: 380, r: 200, t: s(3) + 0.05, seed: 34 });
  /* THE CUT'S ONE CHIP HEADLINE (section 4): this is the film's own promise,
     so the key words take the blueprint's rounded box, which opens behind them
     as they land. No other headline in this cut takes it. */
  headline(ctx, meet, { lines: [[["We built Vallo to ", false], ["change that.", true]]], x: ctx.W / 2, y: 600, size: 76, t0: s(3) + 0.1, t1: s(4) - 0.9, align: "center", keyStyle: "chip" });
  /* four round badges at the frame's edges, in on the beat, out with the
     chapter; one of them paper, none near the pill or the captions */
  badgeDisc(ctx, meet, { name: "home-verified", x: 206, y: 300, size: 132, t0: s(3) + 0.3, t1: s(4) - 0.75, seed: 51 });
  badgeDisc(ctx, meet, { name: "keys", x: 1724, y: 262, size: 120, t0: s(3) + 0.3, t1: s(4) - 0.75, seed: 52, delay: 0.12 });
  badgeDisc(ctx, meet, { name: "search", kind: "glyph", tone: "paper", x: 236, y: 756, size: 112, t0: s(3) + 0.3, t1: s(4) - 0.75, seed: 53, delay: 0.24 });
  badgeDisc(ctx, meet, { name: "shield", x: 1748, y: 736, size: 126, t0: s(3) + 0.3, t1: s(4) - 0.75, seed: 54, delay: 0.36 });
  ctx.sfx("impact_soft", s(3), { offset: 0 });
  ctx.hideCaptions(s(3) - 0.1, s(4) - 0.3);

  /* ===================== 4. One home for real estate (19.0 - 23.2) ===================== */
  /* the site arrives on the right and the sentence stands to its left */
  W.show("d-n-home", s(4) - 0.3, w(5, "Homes") + 0.05, { enter: "fade", dur: 0.5 });
  W.click(w(4, "home") + 0.2, 760, 726);
  const one = layer("one", s(4) - 0.1, s(6));
  /* PARALLAX (section 4, rule 2). The window pushes RIGHT -> FULL -> SIDE across
     this chapter and the next. The column of parts rides that push at a small
     fraction of its rate, and the object on the far plane rides it at a
     fraction of that again, so the three planes separate as the camera moves.
     Still a pure function of t: the rate is read off the window's own pose. */
  const push = (t, k) => Math.max(-44, Math.min(44, (W.at(t).x - FULL.x) * k));
  const far = layer("one-far", s(4) - 0.1, s(6), 2);
  ctx.onFrame((t) => {
    one.style.transform = `translateX(${push(t, -0.055).toFixed(2)}px)`;
    far.style.transform = `translateX(${push(t, -0.016).toFixed(2)}px)`;
  });
  object3d(ctx, far, { name: "city", size: 196, x: 432, y: 752, t0: s(4) + 0.25, t1: w(5, "Homes") - 0.7, drift: 1.1, seed: 19 });
  headline(ctx, one, { lines: [[["Today, Vallo is", false]], [["one home for", false]], [["real estate.", true]]], x: HX, y: 250, size: 78, t0: s(4), t1: w(5, "Homes") - 0.95, stagger: 0.05 });
  /* the label names what the page is showing: the headline already carries
     the sentence, and two of it in one frame reads as a doubled line */
  kicker(ctx, one, { text: "Featured listings", icon: "star", x: HX, y: 640, t0: w(4, "home") - 0.1, t1: w(5, "Homes") - 0.75, size: 30, anchor: "left" });

  /* ===================== 5. Homes, hotels, shortlets, restaurants (23.2 - 30.0) ===================== */
  /* the home page takes the whole frame and scrolls through what is listed */
  W.show("d-n-home-full", w(5, "Homes") + 0.05, w(5, "hotels") - 0.15, {
    enter: "cut", full: true,
    scroll: [[w(5, "Homes") + 0.05, 0], [w(5, "hotels") - 0.3, 1500, "power3.inOut"]],
  });
  W.show("d-n-stays-dates", w(5, "hotels") - 0.15, w(5, "shortlets") - 0.1, { enter: "slide" });
  W.show("d-n-stay", w(5, "shortlets") - 0.1, w(5, "restaurants") - 0.1, { enter: "slide" });
  W.show("d-restaurants", w(5, "restaurants") - 0.1, s(6) - 0.2, { enter: "slide" });
  windowLift(ctx, W, { id: "d-restaurants", crop: { x: 330, y: 128, w: 345, h: 360 }, t0: w(5, "restaurants") + 0.3, t1: s(6) - 0.45, to: { x: COL, y: 380, s: 0.9, r: -3 }, seed: 1, label: "A table, booked on Vallo" });
  /* CONTAINER 1 of 3. The four things one account carries are named one after
     another by the voice and shown one page at a time by the window, so the
     screen never has them in one place: that is the container's job (section 6).
     A counters row, the blueprint's own part (section 4). */
  popOut(ctx, one, {
    kind: "counters", x: COL, y: 700, t0: w(5, "one"), t1: s(6) - 0.4, size: 22, from: "right", seed: 21,
    tab: "One account",
    items: [["house", "Homes"], ["building-2", "Hotels"], ["bed-double", "Shortlets"], ["utensils-crossed", "Restaurants"]],
  });

  /* ===================== 6. Owners: list it yourself (30.0 - 46.2) ===================== */
  /* CUT 3 */
  slabWipe(ctx, s(6) - 0.05, { dir: "up", dur: 0.42 });
  ground(ctx, s(6) - 0.05, s(9) + 0.3, { tone: "navy", y: 15, seed: 35 });
  const own = layer("owners", s(6) - 0.1, s(9));
  headline(ctx, own, { lines: [[["For owners and", false]], [["landlords", true]]], x: ctx.W / 2, y: 360, size: 92, t0: s(6), t1: s(7) - 1.5, align: "center", stagger: 0.05 });
  W.show("d-host-start", s(7) - 1.45, w(8, "listing") - 0.2, { enter: "rise", dur: 0.6 });
  W.click(w(7, "List") + 0.15, 850, 715);
  /* the crop sits on the row's own rounded edges (section 6), a few pixels of
     air all round, so "List it yourself. No agency fee." comes whole */
  windowLift(ctx, W, { id: "d-host-start", crop: { x: 506, y: 664, w: 692, h: 104 }, t0: w(7, "yourself") + 0.1, t1: s(8) - 0.25, to: { x: COL, y: 320, s: 0.72, r: -2 }, seed: 2, label: "The owner's own listing" });
  /* it holds through "add your photos, set your price": the fee is the whole
     offer to an owner, and the column is otherwise bare until the badge */
  liveChip(ctx, own, { text: "No agency fee", x: COL, y: 480, t0: w(7, "agency") - 0.1, t1: w(8, "Ownership", 2) - 0.4, size: 32, anchor: "center" });
  chipRow(ctx, own, { items: [["Add your photos", "camera"], ["Set your price", "tag"], ["Ownership checked", "file-check-2"]], x: COL, y: 220, t0: w(8, "photos"), gap: (w(8, "checked") - w(8, "photos")) / 2, t1: w(8, "Ownership", 2) - 0.35, size: 28, anchor: "center", wrapW: 620 });
  W.show("d-n-listing", w(8, "listing") - 0.2, s(9) - 0.4, { enter: "slide" });
  /* the badge the listing carries, drawn the way the product draws it */
  const seen = layer("seen", w(8, "Ownership", 2) - 0.3, s(9));
  const badge = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", display: "flex", alignItems: "center", gap: "22px", padding: "26px 38px", borderRadius: "999px", background: "linear-gradient(150deg, #2f7cff, #003f98)", boxShadow: "0 30px 70px -20px rgb(0 60 200 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.3)", font: "700 44px/1 Poppins, Inter, sans-serif", color: "#fff", whiteSpace: "nowrap" } }, seen);
  const bi = ctx.icon("badge-check", { size: 52, stroke: 2.2 }, badge); bi.style.color = "#fff";
  ctx.el("span", { text: "Ownership seen" }, badge);
  /* HAND-OFF (section 4, rule 1). The badge does not simply appear in the
     column: it grows out of the slot the "No agency fee" chip is leaving
     (y 480) and carries down to its own place (y 620). The chip is still on
     its way out as the badge starts, so no frame between them is dead (rule 5). */
  during(ctx, w(8, "Ownership", 2) - 0.3, s(9), (t) => {
    const a = ramp(ctx, t, w(8, "Ownership", 2) - 0.2, w(8, "Ownership", 2) + 0.4, "back.out(1.9)");
    const b = ramp(ctx, t, s(9) - 0.6, s(9) - 0.35, "power2.in");
    place(badge, {
      x: COL,
      y: mix(480, 620, a),
      s: 0.5 + 0.5 * a,
      r: (1 - a) * 12,
      o: Math.min(ramp(ctx, t, w(8, "Ownership", 2) - 0.2, w(8, "Ownership", 2)), 1 - b),
    });
  });
  ringBurst(ctx, seen, { cx: COL, cy: 620, r: 260, t: w(8, "Ownership", 2) + 0.05, seed: 36 });
  ctx.sfx("stamp", w(8, "Ownership", 2) + 0.05, { offset: -2 });

  /* ===================== 7. The host desk (46.2 - 58.9) ===================== */
  /* CUT 4, one of the two loud ones: it lands in the longest silence of the
     first half (43.9 to 46.2), so no sentence is under it */
  tileFall(ctx, s(9) - 0.05, { cols: 6, rows: 10, dur: 0.5 });
  ground(ctx, s(9) - 0.05, s(12) + 0.3, { tone: "dusk", y: 85, seed: 37 });
  const desk = layer("desk", s(9) - 0.1, s(12));
  W.show("d-f-host-home", s(9) - 0.4, w(10, "calendar") - 0.2, { enter: "slide" });
  headline(ctx, desk, { lines: [[["Hosts get a", false]], [["full desk.", true]]], x: HX, y: 320, size: 84, t0: s(9), t1: s(10) - 0.95, stagger: 0.05 });
  kicker(ctx, desk, { text: "A setup wizard for your rooms", icon: "bed-double", x: COL, y: 220, t0: w(10, "wizard") - 0.1, t1: w(10, "calendar") - 0.3, size: 28, anchor: "center" });
  /* the cursor goes to the desk's own nav, so the page change is the site's */
  W.click(w(10, "calendar") - 0.45, 110, 306);
  W.show("d-f-host-calendar", w(10, "calendar") - 0.2, w(10, "bookings") - 0.2, { enter: "slide" });
  /* the crop was ending on the rate pills: it now clears them with air below,
     so the room's whole rate block comes up with nothing cut (section 6) */
  windowLift(ctx, W, { id: "d-f-host-calendar", crop: { x: 286, y: 332, w: 752, h: 140 }, t0: w(10, "night") - 0.25, t1: w(10, "earnings") - 0.4, to: { x: COL, y: 430, s: 0.74, r: -2 }, seed: 3, label: "Rates, night by night" });
  W.show("d-host-bookings", w(10, "bookings") - 0.2, w(10, "place") - 0.3, { enter: "slide" });
  chipRow(ctx, desk, { items: [["Bookings", "calendar-check"], ["Reservations", "utensils"], ["Earnings", "wallet"]], x: COL, y: 560, t0: w(10, "bookings"), gap: (w(10, "earnings") - w(10, "bookings")) / 2, t1: w(10, "cancellation") - 0.35, size: 28, anchor: "center", wrapW: 620 });
  W.show("d-f-host-home", w(10, "place") - 0.3, s(11) - 0.25, { enter: "slide" });
  kicker(ctx, desk, { text: "Cancellation rules you choose", icon: "calendar-x-2", x: COL, y: 790, t0: w(10, "cancellation") - 0.1, t1: s(11) - 0.3, size: 28, anchor: "center" });

  /* ===================== 8. Table deposits (58.9 - 64.6) ===================== */
  W.show("d-f-host-reservations", s(11) - 0.25, s(12) - 0.45, { enter: "slide" });
  W.click(w(11, "deposits") - 0.15, 700, 800);
  const dep = layer("deposits", s(11), s(12));
  /*
   * THE FRAME THE FOUNDER SENT BACK, REDONE THE BLUEPRINT'S WAY (section 6).
   *
   * This rule used to be drawn from scratch because an earlier crop of the
   * page's own panel ended mid-sentence. The answer is not to draw it: it is
   * to take the crop off the PANEL'S OWN EDGES. x 292 clears the panel's left
   * rounded edge by seven pixels, x+w 1414 clears its right by eight, y 718
   * sits above its top edge, and the crop stops at 812, in the clear band
   * under the rule and above the row below it. So the whole sentence - "Ask
   * for a card deposit on the tables that matter most. It comes off the
   * guest's bill, and it is yours if they do not come." - comes up with the
   * panel, on one line, inside one heavy sky rule, at 0.95 of the window's own
   * scale so it reads. It lifts straight up off the place it sits, and it
   * overlaps the page above and below it, which is the whole move.
   */
  windowLift(ctx, W, {
    id: "d-f-host-reservations",
    crop: { x: 292, y: 718, w: 1122, h: 94 },
    t0: w(11, "table") - 0.1, t1: w(11, "counts") + 0.25,
    to: { x: 760, y: 470, s: 0.95, r: -1.5 },
    exit: "up", seed: 12, label: "On your reservations page",
  });
  liveChip(ctx, dep, { text: "Every reservation counts", x: COL, y: 700, t0: w(11, "counts") - 0.4, t1: s(12) - 0.35, size: 30, anchor: "center" });

  /* ===================== 9. Agents and firms (64.6 - 78.5) ===================== */
  /* CUT 5 */
  slabWipe(ctx, s(12) - 0.05, { dir: "right", dur: 0.42 });
  ground(ctx, s(12) - 0.05, s(14) + 0.3, { tone: "violet", y: 20, seed: 38 });
  const ag = layer("agents", s(12) - 0.1, s(14));
  W.show("d-f-agent-dashboard", s(12) - 0.45, w(13, "portfolio") - 0.3, { enter: "slide" });
  headline(ctx, ag, { lines: [[["Agents and firms", false]], [["get their own", false]], [["tools.", true]]], x: HX, y: 280, size: 66, t0: s(12), t1: s(13) - 1.0, stagger: 0.05 });
  W.show("d-f-agent-portfolio", w(13, "portfolio") - 0.3, w(13, "analytics") - 0.3, { enter: "slide" });
  W.click(w(13, "analytics") - 0.5, 81, 520);
  W.show("d-f-agent-analytics", w(13, "analytics") - 0.3, w(13, "Pro") - 0.45, { enter: "slide" });
  /* the crop now runs from the analytics card's own top edge to the clear band
     under "No booking requests in these days.", so the card is held up whole */
  windowLift(ctx, W, { id: "d-f-agent-analytics", crop: { x: 288, y: 386, w: 1128, h: 406 }, t0: w(13, "working") - 0.25, t1: w(13, "Pro") - 0.5, to: { x: COL, y: 400, s: 0.47, r: -2 }, seed: 4, label: "Counted from your own records" });
  chipRow(ctx, ag, { items: [["Portfolio", "folder-kanban"], ["Analytics", "chart-column"], ["Firm desk", "building-2"]], x: COL, y: 680, t0: w(13, "portfolio"), gap: (w(13, "firm") - w(13, "portfolio")) / 2, t1: w(13, "Pro") - 0.5, size: 28, anchor: "center", wrapW: 620 });
  W.show("d-f-pro", w(13, "Pro") - 0.45, s(14) - 0.35, { enter: "slide" });
  chipRow(ctx, ag, { items: [["Vallo Pro", "sparkles"], ["Vallo Business", "briefcase"]], x: COL, y: 200, t0: w(13, "Pro"), gap: w(13, "Business") - w(13, "Pro"), t1: s(14) - 0.4, size: 30, anchor: "center", wrapW: 620 });
  liveChip(ctx, ag, { text: "Free trial to start", x: COL, y: 700, t0: w(13, "free") - 0.1, t1: s(14) - 0.4, size: 30, anchor: "center" });

  /* ===================== 10. A no-show, fairly (78.5 - 87.7) ===================== */
  /* CUT 6 */
  irisTicks(ctx, s(14) - 0.05, { dur: 0.46 });
  ground(ctx, s(14) - 0.05, s(16) + 0.3, { tone: "navy", y: 30, seed: 39 });
  W.show("d-messages", s(14) - 0.35, w(14, "report") - 0.25, { enter: "slide" });
  W.click(w(14, "report") - 0.5, 800, 360);
  W.show("d-thread", w(14, "report") - 0.25, s(16) - 0.35, { enter: "slide" });
  const fair = layer("fair", s(14) - 0.1, s(16));
  kicker(ctx, fair, { text: "Booked a viewing, didn't show", icon: "calendar-x", x: COL, y: 200, t0: w(14, "viewing") - 0.1, t1: w(14, "report") - 0.3, size: 28, anchor: "center" });
  /* the thread the report comes off, so the column is not bare while the
     sentence takes its time getting to "you can report it" */
  /* the crop now takes the whole conversation row, its own rounded edges and
     the archive button included, so nothing of it is sheared off */
  windowLift(ctx, W, { id: "d-messages", crop: { x: 400, y: 306, w: 908, h: 110 }, t0: w(14, "viewing") + 0.3, t1: w(14, "report") - 0.3, to: { x: COL, y: 580, s: 0.62, r: -2 }, seed: 11, label: "The enquiry it came from" });
  /* CONTAINER 2 of 3: the rule for a no-show. The page does not state it in
     one place, so this is the container's work rather than a lift (section 6). */
  popOut(ctx, fair, {
    kind: "line", x: COL, y: 300, t0: w(14, "report") - 0.05, t1: w(14, "forty-eight") - 0.35,
    size: 28, from: "right", seed: 22, lucide: "flag",
    tab: "After a missed viewing", title: "Report a no-show", line: "A person reads every report.",
  });
  numberCard(ctx, fair, { value: 48, prefix: "", label: "hours for them to respond", x: COL, y: 520, t0: w(14, "forty-eight") - 0.1, t1: w(14, "forty-eight") + 0.7, tOut: s(15) - 0.35, size: 96 });
  liveChip(ctx, fair, { text: "Fair for everyone", x: COL, y: 200, t0: s(15) - 0.05, t1: s(16) - 0.35, size: 32, anchor: "center" });

  /* ===================== 11. The Vallo passport (87.7 - 95.8) ===================== */
  /* CUT 7 */
  slabWipe(ctx, s(16) - 0.05, { dir: "down", dur: 0.42 });
  ground(ctx, s(16) - 0.05, s(17) + 0.3, { tone: "electric", y: 25, seed: 40 });
  W.show("d-verification", s(16) - 0.35, s(17) - 0.35, { enter: "rise", dur: 0.6 });
  const pass = layer("passport", s(16) - 0.1, s(17));
  windowLift(ctx, W, { id: "d-verification", crop: { x: 548, y: 352, w: 606, h: 270 }, t0: w(16, "passport") - 0.1, t1: w(16, "faster") - 0.3, to: { x: COL, y: 215, s: 0.62, r: -2 }, seed: 5, label: "One government issued document" });
  /* the passport, said in words: there is one card, and the film says what is on it */
  listCard(ctx, pass, {
    title: "What your passport carries",
    items: [
      ["Your verified details", "Your name, your role and when you joined, in one card."],
      ["You choose who sees it", "You decide who you show it to, and when."],
      ["Faster every time", "Applying for your next place does not start from nothing."],
    ],
    x: COL, y: 580, w: 620, t0: w(16, "verified") - 0.1, t1: s(17) - 0.4, rot: -1, size: 28, seed: 15, stagger: 0.22,
  });
  chipRow(ctx, pass, { items: [["Applying is faster", "zap"], ["You choose who sees it", "eye"]], x: COL, y: 830, t0: w(16, "faster") - 0.2, gap: w(16, "choose") - w(16, "faster"), t1: s(17) - 0.4, size: 28, anchor: "center", wrapW: 620 });

  /* ===================== 12. Tenancy file, agreements, rent (95.8 - 106.2) ===================== */
  /* CUT 8 */
  irisTicks(ctx, s(17) - 0.05, { dur: 0.46 });
  ground(ctx, s(17) - 0.05, s(19) + 0.3, { tone: "emerald", y: 20, seed: 41 });
  W.show("d-payments", s(17) - 0.35, s(19) - 0.4, { enter: "slide" });
  W.click(w(17, "agreement") + 0.1, 855, 718);
  const ten = layer("tenancy", s(17) - 0.1, s(19));
  chipRow(ctx, ten, { items: [["Tenancy file", "folder-open"], ["Agreement", "file-signature"], ["Records", "archive"]], x: COL, y: 200, t0: w(17, "tenancy") - 0.1, gap: (w(17, "records") - w(17, "tenancy")) / 2, t1: s(18) + 0.85, size: 28, anchor: "center", wrapW: 620 });
  listCard(ctx, ten, {
    title: "When your rent payment opens",
    items: [
      ["The inspection report is in", "And you have both confirmed the agreement."],
      ["Escrow opens straight away", "A direct payment waits only when the deal needs a second look."],
    ],
    /* in on "Once your agreement is approved": its rows stagger, so it starts
       early enough to be a card rather than a title over white */
    x: COL, y: 520, w: 620, t0: s(18) - 0.35, t1: w(18, "reminds") - 0.5, rot: -1, size: 28, seed: 16,
  });
  kicker(ctx, ten, { text: "Pay your rent in the app", icon: "house", x: COL, y: 200, t0: w(18, "rent") - 0.15, t1: w(18, "reminds") - 0.15, size: 28, anchor: "center" });
  noticeCard(ctx, ten, { object: "bell", title: "Rent due in 7 days", line: "Your tenancy, and Vallo reminds you first.", x: COL, y: 560, w: 620, t0: w(18, "reminds") + 0.05, t1: s(19) - 0.4, size: 30, seed: 17, from: "below" });

  /* ===================== 13. Wallet and escrow (106.2 - 117.7) ===================== */
  /* CUT 9 */
  slabWipe(ctx, s(19) - 0.05, { dir: "left", dur: 0.42 });
  ground(ctx, s(19) - 0.05, s(21) + 0.2, { tone: "electric", y: 18, seed: 42 });
  /* the money page again, entering fresh: this is the wallet's own chapter */
  W.show("d-payments", s(19) - 0.4, s(21) - 0.3, { enter: "rise", dur: 0.6 });
  const wal = layer("wallet", s(19) - 0.1, s(21));
  headline(ctx, wal, { lines: [[["Your Vallo ", false], ["wallet", true]]], x: COL, y: 190, size: 64, t0: w(19, "wallet") - 0.3, t1: s(20) - 0.35, align: "center" });
  chipRow(ctx, wal, { items: [["Add money", "plus"], ["Pay", "credit-card"], ["Send", "send"], ["Withdraw", "arrow-down-to-line"]], x: COL, y: 560, t0: w(19, "add"), gap: (w(19, "withdraw") - w(19, "add")) / 3, t1: s(20) - 0.3, size: 28, anchor: "center", wrapW: 620 });
  /* CONTAINER 3 of 3: the promise the wallet page never prints in one place */
  popOut(ctx, wal, {
    kind: "line", x: COL, y: 300, t0: w(20, "Protected") - 0.1, t1: s(21) - 0.35,
    size: 24, from: "right", seed: 23, lucide: "shield-check",
    tab: "While the deal runs", title: "Protected payment", line: "Your money waits in escrow until the deal is done.",
  });
  windowLift(ctx, W, { id: "d-payments", crop: { x: 285, y: 95, w: 1135, h: 215 }, t0: w(20, "escrow") - 0.2, t1: s(21) - 0.4, to: { x: COL, y: 700, s: 0.5, r: -1.5 }, seed: 6, label: "Paid through Vallo" });
  ctx.sfx("lock_click", w(20, "escrow"), { offset: -2 });

  /* ===================== 14. The promise, on daylight (117.7 - 129.2) ===================== */
  /* CUT 10, the second loud one: the bars close in the two seconds of silence
     after "until the deal is done" and open on "Here's the promise" */
  shutter(ctx, s(21) - 0.05, { bars: 7, dur: 0.4 });
  ground(ctx, s(21) - 0.05, s(22) - 0.25, { tone: "navy", y: 45, seed: 43, sparkle: 8 });
  const pr = layer("promise", s(21) - 0.05, s(24) + 0.1, 800);
  const size = 84;
  headline(ctx, pr, { lines: [[["Here's the ", false], ["promise.", true]]], x: ctx.W / 2, y: 400, size: size * 1.2, t0: s(21), t1: s(22) - 0.5, align: "center" });
  /* daylight, and one line at a time in one slot: each line is clear of the
     slot before the next one rises, so no frame carries two of them */
  const DAY0 = s(22) - 0.35;
  const DAY1 = s(24) - 0.12;
  ground(ctx, DAY0, DAY1, { tone: "day", y: 40, seed: 44, sparkle: 0, z: 2 });
  const SLOT = { x: ctx.W / 2, y: 150, align: "center", color: "#0b1230", key: "#0069fe", sheen: false };
  headline(ctx, pr, { ...SLOT, lines: [[["All funds,", true]], [["in your wallet,", false]], [["in escrow,", false]], [["in every payment,", false]]], size, t0: s(22), t1: w(22, "held") - 0.75, stagger: 0.045 });
  headline(ctx, pr, { ...SLOT, lines: [[["held by our", false]], [["licensed provider.", true]]], size, t0: w(22, "held") - 0.05, t1: s(23) - 0.7, stagger: 0.07 });
  /* the ink has to be gone before the paper is: left a moment longer it
     was dark blue on dark navy */
  headline(ctx, pr, { ...SLOT, lines: [[["Vallo never holds", false]], [["your ", false], ["money.", true]]], size, t0: s(23), t1: s(24) - 1.05, stagger: 0.05 });
  flowRail(ctx, pr, {
    steps: ["Your card", "Our licensed provider", "The owner's bank"],
    x: 660, y: 540, gap: 168, size: 36,
    t0: w(22, "held") + 0.1, t1: s(24) - 0.45, seed: 45,
  });
  ctx.sfx("stamp", w(23, "never") + 0.05, { offset: 0 });
  ctx.hideCaptions(s(21) - 0.1, s(24) - 0.3);
  ctx.hidePill(s(21) - 0.2, s(24) - 0.1);

  /* ===================== 15. Trust at every step (129.2 - 143.1) ===================== */
  /* CUT 11: the slab also carries the white paper away, which a plain cut did
     badly (daylight to electric in one frame) */
  slabWipe(ctx, s(24) - 0.05, { dir: "right", dur: 0.44 });
  ground(ctx, s(24) - 0.05, s(28) + 0.3, { tone: "electric", y: 25, seed: 46 });
  sceneBack(ctx, ctx.scene("trust-back", s(24) - 0.3, s(26) + 0.5, { z: 3 }), { scene: "step-2-dark", t0: s(24), t1: s(26) - 0.1, opacity: 0.40 });
  W.show("d-notifications", s(24) + 0.1, w(26, "flagged") - 0.3, { enter: "slide" });
  const tr = layer("trust", s(24) - 0.1, s(28));
  kicker(ctx, tr, { text: "Trust, built into every step", icon: "shield", x: COL, y: 200, t0: s(24) + 0.3, t1: s(25) - 0.25, size: 28, anchor: "center" });
  /* the notice's second line ("comes back.") sat on the old crop's bottom edge:
     the crop now takes the row's own rounded box with air under it */
  windowLift(ctx, W, { id: "d-notifications", crop: { x: 508, y: 430, w: 688, h: 104 }, t0: s(25) + 0.05, t1: w(26, "flagged") - 1.15, to: { x: COL, y: 330, s: 0.72, r: -2 }, seed: 7, label: "A person reads every one" });
  proofCard(ctx, tr, { lines: ["Checked by a real", "person at Vallo."], x: COL, y: 640, w: 560, t0: w(25, "person") - 0.55, t1: w(26, "flagged") - 1.05, rot: -2, size: 34, seed: 64, from: "right" });
  /* the flag sits on the thread it belongs to, so the window is full behind it */
  W.show("d-thread", w(26, "flagged") - 0.3, w(27, "full") - 0.3, { enter: "slide" });
  const flag = layer("flag", w(26, "flagged") - 0.5, s(27) + 0.2, 790);
  const card = flagCard(ctx, flag, false);
  during(ctx, w(26, "flagged") - 0.5, s(27) + 0.2, (t) => {
    const a = ramp(ctx, t, w(26, "flagged") - 0.35, w(26, "flagged") + 0.25, "back.out(1.4)");
    const b = ramp(ctx, t, s(27) - 0.5, s(27) - 0.2, "power2.in");
    place(card, { x: ctx.W / 2, y: 560 + (1 - a) * 50, s: 0.94 + 0.06 * a, r: -1.5 * a, o: Math.min(a, 1 - b) });
  });
  ctx.sfx("stamp", w(26, "flagged"), { offset: -3 });
  kicker(ctx, flag, { text: "Account number in the chat", icon: "shield-alert", x: ctx.W / 2, y: 170, t0: w(26, "flagged") - 0.15, t1: s(27) - 0.35, size: 30, anchor: "center" });
  W.show("d-listing-cost", w(27, "full") - 0.3, s(28) - 0.35, { enter: "slide" });
  /* ANTICIPATION on the cut's loudest figure (section 4, rule 3): the card
     dips a few pixels and settles back before the odometer starts to roll, so
     the roll is thrown rather than switched on. The dip is on a wrapper, so
     the number card's own motion is untouched and the roll stays on its word. */
  const dip = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px" } }, tr);
  numberCard(ctx, dip, { value: 26100000, label: "The full cost, before anyone pays", x: COL, y: 260, t0: w(27, "full") - 0.05, t1: w(27, "full") + 1.2, tOut: s(28) - 0.3, size: 72 });
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, w(27, "full") - 0.32, w(27, "full") - 0.05, "power2.out");
    const b = ramp(ctx, t, w(27, "full") - 0.05, w(27, "full") + 0.22, "power3.out");
    dip.style.transform = `translateY(${((a - b) * 16).toFixed(2)}px)`;
  });
  windowLift(ctx, W, { id: "d-listing-cost", crop: { x: 330, y: 190, w: 675, h: 515 }, t0: w(27, "cost") + 0.15, t1: s(28) - 0.4, to: { x: COL, y: 700, s: 0.6, r: -2 }, seed: 8, label: "What you will actually pay" });
  ctx.hidePill(w(27, "full") - 0.3, s(28) - 0.1);

  /* ===================== 16. Community: Local talk (143.1 - 156.9) ===================== */
  /* CUT 12, the second shutter: it sits in the longest silence of the film
     (140.2 to 143.1), so nothing is spoken under the closed bars */
  shutter(ctx, s(28) - 0.05, { bars: 9, dur: 0.42 });
  ground(ctx, s(28) - 0.05, s(31) + 0.3, { tone: "violet", y: 25, seed: 47 });
  const com = layer("community", s(28) - 0.1, s(31));
  headline(ctx, com, { lines: [[["Vallo is also a", false]], [["community.", true]]], x: ctx.W / 2, y: 380, size: 84, t0: s(28), t1: s(29) - 1.1, align: "center", stagger: 0.05 });
  W.show("d-f-around", s(29) - 0.4, w(30, "stories") - 0.2, { enter: "slide" });
  /* the crop sat inside the post, shearing its top and its action row: it now
     takes the post's own rounded card, so the whole message comes with it */
  windowLift(ctx, W, { id: "d-f-around", crop: { x: 371, y: 275, w: 612, h: 394 }, t0: w(29, "neighbourhood") - 0.2, t1: w(30, "stories") - 0.25, to: { x: COL, y: 400, s: 0.72, r: -2 }, seed: 9, label: "Local talk" });
  W.show("d-around", w(30, "stories") - 0.2, s(31) - 0.35, { enter: "slide" });
  W.click(w(30, "follow") + 0.15, 1030, 220);
  chipRow(ctx, com, { items: [["Local talk", "messages-square"], ["Stories", "circle-play"], ["Follow", "user-plus"], ["What's new around you", "map-pin"]], x: COL, y: 700, t0: w(29, "Local"), gap: (w(30, "new") - w(29, "Local")) / 3, t1: s(31) - 0.4, size: 26, anchor: "center", wrapW: 620 });

  /* ===================== 17. Referral rewards (156.9 - 180.0) ===================== */
  /* CUT 13, the second tile fall: the flash that stood here was standing in
     for the cut, and the gap before "And now..." is two and a half seconds */
  tileFall(ctx, s(31) - 0.05, { cols: 8, rows: 10, dur: 0.52 });
  ground(ctx, s(31) - 0.05, s(38) + 0.3, { tone: "gold", y: 25, seed: 48 });
  const rw = layer("rewards", s(31) - 0.1, s(38));
  headline(ctx, rw, { lines: [[["Referral rewards", false]], [["are ", false], ["live.", true]]], x: ctx.W / 2, y: 360, size: 86, t0: s(31) + 0.12, t1: s(32) - 0.35, align: "center", stagger: 0.05 });
  liveChip(ctx, rw, { text: "Live now", x: ctx.W / 2, y: 620, t0: w(31, "live") - 0.1, t1: s(32) - 0.3, size: 32, anchor: "center" });
  /* the second set of badges, at the frame's edges, in on the beat and out
     with the opening of the chapter */
  badgeDisc(ctx, rw, { name: "gift", x: 212, y: 302, size: 134, t0: s(31) + 0.45, t1: s(32) - 0.25, seed: 55 });
  badgeDisc(ctx, rw, { name: "earnings", x: 1718, y: 272, size: 124, t0: s(31) + 0.45, t1: s(32) - 0.25, seed: 56, delay: 0.12 });
  badgeDisc(ctx, rw, { name: "celebrate", x: 254, y: 728, size: 118, t0: s(31) + 0.45, t1: s(32) - 0.25, seed: 57, delay: 0.24 });
  badgeDisc(ctx, rw, { name: "send", kind: "glyph", tone: "paper", x: 1740, y: 716, size: 112, t0: s(31) + 0.45, t1: s(32) - 0.25, seed: 58, delay: 0.36 });
  W.show("d-f-rewards", s(32) + 0.2, s(38) - 0.35, { enter: "rise", dur: 0.6 });
  kicker(ctx, rw, { text: "Share your invite link", icon: "link", x: COL, y: 200, t0: w(33, "invite") - 0.3, t1: w(34, "earn") - 0.45, size: 30, anchor: "center" });
  ctx.sfx("bubble_send", w(33, "link"), { offset: -3 });
  /* the crop ran through the middle of the "How you earn" card: it now takes
     the card's own left and right edges and stops in the band under the line.
     HAND-OFF (section 4, rule 1): it leaves upward, into the slot where the
     one thousand naira card arrives, and the figure grows out of it. */
  windowLift(ctx, W, { id: "d-f-rewards", crop: { x: 510, y: 750, w: 686, h: 102 }, t0: w(34, "friend") - 0.2, t1: w(36, "thousand") - 0.95, to: { x: COL, y: 620, s: 0.62, r: -3 }, exit: "up", seed: 10, label: "What a referral pays" });
  numberCard(ctx, rw, { value: 80, label: "for each friend who joins and gets verified", x: COL, y: 330, t0: w(34, "earn") - 0.05, t1: w(34, "earn") + 0.6, tOut: s(35) + 0.9, size: 72 });
  kicker(ctx, rw, { text: "Ready after 7 days", icon: "clock", x: COL, y: 200, t0: w(35, "seven") - 0.1, t1: s(36) - 0.2, size: 30, anchor: "center" });
  W.click(w(36, "withdraw") - 0.15, 855, 332);
  numberCard(ctx, rw, { value: 1000, label: "withdraw it straight to your bank", x: COL, y: 200, t0: w(36, "thousand") - 0.1, t1: w(36, "thousand") + 0.6, tOut: s(37) - 0.25, size: 84 });
  /* the withdrawal rule in words: the page states it in one small line */
  listCard(ctx, rw, {
    title: "Withdrawing your rewards",
    items: [
      ["₦1,000 to withdraw", "You can withdraw once your rewards balance reaches ₦1,000."],
      ["Straight to your bank", "From your rewards balance to your own bank account."],
    ],
    x: COL, y: 660, w: 620, t0: w(36, "withdraw") - 0.25, t1: s(37) - 0.65, rot: 2, size: 28, seed: 26, stagger: 0.16,
  });
  chipRow(ctx, rw, { items: [["Invite", "send"], ["They join", "user-plus"], ["You earn", "coins"]], x: COL, y: 560, t0: s(37), gap: 0.35, t1: s(38) - 0.4, size: 30, anchor: "center", wrapW: 620 });
  /* around the three steps, and inside the column: a wider burst thrown from
     COL runs out of the frame on the right as it opens */
  ringBurst(ctx, rw, { cx: COL, cy: 620, r: 230, t: w(37, "earn") + 0.1, seed: 49 });

  /* ===================== 18. The beginning (180.0 - 205.4) ===================== */
  /* CUT 14: the brackets close on the gold and bloom open on the navy */
  irisTicks(ctx, s(38) - 0.05, { dur: 0.5 });
  ground(ctx, s(38) - 0.05, s(42) + 0.2, { tone: "navy", y: 40, seed: 50, sparkle: 10 });
  const vis = layer("vision", s(38) - 0.1, s(42), 800);
  headline(ctx, vis, { lines: [[["This is just the ", false], ["beginning.", true]]], x: ctx.W / 2, y: 420, size: 92, t0: s(38), t1: s(39) - 0.15, align: "center" });
  listingWall(ctx, layer("wall", s(39) - 0.5, s(40) - 0.1, 3), { t0: s(39) - 0.4, t1: s(40) - 0.4, rows: 4, opacity: 0.30, seed: 13, tilt: -11, speed: 70, y: 20, stays: STAY_CARDS(ctx), stayRows: [1, 3] });
  headline(ctx, vis, { lines: [[["The infrastructure", false]], [["for how Nigeria", false]]], x: 160, y: 180, size: 88, t0: w(39, "infrastructure") - 0.1, t1: s(40) - 0.35, stagger: 0.07 });
  const verbs = [["finds", "search"], ["understands", "lightbulb"], ["pays for", "credit-card"], ["runs", "settings-2"]];
  verbs.forEach(([v, ic], i) => {
    const t = w(39, v.split(" ")[0]);
    featureCard(ctx, vis, { icon: ic, title: `${v[0].toUpperCase()}${v.slice(1)}`, line: null, x: 160 + i * 400, y: 470, w: 360, t0: t - 0.1, t1: s(40) - 0.35 + i * 0.04, size: 40 });
  });
  /* every home, every room, every table: the three pages themselves, cut on the word */
  W.show("d-n-listing", s(40) - 0.25, w(40, "room") - 0.15, { enter: "rise", dur: 0.5 });
  W.show("d-n-stay", w(40, "room") - 0.15, w(40, "table") - 0.15, { enter: "slide" });
  W.show("d-restaurant", w(40, "table") - 0.15, s(41) - 0.3, { enter: "slide" });
  kicker(ctx, vis, { text: "Every home, every room, every table", icon: "layers", x: HX, y: 320, t0: w(40, "home") - 0.1, t1: s(41) - 0.5, size: 30, anchor: "left" });
  chipRow(ctx, vis, { items: [["Real people", "users"], ["Real prices", "tag"], ["Real trust", "shield-check"]], x: HX, y: 620, t0: w(40, "people") - 0.15, gap: (w(40, "trust") - w(40, "people")) / 2, t1: s(41) - 0.35, size: 30, anchor: "left", wrapW: 620 });
  const map2 = layer("map2", s(41) - 0.35, s(42), 790);
  await nigeriaMap3d(ctx, map2, { x: 600, y: 170, w: 720, t0: s(41) - 0.3, t1: s(42) - 0.35, tTrails: w(41, "Nigeria") + 0.15, gap: 0.24, labels: true });
  headline(ctx, map2, { lines: [[["Vallo is ", false], ["growing.", true]]], x: ctx.W / 2, y: 800, size: 72, t0: w(41, "growing") - 0.25, t1: s(42) - 0.35, align: "center" });
  ctx.hideCaptions(s(38) - 0.1, s(39) + 0.4);

  /* ===================== 19. The end card ===================== */
  ending(ctx, { t0: s(42), tLine: s(43) - 0.05, tBadges: s(44) - 0.1, tUrl: s(45) + 0.4, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx);
}
