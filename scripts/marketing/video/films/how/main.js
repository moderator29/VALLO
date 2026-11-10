/**
 * VIDEO ONE, "How Vallo works" (films/how/timeline.json, 2:28), both formats.
 *
 * One phone carries the film: it rises after "Meet Vallo" and every chapter
 * is a real screen on it, tapped by the glossy pointer, with real parts of
 * the screen lifted off beside it as the voice names them. The desktop film
 * keeps the phone on the left, with the web app's window, the lifted parts
 * and the words on the right. Claims and figures: FACTS-OCT.md.
 */
import { nigeriaMap3d, poster, sceneBack, installFocus, momentCard, calendarCard, noticeCard, priceCard, proofCard, listCard, flowRail, STAY_CARDS, listingWall, flagCard, nigeriaMap, anchors, ground, hero, lift, headline, kicker, liveChip, numberCard, notify, chipRow, featureCard, ending, ringBurst, windowRig, ramp, opa, during, place, popOut, figureOut, badgeDisc, object3d, slabWipe, shutter, irisTicks, tileFall, whipPan } from "../kit.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  /* ---------- poses ---------- */
  const HOME = M ? { cx: 540, cy: 1075, height: 1380 } : { cx: 590, cy: 575, height: 940 };
  const LOW = M ? { cx: 540, cy: 1255, height: 1180 } : { cx: 560, cy: 585, height: 900 };
  const LEFT = M ? { cx: 700, cy: 1100, height: 1300 } : { cx: 470, cy: 575, height: 880 };
  const off = (p, dy = M ? 1750 : 1200) => ({ ...p, cy: p.cy + dy });
  /* the push onto the thread's header. On the phone cut a straight aim at the
     call button threw the phone's left edge 146px off the frame, so the screen
     read ":41" instead of "9:41": the phone cut keeps the body centred and
     stops the zoom where the whole phone still clears every edge by 50px. */
  const CALL = M ? { cx: 540, cy: 960, height: 1800 } : H.aim(1000, 360, 1500, 700, 420);
  /* slots for lifted parts and words */
  const R = M
    ? { l1: { x: 255, y: 560 }, r1: { x: 825, y: 610 }, l2: { x: 250, y: 1010 }, r2: { x: 830, y: 1060 }, top: 410, cx: 540, size: 86 }
    : { l1: { x: 1170, y: 330 }, r1: { x: 1580, y: 360 }, l2: { x: 1170, y: 700 }, r2: { x: 1580, y: 730 }, top: 210, cx: 1390, size: 76 };
  const HX = M ? 60 : 1000; // headline left
  const TS = M ? 0.6 : 0.58; // a lifted tile's scale (stage px per display px)
  const RS = M ? 0.66 : 0.6; // a lifted row's scale
  const ROW = (i) => ({ x: R.cx, y: (M ? [500, 730, 960, 1190] : [250, 450, 650, 850])[i] });
  const BS = TS;

  const path = [
    [0, { ...off(HOME), opacity: 0 }],
    [7.95, { ...off(HOME), opacity: 1 }, "none"],
    [8.75, { ...HOME, rx: 0, ry: 0 }, "power3.out"],
    [s(4) - 0.2, { ...HOME }],
    [s(4) + 0.5, { ...LOW }],
    [s(5) - 0.2, { ...LOW }],
    [s(5) + 0.4, { ...HOME }],
    /* the cost: a push onto the listing's price, then back for the lines */
    [s(7) + 0.2, { ...HOME }],
    [s(7) + 1.1, H.aim(660, 1350, M ? 1900 : 1250, M ? 540 : 590, M ? 900 : 540)],
    [s(8) - 0.25, H.aim(660, 1350, M ? 1900 : 1250, M ? 540 : 590, M ? 900 : 540)],
    [s(8) + 0.4, { ...HOME }],
    [w(8, "added") - 0.5, { ...HOME }],
    [w(8, "added") + 0.2, { ...LOW }],
    [s(9) - 0.1, { ...LOW }],
    [s(9) + 0.5, { ...HOME }],
    /* the call: a push onto the thread's header */
    [w(12, "call") - 0.6, { ...HOME }],
    [w(12, "call") + 0.1, CALL],
    [w(12, "viewing") - 0.5, CALL],
    [w(12, "viewing") + 0.2, { ...HOME }],
    /* the flag: the phone steps back for the card */
    [s(14) - 0.2, { ...HOME }],
    [s(14) + 0.5, { ...LOW }],
    [s(15) - 0.3, { ...LOW }],
    [s(16) + 0.2, { ...LOW }],
    [s(18) - 0.3, { ...LOW }],
    [s(18) + 0.4, { ...HOME }],
    /* the money promise: the phone leaves, the words carry it, it returns */
    [s(24) - 0.2, { ...HOME }],
    [s(24) + 0.6, { ...off(HOME), ry: -18 }, "power3.in"],
    [s(26) - 0.6, { ...off(HOME), ry: 14 }, "none"],
    [s(26) + 0.2, { ...LOW, ry: 0 }, "power3.out"],
    [s(27) - 0.2, { ...LOW }],
    [s(27) + 0.5, { ...HOME }],
    [s(33) - 0.6, { ...HOME }],
    [s(33) + 0.02, { ...off(HOME), rz: -5, ry: 16 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ];
  H.path(path);
  H.swing(s(5) - 0.6, s(7) - 0.2, s(9) - 0.1, s(11) - 0.2, s(18) - 0.2, s(20) - 0.2, s(22) - 0.2, s(27) - 0.2, s(28) - 0.2, s(31) - 0.2);

  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });

  /* ===================== 1. Opening: the gamble (0 - 6.9) ===================== */
  ground(ctx, 0, s(2) + 0.1, { tone: "navy", y: 30, seed: 11 });
  const open = layer("open", 0, s(2) + 0.1);
  /* the frame a chat shows before anyone presses play: composed at t = 0 */
  poster(ctx, open, { t1: s(1) - 0.15 });
  const big = M ? 104 : 112;
  /* EVERY LINE RISES AS ONE. A word whose rise has not begun is drawn where
     it will land, so a staggered line was caught with its last word already
     set while the first was still half out of its mask: "shouldn't feel li"
     over a finished "gamble." The lines still arrive one after another, on
     their own words; the words inside a line no longer do. */
  headline(ctx, open, { lines: [[["Finding a place", false]], [["in ", false], ["Nigeria", true]]], x: M ? 60 : 160, y: M ? 560 : 260, size: big, t0: s(1) - 0.05, t1: s(2) - 0.55, stagger: 0 });
  /* THE ONE CHIP IN THIS CUT (16 October, the blueprint's key word in a
     rounded box). It goes on the film's own promise, the line the whole cut
     answers: the box opens behind "a gamble." as the word lands. */
  headline(ctx, open, { lines: [[["shouldn't feel like", false]], [["a gamble.", true]]], x: M ? 60 : 160, y: M ? 560 + big * 2.25 : 260 + big * 2.25, size: big, t0: w(1, "shouldn't") - 0.05, t1: s(2) - 0.5, stagger: 0, keyStyle: "chip" });
  await nigeriaMap3d(ctx, open, { x: M ? 150 : 1090, y: M ? 1120 : 250, w: M ? 790 : 700, t0: s(1) - 0.05, t1: s(2) - 0.4, tTrails: s(1) + 0.55, gap: 0.26, labels: true, cities: 6 });
  const die = ctx.sticker("1f3b2", M ? 210 : 190, open, { class: "abs", style: { left: "0px", top: "0px" } });
  during(ctx, 0, s(2) + 0.1, (t) => {
    const u = ramp(ctx, t, w(1, "gamble") - 0.2, w(1, "gamble") + 0.5, "back.out(1.7)");
    const out = ramp(ctx, t, s(2) - 0.55, s(2) - 0.15, "power2.in");
    place(die, { x: M ? 880 : 1720, y: (M ? 430 : 860) - out * 200, s: 0.4 + 0.6 * u, r: (1 - u) * 160 + t * 18, o: Math.min(u, 1 - out) });
  });
  ctx.sfx("pop", w(1, "gamble"), { offset: -2 });
  ctx.hideCaptions(s(1) - 0.2, s(2) + 0.1);

  /* ===================== 2. Meet Vallo (6.9 - 8.2) ===================== */
  /* CUT 1 -> 2. The flash here was standing in for a cut, so it is now a cut:
     four tick brackets close on the centre and bloom white on the frame the
     electric ground starts, and the mark rises out of the bloom. */
  irisTicks(ctx, s(2) - 0.05, { dur: 0.46 });
  ground(ctx, s(2) - 0.05, s(4) + 0.6, { tone: "electric", y: 20, seed: 12 });
  const meet = layer("meet", s(2) - 0.05, s(3) + 1.2, 780);
  const mark = ctx.img(ctx.src.asset("logo-mark.png"), { class: "abs", style: { left: "0px", top: "0px", width: "300px", height: "300px", objectFit: "contain" } }, meet);
  const word = ctx.img(ctx.src.asset("logo-wordmark.png"), { class: "abs", style: { left: "0px", top: "0px", width: M ? "560px" : "520px", height: "auto" } }, meet);
  during(ctx, s(2) - 0.05, s(3) + 1.2, (t) => {
    const a = ramp(ctx, t, s(2), s(2) + 0.55, "back.out(1.8)");
    const up = ramp(ctx, t, s(3) - 0.3, s(3) + 0.6, "power3.inOut");
    const cy = M ? 820 : 430;
    place(mark, { x: ctx.W / 2, y: cy - up * (M ? 480 : 360), s: (0.3 + 0.7 * a) * (1 - 0.55 * up), r: (1 - a) * -40, o: ramp(ctx, t, s(2), s(2) + 0.15) * (1 - ramp(ctx, t, s(3) + 0.6, s(3) + 1.1)) });
    const b = ramp(ctx, t, s(2) + 0.25, s(2) + 0.8, "land");
    place(word, { x: ctx.W / 2, y: cy + (M ? 270 : 230) + (1 - b) * 40 - up * 600, s: 1, o: b * (1 - up) });
  });
  ringBurst(ctx, meet, { cx: ctx.W / 2, cy: M ? 820 : 430, r: 210, t: s(2) + 0.05, seed: 21 });
  ctx.sfx("impact_soft", s(2), { offset: 0 });
  ctx.hideCaptions(s(2) - 0.1, s(2) + 1.1);

  /* ===================== 3. One app: homes, hotels, shortlets, restaurants ===================== */
  H.show("n-home2", 7.9, s(3) + 1.0, { enter: "cut", full: "n-home2-full", scroll: [[7.9, 1500], [w(3, "Homes") + 0.05, 3000, "power3.out"]] });
  H.show("n-stays", s(3) + 1.0, s(4) + 0.6, { enter: "slide" });
  H.tap(s(3) + 0.85, 660, 1600);
  if (M) {
    /* ONE PART, NOT FOUR. The four parts crowded the phone: each lifted stays
       tile sat a finger's width from its own twin on the screen beneath it,
       the right-hand pair came within 20px of the frame's edge, the left pair
       touched, and together they covered the screen they were lifted from.
       The phone says hotels, shortlets and restaurants itself, in its own
       tiles, as the voice names them. The one part held up is the premium
       listing the screen has just scrolled past: the only thing in this
       chapter the phone cannot show whole. */
    lift(ctx, H, { id: "n-home2", src: ctx.src.capture("n-home2-full"), scrolled: 3000, crop: { x: 94, y: 3683, w: 1122, h: 1042 }, t0: w(3, "Homes") + 0.05, t1: w(3, "one") - 0.2, to: { x: 540, y: 1040, s: 0.3, r: -3 }, seed: 1, radius: 60 });
  } else {
    /* THE DESKTOP CUT SHOWS THE DESKTOP. Four parts lifted off a phone, in a
       16:9 frame, was the phone film in a wider box: the founder said so.
       Here the same ground is covered by the site itself, in a window
       beside the phone, scrolling from Premium to Featured. */
    const WH = windowRig(ctx);
    WH.path([
      [w(3, "Homes") - 0.5, { x: 2000, y: 170, s: 0.62, opacity: 1 }],
      [w(3, "Homes") + 0.35, { x: 960, y: 170, s: 0.62, opacity: 1 }, "power3.out"],
      [w(3, "one") - 0.45, { x: 960, y: 170, s: 0.62, opacity: 1 }],
      [w(3, "one") + 0.15, { x: 2000, y: 170, s: 0.62, opacity: 1 }, "power3.in"],
      [w(3, "one") + 0.25, { x: 2000, y: 170, s: 0.62, opacity: 0 }, "none"],
      [ctx.duration, { x: 2000, y: 170, s: 0.62, opacity: 0 }, "none"],
    ]);
    WH.show("d-n-home-premium", w(3, "Homes") - 0.5, w(3, "one") + 0.25, { enter: "cut" });
    WH.show("d-n-home-featured", w(3, "restaurants") - 0.2, w(3, "one") + 0.25, { enter: "rise", dur: 0.6 });
  }
  const one = layer("one", s(3), s(4) + 0.4);
  /* the pills used to sit at y 1600, on the caption and on the phone's own
     bottom bar. They ride the film's label band instead, clear of both. */
  kicker(ctx, one, { text: "Premium listings", icon: "gem", x: R.cx, y: M ? 1440 : 170, t0: w(3, "Homes") + 0.2, t1: w(3, "one") - 0.25, size: M ? 32 : 28, anchor: "center" });
  /* a row with no width of its own is laid out from its left edge to the
     frame's, so these two pills wrapped and the second sat under the caption:
     every row on the phone cut is given its width. */
  /* "One app, one account" is the one claim here that no screen prints in one
     place, so it is the container's job (16 October). The phone's own tiles
     still say homes, hotels, shortlets and restaurants. */
  /* it stood at y 1440, the film's label band, and on the phone cut that band
     is the category tiles: the container sat across "Restaurants" and "Local
     talk". It rides the free band above the handset instead, under the pill
     and clear of every word on the glass. */
  if (M) popOut(ctx, one, { kind: "counters", items: [["smartphone", "One app"], ["user-round-check", "One account"]], x: R.cx, y: 300, t0: w(3, "one"), t1: s(4) - 0.2, size: 32, from: "above", seed: 12 });
  else chipRow(ctx, one, { items: [["One app", "smartphone"], ["One account", "user-round-check"]], x: R.cx, y: 170, t0: w(3, "one"), t1: s(4) - 0.2, size: 30, wrapW: null, anchor: "center" });
  /* THE BLUEPRINT'S COINS, one on each word the voice names. They ride the
     margins beside the handset, well clear of the captions and the pill, and
     they leave with the chapter. One is paper, the rest navy. */
  if (M) {
    [["home-small", 118, 560, w(3, "Homes"), "navy", 1],
      ["hotel", 962, 650, w(3, "hotels"), "paper", 2],
      ["shortlet", 118, 1190, w(3, "shortlets"), "navy", 3],
      ["restaurant", 962, 1255, w(3, "restaurants"), "navy", 4]]
      .forEach(([name, bx, by, t0, tone, seed]) => badgeDisc(ctx, one, { name, x: bx, y: by, size: 130, t0, t1: s(4) - 0.25, tone, seed, drift: 1 }));
  }

  /* ===================== 4. How it works: search, filter, save, compare ===================== */
  listingWall(ctx, layer("wall1", s(4) - 0.5, w(6, "Filter") + 1.2, 3), { t0: s(4) - 0.4, t1: w(6, "Filter") + 0.3, rows: M ? 5 : 3, opacity: 0.52, seed: 11, y: M ? 260 : 60, stays: STAY_CARDS(ctx), stayRows: [1, 3] });
  const how = layer("how", s(4) - 0.1, s(5) + 0.5);
  headline(ctx, how, { lines: [[["Here's how it ", false], ["works.", true]]], x: M ? R.cx : 1000, y: M ? R.top : 420, size: M ? 88 : 92, t0: s(4), t1: s(5) - 0.15, align: M ? "center" : "left", stagger: 0 });
  /* CUT 2 -> 4. A navy slab travels up the frame on the beat the title card
     hands over to the search chapter, its lit edge leading. */
  slabWipe(ctx, s(4) + 0.55, { dir: "up", dur: 0.42 });
  ground(ctx, s(4) + 0.55, s(7) + 0.2, { tone: "navy", y: 15, seed: 13 });
  H.show("n-search2", s(5) - 0.3, w(6, "Filter") + 0.2, { enter: "slide", full: "n-search2-full", scroll: [[w(5, "Nigeria") - 0.3, 0], [w(6, "Filter") - 0.7, 2350, "power2.inOut"], [w(6, "Filter") - 0.2, 0, "power3.inOut"]] });
  H.show("sc-filters", w(6, "Filter") + 0.2, w(6, "save") - 0.1, { enter: "rise" });
  H.show("n-search-all", w(6, "save") - 0.1, w(6, "compare") - 0.3, { enter: "fade", dur: 0.3 });
  H.show("sc-saved", w(6, "compare") - 0.3, s(7) + 0.3, { enter: "slide" });
  H.tap(w(5, "Search") + 0.05, 600, 480);
  /* the row of search chips, held over the row it came from. The crop used to
     run the full width of the display, so it took a slice of the chip that
     the screen itself cuts off ("⌂ A"), and at y 500 the part lay across the
     phone's status bar and island. It now ends after the last whole chip and
     rises in place, over its own row. */
  /* every crop in this cut now sits on its component's OWN edges with a few
     pixels of air (16 October): the chip row ends in the gap after "New
     listed", so no chip and no word is ever cut by the card's rule. */
  lift(ctx, H, { id: "n-search-all", crop: { x: 24, y: 586, w: 1152, h: 146 }, t0: w(5, "Nigeria") - 0.1, t1: w(6, "Filter") + 0.1, to: { x: R.cx, y: 700, s: RS, r: -3 }, exit: "back", seed: 5 });
  H.tap(w(6, "Filter") - 0.05, 1056, 478);
  /* THE SCREEN'S OWN COUNT, ON THE EMPTY BEAT. "Filter by area" had nothing
     on the phone cut, and the number that answers the whole chapter is on
     the filters screen already: its own bar, lifted whole, inside the rule.
     Nothing is drawn, nothing is claimed, and the figure is the product's. */
  if (M) lift(ctx, H, { id: "sc-filters", crop: { x: 31, y: 2623, w: 1250, h: 201 }, t0: w(6, "area") - 0.05, t1: w(6, "save") - 0.45, to: { x: R.cx, y: 500, s: 0.62, r: -2 }, exit: "up", seed: 4 });
  /* TWO PARTS HERE, NOT THREE. The rent/sale/shortlet tabs were lifted onto
     the phone's status bar and island, directly over the identical row on the
     screen below, and they named nothing the voice was saying. Budget and
     bedrooms are left, each over the filter it belongs to, and the lower one
     has dropped 60px: at y 1250 its top corner met the price card's bottom. */
  if (!M) lift(ctx, H, { id: "sc-filters", crop: { x: 40, y: 430, w: 1240, h: 180 }, t0: w(6, "area"), t1: w(6, "save") - 0.3, to: { x: R.cx, y: 230, s: RS, r: -2 }, seed: 6 });
  /* the two crops used to start below their block's own heading, so the
     card's rule cut straight through "Price range" and "Bedrooms". Each now
     opens above its heading and closes under its last row. */
  lift(ctx, H, { id: "sc-filters", crop: { x: 24, y: 668, w: 1272, h: 862 }, t0: w(6, "budget"), t1: w(6, "save") - 0.25, to: { x: R.cx + (M ? 20 : 0), y: M ? 860 : 480, s: RS * 0.85, r: 2 }, seed: 7 });
  lift(ctx, H, { id: "sc-filters", crop: { x: 30, y: 1648, w: 1264, h: 404 }, t0: w(6, "bedrooms"), t1: w(6, "save") - 0.2, to: { x: R.cx - (M ? 20 : 0), y: M ? 1310 : 800, s: RS, r: -2 }, seed: 8 });
  H.tap(w(6, "bedrooms") + 0.5, 660, 2725);
  H.tap(w(6, "love") - 0.1, 1150, 1250);
  ringBurst(ctx, layer("love", w(6, "love") - 0.2, w(6, "love") + 1.6, 870), { ...(() => { const p = H.toStage(w(6, "love"), 1150, 1250); return { cx: p.x, cy: p.y }; })(), r: 70, t: w(6, "love") - 0.05, dots: 12, seed: 9, dur: 0.5 });
  H.tap(w(6, "compare") + 0.2, 230, 975);
  /* the pill waits for the filter parts to clear the label band: it used to
     open while the lowest of them was still on its way out, half a pill deep
     into it. It lands on "the ones you love" instead. */
  kicker(ctx, layer("fomo1", w(6, "save") - 0.2, w(6, "side")), { text: "Save it before it's gone", icon: "heart", x: R.cx, y: M ? 1440 : 860, t0: w(6, "save") + (M ? 0.45 : -0.1), t1: w(6, "side") - 0.3, size: M ? 34 : 30, anchor: "center" });
  /* THE TWO SAVED PLACES, EACH OVER ITS OWN ROW. Side by side, the two parts
     ran 20px off the left and right edges and their corners crossed, and each
     one hung above an identical row still readable on the phone. Stacked at
     the width of the rows they came from, they cover those rows and keep a
     clear band between them. */
  lift(ctx, H, { id: "sc-saved", crop: { x: 28, y: 1093, w: 1254, h: 282 }, t0: w(6, "side") - 0.1, t1: s(7) - 0.05, to: { x: M ? 540 : 1180, y: M ? 985 : 420, s: M ? 0.4 : 0.33, r: -1 }, seed: 10 });
  lift(ctx, H, { id: "sc-saved", crop: { x: 28, y: 1423, w: 1254, h: 282 }, t0: w(6, "side", 2) - 0.1, t1: s(7) - 0.05, to: { x: M ? 540 : 1600, y: M ? 1180 : 470, s: M ? 0.4 : 0.33, r: 1 }, seed: 11 });
  if (!M) {
    const W = windowRig(ctx);
    W.path([
      [s(5) - 0.2, { x: 1960, y: 330, s: 0.58, opacity: 1 }],
      [s(5) + 0.5, { x: 1030, y: 330, s: 0.58, opacity: 1 }, "power3.out"],
      [w(6, "area") - 0.3, { x: 1030, y: 330, s: 0.58, opacity: 1 }],
      [w(6, "area") + 0.3, { x: 1960, y: 330, s: 0.58, opacity: 1 }, "power3.in"],
      [w(6, "area") + 0.4, { x: 1960, y: 330, s: 0.58, opacity: 0 }, "none"],
      [ctx.duration, { x: 1960, y: 330, s: 0.58, opacity: 0 }, "none"],
    ]);
    W.show("d-n-search-all", s(5) - 0.2, w(6, "area") + 0.4, { enter: "cut" });
    W.click(w(5, "Nigeria") + 0.3, 700, 38);
  }

  /* ===================== 5. The whole cost (25.96 - 36.45) ===================== */
  /* CUT 4 -> 5. The brackets close again, on the beat the cost chapter opens. */
  irisTicks(ctx, s(7) - 0.05, { dur: 0.44 });
  ground(ctx, s(7) - 0.05, s(9) + 0.3, { tone: "electric", y: 25, seed: 14 });
  H.show("sc-listing", s(7) - 0.2, w(7, "move-in") + 0.3, { enter: "slide" });
  H.show("sc-listing-cost", w(7, "move-in") + 0.3, s(9) + 0.2, { enter: "rise" });
  H.tap(w(7, "move-in") + 0.05, 200, 2720);
  const cost = layer("cost", s(7), s(9) + 0.3);
  kicker(ctx, cost, { text: "What you will actually pay", icon: "receipt", x: R.cx, y: M ? 1430 : 880, t0: w(7, "whole"), t1: w(7, "move-in") + 0.3, size: M ? 32 : 28, anchor: "center" });
  /* the four crops now run the full width of the cost card, edge to edge, so
     each row is held up inside the card's own borders */
  const lines = [
    { word: "Rent", crop: { x: 30, y: 1048, w: 1260, h: 322 }, y: M ? 508 : 218 },
    { word: "agency", crop: { x: 30, y: 1385, w: 1260, h: 260 }, y: M ? 779 : 412 },
    { word: "legal", crop: { x: 30, y: 1655, w: 1260, h: 250 }, y: M ? 1030 : 594 },
    { word: "caution", crop: { x: 30, y: 2195, w: 1260, h: 370 }, y: M ? 1316 : 790 },
  ];
  lines.forEach((l, i) => lift(ctx, H, { id: "sc-listing-cost", crop: l.crop, t0: w(8, l.word) - 0.05, t1: w(8, "added") - 0.6 + i * 0.05, to: { x: R.cx + (i % 2 ? 14 : -14), y: l.y, s: RS * (M ? 1 : 0.82), r: i % 2 ? 1.5 : -1.5 }, seed: 20 + i }));
  numberCard(ctx, cost, { value: 26100000, label: "Move-in total, every line added", x: R.cx, y: M ? R.top : 330, t0: w(8, "added") - 0.02, t1: w(8, "added") + 1.3, tOut: s(9) - 0.2, size: M ? 96 : 84 });
  /* the film's loud number, echoed once in outline under the card that rolls
     it, in the band the phone has stepped out of (it is at LOW from here).
     The figure is the listing's own: FACTS-OCT, the Maitama villa. */
  if (M) figureOut(ctx, cost, { text: "₦26.1m", x: R.cx, y: 300, size: 110, rot: -3, t0: w(8, "added") + 0.35, t1: s(9) - 0.45, seed: 6 });
  ctx.hidePill(w(8, "added") - 0.3, s(9) - 0.1);

  /* ===================== 6. Price check (36.92 - 41.72) ===================== */
  H.show("sc-price", s(9) - 0.1, s(11) + 0.3, { enter: "slide" });
  const price = layer("price", s(9), s(11));
  H.tap(w(10, "nearby") - 0.1, 1080, 1470);
  listCard(ctx, price, {
    title: "Price check",
    items: [
      ["What homes nearby ask", "Tell Vallo where and what, and it shows what similar places near there are advertised for."],
      ["Never a guess", "If there is not enough nearby to be sure, Vallo says so instead."],
    ],
    x: M ? 540 : 1330, y: M ? 760 : 470, w: M ? 880 : 740, t0: w(10, "price") - 0.05, t1: s(11) - 0.3, rot: -1, size: M ? 36 : 31, seed: 30,
    stagger: Math.max(0.35, w(10, "asking") - w(10, "nearby")),
  });
  /* the card's first line already reads "What homes nearby ask" and the
     caption says it a third time, so the phone cut drops the pill. */
  if (!M) kicker(ctx, price, { text: "What homes nearby are asking", icon: "map-pin", x: R.cx, y: 860, t0: w(10, "asking") - 0.6, t1: s(11) - 0.2, size: 28, anchor: "center" });

  /* ===================== 7. Talk straight to the lister (42.69 - 57.95) ===================== */
  /* CUT 6 -> 7. Seven bars close from alternate sides and open again on the
     violet: the loudest cut of the first half, in the longest gap the voice
     leaves here. */
  shutter(ctx, s(11) - 0.05, { bars: 7, dur: 0.38 });
  ground(ctx, s(11) - 0.05, s(14) + 0.3, { tone: "violet", y: 22, seed: 15 });
  H.show("sc-messages", s(11) - 0.2, w(11, "inside") - 0.2, { enter: "slide" });
  H.show("sc-thread", w(11, "inside") - 0.2, s(15) + 0.2, { enter: "slide" });
  const talk = layer("talk", s(11), s(14));
  /* the pills sat on the phone's status bar and dynamic island: on the phone
     cut they now ride the clear band under the inbox tabs (the thread's photo
     once the screen turns over), well below the top of the screen */
  chipRow(ctx, talk, { items: [["Owner", "key-round"], ["Landlord", "house"], ["Agent", "badge-check"]], x: R.cx, y: M ? 1000 : 220, t0: w(11, "owner"), gap: 0.42, t1: w(11, "inside") + 0.6, size: M ? 34 : 30, wrapW: M ? 1000 : null, anchor: "center" });
  H.tap(w(12, "message") - 0.2, 500, 2775);
  /* THE SENTENCE WAS CUT HERE. The crop held the middle of a message bubble,
     so it read "I like these two as well. Could we view all three" and
     stopped at the card's edge; the rest of that line is hidden behind the
     thread's own banner, so no part and no card could carry it whole. The
     crop takes the banner instead, on its own rounded edges: two whole
     lines, nothing cut. */
  lift(ctx, H, { id: "sc-thread", crop: { x: 80, y: 2344, w: 1156, h: 172 }, t0: w(12, "message") + 0.1, t1: w(12, "call") - 0.4, to: { x: R.cx, y: M ? 540 : 330, s: M ? 0.70 : 0.62, r: -2 }, seed: 31 });
  H.tap(w(12, "call") + 0.15, 1055, 275);
  chipRow(ctx, talk, { items: [["Voice call", "phone"], ["Video call", "video"]], x: R.cx, y: M ? 1430 : 840, t0: w(12, "voice"), gap: 0.35, t1: w(12, "viewing") - 0.3, size: M ? 34 : 30, wrapW: M ? 1000 : null, anchor: "center" });
  H.tap(w(12, "viewing") + 0.1, 330, 850);
  momentCard(ctx, talk, { cap: "Saturday", big: "11:00 AM", check: "Inspection set", x: M ? 330 : 1310, y: M ? 620 : 430, w: M ? 540 : 470, t0: w(12, "viewing") + 0.25, t1: s(13) + 0.6, rot: -3, size: M ? 42 : 36, from: "left", seed: 32 });
  chipRow(ctx, talk, { items: [["In person", "footprints"], ["By video", "video"]], x: R.cx, y: M ? 1430 : 840, t0: w(12, "person"), gap: 0.5, t1: s(13) + 0.2, size: M ? 34 : 30, wrapW: M ? 1000 : null, anchor: "center" });
  const free = layer("free", s(13) - 0.1, s(14) + 0.1);
  /* the phone is at HOME for this one, so the top slot is its status bar and
     island: the chip sat squarely on the clock. It takes the label band, and
     the reminder moves up to leave that band clear. */
  liveChip(ctx, free, { text: "Viewings are always free", x: R.cx, y: M ? 1430 : 230, t0: w(13, "free") - 0.3, t1: s(14) - 0.2, size: M ? 34 : 30, anchor: "center" });
  notify(ctx, free, { title: "Viewing tomorrow, 10:00", line: "Mini flat in Yaba", icon: "bell-ring", x: M ? 90 : 1010, y: M ? 1120 : 560, t: w(13, "reminders") - 0.1, tOut: s(14) - 0.25, size: M ? 36 : 32, example: true });

  /* ===================== 8. Account numbers flagged (58.85 - 64.16) ===================== */
  /* CUT 7 -> 8. A navy slab sweeps left into the gold. */
  slabWipe(ctx, s(14) - 0.05, { dir: "left", dur: 0.4 });
  ground(ctx, s(14) - 0.05, s(15) + 0.2, { tone: "gold", y: 30, seed: 16 });
  sceneBack(ctx, ctx.scene("flag-back", s(14) - 0.2, s(15) + 0.4, { z: 3 }), { scene: "step-3-dark", t0: s(14), t1: s(15) - 0.1, opacity: 0.38 });
  const flag = layer("flag", s(14), s(15) + 0.1, 790);
  const card = flagCard(ctx, flag, M);
  during(ctx, s(14), s(15) + 0.1, (t) => {
    const a = ramp(ctx, t, w(14, "flags") - 0.35, w(14, "flags") + 0.3, "back.out(1.5)");
    const b = ramp(ctx, t, s(15) - 0.45, s(15) - 0.1, "power2.in");
    place(card, { x: M ? 540 : 1380, y: (M ? 760 : 520) + (1 - a) * 60 - b * 60, s: 0.94 + 0.06 * a, o: Math.min(ramp(ctx, t, w(14, "flags") - 0.35, w(14, "flags") - 0.1), 1 - b) });
  });
  ctx.sfx("stamp", w(14, "flags"), { offset: -3 });
  /* the phone is at LOW for this whole chapter, so the band beside it is
     empty: one brand object drifts through it while the card is up. */
  if (M) object3d(ctx, flag, { name: "shield", size: 230, x: 150, y: 1180, t0: w(14, "account") + 0.3, t1: s(15) - 0.35, drift: 1, seed: 16 });
  /* the chapter pill above it already reads "Safe in chat" and the caption
     below reads "number in the chat", so the phone cut leaves the pill out
     and lets the card itself make the point. */
  if (!M) kicker(ctx, flag, { text: "Account number in the chat", icon: "triangle-alert", x: R.cx, y: 220, t0: w(14, "account") - 0.2, t1: w(14, "flags") - 0.3, size: 28, anchor: "center" });

  /* ===================== 9. Protected payment (66.92 - 75.14) ===================== */
  /* CUT 8 -> 9. The frame breaks into tiles and drops away: the loudest cut
     in the film, in the longest silence in it (2.7s after the flag card). */
  tileFall(ctx, s(15) - 0.05, { cols: 6, rows: 10, dur: 0.46, seed: 9 });
  ground(ctx, s(15) - 0.05, s(18) + 0.3, { tone: "emerald", y: 20, seed: 17 });
  H.show("sc-listing-cost", s(15) - 0.2, s(18) + 0.3, { enter: "fade", dur: 0.3 });
  H.tap(w(16, "Pay") - 0.05, 200, 2720);
  const prot = layer("prot", s(15) - 0.1, s(18) + 0.1);
  headline(ctx, prot, { lines: [[["Ready to ", false], ["move in?", true]]], x: M ? R.cx : HX, y: M ? R.top : 200, size: M ? 84 : 80, t0: s(15), t1: s(16) + 0.4, align: M ? "center" : "left", stagger: 0 });
  featureCard(ctx, prot, { icon: "shield-check", title: "Protected payment", line: "Held in escrow by our licensed provider. Released when the deal is done.", x: M ? 540 : 1000, y: M ? 1300 : 420, w: M ? 900 : 760, t0: w(16, "Protected") - 0.1, t1: s(18) - 0.25, size: M ? 38 : 34, anchor: M ? "center" : "left" });
  /* the card below already says who holds the money and when it is released,
     and the caption says it a third time. The pill carries the other half of
     the promise instead, in the platform's own words. */
  /* the platform's own statement is a RULE no screen prints in one place, so
     on the phone cut it takes a container, in the band the phone has left
     empty (it is at LOW until the chapter ends). */
  if (M) popOut(ctx, prot, { kind: "line", lucide: "building-2", tab: "Your money", title: "Vallo never holds your money", line: "Licensed partners hold it.", x: R.cx, y: 480, size: 30, from: "above", t0: w(17, "escrow") - 0.1, t1: s(18) - 0.25, seed: 17 });
  else chipRow(ctx, prot, { items: [["Vallo never holds your money", "building-2"]], x: 1000, y: 240, t0: w(17, "escrow") - 0.1, gap: 0.9, t1: s(18) - 0.25, size: 28, wrapW: 820, anchor: "left" });
  ctx.sfx("lock_click", w(17, "escrow"), { offset: -2 });

  /* ===================== 10. Book a room (75.58 - 82.65) ===================== */
  /* CUT 9 -> 10. The slab sweeps the other way into the dusk ground. */
  slabWipe(ctx, s(18) - 0.05, { dir: "right", dur: 0.4 });
  ground(ctx, s(18) - 0.05, s(20) + 0.2, { tone: "dusk", y: 85, seed: 18 });
  H.show("n-stays", s(18) - 0.2, w(19, "dates") - 0.2, { enter: "slide" });
  H.show("n-staysd", w(19, "dates") - 0.2, s(20) + 0.1, { enter: "slide", full: "n-staysd-full", scroll: [[w(19, "room") - 0.1, 0], [w(19, "room") + 0.7, 1990, "power3.inOut"], [w(19, "shortlet") - 0.2, 1990], [w(19, "shortlet") + 0.5, 3440, "power3.inOut"]] });
  H.tap(s(18) + 0.7, 340, 1920);
  H.tap(w(19, "dates") + 0.15, 520, 1060);
  const dates = layer("dates", w(19, "dates"), w(19, "hotel") + 0.8, 770);
  calendarCard(ctx, dates, { place: "Eko Pearl Apartments · Victoria Island, Lagos", month: "October 2026", days: 31, start: 4, pick: 16, x: M ? 540 : 1330, y: M ? 700 : 470, w: M ? 860 : 700, t0: w(19, "dates") + 0.1, t1: w(19, "hotel") + 0.1, tPick: w(19, "dates") + 0.75, rot: -1, seed: 39, from: "above" });
  H.tap(w(19, "room") - 0.4, 660, 1560);
  const trip = layer("trip", s(18), s(20));
  lift(ctx, H, { id: "n-staysd", src: ctx.src.capture("n-staysd-full"), scrolled: 3440, crop: { x: 30, y: 3720, w: 1252, h: 1390 }, t0: w(19, "full") + 0.05, t1: s(20) - 0.15, to: { x: R.cx, y: M ? 950 : 600, s: M ? 0.46 : 0.36, r: -2 }, seed: 40, radius: 50 });
  /* the total sat at y 300, where the chapter pill cut straight through the
     label and the figure. The pill steps aside, as it does for the move-in
     total, and the card takes the clear band above the phone. */
  numberCard(ctx, trip, { value: 396000, label: "Total for 3 nights, Eko Pearl Apartments", x: R.cx, y: M ? 130 : 120, t0: w(19, "full") + 0.1, t1: w(19, "full") + 0.9, tOut: s(20) - 0.15, size: M ? 84 : 76 });
  if (M) ctx.hidePill(w(19, "full") - 0.35, s(20) - 0.05);
  priceCard(ctx, trip, { name: "Eko Pearl Apartments", figure: "₦132,000", unit: "per night", x: M ? 660 : 1500, y: M ? 1330 : 790, w: M ? 600 : 520, t0: w(19, "room") + 0.5, t1: w(19, "full") - 0.55, rot: 2, size: M ? 38 : 34, seed: 41, from: "right" });
  /* the notice used to open with its top edge across the phone's status bar */
  noticeCard(ctx, trip, { object: "calendar-booked", title: "Room booked", line: "Eko Pearl Apartments · 3 nights", x: M ? 540 : 1330, y: M ? 600 : 300, w: M ? 820 : 700, t0: w(19, "hotel") + 0.45, t1: w(19, "full") - 0.55, rot: 0, size: M ? 38 : 34, seed: 42, from: "above" });
  kicker(ctx, trip, { text: "The full cost before you pay", icon: "badge-check", x: R.cx, y: M ? 1440 : 860, t0: w(19, "full") - 0.2, t1: s(20) - 0.2, size: M ? 32 : 28, anchor: "center" });
  listingWall(ctx, layer("staywall", s(18) - 0.5, w(19, "dates") + 0.5, 3), { t0: s(18) - 0.4, t1: w(19, "dates"), rows: M ? 5 : 3, opacity: 0.55, seed: 21, y: M ? 260 : 60, stays: STAY_CARDS(ctx), stayRows: [0, 1, 2, 3, 4] });
  if (!M) {
    const W2 = windowRig(ctx);
    W2.path([
      [s(18) - 0.2, { x: 1960, y: 300, s: 0.6, opacity: 1 }],
      [s(18) + 0.5, { x: 1000, y: 300, s: 0.6, opacity: 1 }, "power3.out"],
      [w(19, "room") - 0.4, { x: 1000, y: 300, s: 0.6, opacity: 1 }],
      [w(19, "room") + 0.2, { x: 1960, y: 300, s: 0.6, opacity: 1 }, "power3.in"],
      [w(19, "room") + 0.3, { x: 1960, y: 300, s: 0.6, opacity: 0 }, "none"],
    ]);
    W2.show("d-n-stays-dates", s(18) - 0.2, w(19, "room") + 0.3, { enter: "cut" });
    W2.click(w(19, "dates") + 0.2, 1240, 352);
  }

  /* ===================== 11. Reserve a table (83.65 - 89.10) ===================== */
  H.show("sc-restaurants", s(20) - 0.2, w(21, "secure") - 0.3, { enter: "slide" });
  H.show("f-restaurant-reserve", w(21, "secure") - 0.3, s(22) + 0.2, { enter: "slide" });
  H.tap(w(21, "restaurant") + 0.1, 660, 1280);
  H.tap(w(21, "deposit") - 0.1, 390, 2745);
  const table = layer("table", s(20), s(22));
  /* the phone is at HOME here, so a line at y 410 lay across its status bar
     and island: the headline takes the band above the phone and the chapter
     pill waits until it has gone. */
  headline(ctx, table, { lines: [[["Going out ", false], ["tonight?", true]]], x: M ? R.cx : HX, y: M ? 185 : 220, size: M ? 84 : 80, t0: s(20), t1: s(21) + 0.8, align: M ? "center" : "left", stagger: 0 });
  if (M) ctx.hidePill(s(20) - 0.15, s(21) + 1.3);
  /* the reservation row, held over the row it was lifted from: at y 600 it
     floated directly above its own twin, still readable on the screen. */
  /* the restaurant's own facts row, lifted whole on "secure": seafood, smart
     casual, seats 80, in the product's own cells. It leads, and the
     reservation row follows it half a second later. */
  if (M) lift(ctx, H, { id: "f-restaurant-reserve", crop: { x: 133, y: 1432, w: 1050, h: 198 }, t0: w(21, "secure") - 0.05, t1: s(22) - 0.45, to: { x: R.cx, y: 560, s: 0.60, r: 2 }, seed: 44 });
  /* the header card, from its own top edge down: the open chip, the name and
     the place, with air under them. It used to start inside the card. */
  lift(ctx, H, { id: "f-restaurant-reserve", crop: { x: 84, y: 1070, w: 1176, h: 348 }, t0: w(21, "table") - 0.1, t1: s(22) - 0.25, to: { x: R.cx, y: M ? 1030 : 380, s: RS, r: -3 }, seed: 41 });
  chipRow(ctx, table, { items: [["Table deposit", "utensils-crossed"], ["Confirmed by the restaurant", "check"]], x: R.cx, y: M ? 1440 : 860, t0: w(21, "deposit"), gap: 0.5, t1: s(22) - 0.25, size: M ? 30 : 28, wrapW: M ? 960 : 820, anchor: "center" });

  /* ===================== 12. The wallet (90.0 - 96.96) ===================== */
  /* CUT 11 -> 12. The brackets close on the wallet. */
  irisTicks(ctx, s(22) - 0.05, { dur: 0.44 });
  ground(ctx, s(22) - 0.05, s(24) + 0.2, { tone: "electric", y: 18, seed: 19 });
  const WALLET_PATCH = [{ x: 274, y: 2128, w: 870, h: 66, bg: "rgb(5 11 32)", size: 46, weight: 600, lh: 1.3, color: "rgb(222 227 255)", lines: ["Open your account with our partner"] }];
  H.show("n-wallet", s(22) - 0.2, s(24) + 0.3, { enter: "slide", patch: WALLET_PATCH });
  const wal = layer("wallet", s(22), s(24));
  /* the line used to run across the phone's clock and island, and the pill
     over it said "Your wallet" at the same moment. The line takes the band
     above the phone and the pill waits its turn. */
  headline(ctx, wal, { lines: [[["Your Vallo ", false], ["wallet", true]]], x: M ? R.cx : HX, y: M ? 185 : 210, size: M ? 84 : 80, t0: w(22, "wallet") - 0.3, t1: s(23) - 0.2, align: M ? "center" : "left", stagger: 0 });
  if (M) ctx.hidePill(w(22, "wallet") - 0.45, s(23) + 0.25);
  H.tap(w(23, "Add") - 0.3, 1188, 2508);
  lift(ctx, H, { id: "n-wallet", crop: { x: 28, y: 2371, w: 1254, h: 334 }, t0: w(23, "Add") - 0.05, t1: s(24) - 0.25, to: { x: R.cx, y: M ? 720 : 330, s: RS, r: -2 }, seed: 50 });
  chipRow(ctx, wal, { items: [["Add money", "plus"], ["Pay", "credit-card"], ["Send", "send"], ["Withdraw", "arrow-down-to-line"]], x: R.cx, y: M ? 1440 : 860, t0: w(23, "Add"), gap: (w(23, "withdraw") - w(23, "Add")) / 3, t1: s(24) - 0.2, size: M ? 32 : 28, anchor: "center", wrapW: M ? 980 : 860 });

  /* ===================== 13. Every naira (97.5 - 109.78) ===================== */
  /* CUT 12 -> 13. The slab falls down the frame as the phone leaves and the
     list of every naira begins. */
  slabWipe(ctx, s(24) - 0.05, { dir: "down", dur: 0.42 });
  ground(ctx, s(24) - 0.05, s(27) + 0.3, { tone: "navy", y: 45, seed: 20, sparkle: 8 });
  const naira = layer("naira", s(24) - 0.05, s(26) + 0.2, 800);
  const size = M ? 92 : 96;
  /* THE LIST ARRIVES AS IT IS SPOKEN. All four lines used to land inside half
     a second and then sit still in the top third, with the phone gone and
     nothing at all below them for three and a half seconds. Each line now
     lands on its own words, down its own row of the frame, so the picture
     fills as the voice fills it. */
  if (M) {
    const EVERY = [
      { lines: [[["Every ", false], ["naira,", true]]], t0: s(24) },
      { lines: [[["in your wallet,", false]]], t0: w(24, "wallet") - 0.45 },
      { lines: [[["in escrow,", false]]], t0: w(24, "escrow") - 0.45 },
      { lines: [[["in every payment,", false]]], t0: w(24, "payment") - 0.9 },
    ];
    EVERY.forEach(({ lines, t0 }, i) => headline(ctx, naira, { lines, x: 60, y: [500, 730, 960, 1190][i], size, t0, t1: w(24, "held") - 0.8, stagger: 0 }));
  } else {
    headline(ctx, naira, { lines: [[["Every ", false], ["naira,", true]], [["in your wallet,", false]], [["in escrow,", false]], [["in every payment,", false]]], x: 200, y: 150, size, t0: s(24), t1: w(24, "held") - 0.64, stagger: 0.045 });
  }
  /* daylight for the promise: white paper, dark type, and the money's route
     drawn down a rail, the way the founder's favourite cut said it */
  /* THE INK LEAVES BEFORE THE PAPER DOES. White type exiting over white paper
     ghosts out invisibly. The list's last word's exit runs 0.62 s past its t1,
     so the list is wholly gone before the daylight ground arrives. */
  const DAY0 = w(24, "held");
  const DAY1 = s(26) - 0.1;
  ground(ctx, DAY0, DAY1, { tone: "day", y: 40, seed: 34, sparkle: 0, z: 2 });
  ctx.hidePill(DAY0 - 0.1, DAY1 + 0.1);
  const INKC = "#0b1230";
  headline(ctx, naira, { lines: [[["held by our", false]], [["licensed provider.", true]]], x: M ? 70 : ctx.W / 2, y: M ? 300 : 150, size: size * (M ? 0.95 : 0.9), t0: w(24, "held") + 0.06, t1: s(25) - 0.2, stagger: 0, color: INKC, key: "#0069fe", sheen: false, align: M ? "left" : "center" });
  /* the ink type and the rail are off the frame before the white goes: left a
     moment longer they turned dark blue on dark navy as the day faded. */
  headline(ctx, naira, { lines: [[["Never by ", false], ["Vallo.", true]]], x: ctx.W / 2, y: M ? 560 : 320, size: size * (M ? 1.2 : 1.05), t0: s(25) - 0.05, t1: s(26) - 0.55, align: "center", stagger: 0, color: INKC, key: "#0069fe", sheen: false });
  flowRail(ctx, naira, {
    steps: ["Your card", "Our licensed provider", "The owner's bank"],
    x: M ? 170 : 660, y: M ? 880 : 470, gap: M ? 255 : 192, size: M ? 46 : 38,
    t0: w(24, "held") + 0.15, t1: s(26) - 0.75, seed: 35,
  });
  ctx.sfx("stamp", s(25) + 0.05, { offset: 0 });
  ctx.hideCaptions(s(24) - 0.1, s(26) - 0.1);
  ctx.hidePill(s(24) - 0.2, s(27) - 0.1);
  H.show("sc-payments", s(26) - 0.8, s(27) + 0.2, { enter: "cut" });
  const rec = layer("receipts", s(26) - 0.1, s(27));
  /* the record, held over the record: at y 600 the part lay on the phone's
     status bar with its own twin still legible underneath it. */
  /* the record card from its own top edge: the heading, the figure and the
     whole sentence under it. The crop used to start across the figure. */
  lift(ctx, H, { id: "sc-payments", crop: { x: 28, y: 663, w: 1264, h: 484 }, t0: w(26, "receipt") - 0.1, t1: s(27) - 0.25, to: { x: R.cx, y: M ? 1040 : 360, s: RS * 0.95, r: -2 }, seed: 54 });
  /* two pills this wide wrapped onto two rows and the second row landed on
     the caption. The two rules go in one container instead, in the band the
     phone has left empty: neither screen prints them in one place. */
  if (M) popOut(ctx, rec, { kind: "line", lucide: "receipt", tab: "Payments", title: "A receipt for every payment", line: "Vallo earns only when a deal is done.", x: R.cx, y: 470, size: 32, from: "above", t0: w(26, "receipt") + 0.2, t1: s(27) - 0.45, seed: 54 });
  else chipRow(ctx, rec, { items: [["A receipt for every payment", "receipt"], ["Vallo earns only when a deal is done", "handshake"]], x: R.cx, y: 860, t0: w(26, "receipt") + 0.2, gap: 1.3, t1: s(27) - 0.25, size: 26, wrapW: 840, anchor: "center" });

  /* ===================== 14. Checked by a person (110.77 - 119.45) ===================== */
  /* CUT 13 -> 14. The bars close once more, into the verification chapter. */
  shutter(ctx, s(27) - 0.05, { bars: 7, dur: 0.36 });
  ground(ctx, s(27) - 0.05, s(28) + 0.3, { tone: "electric", y: 25, seed: 21 });
  sceneBack(ctx, ctx.scene("ver-back", s(27) - 0.3, s(28) + 0.5, { z: 3 }), { scene: "step-2-dark", t0: s(27) - 0.2, t1: s(28) - 0.1, opacity: 0.42 });
  H.show("sc-verification", s(27) - 0.2, s(28) + 0.3, { enter: "slide" });
  const ver = layer("ver", s(27), s(28) + 0.1);
  listCard(ctx, ver, {
    title: "What is checked",
    items: [
      ["Your ID", "One government issued document showing your face and name."],
      ["Your address", "Confirmed against the document you gave."],
      ["A bank account", "In your own name, matching your ID."],
      ["A real person", "Someone at Vallo reads it, every time."],
    ],
    x: M ? 540 : 1330, y: M ? 760 : 470, w: M ? 880 : 740,
    /* a step a second left the card standing three quarters empty for three
       seconds at a stretch: the four lines now fill it in a beat and a half */
    t0: w(27, "owner") - 0.1, t1: s(28) - 0.3, rot: -1, size: M ? 36 : 31, seed: 60, stagger: M ? 0.35 : Math.max(0.3, (w(27, "person") - w(27, "owner")) / 3),
  });
  /* the pill above says "Checked by a person", the card's last line says a
     real person reads it and the caption says it again, so on the phone the
     stamp carries the screen's own heading instead. */
  proofCard(ctx, ver, { lines: M ? ["Four steps, in order."] : ["Checked by a real", "person at Vallo."], x: M ? 420 : 560, y: M ? 1430 : 820, w: M ? 640 : 560, t0: w(27, "person") + 0.1, t1: s(28) - 0.25, rot: -2, size: M ? 42 : 36, seed: 64, from: "left" });

  /* ===================== 15. Ask anything (120.0 - 125.9) ===================== */
  /* CUT 14 -> 15. The brackets close on the question. */
  irisTicks(ctx, s(28) - 0.05, { dur: 0.44 });
  ground(ctx, s(28) - 0.05, s(31) + 0.3, { tone: "violet", y: 30, seed: 22 });
  H.show("sc-assistant-start", s(28) - 0.2, s(31) + 0.3, { enter: "slide" });
  H.tap(s(29) + 0.3, 600, 2480);
  /* both crops cut a neighbour mid-shape: the bubble's took half the sender's
     avatar, and the chip row's ended inside the second suggestion, on "What
     will it cost me t". Each now holds one whole element with a margin. */
  lift(ctx, H, { id: "sc-assistant", crop: { x: 96, y: 572, w: 1190, h: 302 }, t0: w(29, "time") - 0.3, t1: s(31) - 0.25, to: { x: R.cx, y: M ? 700 : 340, s: RS, r: -3 }, seed: 70, label: "Your question, in the chat" });
  lift(ctx, H, { id: "sc-assistant-start", crop: { x: 26, y: 2399, w: 754, h: 192 }, t0: s(28) + 0.45, t1: w(29, "time") - 0.4, to: { x: R.cx, y: M ? 1250 : 760, s: M ? 0.78 : 0.62, r: 2 }, seed: 71, label: "A question to start with" });
  const ai = layer("ai", s(28), s(31));
  kicker(ctx, ai, { text: "Always says it is an AI", icon: "sparkles", x: R.cx, y: M ? 1440 : 860, t0: w(30, "AI") - 0.5, t1: s(31) - 0.2, size: M ? 32 : 28, anchor: "center" });
  /* the band under the lifted question is empty for three seconds: one brand
     object drifts through it, on "any time of day". Not the assistant's own
     object: the screen under it is already drawing that face. */
  if (M) object3d(ctx, ai, { name: "clock", size: 200, x: 890, y: 1180, t0: w(29, "time") + 0.1, t1: s(31) - 0.4, drift: 1, seed: 22 });

  /* ===================== 16. Your language (126.35 - 131.44) ===================== */
  /* CUT 15 -> 16. The frame breaks into tiles a second time, into the dusk. */
  tileFall(ctx, s(31) - 0.05, { cols: 6, rows: 10, dur: 0.44, seed: 13 });
  ground(ctx, s(31) - 0.05, s(33) - 0.2, { tone: "dusk", y: 80, seed: 23 });
  H.show("n-welcome-en", s(31) - 0.2, w(32, "Hausa") - 0.1, { enter: "slide" });
  /* EACH LANGUAGE WHOLE, ON ITS OWN WORD. The four welcome screens used to
     slide in over one another, and the words are six tenths of a second
     apart, so a frame caught two of them at once: half a phone of Hausa
     beside half a phone of Yorùbá. They cut on the word now, and the swipe
     the slide used to carry is kept. */
  [["n-welcome-ha", "Hausa", "Yorùbá"], ["n-welcome-yo", "Yorùbá", "Igbo"], ["n-welcome-ig", "Igbo", null]].forEach(([id, word, next]) => {
    const t0 = w(32, word) - 0.1;
    H.show(id, t0, next ? w(32, next) - 0.1 : s(33) + 0.5, { enter: "cut" });
    ctx.sfx("swipe", t0, { offset: -4 });
    /* a light whip carries each swipe: a quick move inside a chapter, never
       a chapter change, and it keeps the swipe's own sound. */
    whipPan(ctx, t0, { dir: "left", dur: 0.22, sound: null });
  });
  /* NO PART HERE ON THE PHONE. Four parts in two and a half seconds cannot
     be done in this frame: each one needed four tenths of a second to fly in
     and six to leave, so every language was still on its way out when the
     next arrived, two labels deep in the same spot (the checker reads a
     third of each on top of the other), and each part carried a button the
     screen below it was already showing whole. The phone says the language
     itself, and the pills name the four. */
  if (!M) [["n-welcome-en", "English", -3], ["n-welcome-ha", "Hausa", 3], ["n-welcome-yo", "Yorùbá", -2], ["n-welcome-ig", "Igbo", 2]].forEach(([id, word, r], i) => {
    const t0 = w(32, word) + 0.25;
    const t1 = i < 3 ? w(32, ["Hausa", "Yorùbá", "Igbo"][i]) + 0.1 : s(33) - 1.25;
    lift(ctx, H, { id, crop: { x: 18, y: 2390, w: 1284, h: 430 }, t0, t1, to: { x: R.cx, y: 340, s: RS, r }, exit: "up", seed: 80 + i, fly: 0.4, label: `Welcome screen, ${word}` });
  });
  const lang = layer("lang", s(31), s(33));
  chipRow(ctx, lang, { items: [["English"], ["Hausa"], ["Yorùbá"], ["Igbo"]], x: R.cx, y: M ? 1000 : 700, t0: w(32, "English") - 0.05, gap: 0.62, t1: s(33) - 1.3, size: 32, wrapW: M ? 1000 : 900, anchor: "center" });
  /* nothing is lifted in this chapter on the phone cut (four parts in two
     and a half seconds cannot be done in this frame), so three badges ride
     the margins while the phone says the language itself. */
  if (M) {
    /* they wait for the lifted question of the chapter before to clear */
    badgeDisc(ctx, lang, { name: "vallo", kind: "mark", x: 120, y: 640, size: 130, t0: w(31, "speaks"), t1: s(33) - 1.5, tone: "paper", seed: 23 });
    badgeDisc(ctx, lang, { name: "languages", kind: "glyph", x: 960, y: 700, size: 126, t0: w(31, "language"), t1: s(33) - 1.5, seed: 24 });
    badgeDisc(ctx, lang, { name: "message-circle", kind: "glyph", x: 140, y: 1270, size: 122, t0: w(32, "English"), t1: s(33) - 1.5, seed: 25 });
  }

  /* ===================== 17. The end card ===================== */
  ending(ctx, { t0: s(33), tLine: s(34) - 0.05, tBadges: s(35) - 0.1, tUrl: s(36) + 0.4, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: M ? 0.56 : 0.28 });
}

void opa;
