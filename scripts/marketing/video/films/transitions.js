/**
 * THE DEEP TRANSITIONS.
 *
 * The founder, 16 October 2026: "I need more transition in the films like
 * deep transition". A cut that simply swaps two scenes is the cheapest thing
 * a film can do. These five carry the cut themselves, in the same language
 * as the pop-out containers: navy slabs, sky hairlines, tick brackets.
 *
 * Each is an OVERLAY scene at a high z, so the two scenes underneath need no
 * knowledge of it: scene A ends at t, scene B begins at t, and the transition
 * is awake from a little before to a little after. Everything is a pure
 * function of t.
 *
 *   slabWipe   a navy slab with a lit leading edge sweeps the frame
 *   shutter    bars close from alternate sides and open again
 *   irisTicks  four tick brackets close to a box, the box blooms and clears
 *   tileFall   the frame breaks into tiles that drop away
 *   whipPan    a streak of light and motion blur, for a camera whip
 *
 * Every one takes (ctx, t, opts) where t is the cut itself: the frame where
 * the stage is fully covered (slabWipe, shutter, tileFall) or at its tightest
 * (irisTicks). Put the scene change on that same t.
 */
import { ramp, opa } from "./kit.js";

const SKY = "rgb(143 211 255";
const NAVY = "#02040F";

/** The overlay every transition is drawn in. */
function layer(ctx, id, t0, t1, z = 880) {
  return ctx.scene(`tr-${id}-${t0.toFixed(2)}`, t0, t1, { z });
}

/**
 * A slab sweeps the frame: in over `dur`, out over `dur`. Its leading edge
 * carries a bright hairline and two tick brackets, so the wipe is made of the
 * same parts as the containers.
 *   dir  "left" | "right" | "up" | "down" (where the slab travels)
 */
export function slabWipe(ctx, t, { dir = "left", dur = 0.42, tone = "navy", sound = "whoosh_short", z = 880 } = {}) {
  const t0 = t - dur;
  const t1 = t + dur;
  const root = layer(ctx, "slab", t0 - 0.05, t1 + 0.05, z);
  const horiz = dir === "left" || dir === "right";
  const span = horiz ? ctx.W : ctx.H;
  const slab = ctx.el("div", {
    class: "abs",
    style: {
      left: "0px", top: "0px", width: `${ctx.W * 1.04}px`, height: `${ctx.H * 1.04}px`,
      background: tone === "day" ? "linear-gradient(176deg, #ffffff 0%, #eaf1ff 100%)" : NAVY,
    },
  }, root);
  /* the lit leading edge */
  const lip = ctx.el("div", {
    class: "abs",
    style: horiz
      ? { top: "0px", [dir === "left" ? "right" : "left"]: "0px", width: "6px", height: "100%", background: `${SKY} / 0.95)`, boxShadow: `0 0 60px 10px ${SKY} / 0.45)` }
      : { left: "0px", [dir === "up" ? "bottom" : "top"]: "0px", height: "6px", width: "100%", background: `${SKY} / 0.95)`, boxShadow: `0 0 60px 10px ${SKY} / 0.45)` },
  }, slab);
  void lip;
  const sign = dir === "left" || dir === "up" ? 1 : -1;
  ctx.onFrame((u) => {
    if (u < t0 - 0.05 || u > t1 + 0.05) return;
    const a = ramp(ctx, u, t0, t, "whip");
    const b = ramp(ctx, u, t, t1, "whip");
    /* in: from fully off one side to covering; out: on to fully off the other */
    const p = (1 - a) * sign * span + b * -sign * span;
    slab.style.transform = horiz ? `translateX(${p.toFixed(1)}px)` : `translateY(${p.toFixed(1)}px)`;
  });
  if (sound) ctx.sfx(sound, t - dur * 0.7, { offset: -3 });
  return root;
}

/**
 * Bars close from alternate sides, meet, and open again. `bars` of them,
 * each with a sky hairline on its leading edge.
 */
