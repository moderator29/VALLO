/*
 * THE REFERRAL FILM, "Vallo pays you to bring people" (films/referral/timeline.json).
 *
 * One phone carries it, and the phone is on the Rewards screens the whole
 * way: the invite link, the ₦80 rule, the balance, the withdraw sheet and
 * the terms plate. Every figure on the stage is a figure the product prints
 * (supabase/migrations/20261008195310_d85_referral_signup_80_invite_and_earn.sql,
 * FACTS-OCT.md): ₦80 for each friend who SIGNS UP FULLY, up to 1,500
 * qualified referrals a month, withdraw once the Rewards Balance reaches
 * ₦1,000. The Rewards Balance is what Vallo owes you, so it is never drawn
 * as a wallet and no balance is ever invented: the only money on the stage
 * is ₦80, ₦1,000 and the screens' own ₦0.
 *
 * The clock is provisional and will be replaced by the aligner, so nothing
 * here refers to a number of seconds: every beat hangs on s(i), e(i) and
 * w(i, "word"). The voice leaves about a third of a second between lines, so
 * each chapter is cut on that breath (`cut(i)`) with a short transition.
 */
import {
  anchors, ground, hero, lift, headline, kicker, ending, openerReward,
  popOut, badgeDisc, object3d, installFocus,
  slabWipe, shutter, irisTicks, tileFall, whipPan,
} from "../kit.js";
import { strikeOut, bigRoll } from "./parts.js";

