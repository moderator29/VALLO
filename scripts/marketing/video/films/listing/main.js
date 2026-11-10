/*
 * THE LISTING FILM, "List your own place, no agency fee" (films/listing/timeline.json).
 *
 * Spoken to owners, so it is the steadiest of the three shorts: fewer, longer
 * held beats, and almost everything it holds up is a part of the live product
 * rather than something we drew. One phone carries it, the real screens of the
 * owner's own flow run on it, and the words that matter are the product's own
 * words, cropped on their components' own edges (films/blocks.py).
 *
 * THE ONE THING THIS FILM MUST NEVER SAY is that a workspace goes live on
 * being described. Every workspace on Vallo is an application: the Add a
 * workspace screen says each one "gets its own tools and its own checks", and
 * the flow's last step is "Check and send". So sentence three ends on the
 * send, not on a listing appearing in search.
 *
 * Claims and figures: FACTS-OCT.md. The payments provider is never named
 * (the Agreements screen's own paragraph says "our payment processor", and
 * that paragraph is lifted whole rather than paraphrased).
 *
 * Nothing here refers to a number of seconds: the clock is provisional and
 * every beat re-anchors itself on s(i), e(i) and w(i, "word").
 */
import {
  anchors, ground, hero, lift, headline, ending, openerOwner, popOut, badgeDisc,
  object3d, installFocus, slabWipe, shutter, irisTicks, tileFall, whipPan,
} from "../kit.js";
import { placeBack, strikeThrough } from "./parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, w, wq } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  /* The cut into sentence i. The gaps this voice leaves between lines are
     about a third of a second, so a transition is hung a breath ahead of the
     word and opens over the first syllable, the way the long films hang
     theirs. The loud two (tileFall, shutter) are given a shorter sweep so
     they are open again before the line is under way. */
  const cut = (i) => s(i) - 0.12;
  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });

  /* ---------- the stage ---------- */
  const CX = 540;
  /* HOME: the phone at reading size, its glass from y 398 to 1752.
     LOW: stepped back, so the band from the pill down to y 700 is free for a
     container. The chapter pill sits at y 290..360 and the captions at 1580,
     so nothing of ours lands in either without ctx.hidePill / hideCaptions. */
  const HOME = { cx: CX, cy: 1075, height: 1380 };
  const LOW = { cx: CX, cy: 1265, height: 1150 };
  const off = (p) => ({ ...p, cy: p.cy + 1750 });
  /* the push onto the cost breakdown: the rows of the listing's own price
     sheet aimed at the middle of the frame, with 100px of air each side */
  const COST = H.aim(660, 1700, 1950, CX, 1000);

  H.path([
    [0, { ...off(LOW), opacity: 0 }],
    /* THE PHONE'S FIRST RISE, on "list it yourself". It comes up to the low
       pose, under the opening line and clear of it, so the last beat of
       sentence one is the owner's own screen arriving rather than three
       seconds of a title card sitting still. It takes the reading pose behind
       the opening cut's slab. */
    [s(1) + 0.45, { ...off(LOW), opacity: 1 }, "none"],
    [w(1, "list") - 0.15, { ...off(LOW) }, "none"],
    [w(1, "list") + 0.75, { ...LOW }, "power3.out"],
    [cut(2) - 0.05, { ...LOW }],
    [cut(2) + 0.30, { ...HOME }, "power3.out"],
    /* the phone steps back for the struck fee, so the container stands in a
       clear band rather than across the screen's own heading */
    [w(2, "middle") - 0.45, { ...HOME }],
    [w(2, "middle") + 0.35, { ...LOW }],
    [cut(3) - 0.15, { ...LOW }],
    /* and takes the reading pose again inside the cut into the flow */
    [cut(3) + 0.30, { ...HOME }, "power3.out"],
    /* the workspace flow: the phone steps back so the steps have a band */
    [w(3, "price") - 0.75, { ...HOME }],
    [w(3, "price") + 0.05, { ...LOW }],
    [cut(4) + 0.05, { ...LOW }],
    [cut(4) + 0.52, { ...HOME }],
    /* the cost: a push onto the breakdown itself, then back for the total */
    [w(4, "so") - 0.20, { ...HOME }],
    [w(4, "call") + 0.05, COST, "power2.inOut"],
    [w(4, "already") - 0.35, COST],
    [w(4, "already") + 0.15, { ...LOW }],
    [cut(5) + 0.05, { ...LOW }],
    [cut(5) + 0.50, { ...HOME }],
    [w(6, "through") - 0.35, { ...HOME }],
    [w(6, "through") + 0.25, { ...LOW }],
    /* the promise is said with the phone away */
    [cut(7) - 0.45, { ...LOW }],
    [cut(7) - 0.02, { ...off(LOW), ry: 18, rz: -5 }, "power3.in"],
    [cut(7) + 0.35, { ...off(LOW), opacity: 0 }, "none"],
    [ctx.duration, { ...off(LOW), opacity: 0 }, "none"],
  ]);
  H.swing(cut(3), cut(4), cut(5), cut(6));

  /* ---------- the screens ---------- */
  H.show("host-start", w(1, "list") - 0.1, cut(3) + 0.05, { enter: "cut" });
  H.show("f-host-start", cut(3) + 0.05, w(3, "tell") + 0.30, { enter: "cut" });
  H.show("f-agent-listing-edit", w(3, "tell") + 0.30, cut(4) + 0.08, { enter: "slide" });
  H.show("sc-listing-cost", cut(4) + 0.08, cut(5) + 0.08, { enter: "rise" });
  H.show("f-agent-inspections", cut(5) + 0.08, w(5, "report") - 0.10, { enter: "slide" });
  H.show("f-agreements", w(5, "report") - 0.10, cut(7) - 0.05, { enter: "slide" });

  /* ===================== 1. The opening frame (built, approved) ============ */
  ground(ctx, 0, cut(2), { tone: "navy", y: 26, seed: 11 });
  const open = layer("open", 0, cut(2));
  openerOwner(ctx, open, { t1: s(1) - 0.15 });
  /* the opener's composed still clears on the first word, and a photographed
     place takes the field under the line, BEHIND the phone (z 3), so the
     frame is never empty and the handset rises out of the building */
  placeBack(ctx, ctx.scene("open-place", s(1), cut(2), { z: 3 }), { scene: "house", t0: s(1) + 0.15, t1: s(2) - 0.45, y: 880, opacity: 0.44 });
  headline(ctx, open, {
    lines: [[["If you own a place,", false]], [["list it ", false], ["yourself.", true]]],
    x: M ? 60 : 160, y: M ? 430 : 230, size: M ? 100 : 104, t0: s(1) - 0.05, t1: s(2) - 0.5, stagger: 0, keyStyle: "chip",
  });
  ctx.hideCaptions(s(1) - 0.2, s(2) - 0.3);

  /* ===================== 2. No agency fee ================================= */
  /* CUT 1 -> 2. A navy slab travels up the frame, its lit edge leading, and
     the phone rises into place behind it. */
  slabWipe(ctx, cut(2), { dir: "up", dur: 0.34 });
  ground(ctx, cut(2), cut(3), { tone: "electric", y: 20, seed: 12 });
  const fee = layer("fee", cut(2), cut(3) + 0.1);

  /* THE FILM'S WHOLE CLAIM, IN THE PRODUCT'S OWN TYPE. "I own the property /
     List it yourself. No agency fee." is a row of the live Add a workspace
     screen, cropped on the row card's own rounded edges (blocks.py: the card
     runs y 1912..2173) and dropped back over the place it came from, a third
     larger, the way the blueprint does it. Nothing is drawn and nothing is
     claimed: this is the screen saying it. */
  lift(ctx, H, {
    id: "host-start", crop: { x: 44, y: 1904, w: 1232, h: 278 },
    t0: w(2, "agency") - 0.12, t1: w(2, "did") - 0.15,
    /* it rests just under the screen's own sub-line: a few pixels higher and
       the card's rule ran through "Add a workspace" once the phone stepped
       back, which is the founder's standing complaint */
    to: { x: CX, y: 1075, s: 0.72, r: -2 }, seed: 1, radius: 44,
  });
  /* the caption would print "No agency fee." under a part that already says
     it in the product's own words, so it waits for the second clause */
  ctx.hideCaptions(s(2) - 0.15, w(2, "No", 2) - 0.15);

  /* AND THE CUT THAT IS NOT TAKEN. The figure is the example listing's own
     (sc-listing-cost prints "Agency fee ... 10.0% of a year's rent"), held up
     in a container because no screen prints it as a rule, and struck through
     on the word "cut". */
  const feeOut = popOut(ctx, fee, {
    kind: "stat", lucide: "percent", tab: "Agency fee", figure: "10.0%", unit: "of a year's rent",
    note: "Not when you list it yourself.",
    x: CX, y: 555, t0: w(2, "middle") + 0.05, t1: cut(3) - 0.42, size: 32, from: "above", seed: 2,
  });
  strikeThrough(ctx, feeOut.rows[1], { t0: w(2, "cut"), dur: 0.44 });

  /* two of the brand's discs ride the margins beside the handset */
  badgeDisc(ctx, fee, { name: "price-tag", x: 112, y: 1310, size: 128, t0: w(2, "fee") + 0.15, t1: cut(3) - 0.5, seed: 3 });
  badgeDisc(ctx, fee, { name: "contract", x: 972, y: 770, size: 126, t0: w(2, "man") + 0.15, t1: cut(3) - 0.45, seed: 4 });

  /* ===================== 3. Add a workspace, and send it =================== */
  /* CUT 2 -> 3. The frame breaks into tiles and drops away. */
  tileFall(ctx, cut(3), { cols: 6, rows: 10, dur: 0.28, seed: 9 });
  ground(ctx, cut(3), cut(4), { tone: "navy", y: 15, seed: 13 });
  const flow = layer("flow", cut(3), cut(4) + 0.1);

  /* THE SCREEN'S OWN HEADING, WITH THE SENTENCE THAT MATTERS UNDER IT: "Each
     workspace gets its own tools and its own checks." That line is why this
     film never shows a place going live on being described. */
  lift(ctx, H, {
    id: "f-host-start", crop: { x: 30, y: 694, w: 1256, h: 300 },
    /* it leaves while the wizard is still sliding in under it: held any
       longer it hung half faded over the new screen's own heading */
    t0: w(3, "workspace") - 0.12, t1: w(3, "Vallo") + 0.05,
    to: { x: CX, y: 790, s: 0.60, r: -1.5 }, seed: 5, radius: 20,
  });
  H.tap(w(3, "tell") - 0.15, 660, 2355);

  /* the step the pointer opened: the wizard's first question, whole, over the
     place it came from (its own block runs y 1758..1980 on the screen) */
  lift(ctx, H, {
    id: "f-agent-listing-edit", crop: { x: 36, y: 1756, w: 1252, h: 228 },
    t0: w(3, "place") - 0.12, t1: w(3, "and", 2) - 0.45,
    to: { x: CX, y: 1180, s: 0.62, r: 1.5 }, seed: 6, radius: 20,
  });
  /* a light whip carries the move from the list to the wizard: a quick move
     inside a chapter, never a chapter change */
  whipPan(ctx, w(3, "tell") + 0.30, { dir: "left", dur: 0.22, sound: null });

  /* THE CONTAINERS COME IN HALF A SECOND EARLY, and their words land on the
     word. A pop-out takes about that long to assemble itself, so brought in
     on the beat it was still an empty slab when the beat had passed; brought
     in early, the slab is the anticipation and the type is on the voice. */
  /* the price step, named as the product names it (step six of eight) */
  popOut(ctx, flow, {
    kind: "line", lucide: "tag", tab: "Step six of eight", title: "The price",
    line: "And what it includes.",
    x: CX, y: 480, t0: w(3, "price") - 0.50, t1: w(3, "and", 2) - 0.79, size: 30, from: "above", seed: 7,
  });
  /* THE LAST STEP, AND THE ONE LOUD CONTAINER IN THE FILM. "Check and send"
     and "Nothing is submitted until you press the button on this screen" are
     the flow's own words (lib/host/onboarding.ts). The beat ends on the send. */
  popOut(ctx, flow, {
    kind: "line", lucide: "send-horizontal", tab: "The last step", title: "Check and send",
    line: "Nothing is sent until you press it.",
    x: CX, y: 430, t0: wq(3, "send", ["it", 2]) - 0.50, t1: cut(4) - 0.40, size: 30, from: "below", accent: "electric", seed: 8,
  });
  ctx.hidePill(wq(3, "send", ["it", 2]) - 0.5, cut(4) - 0.05);
  object3d(ctx, flow, { name: "checklist", size: 210, x: 905, y: 980, t0: wq(3, "checks", "live") - 0.25, t1: cut(4) - 0.35, drift: 1, seed: 14 });

  /* ===================== 4. The whole cost, on the listing ================= */
  /* CUT 3 -> 4. Four tick brackets close on the centre and bloom. */
  irisTicks(ctx, cut(4), { dur: 0.34 });
  ground(ctx, cut(4), cut(5), { tone: "electric", y: 25, seed: 15 });

  /* the renter's side of the same place, and its own promise at the top of
     the cost sheet (blocks.py: the heading runs y 481..724) */
  lift(ctx, H, {
    id: "sc-listing-cost", crop: { x: 30, y: 462, w: 1190, h: 282 },
    /* it is gone before the push brings the same heading up on the glass */
    t0: w(4, "whole") - 0.12, t1: w(4, "so") - 0.30,
    to: { x: CX, y: 700, s: 0.64, r: -1.5 }, seed: 20, radius: 20,
  });
  /* VIDEO ONE HELD THE FOUR COST ROWS UP ONE BY ONE. This film has two thirds
     of the time for the same beat, so it does the opposite: the camera pushes
     onto the breakdown itself and the viewer reads rent, agency fee, legal
     fee, agreement fee and the refundable caution deposit off the glass, at
     size, in the product's own card. (The pose is in H.path.)
     NOTHING ELSE IS ON THE STAGE FOR IT. A brand object drifting at the left
     margin sat across the "Agreement fee" row once the push was deep, and the
     whole point of the push is that those rows are read. */

  /* THE REAL NUMBER, AS THE LISTING PRINTS IT. The move-in total is the
     listing's own sticky bar, lifted off it rather than counted up by us: the
     figure a renter has already seen before anybody picks up a phone. The
     crop stops before the bar's buttons, so no control is cut in half. */
  lift(ctx, H, {
    id: "sc-listing-cost", crop: { x: 26, y: 2676, w: 288, h: 140 },
    t0: w(4, "already") + 0.32, t1: cut(5) - 0.42,
    to: { x: CX, y: 430, s: 1.55, r: -2 }, seed: 21, radius: 22, fly: 0.78,
  });
  /* the push brings the cost sheet's own heading up under the pill, and the
     pill sat squarely across "Every cost this lister has declared": it steps
     aside from the moment the push is deep until the chapter turns */
  ctx.hidePill(w(4, "call") - 0.35, cut(5) - 0.05);

  /* ===================== 5. Inspect, read the report, then agree ========== */
  /* CUT 4 -> 5. Bars close from alternate sides and open again. */
  shutter(ctx, cut(5), { bars: 7, dur: 0.28 });
  ground(ctx, cut(5), cut(6), { tone: "violet", y: 22, seed: 17 });
  const deal = layer("deal", cut(5), cut(6) + 0.1);

  /* "Property inspection / Check the property, confirm details, submit your
     report." One crop carries the ask and the report both, and it is taken
     low enough to keep the whole of the screen's own house object. */
  lift(ctx, H, {
    id: "f-agent-inspections", crop: { x: 30, y: 1164, w: 1240, h: 262 },
    t0: w(5, "inspection") - 0.12, t1: w(5, "Then") - 0.45,
    to: { x: CX, y: 900, s: 0.64, r: -2 }, seed: 22, radius: 20,
  });
  whipPan(ctx, w(5, "report") - 0.10, { dir: "left", dur: 0.22, sound: null });
  /* and the Agreements screen answering the last clause in its own words */
  lift(ctx, H, {
    id: "f-agreements", crop: { x: 120, y: 2120, w: 1082, h: 238 },
    t0: w(5, "agreement") - 0.50, t1: cut(6) - 0.32,
    to: { x: CX, y: 1120, s: 0.72, r: 1.5 }, seed: 23, radius: 20,
  });
  object3d(ctx, deal, { name: "contract", size: 220, x: 905, y: 600, t0: w(5, "agreement") - 0.15, t1: cut(6) - 0.38, drift: 1, seed: 18 });

  /* ===================== 6. Straight to your own bank account ============= */
  /* CUT 5 -> 6. The slab sweeps left into the emerald. */
  slabWipe(ctx, cut(6), { dir: "left", dur: 0.34 });
  ground(ctx, cut(6), cut(7), { tone: "emerald", y: 20, seed: 19 });
  const paid = layer("paid", cut(6), cut(7) + 0.1);

  /* THE STRONGEST PROOF IN THE FILM, AND IT IS NOT OURS. The Agreements
     screen prints, verbatim: "Vallo never holds your money. When you pay, the
     owner's or agent's share goes straight to their bank account through our
     payment processor, in the same transaction." It is lifted whole, over the
     place it sits, so the film quotes the product rather than the other way
     round. The paragraph names no provider, which is the rule. */
  lift(ctx, H, {
    id: "f-agreements", crop: { x: 30, y: 1068, w: 1256, h: 210 },
    t0: w(6, "share") - 0.12, t1: w(6, "through") - 0.05,
    to: { x: CX, y: 980, s: 0.68, r: -1.5 }, seed: 24, radius: 16,
    label: "The Agreements screen, word for word",
  });
  object3d(ctx, paid, { name: "bank", size: 230, x: 125, y: 690, t0: w(6, "bank") - 0.2, t1: cut(7) - 0.45, drift: 1, seed: 25 });
  popOut(ctx, paid, {
    kind: "line", lucide: "shield-check", tab: "In the same transaction", title: "Our licensed payments provider",
    x: CX, y: 420, t0: w(6, "licensed") - 0.50, t1: cut(7) - 0.40, size: 32, from: "above", seed: 26,
  });
  ctx.hidePill(w(6, "licensed") - 0.5, cut(7));

  /* ===================== 7. Vallo never holds your money ================== */
  /* CUT 6 -> 7. The frame breaks into tiles a second time and the phone is
     gone when it clears: the one line in the film that stands on its own. */
  tileFall(ctx, cut(7), { cols: 6, rows: 10, dur: 0.28, seed: 13 });
  /* it runs a little past the last container, so the end card's own field
     fades in over a lit stage rather than over black */
  ground(ctx, cut(7), s(9) + 0.3, { tone: "electric", y: 28, seed: 27, sparkle: 8 });
  const vow = layer("vow", cut(7), s(9) - 0.1, 800);
  headline(ctx, vow, {
    lines: [[["Vallo ", false], ["never", true]], [["holds your money.", false]]],
    x: CX, y: 720, size: 96, t0: w(7, "Vallo") - 0.1, t1: s(8) - 0.42, align: "center", stagger: 0, keyStyle: "chip",
  });
  ctx.hideCaptions(s(7) - 0.2, s(8) - 0.25);
  badgeDisc(ctx, vow, { name: "bank", x: 130, y: 460, size: 138, t0: w(7, "never") - 0.1, t1: s(8) - 0.5, seed: 28 });
  badgeDisc(ctx, vow, { name: "vallo", kind: "mark", x: 950, y: 560, size: 130, t0: w(7, "holds") - 0.05, t1: s(8) - 0.5, tone: "paper", seed: 29 });
  badgeDisc(ctx, vow, { name: "lock", kind: "glyph", x: 160, y: 1270, size: 126, t0: w(7, "money") - 0.05, t1: s(8) - 0.5, seed: 30 });
  ctx.sfx("lock_click", w(7, "holds"), { offset: -2 });

  /* ---- Your place. Your price. Your account.: three phrases, three containers ---- */
  const mine = layer("mine", s(8) - 0.8, s(9) + 0.25, 800);
  /* A CONTAINER TAKES HALF A SECOND TO BUILD ITSELF, and at this speaking
     rate the three phrases are six tenths apart: brought in ON the word, the
     third one was still an empty box when the ending arrived. Each one now
     starts half a second early, so the slab is the anticipation and the words
     inside it land exactly on the phrase that names them. */
  [
    ["house", "Your place", "You put it up yourself", "place", 600, "left", 31, 0.00],
    ["tag", "Your price", "You set it, and what it includes", "price", 950, "right", 32, 0.04],
    ["landmark", "Your account", "Your share lands in it", "account", 1300, "left", 33, 0.08],
  ].forEach(([lucide, tab, title, word, y, from, seed, late]) => {
    popOut(ctx, mine, {
      kind: "line", lucide, tab, title,
      x: CX, y, t0: w(8, word) - 0.50, t1: s(9) - 0.30 + late, size: 32, from, seed,
    });
  });
  /* the three tabs print the three phrases, so the caption stays down until
     the end card takes over the words itself */
  ctx.hideCaptions(s(8) - 0.2, s(9) - 0.05);

  /* ===================== 8. The end card =================================== */
  /* the mark lands on "Vallo." itself: at this speaking rate the old lead-in
     opened over the last word of the sentence before it */
  ending(ctx, { t0: s(9) + 0.08, tLine: w(9, "Real") - 0.05, tBadges: s(9) + 1.05, tUrl: s(9) + 1.65, t1: ctx.duration });

  /* last, so every part has registered the moment it is held up */
  installFocus(ctx, { strength: 0.5 });
}

void 0;