export function shutter(ctx, t, { bars = 7, dur = 0.4, sound = "impact_soft", z = 882 } = {}) {
  const t0 = t - dur;
  const t1 = t + dur;
  const root = layer(ctx, "shut", t0 - 0.05, t1 + 0.05, z);
  const h = ctx.H / bars;
  const list = [];
  for (let i = 0; i < bars; i += 1) {
    const el = ctx.el("div", {
      class: "abs",
      style: { left: "0px", top: `${(i * h).toFixed(2)}px`, width: `${ctx.W}px`, height: `${Math.ceil(h) + 1}px`, background: NAVY },
    }, root);
    ctx.el("div", {
      class: "abs",
      style: { top: "0px", [i % 2 ? "left" : "right"]: "0px", width: "5px", height: "100%", background: `${SKY} / 0.9)` },
    }, el);
    list.push({ el, sign: i % 2 ? -1 : 1, i });
  }
  ctx.onFrame((u) => {
    if (u < t0 - 0.05 || u > t1 + 0.05) return;
    for (const { el, sign, i } of list) {
      const lead = i * 0.012;
      const a = ramp(ctx, u, t0 + lead, t - 0.02 + lead, "whip");
      const b = ramp(ctx, u, t + 0.02 + lead, t1 + lead, "whip");
      const p = (1 - a) * sign * ctx.W + b * -sign * ctx.W;
      el.style.transform = `translateX(${p.toFixed(1)}px)`;
    }
  });
  if (sound) ctx.sfx(sound, t - 0.06, { offset: -4 });
  return root;
}

/**
 * Four tick brackets fly in from the corners and close on a small box; the
 * box blooms white and clears. The container language carrying the cut.
 */
export function irisTicks(ctx, t, { dur = 0.46, size = null, sound = "stamp", z = 884 } = {}) {
  const t0 = t - dur;
  const t1 = t + dur * 0.9;
  const root = layer(ctx, "iris", t0 - 0.05, t1 + 0.1, z);
  const W = size ?? Math.min(ctx.W, ctx.H) * 0.34;
  const H = W * 0.62;
  const cx = ctx.W / 2;
  const cy = ctx.H * (ctx.isMobile ? 0.46 : 0.5);
  const d = W * 0.3;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const tks = corners.map(([sx, sy], i) => {
    const el = ctx.el("div", {
      class: "abs",
      style: {
        left: `${(cx + (sx * W) / 2 - (sx < 0 ? 0 : d)).toFixed(1)}px`,
        top: `${(cy + (sy * H) / 2 - (sy < 0 ? 0 : d)).toFixed(1)}px`,
        width: `${d}px`, height: `${d}px`,
        [sx < 0 ? "borderLeft" : "borderRight"]: `12px solid ${SKY} / 0.98)`,
        [sy < 0 ? "borderTop" : "borderBottom"]: `12px solid ${SKY} / 0.98)`,
        [`border${sy < 0 ? "Top" : "Bottom"}${sx < 0 ? "Left" : "Right"}Radius`]: "26px",
      },
    }, root);
    return { el, sx, sy, i };
  });
  const bloom = ctx.el("div", {
    class: "fill",
    style: { background: `radial-gradient(42% 34% at 50% ${((cy / ctx.H) * 100).toFixed(1)}%, rgb(255 255 255 / 0.95) 0%, ${SKY} / 0.5) 38%, transparent 72%)`, opacity: "0" },
  }, root);
  ctx.onFrame((u) => {
    if (u < t0 - 0.05 || u > t1 + 0.1) return;
    const a = ramp(ctx, u, t0, t, "whip");
    const b = ramp(ctx, u, t, t1, "power2.out");
    for (const { el, sx, sy, i } of tks) {
      const fly = (1 - a) * Math.max(ctx.W, ctx.H) * 0.4;
      const open = b * Math.max(ctx.W, ctx.H) * 0.5;
      el.style.transform = `translate(${(sx * (fly + open)).toFixed(1)}px, ${(sy * (fly + open)).toFixed(1)}px) scale(${(0.6 + 0.4 * a).toFixed(3)})`;
      el.style.opacity = opa(Math.min(a * 1.4, 1 - b));
      void i;
    }
    const k = u < t ? ramp(ctx, u, t - 0.12, t, "power2.in") : 1 - ramp(ctx, u, t, t + dur * 0.55, "power2.out");
    bloom.style.opacity = opa(k);
  });
  if (sound) ctx.sfx(sound, t - 0.04, { offset: -4 });
  return root;
}

