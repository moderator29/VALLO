/**
 * THE THREE SHORT FILMS' OPENING FRAMES.
 *
 * The founder's ruling, 17 October: "the starting view should not be those
 * get started ones you already used for the until 2 videos, don't use them
 * again, okay, non inside the remaining 2". Videos One and Two both open on
 * the product's own onboarding illustration (brand/onboarding/step-1-dark
 * and step-4-dark) with the three questions over it. Nothing here touches
 * that artwork, and no two of these three frames share a silhouette: a chat
 * showing all five films side by side shows five different stills.
 *
 *   openerClock   the sign-up film   a minute, counted, and the three fields
 *   openerReward  the referral film  the fee, oversized, and the link
 *   openerOwner   the listing film   a real place, and the fee that is zero
 *
 * EACH ONE IS COMPOSED AND STILL AT t = 0. The frame a chat shows before
 * anyone presses play is the first frame, so nothing fades up out of nothing:
 * everything is already standing at full presence, it breathes where it
 * stands, and it clears for the opening line. The containers are the
 * blueprint's containers (popout.js): solid ink, a thick bright edge all the
 * way round, the label as the first row.
 *
 * Every value is a pure function of t (BUILDING.md, "Determinism").
 */
import { ramp, place, opa } from "./kit.js";
import { sparkles } from "../engine/components.js";

const EDGE = "#8FD3FF";
const INK = "#04071C";
const PLATE = "#000208";

/* ------------------------------------------------------------------ parts */

/** The night behind an opener: a tone's glow over a deep field. */
function sky(ctx, parent, { glow = "rgb(0 105 254 / 0.52)", top = "#020733", bottom = "#01061f", x = 50, y = 26 }) {
  return ctx.el("div", {
    class: "fill",
    style: { background: `radial-gradient(72% 42% at ${x}% ${y}%, ${glow}, transparent 74%), linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` },
  }, parent);
}

/**
 * One of the blueprint's containers, DRAWN STANDING. popOut's container
 * arrives on a cue; an opener's is already there on frame one, so this draws
 * the same object at rest and only ever breathes and leaves.
 *
 *   rows   [["eyebrow"|"title"|"line"|"figure"|"dots", text, unit?], ...]
 */