export async function build(ctx) {
  const M = ctx.isMobile;
  const { s, e, w, wq } = anchors(ctx);
  const H = await hero(ctx, { model: "island", env: "dark", edge: "#040a2e" });

  /* ---------- poses ---------- */
  const HOME = { cx: 540, cy: 1075, height: 1380 };
  const LOW = { cx: 540, cy: 1255, height: 1180 };
  const MID = { cx: 540, cy: 1180, height: 1300 };
  const off = (p, dy = 1760) => ({ ...p, cy: p.cy + dy });
  /* THE ONE PUSH. It is aimed at a point of the DISPLAY, and it stops where
     the whole handset still clears every edge of the frame by 50px: the
     "How it is counted" plate lands in the middle of the stage at a size
     that can be read, which is the whole of sentence seven. */
  const TERMS = H.aim(660, 1855, 1600, 540, 1080);

  /* ---------- the Rewards screens, measured ----------
     f-rewards-full is 880px wide and the display renders it at 1320, so the
     crops taken off it are in that 1320-wide space. Every box below was
     measured (films/blocks.py) and then checked by eye on its own component's
     edges, so no rule ever cuts a heading. */
  const LINK = 2576;        /* scrolled so the invite link card is centred */
  const COUNTED = 3660;     /* scrolled to the foot: "How it is counted" */
  const FULL = ctx.src.capture("f-rewards-full");
  const CROP = {
    /* the invite card's own first rows: the label, the link, the code */
    link: { x: 27, y: 3669, w: 1266, h: 400 },
    /* "Qualified referrals counted a month      1,500", one row of the plate */
    row1500: { x: 27, y: 5262, w: 1266, h: 186 },
    /* the balance card's own rule, in its own rounded box */
    pill1000: { x: 110, y: 1426, w: 1104, h: 200 },
    /* "Your Rewards Balance is what Vallo owes you for referrals that
       qualified. It is not money held for you, and it does not expire." */
    owes: { x: 104, y: 2444, w: 1126, h: 210 },
    /* "Earn ₦80 for each friend who signs up fully" */
    earn80: { x: 100, y: 1570, w: 1130, h: 230 },
  };
  const SHARE = [908, 1770];     /* the Share button, at scroll = LINK */
  const WITHDRAW = [660, 1320];  /* the Withdraw button of the balance card */

  const layer = (id, t0, t1, z = 760) => ctx.scene(id, t0, t1, { z });
  const cut = (i) => s(i) - 0.2;

  /* ---------- the phone's path ---------- */
  H.path([
    [0, { ...off(HOME), opacity: 0 }],
    /* it rises UNDER the first wipe, so it is already standing when the slab
       clears on "Share your invite link" */
    [s(2) - 0.38, { ...off(HOME), opacity: 1 }, "none"],
    [s(2) + 0.27, { ...HOME, rx: 0, ry: 0, rz: 0 }, "power3.out"],
    [s(3) - 0.3, { ...HOME }],
    [s(3) + 0.3, { ...LOW }],
    /* THE PHONE LEAVES FOR THE NUMBER. "you earn eighty naira" is the line
       the whole film turns on, so the handset slides out of the bottom of the
       frame and what it uncovers is ₦80, standing behind it. */
    [wq(3, "link", "it") + 0.1, { ...LOW }],
    [wq(3, "link", "it") + 0.45, { ...off(LOW), rz: -5, ry: 16 }, "power3.in"],
    [s(5) - 0.75, { ...off(LOW), ry: 12 }, "none"],
    [s(5) - 0.05, { ...LOW, rx: 0, ry: 0, rz: 0 }, "power3.out"],
    /* a lean onto the balance card, and back out as the balance climbs */
    [w(5, "Rewards") - 0.1, { ...LOW }],
    [w(5, "Balance") + 0.3, { ...MID }],
    [w(5, "watch") - 0.15, { ...MID }],
    [w(5, "climb") + 0.1, { ...LOW }],
    [w(6, "withdraw") + 0.15, { ...LOW }],
    [w(6, "withdraw") + 0.6, { ...HOME }],
    [s(7) - 0.3, { ...HOME }],
    [s(7) + 0.2, { ...LOW }],
    /* the push onto the terms: the line says they sit on the screen, so the
       screen is what fills the frame */
    [wq(7, "terms", "catch") - 0.05, { ...LOW }],
    [wq(7, "screen", "small") - 0.15, { ...TERMS }],
    [w(7, "print") - 0.1, { ...TERMS }],
    [s(8) - 0.25, { ...HOME }],
    [s(9) - 0.95, { ...HOME }],
    [s(9) - 0.5, { ...off(HOME), rz: 5, ry: -16 }, "power3.in"],
    [ctx.duration, { ...off(HOME), opacity: 0 }, "none"],
  ]);
  H.swing(cut(3), cut(5), cut(6), cut(7), cut(8));

  /* ===================== the opening frame (composed and still at t = 0) ===================== */
  ground(ctx, 0, s(2) + 0.1, { tone: "navy", y: 26, seed: 11 });
  const open = ctx.scene("open", 0, s(2) + 0.1, { z: 760 });
  openerReward(ctx, open, { t1: s(1) - 0.15 });
  headline(ctx, open, {
    lines: [[["Vallo pays you", false]], [["to bring ", false], ["people.", true]]],
    x: M ? 60 : 160, y: M ? 430 : 230, size: M ? 100 : 104, t0: s(1) - 0.05, t1: s(2) - 0.5, stagger: 0, keyStyle: "chip",
  });
  ctx.hideCaptions(s(1) - 0.2, s(2) - 0.3);

  /* ===================== 1. Share your invite link (s2) =====================
     The shortest chapter in the film: a second and a third of voice. One
     idea, two moves, nothing held up. The screen scrolls itself to the invite
     card as the words name it, and the pointer presses Share. */
  slabWipe(ctx, cut(2), { dir: "up", dur: 0.3 });
  ground(ctx, cut(2), cut(3), { tone: "navy", y: 24, seed: 31 });
  H.show("f-rewards", s(2) - 0.42, cut(3) + 0.05, {
    enter: "cut",
    full: "f-rewards-full",
    scroll: [[s(2) - 0.3, 0], [w(2, "invite") + 0.05, LINK, "power3.inOut"]],
  });
  H.tap(w(2, "link") + 0.15, SHARE[0], SHARE[1]);
  const share = layer("share", s(2) - 0.1, cut(3) + 0.1);
  /* two of the blueprint's discs ride the margins beside the handset, clear
     of the pill and the captions, and they leave with the chapter */
  badgeDisc(ctx, share, { name: "link-2", kind: "glyph", x: 118, y: 900, size: 128, t0: s(2) + 0.2, t1: cut(3) - 0.25, seed: 1 });
  badgeDisc(ctx, share, { name: "megaphone", kind: "object", x: 962, y: 1230, size: 136, t0: s(2) + 0.5, t1: cut(3) - 0.2, seed: 2 });

  /* ===================== 2. Eighty naira a friend (s3) =====================
     The film's signature. The how-you-earn sheet rises on the phone and its
     own headline is lifted off it on "signs up fully"; then the handset
     slides away and what was standing behind it is ₦80 at poster size,
     stroked rather than filled, its digits rolling into place as the voice
     reaches "eighty". */
  shutter(ctx, cut(3), { bars: 7, dur: 0.26 });
  ground(ctx, cut(3), cut(4), { tone: "electric", y: 20, seed: 32 });
  H.show("f-rewards-how", cut(3) + 0.04, wq(3, "link", "it") + 0.5, { enter: "rise", dur: 0.5 });
  /* the sheet's own headline, held over the line it came from, half again as
     big: the product saying the rule in its own type */
  lift(ctx, H, {
    id: "f-rewards-how", crop: CROP.earn80,
    t0: w(3, "friend") - 0.15, t1: wq(3, "link", "it") - 0.15,
    to: { x: 540, y: 1356, s: 0.72, r: -2 }, exit: "up", fly: 0.5, seed: 3,
  });
  /* the figure stands BEHIND the phone (z 300), so the handset leaving is
     what reveals it. It locks on "eighty" rather than "naira" because the
     chapter is cut a tenth of a second after the sentence ends: landing it
     on the last word would leave it nothing to stand in. */
  const money = layer("money", w(3, "you") - 0.6, cut(4) + 0.15, 300);
  bigRoll(ctx, money, {
    value: 80, prefix: "₦", x: 540, y: 1000, size: M ? 430 : 300, rot: -3,
    t0: w(3, "earn"), t1: w(3, "eighty") + 0.35, tOut: s(4) - 0.5, seed: 7,
  });
  /* the condition, in the product's own words, under the figure: ₦80 is
     never shown on this stage without what it is paid for */
  kicker(ctx, money, {
    text: "for each friend who signs up fully", icon: "user-round-check",
    x: 540, y: 1300, t0: w(3, "eighty") - 0.1, t1: s(4) - 0.45, size: 32, anchor: "center",
  });
  ctx.sfx("success", w(3, "eighty") + 0.4, { offset: -2 });

  /* ===================== 3. A real person (s4) =====================
     "Not for a click. Not for a download. For a real person, fully signed
     up." Three containers: the first two are struck through on the word that
     dismisses them, the third is lit and carries the product's own definition
     of signing up fully, which is what the ₦80 is actually paid for. */
  tileFall(ctx, cut(4), { cols: 6, rows: 10, dur: 0.3, seed: 9 });
  ground(ctx, cut(4), cut(5), { tone: "gold", y: 30, seed: 33 });
  const who = layer("who", cut(4), cut(5) + 0.1);
  const OUT2 = w(4, "signed") - 0.1;
  const c1 = popOut(ctx, who, {
    kind: "line", lucide: "mouse-pointer-click", tab: "Not paid for", title: "A click",
    x: 540, y: 520, size: 38, rot: -2, from: "left", t0: w(4, "for", 1) - 0.1, t1: OUT2, seed: 11,
  });
  strikeOut(ctx, { slab: c1.slab, row: c1.rows[0], t0: w(4, "click") + 0.12, t1: OUT2 });
  const c2 = popOut(ctx, who, {
    kind: "line", lucide: "download", tab: "Not paid for", title: "A download",
    x: 540, y: 800, size: 38, rot: 2, from: "right", t0: w(4, "for", 2) - 0.1, t1: OUT2 + 0.07, seed: 12,
  });
  strikeOut(ctx, { slab: c2.slab, row: c2.rows[0], t0: w(4, "download") + 0.25, t1: OUT2 + 0.07 });
  /* the turn in the sentence takes a light whip: a quick move inside a
     chapter, never a chapter change */
  whipPan(ctx, w(4, "For") - 0.1, { dir: "left", dur: 0.22 });
  popOut(ctx, who, {
    kind: "line", lucide: "user-round-check", tab: "Paid for", accent: "electric",
    /* THE CONDITIONS ARE NOT ENUMERATED HERE, and this is deliberate.
       The Rewards screen does enumerate them, correctly: that sentence is
       GENERATED from the live campaign's own requirement keys
       (lib/referral/requirements.ts, signedUpFullySentence), so whatever
       the screen prints is true the day it is read. A film cannot do that.
       The requirements have already changed once in five days - signup-80
       counted a confirmed email on 8 October, signup-80-phone counts a
       confirmed phone from 13 October - and a film that names today's list
       is wrong the next time the founder moves it. "Signs up fully" is the
       campaign-independent phrasing, it is the screen's own headline, and
       it is what the voice says over this frame. The screen behind carries
       the detail, and keeps carrying it after the terms move. */
    title: "A real person", line: "Signs up fully, with your link",
    amount: "₦80",
    x: 540, y: 1150, size: 40, rot: -1, from: "below", t0: w(4, "real") - 0.3, t1: s(5) - 0.45, seed: 13,
  });

  /* ===================== 4. Watch it climb (s5) =====================
     The balance screen comes back and the phone leans in on it. What the
     Rewards Balance IS is a sentence the screen prints itself, so it is
     lifted off the glass rather than written again, and the climb is ₦80
     landing on ₦80 up the empty margin: no balance is invented. */
  slabWipe(ctx, cut(5), { dir: "down", dur: 0.3 });
  ground(ctx, cut(5), cut(6), { tone: "navy", y: 22, seed: 34 });
  H.show("f-rewards", cut(5) + 0.06, cut(7) + 0.05, { enter: "rise", dur: 0.5 });
  const climb = layer("climb", cut(5), cut(6) + 0.1);
  lift(ctx, H, {
    id: "f-rewards", crop: CROP.owes,
    t0: w(5, "Balance") + 0.1, t1: w(5, "watch") - 0.15,
    to: { x: 540, y: 1370, s: 0.7, r: -2 }, exit: "fade", fly: 0.5, seed: 4,
  });
  /* the climb: one friend, then another, then another, each adding the same
     ₦80 the product prints. They stack up the left margin, clear of the
     handset, one arriving every quarter second. */
  for (const [y, d] of [[1210, 0], [1010, 0.25], [810, 0.5]]) {
    kicker(ctx, climb, {
      text: "+ ₦80", icon: "user-round-check",
      x: 148, y, t0: w(5, "and") + 0.05 + d, t1: s(6) - 0.3, size: 30, anchor: "center",
    });
  }
  /* the brand's coin object is a plain disc at this size and reads as a dot,
     so the small discs carry line glyphs instead */
  badgeDisc(ctx, climb, { name: "coins", kind: "glyph", x: 960, y: 1150, size: 134, t0: wq(5, ["you", 2], "you") + 0.1, t1: s(6) - 0.3, seed: 5 });

  /* ===================== 5. Withdraw at ₦1,000 (s6) =====================
     The rule is printed on the balance card itself, so it is lifted off it
     whole, and then the pointer presses the screen's own Withdraw button and
     it lights.

     THE WITHDRAW SHEET IS NOT SHOWN. f-rewards-withdraw is the state of a
     balance that has not got there yet, and its heading reads "Not enough to
     withdraw yet": on the line "At one thousand naira, you can withdraw it to
     your bank" that is the one sentence on the stage arguing with the voice.
     The button, the rule and the bank say it without contradicting it. */
  irisTicks(ctx, cut(6), { dur: 0.34 });
  ground(ctx, cut(6), cut(7), { tone: "emerald", y: 24, seed: 35 });
  lift(ctx, H, {
    id: "f-rewards", crop: CROP.pill1000,
    t0: w(6, "one") - 0.15, t1: w(6, "withdraw") - 0.4,
    /* ABOVE the Withdraw button, not over it: held level with the button the
       pointer glides to, the orb came to rest in the middle of the lifted
       sentence and sat on the word "your". */
    to: { x: 540, y: 900, s: 0.72, r: -2 }, exit: "up", fly: 0.55, seed: 8,
  });
  H.tap(w(6, "withdraw") + 0.05, WITHDRAW[0], WITHDRAW[1]);
  /* the ring is drawn inside the display, and a screen shown later in the
     film sits above its own z, so it is lifted over the screen it outlines */
  H.ring(w(6, "withdraw") + 0.02, s(7) - 0.4, { x: 118, y: 1229, w: 1086, h: 185, r: 48 }).style.zIndex = "900";
  const bank = layer("bank", w(6, "it") - 0.6, cut(7) + 0.1);
  object3d(ctx, bank, { name: "bank", size: 190, x: 118, y: 770, t0: w(6, "it") - 0.2, t1: s(7) - 0.45, drift: 1, seed: 9 });

  /* ===================== 6. Up to 1,500 a month (s7) =====================
     The longest line in the film, and the one that must not drift: an early
     draft of this script said "no limit", which was wrong and was corrected.
     The screen scrolls to "How it is counted", the 1,500 row is held up off
     it, and then the camera pushes onto the whole plate, so the terms are
     read in the product's own type rather than ours. */
  shutter(ctx, cut(7), { bars: 7, dur: 0.26 });
  ground(ctx, cut(7), cut(8), { tone: "violet", y: 26, seed: 36 });
  H.show("f-rewards", cut(7) + 0.04, s(8) - 0.3, {
    enter: "slide",
    full: "f-rewards-full",
    scroll: [[cut(7) + 0.04, LINK], [wq(7, "hundred", "many") + 0.1, COUNTED, "power2.inOut"]],
  });
  lift(ctx, H, {
    id: "f-rewards", src: FULL, scrolled: COUNTED, crop: CROP.row1500,
    t0: w(7, "friends") - 0.15, t1: wq(7, "terms", "catch") - 0.25,
    to: { x: 540, y: 1180, s: 0.64, r: -2 }, exit: "up", fly: 0.55, seed: 10, radius: 30,
  });
  const terms = layer("terms", wq(7, "terms", "catch") - 0.5, cut(8) + 0.1);
  badgeDisc(ctx, terms, { name: "file-text", kind: "glyph", x: 96, y: 620, size: 134, t0: wq(7, "terms", "catch") + 0.15, t1: s(8) - 0.5, seed: 14 });
  badgeDisc(ctx, terms, { name: "contract", kind: "object", x: 984, y: 1368, size: 140, t0: wq(7, "terms", "catch") + 0.5, t1: s(8) - 0.46, seed: 15 });
  /* pushed this far in, the screen's own rows run up under the pill */
  ctx.hidePill(wq(7, "screen", "small") - 0.4, s(8) - 0.4);

  /* ===================== 7. Share. Earn. (s8) =====================
     The link comes back, and the coins with it. */
  irisTicks(ctx, cut(8), { dur: 0.34 });
  ground(ctx, cut(8), s(9) - 0.55, { tone: "electric", y: 20, seed: 37 });
  H.show("f-rewards", cut(8) + 0.04, s(9) - 0.5, {
    enter: "cut",
    full: "f-rewards-full",
    scroll: [[cut(8) + 0.04, COUNTED], [w(8, "the") - 0.1, LINK, "power3.inOut"]],
  });
  lift(ctx, H, {
    id: "f-rewards", src: FULL, scrolled: LINK, crop: CROP.link,
    t0: w(8, "link") - 0.15, t1: w(8, "join") - 0.05,
    to: { x: 540, y: 614, s: 0.62, r: 2 }, exit: "up", fly: 0.45, seed: 16, radius: 44,
  });
  H.tap(w(8, "link") + 0.25, SHARE[0], SHARE[1]);
  const join = layer("join", s(8) - 0.1, s(9) - 0.5);
  [["coins", "glyph", 118, 806, 0, "navy", 17],
    ["gift", "object", 958, 892, 0.14, "navy", 18],
    ["user-round-plus", "glyph", 142, 1330, 0.28, "paper", 19],
    ["celebrate", "object", 946, 1342, 0.42, "navy", 20]]
    .forEach(([name, kind, bx, by, delay, tone, seed]) => badgeDisc(ctx, join, {
      name, kind, x: bx, y: by, size: 128, t0: w(8, "Earn") + 0.05, t1: s(9) - 0.72, tone, seed, delay, drift: 1,
    }));

  /* ===================== the ending ===================== */
  ending(ctx, { t0: s(9) - 0.5, tLine: s(9) + 0.15, tBadges: s(9) + 1.0, tUrl: s(9) + 1.5, t1: e(9) + 1.4 });

  /* last, so every held part has registered the moment it is up */
  installFocus(ctx, { strength: M ? 0.5 : 0.28 });
}