/** The frame breaks into tiles that drop away, uncovering the next scene. */
export function tileFall(ctx, t, { cols = 6, rows = 10, dur = 0.5, seed = 9, sound = "whoosh_short", z = 881 } = {}) {
  const t0 = t - dur * 0.55;
  const t1 = t + dur * 1.1;
  const root = layer(ctx, "tile", t0 - 0.05, t1 + 0.1, z);
  const w = ctx.W / cols;
  const h = ctx.H / rows;
  const rand = ctx.random(seed);
  const list = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const el = ctx.el("div", {
        class: "abs",
        style: {
          left: `${(c * w).toFixed(2)}px`, top: `${(r * h).toFixed(2)}px`,
          width: `${Math.ceil(w) + 1}px`, height: `${Math.ceil(h) + 1}px`,
          background: NAVY,
          boxShadow: `inset 0 0 0 1px ${SKY} / 0.10)`,
        },
      }, root);
      list.push({ el, lead: (r / rows) * 0.18 + rand() * 0.1, drop: 0.6 + rand() * 0.8 });
    }
  }
  ctx.onFrame((u) => {
    if (u < t0 - 0.05 || u > t1 + 0.1) return;
    for (const { el, lead, drop } of list) {
      const a = ramp(ctx, u, t0, t - 0.04, "power2.out");
      const b = ramp(ctx, u, t + lead, t + lead + dur, "power2.in");
      el.style.transform = `translateY(${(b * ctx.H * drop).toFixed(1)}px) scale(${(0.9 + 0.1 * a).toFixed(3)})`;
      el.style.opacity = opa(Math.min(a, 1 - b * 0.9));
    }
  });
  if (sound) ctx.sfx(sound, t - 0.1, { offset: -4 });
  return root;
}

/** A streak of light across a camera whip: short, bright, and gone. */
export function whipPan(ctx, t, { dir = "left", dur = 0.26, sound = "whoosh_short", z = 886 } = {}) {
  const t0 = t - dur;
  const t1 = t + dur;
  const root = layer(ctx, "whip", t0 - 0.05, t1 + 0.05, z);
  const streak = ctx.el("div", {
    class: "abs",
    style: {
      left: `${-ctx.W * 0.5}px`, top: `${-ctx.H * 0.1}px`, width: `${ctx.W * 0.5}px`, height: `${ctx.H * 1.2}px`,
      background: `linear-gradient(90deg, transparent, rgb(255 255 255 / 0.10), ${SKY} / 0.55), rgb(255 255 255 / 0.10), transparent)`,
      transform: "skewX(-14deg)",
    },
  }, root);
  const sign = dir === "left" ? 1 : -1;
  ctx.onFrame((u) => {
    if (u < t0 - 0.05 || u > t1 + 0.05) { return; }
    const a = ramp(ctx, u, t0, t1, "whip");
    const x = sign * (a * ctx.W * 2.2 - ctx.W * 0.2);
    streak.style.transform = `translateX(${x.toFixed(1)}px) skewX(-14deg)`;
    streak.style.opacity = opa(Math.sin(Math.PI * a));
  });
  if (sound) ctx.sfx(sound, t - dur * 0.6, { offset: -6 });
  return root;
}