function slab(ctx, parent, { x, y, rot = 0, size = 34, w = null, tab = null, rows = [], tone = "navy", z = null }) {
  const loud = tone === "electric";
  const edge = loud ? "#CFE6FF" : EDGE;
  const eye = loud ? "#ffffff" : "rgb(143 211 255 / 0.95)";
  const soft = loud ? "rgb(255 255 255 / 0.9)" : "rgb(214 228 255 / 0.88)";
  const box = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", transformOrigin: "50% 50%", ...(z == null ? {} : { zIndex: String(z) }) } }, parent);
  const body = ctx.el("div", {
    style: {
      position: "relative",
      ...(w ? { width: `${w}px` } : {}),
      padding: `${size * 0.86}px ${size * 0.93}px`,
      borderRadius: `${size * 1.16}px`,
      border: `${(size * 0.23).toFixed(2)}px solid ${edge}`,
      background: loud ? "#0069FE" : INK,
      boxShadow: "0 54px 96px -34px rgb(0 0 10 / 0.92)",
      color: "#ffffff",
      font: `500 ${size}px/1.2 Inter, sans-serif`,
    },
  }, box);

  if (tab) {
    const t = ctx.el("div", {
      style: {
        display: "flex", alignItems: "center", gap: `${size * 0.3}px`, marginBottom: `${size * 0.42}px`,
        font: `700 ${Math.round(size * 0.6)}px/1 Inter, sans-serif`, letterSpacing: "0.14em",
        textTransform: "uppercase", whiteSpace: "nowrap", color: eye,
      },
    }, body);
    ctx.el("span", { style: { width: `${size * 0.3}px`, height: `${size * 0.3}px`, borderRadius: "50%", background: eye, flex: "none" } }, t);
    ctx.el("span", { text: tab }, t);
  }

  rows.forEach(([kind, text, unit], i) => {
    const gap = i ? `${size * (kind === "figure" ? 0.3 : 0.24)}px` : "0px";
    if (kind === "title") {
      ctx.el("div", { text, style: { marginTop: gap, font: `700 ${size}px/1.15 Inter, sans-serif`, letterSpacing: "-0.012em", whiteSpace: "nowrap" } }, body);
    } else if (kind === "line") {
      ctx.el("div", { text, style: { marginTop: gap, font: `500 ${Math.round(size * 0.78)}px/1.3 Inter, sans-serif`, color: soft, whiteSpace: "nowrap" } }, body);
    } else if (kind === "eyebrow") {
      ctx.el("div", { text, style: { marginTop: gap, font: `700 ${Math.round(size * 0.6)}px/1 Inter, sans-serif`, letterSpacing: "0.12em", textTransform: "uppercase", color: eye, whiteSpace: "nowrap" } }, body);
    } else if (kind === "figure") {
      const row = ctx.el("div", { style: { marginTop: gap, display: "flex", alignItems: "baseline", gap: `${size * 0.24}px`, whiteSpace: "nowrap" } }, body);
      ctx.el("span", { text, style: { font: `700 ${Math.round(size * 2.05)}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.03em" } }, row);
      if (unit) ctx.el("span", { text: unit, style: { font: `600 ${Math.round(size * 0.82)}px/1 Inter, sans-serif`, color: soft } }, row);
    } else if (kind === "dots") {
      const row = ctx.el("div", { style: { marginTop: gap, display: "flex", alignItems: "center", gap: `${size * 0.28}px` } }, body);
      for (let k = 0; k < (text ?? 8); k += 1) {
        ctx.el("span", { style: { width: `${size * 0.4}px`, height: `${size * 0.4}px`, borderRadius: "50%", background: "rgb(214 228 255 / 0.85)" } }, row);
      }
    } else if (kind === "cells") {
      const plate = ctx.el("div", {
        style: {
          marginTop: gap, display: "flex", alignItems: "stretch", gap: `${size * 0.7}px`,
          padding: `${size * 0.56}px ${size * 0.68}px`, borderRadius: `${size * 0.72}px`,
          background: PLATE, border: `${(size * 0.07).toFixed(2)}px solid rgb(143 211 255 / 0.45)`,
        },
      }, body);
      text.forEach(([k, v], j) => {
        const cell = ctx.el("div", { style: { minWidth: "0", ...(j ? { borderLeft: `${(size * 0.055).toFixed(2)}px solid rgb(143 211 255 / 0.40)`, paddingLeft: `${size * 0.7}px` } : {}) } }, plate);
        ctx.el("div", { text: k, style: { font: `700 ${Math.round(size * 0.6)}px/1 Inter, sans-serif`, letterSpacing: "0.12em", textTransform: "uppercase", color: eye, whiteSpace: "nowrap" } }, cell);
        ctx.el("div", { text: v, style: { marginTop: `${size * 0.2}px`, font: `700 ${Math.round(size * 1.1)}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.025em", whiteSpace: "nowrap" } }, cell);
      });
    }
  });
  return { box, x, y, rot };
}

/** A 3D object of the founder's own, standing at full size on frame one. */
function standing(ctx, parent, { name, size, x, y, rot = 0, z = null }) {
  const img = ctx.img(ctx.src.object(name), {
    class: "abs",
    style: { left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, objectFit: "contain", ...(z == null ? {} : { zIndex: String(z) }) },
  }, parent);
  return { box: img, x, y, rot };
}

/**
 * The breath and the clearance every opener shares: each piece drifts on its
 * own phase while it stands, then rises and goes, nearest piece first, as the
 * opening line takes the frame.
 */
function breathe(ctx, pieces, { t1, seed = 10, lift = 150 }) {
  const rand = ctx.random(seed);
  const set = pieces.map((p) => ({ ...p, ph: rand() * Math.PI * 2, amp: 4 + rand() * 5, turn: 0.4 + rand() * 0.5, out: rand() * 0.14 }));
  ctx.onFrame((t) => {
    for (const p of set) {
      const o = ramp(ctx, t, t1 - 0.6 + p.out, t1 + 0.1 + p.out, "power2.in");
      place(p.box, {
        x: p.x,
        y: p.y + Math.sin(t * 0.72 + p.ph) * p.amp - o * lift,
        s: (p.s ?? 1) * (1 - 0.06 * o),
        r: p.rot + Math.sin(t * 0.44 + p.ph) * p.turn,
        o: 1 - o,
      });
    }
  });
}

/* ----------------------------------------------------- 1. the sign-up film */

/**
 * A MINUTE, COUNTED. The whole claim of the sign-up film is its first
 * sentence — it takes about a minute — so the frame is that minute, set
 * enormous and stroked so the night reads through it, with the only three
 * things the form ever asks for standing in front of it as containers.
 * The clock and the verified badge are the founder's own 3D objects.
 */
export function openerClock(ctx, parent, { t1 }) {
  const M = ctx.isMobile;
  const root = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`, overflow: "hidden" } }, parent);
  const back = sky(ctx, root, { glow: "rgb(0 105 254 / 0.62)", top: "#02093c", bottom: "#01040f", y: M ? 34 : 40 });

  /* the minute, stroked, behind everything */
  const fig = ctx.el("div", {
    text: "1:00",
    class: "abs num",
    style: {
      left: "0px", top: "0px", whiteSpace: "nowrap",
      font: `800 ${M ? 468 : 420}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.055em",
      color: "transparent", WebkitTextStroke: `${M ? 9 : 7}px rgb(143 211 255 / 0.34)`,
    },
  }, root);

  const size = M ? 38 : 31;
  const pieces = [
    { ...slab(ctx, root, { x: 0, y: 0, rot: -3.0, size, tab: "Step one", rows: [["title", "Your name"], ["line", "Ada Okafor"]], z: 6 }), ...(M ? { x: 420, y: 900 } : { x: 1300, y: 300 }) },
    { ...slab(ctx, root, { x: 0, y: 0, rot: 2.4, size, tab: "Step two", rows: [["title", "Your email"], ["line", "you@example.com"]], z: 7 }), ...(M ? { x: 648, y: 1162 } : { x: 1540, y: 556 }) },
    { ...slab(ctx, root, { x: 0, y: 0, rot: -2.0, size, tab: "Step three", rows: [["title", "A password you choose"], ["dots", 9]], z: 8 }), ...(M ? { x: 470, y: 1430 } : { x: 1286, y: 812 }) },
    { ...standing(ctx, root, { name: "clock", size: M ? 300 : 230, x: M ? 852 : 1790, y: M ? 606 : 150, rot: 9, z: 9 }) },
    { ...standing(ctx, root, { name: "id-check", size: M ? 232 : 190, x: M ? 170 : 1058, y: M ? 1636 : 1000, rot: -11, z: 9 }) },
  ];

  ctx.onFrame((t) => {
    const out = ramp(ctx, t, t1 - 0.55, t1 + 0.25, "power2.inOut");
    place(fig, { x: M ? 540 : 1430, y: M ? 1172 : 560, s: 1 + out * 0.08, o: (1 - out) * 0.95 });
    back.style.opacity = opa(1 - ramp(ctx, t, t1 - 0.3, t1 + 0.3));
  });
  breathe(ctx, pieces, { t1, seed: 31, lift: M ? 190 : 140 });
  sparkles(ctx, root, { area: { x: 60, y: M ? 900 : 180, w: ctx.W - 120, h: M ? 900 : 760 }, count: 7, seed: 33, t0: 0, t1 });
  return root;
}

/* ---------------------------------------------------- 2. the referral film */

/**
 * THE FEE, OVERSIZED. The blueprint's loudest move is a price blown up past
 * the frame it belongs to, so the referral film opens on the eighty naira
 * itself, filled and enormous, the invite link standing in front of it and
 * the founder's coins and gift stacked around it. Gold over navy: no other
 * film in the set is warm, so this one is unmistakable at thumbnail size.
 */
export function openerReward(ctx, parent, { t1 }) {
  const M = ctx.isMobile;
  const root = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`, overflow: "hidden" } }, parent);
  const back = sky(ctx, root, { glow: "rgb(255 196 61 / 0.34)", top: "#0d0a2c", bottom: "#01040f", y: M ? 30 : 36 });
  const wash = ctx.el("div", { class: "fill", style: { background: `radial-gradient(58% 34% at ${M ? 50 : 72}% ${M ? 66 : 54}%, rgb(0 105 254 / 0.40), transparent 72%)` } }, root);

  /* the figure, filled, with the naira mark a size down and raised */
  const fig = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", whiteSpace: "nowrap", display: "flex", alignItems: "baseline", gap: `${M ? 12 : 9}px` } }, root);
  ctx.el("span", { text: "₦", style: { font: `700 ${M ? 240 : 185}px/1 Poppins, Inter, sans-serif`, color: "rgb(255 214 122 / 0.95)", letterSpacing: "-0.02em" } }, fig);
  ctx.el("span", { text: "80", class: "num", style: { font: `800 ${M ? 470 : 360}px/1 Poppins, Inter, sans-serif`, color: "#FFE2A3", letterSpacing: "-0.055em" } }, fig);
  const note = ctx.el("div", {
    text: "a friend who signs up fully",
    class: "abs",
    style: { left: "0px", top: "0px", whiteSpace: "nowrap", font: `600 ${M ? 44 : 34}px/1 Inter, sans-serif`, color: "rgb(255 255 255 / 0.76)", letterSpacing: "0.01em" },
  }, root);

  const size = M ? 38 : 31;
  const pieces = [
    { ...slab(ctx, root, { x: 0, y: 0, rot: -2.6, size, tab: "Your invite link", rows: [["title", "vallospaces.com/r/ADA7K2"]], z: 7 }), ...(M ? { x: 540, y: 1626 } : { x: 1392, y: 838 }) },
    { ...slab(ctx, root, { x: 0, y: 0, rot: 3.2, size: size * 0.92, tone: "electric", tab: "Withdraw at", rows: [["figure", "₦1,000", "or more"]], z: 8 }), ...(M ? { x: 722, y: 884 } : { x: 1636, y: 300 }) },
    { ...standing(ctx, root, { name: "coin", size: M ? 272 : 212, x: M ? 180 : 1086, y: M ? 872 : 266, rot: -13, z: 9 }) },
    { ...standing(ctx, root, { name: "gift", size: M ? 238 : 186, x: M ? 924 : 1808, y: M ? 1816 : 972, rot: 11, z: 9 }) },
    { ...standing(ctx, root, { name: "megaphone", size: M ? 198 : 158, x: M ? 124 : 1042, y: M ? 1808 : 690, rot: -7, z: 9 }) },
  ];

  ctx.onFrame((t) => {
    const out = ramp(ctx, t, t1 - 0.55, t1 + 0.25, "power2.inOut");
    place(fig, { x: M ? 540 : 1430, y: M ? 1148 : 560, s: 1 + out * 0.07, o: 1 - out });
    place(note, { x: M ? 540 : 1430, y: M ? 1438 : 700, s: 1, o: (1 - out) * 0.95 });
    back.style.opacity = opa(1 - ramp(ctx, t, t1 - 0.3, t1 + 0.3));
    wash.style.opacity = opa(1 - out);
  });
  breathe(ctx, pieces, { t1, seed: 41, lift: M ? 190 : 140 });
  sparkles(ctx, root, { area: { x: 60, y: M ? 940 : 190, w: ctx.W - 120, h: M ? 880 : 740 }, count: 8, seed: 43, t0: 0, t1 });
  return root;
}

/* ----------------------------------------------------- 3. the listing film */

/**
 * A REAL PLACE, AND THE FEE THAT IS ZERO. The listing film is addressed to
 * someone who owns a house, so its first frame is a house: one of the
 * platform's own photographed places, standing in the lower frame with the
 * night melted into its edges, and over it the one number that makes the
 * film's case. The keys are the founder's own object. No illustration, no
 * phone, no interface: the only photographic opener in the set.
 */
export function openerOwner(ctx, parent, { t1, scene = "villa" }) {
  const M = ctx.isMobile;
  const root = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`, overflow: "hidden" } }, parent);
  const back = sky(ctx, root, { glow: "rgb(0 105 254 / 0.44)", top: "#02052a", bottom: "#01030c", y: M ? 22 : 30 });

  /* the place: wide, low, its top and sides melted into the night */
  const aw = M ? ctx.W * 1.18 : ctx.W * 0.78;
  const ah = aw * 0.68;
  const fadeTop = "linear-gradient(180deg, transparent 0%, #000 26%, #000 72%, transparent 100%)";
  const fadeSide = "linear-gradient(90deg, transparent 0%, #000 14%, #000 86%, transparent 100%)";
  const art = ctx.img(ctx.src.scene(scene), {
    class: "abs",
    style: {
      left: `${(M ? (ctx.W - aw) / 2 : ctx.W - aw + 150).toFixed(1)}px`,
      top: `${(M ? 836 : 300).toFixed(1)}px`,
      width: `${aw.toFixed(1)}px`, height: `${ah.toFixed(1)}px`, objectFit: "cover",
      WebkitMaskImage: `${fadeTop}, ${fadeSide}`, maskImage: `${fadeTop}, ${fadeSide}`,
      WebkitMaskComposite: "source-in", maskComposite: "intersect",
      filter: "saturate(0.92) brightness(0.74)",
    },
  }, root);
  /* the night laid back over the photograph, so type on top stays readable */
  ctx.el("div", { class: "fill", style: { background: `linear-gradient(180deg, rgb(1 4 15 / 0.55) 0%, rgb(1 4 15 / 0.10) 45%, rgb(1 4 15 / 0.72) 100%)` } }, root);

  const size = M ? 38 : 31;
  const pieces = [
    { ...slab(ctx, root, { x: 0, y: 0, rot: -2.4, size, tab: "What Vallo takes", rows: [["cells", [["Agency fee", "₦0"], ["Middle man", "None"]]]], z: 7 }), ...(M ? { x: 540, y: 1076 } : { x: 1344, y: 408 }) },
    { ...slab(ctx, root, { x: 0, y: 0, rot: 2.8, size: size * 0.94, tone: "electric", tab: "You set the price", rows: [["figure", "₦2.4m", "a year"]], z: 8 }), ...(M ? { x: 648, y: 1468 } : { x: 1570, y: 790 }) },
    { ...standing(ctx, root, { name: "keys", size: M ? 290 : 224, x: M ? 180 : 1096, y: M ? 1534 : 760, rot: -12, z: 9 }) },
    { ...standing(ctx, root, { name: "home-verified", size: M ? 214 : 172, x: M ? 890 : 1812, y: M ? 872 : 240, rot: 10, z: 9 }) },
  ];

  ctx.onFrame((t) => {
    const out = ramp(ctx, t, t1 - 0.55, t1 + 0.25, "power2.inOut");
    const breath = Math.sin(t * 0.5) * 0.004;
    art.style.transform = `scale(${(1.02 + breath + out * 0.06).toFixed(4)}) translateY(${(out * ctx.H * 0.05).toFixed(1)}px)`;
    art.style.opacity = opa(1 - out);
    back.style.opacity = opa(1 - ramp(ctx, t, t1 - 0.3, t1 + 0.3));
  });
  breathe(ctx, pieces, { t1, seed: 51, lift: M ? 180 : 135 });
  sparkles(ctx, root, { area: { x: 60, y: M ? 880 : 170, w: ctx.W - 120, h: M ? 820 : 700 }, count: 6, seed: 53, t0: 0, t1 });
  return root;
}
