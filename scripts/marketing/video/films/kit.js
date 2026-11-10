/**
 * THE OCTOBER FILMS' SHOT KIT (Video One "How Vallo works", Video Two "The
 * Vallo vision"), on the old film's engine: one 3D phone that carries the
 * whole film (mobile and desktop), a browser window for the desktop film,
 * the glossy pointer, real components lifted off the live screens, camera
 * pushes, kinetic words, number rolls, pop-ups and the store ending.
 *
 * Every value is a pure function of t (BUILDING.md, "Determinism"): poses,
 * screens, pointer and bodies are drawn by per-frame hooks from keyframe
 * lists, never by history.
 */
import { orb, press, tap, words, ringBurst, sparkles, odometer, popup, popIn, browserWindow, bob } from "../engine/components.js";
import { phone } from "../engine/phone.js";

/* The 16 October pop-out containers and deep transitions live in their own
   modules; the films reach them through the kit like everything else. */
export { popOut, figureOut, badgeDisc } from "./popout.js";
export { slabWipe, shutter, irisTicks, tileFall, whipPan } from "./transitions.js";
/* The three short films' opening frames (17 October: none of them may reuse
   the onboarding artwork Videos One and Two open on). */
export { openerClock, openerReward, openerOwner } from "./openers.js";

export const DW = 1320;
export const DH = 2868;
const BAR_PX = 186;
/* Display geometry at zero rotation, measured from the live phone (scenes/c-kit.js). */
const FIT = { island: { w: 532.6 / 1180, h: 1156.6 / 1180 }, android: { w: 534.8 / 1180, h: 1162.0 / 1180 } };

export const mix = (a, b, u) => a + (b - a) * u;
export const opa = (o) => (o >= 0.9999 ? "0.9999" : Math.max(0, o).toFixed(4));

/* ------------------------------------------------------------------ clock */

/** Anchors from the film's voice plan: s(i) start, e(i) end, w(i, word, nth) start. */
export function anchors(ctx) {
  const w = (i, word, nth = 1) => ctx.word(i, word, nth).start;
  return {
    s: (i) => ctx.sentence(i).start,
    e: (i) => ctx.sentence(i).end,
    w,
    we: (i, word, nth = 1) => ctx.word(i, word, nth).end,
    /**
     * THE SAME BEAT, WHICHEVER TAKE IS UNDER THE FILM. A beat hangs on a
     * word, and a line that gets rewritten takes its words with it: the
     * referral film's "fifteen hundred friends a month" was "no limit on how
     * many friends you bring" in the take that was actually recorded, so
     * w(7, "hundred") threw and the whole film failed to build.
     *
     * wq names the word in each wording it might be spoken in, nearest
     * equivalent first, and takes the first one the recording actually has.
     * A film written this way plays on either take and needs no edit when
     * the other one arrives.
     *
     *   wq(7, "hundred", "many")   the figure, or the word that stands where
     *                              the figure stands in the older line
     */
    wq: (i, ...words) => {
      for (const word of words) {
        const [name, nth] = Array.isArray(word) ? word : [word, 1];
        try { return w(i, name, nth); } catch { /* the next wording */ }
      }
      throw new Error(`sentence ${i} has none of: ${words.map((x) => (Array.isArray(x) ? x[0] : x)).join(", ")}`);
    },
  };
}

/** u in [0, 1] from t0 to t1 through a named ease. */
export function ramp(ctx, t, t0, t1, ease = "power2.inOut") {
  if (t <= t0) return 0;
  if (t >= t1) return 1;
  return ctx.ease(ease)((t - t0) / (t1 - t0));
}

/**
 * Keyframes: [[t, {props}, ease?], ...] sorted by t. Before the first key its
 * values hold; between two keys the props glide with the later key's ease.
 */
export function keyed(ctx, list) {
  /* each key carries every prop of the keys before it, so no value depends on the frames drawn before */
  const keys = [];
  list.forEach(([t, props, ease], k) => keys.push([t, k ? { ...keys[k - 1][1], ...props } : { ...props }, ease]));
  return (t) => {
    if (t <= keys[0][0]) return { ...keys[0][1] };
    for (let k = 1; k < keys.length; k += 1) {
      const [t1, b, ease = "glide"] = keys[k];
      if (t < t1) {
        const [t0, a] = keys[k - 1];
        const u = ramp(ctx, t, t0, t1, ease);
        const out = { ...a };
        for (const key of Object.keys(b)) out[key] = mix(a[key] ?? b[key], b[key], u);
        return out;
      }
    }
    return { ...keys[keys.length - 1][1] };
  };
}

/** Runs fn(t) on every frame from t0 to t1 only. */
export function during(ctx, t0, t1, fn) {
  ctx.onFrame((t) => { if (t >= t0 && t < t1) fn(t); });
}

/** Places an element's centre at (x, y): rotation r, scale s, opacity o. */
export function place(el, { x = 0, y = 0, s = 1, r = 0, o = 1 }) {
  el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
  el.style.opacity = opa(o);
  el.style.visibility = o > 0.001 ? "inherit" : "hidden";
}

/* ---------------------------------------------------------------- grounds */

const TONES = {
  navy: ["rgb(0 105 254 / 0.50)", "rgb(0 63 152 / 0.22)", "#02063f", "#010118"],
  electric: ["rgb(0 105 254 / 0.75)", "rgb(47 124 255 / 0.30)", "#031062", "#010118"],
  dusk: ["rgb(255 107 26 / 0.45)", "rgb(255 178 122 / 0.16)", "#0b0a2e", "#130b22"],
  emerald: ["rgb(16 185 129 / 0.38)", "rgb(0 105 254 / 0.18)", "#02163a", "#010118"],
  violet: ["rgb(124 92 255 / 0.45)", "rgb(0 105 254 / 0.20)", "#0a0640", "#05021c"],
  gold: ["rgb(255 196 61 / 0.36)", "rgb(255 107 26 / 0.14)", "#0d0a2c", "#07041a"],
  /* Daylight: the stage the founder's favourite cut used for its clean
     bodies. White paper, a wash of brand blue, and dark type on top. */
  day: ["rgb(0 105 254 / 0.14)", "rgb(143 211 255 / 0.16)", "#ffffff", "#e6edf9"],
  dayblue: ["rgb(0 105 254 / 0.20)", "rgb(143 211 255 / 0.22)", "#f4f8ff", "#dbe6fa"],
};

/** The tones whose stage is white, so everything drawn on them runs dark. */
export const isDay = (tone) => tone === "day" || tone === "dayblue";

/**
 * A ground: a full-stage night gradient in a tone, its glow drifting slowly,
 * with a few sparkles. Returns the scene root (z 1).
 */
export function ground(ctx, t0, t1, { tone = "navy", x = 50, y = 18, seed = 3, sparkle = 5, z = 1 } = {}) {
  if (isDay(tone)) (ctx.__day ??= []).push([t0, t1]);
  const root = ctx.scene(`ground-${t0.toFixed(2)}`, t0, t1, { z });
  const [g1, g2, top, bottom] = TONES[tone];
  const base = ctx.el("div", { class: "fill", style: { background: `linear-gradient(180deg, ${top} 0%, ${bottom} 72%)` } }, root);
  const glowEl = ctx.el("div", { class: "abs", style: { left: "-25%", top: "-25%", width: "150%", height: "150%", background: `radial-gradient(42% 30% at 50% 50%, ${g1} 0%, ${g2} 45%, transparent 75%)` } }, root);
  const low = ctx.el("div", { class: "fill", style: { background: "radial-gradient(120% 70% at 50% 115%, rgb(2 6 63 / 0.85) 0%, transparent 62%)" } }, root);
  const rand = ctx.random(seed);
  const ph = rand() * 6;
  during(ctx, t0, t1, (t) => {
    const dx = (x - 50) / 100 * ctx.W + Math.sin((t + ph) * 0.23) * ctx.W * 0.05;
    const dy = (y - 50) / 100 * ctx.H + Math.cos((t + ph) * 0.19) * ctx.H * 0.03;
    glowEl.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  });
  /* drifting soft lights (radial gradients, no blur filter) */
  const lights = [];
  for (let i = 0; i < 7; i += 1) {
    const size = (ctx.isMobile ? 160 : 140) + rand() * 260;
    /* on white paper a pale light is invisible, so day grounds drift blue */
    const hue = isDay(tone) ? "0 105 254" : rand() < 0.6 ? "143 211 255" : rand() < 0.5 ? "0 105 254" : "255 178 122";
    const el = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, borderRadius: "50%", background: `radial-gradient(closest-side, rgb(${hue} / ${((isDay(tone) ? 0.05 : 0.10) + rand() * (isDay(tone) ? 0.05 : 0.12)).toFixed(3)}), transparent)` } }, root);
    lights.push({ el, x: rand() * ctx.W, y: rand() * ctx.H, vx: (rand() - 0.5) * 26, vy: -8 - rand() * 18, size, ph: rand() * 6 });
  }
  during(ctx, t0, t1, (t) => {
    for (const l of lights) {
      const x = ((l.x + l.vx * t) % (ctx.W + l.size) + ctx.W + l.size) % (ctx.W + l.size) - l.size / 2;
      const y = ((l.y + l.vy * t) % (ctx.H + l.size) + ctx.H + l.size) % (ctx.H + l.size) - l.size / 2;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.9 + 0.1 * Math.sin(t * 0.7 + l.ph)).toFixed(4)})`;
    }
  });
  if (sparkle) sparkles(ctx, root, { area: { x: 30, y: ctx.isMobile ? 380 : 110, w: ctx.W - 60, h: ctx.isMobile ? 1100 : 780 }, count: sparkle, seed, t0, t1, min: 14, max: 30 });
  void base; void low;
  return root;
}

/** A quick bloom of light across a cut, with a whoosh. */
export function flash(ctx, t, { color = "rgb(143 211 255 / 0.55)", sound = "whoosh_short", offset = -2 } = {}) {
  const root = ctx.scene(`flash-${t.toFixed(2)}`, t - 0.2, t + 0.35, { z: 870 });
  const el = ctx.el("div", { class: "fill", style: { background: `radial-gradient(60% 50% at 50% 50%, ${color} 0%, transparent 70%)`, opacity: 0 } }, root);
  during(ctx, t - 0.2, t + 0.35, (u) => {
    const a = ramp(ctx, u, t - 0.2, t, "power2.in") * (1 - ramp(ctx, u, t, t + 0.35, "power2.out"));
    el.style.opacity = opa(a * 0.9);
  });
  if (sound) ctx.sfx(sound, t - 0.12, { offset });
}

/* ------------------------------------------------------------- the phone */

/**
 * The film's phone. One 3D phone (one WebGL context) for the whole film:
 *   H.path(keys)                pose keyframes [[t, {cx, cy, height, rx, ry, rz, opacity}, ease]]
 *   H.show(id, t0, t1, opts)    a screen in the display (enter: slide | rise | fade | cut | left)
 *   H.tap(t, dx, dy)            the pointer comes to display px (dx, dy) and presses
 *   H.at(t)                     the pose at t;  H.toStage(t, dx, dy) a display point on the stage
 *   H.aim(dx, dy, height, X, Y) the pose that puts display point (dx, dy) at stage (X, Y)
 *   H.ring(t0, t1, box)         an electric outline on the screen (display px box)
 */
export async function hero(ctx, { model = "island", env = "dark", edge = "#040a2e", platform = "ios" } = {}) {
  const root = ctx.scene("hero-phone", 0, ctx.duration + 1, { z: 400 });
  const keys = [];
  let poseAt = () => ({ cx: ctx.W / 2, cy: ctx.H / 2, height: 1400, rx: 0, ry: 0, rz: 0, fov: 24, opacity: 0 });
  const holder = { p: null };
  const swings = [];
  const swung = (t, q) => {
    for (let i = 0; i < swings.length; i += 1) {
      const ts = swings[i];
      if (t > ts - 0.45 && t < ts + 0.55) {
        const u = (t - ts + 0.45) / 1.0;
        const k = Math.sin(Math.PI * u) ** 2;
        const dir = i % 2 ? 1 : -1;
        q.ry = (q.ry ?? 0) + dir * 22 * k;
        q.rz = (q.rz ?? 0) - dir * 2.5 * k;
        q.height = q.height * (1 - 0.06 * k);
      }
    }
    return q;
  };
  ctx.onFrame((t) => {
    if (!holder.p) return;
    Object.assign(holder.p.pose, { fov: 24, rx: 0, ry: 0, rz: 0 }, swung(t, { ...poseAt(t) }));
  });
  await Promise.all(ctx.pending ?? []);
  const p = phone(ctx, { model, parent: root, env, edge });
  await Promise.all(ctx.pending ?? []);
  if (p.mode !== "3d") console.error("films: the phone fell back to CSS");
  holder.p = p;

  const fit = FIT[model];
  const H = {
    p,
    root,
    model,
    platform,
    path(list) {
      keys.splice(0, keys.length, ...list.sort((a, b) => a[0] - b[0]));
      poseAt = keyed(ctx, keys);
      return H;
    },
    at: (t) => swung(t, { rx: 0, ry: 0, rz: 0, opacity: 1, ...poseAt(t) }),
    /** A 3D swing at each time (a chapter change): the phone turns away and back while its screen changes. */
    swing(...times) { swings.push(...times); times.forEach((ts, i) => leak(ctx, ts, { warm: i % 2 === 0 })); return H; },
    scaleAt: (t) => (fit.h * H.at(t).height) / DH,
    toStage(t, dx, dy) {
      const q = H.at(t);
      const s = (fit.h * q.height) / DH;
      return { x: q.cx + (dx - DW / 2) * s, y: q.cy + (dy - DH / 2) * s, s };
    },
    aim(dx, dy, height, X, Y) {
      const s = (fit.h * height) / DH;
      return { cx: X - (dx - DW / 2) * s, cy: Y - (dy - DH / 2) * s, height };
    },
    show(id, t0, t1, opts = {}) { (window.__dbg ??= { shows: [], taps: [], lifts: [] }).shows.push({ id, t0, t1, full: opts.full ?? null, scroll: opts.scroll ?? null }); return screenShow(ctx, H, id, t0, t1, opts); },
    tap(t, dx, dy, opts = {}) { (window.__dbg ??= { shows: [], taps: [], lifts: [] }).taps.push({ t, dx, dy }); taps.push({ t, dx, dy, ...opts }); tap(ctx, p.screen, { x: dx, y: dy, t, size: 260, sound: opts.sound ?? "tap", offset: opts.offset ?? 0 }); return H; },
    ring(t0, t1, { x, y, w, h, r = 48 }) {
      const el = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${r}px`, border: "6px solid #2f7cff", boxShadow: "0 0 46px 4px rgb(0 105 254 / 0.5), inset 0 0 34px rgb(0 105 254 / 0.22)", zIndex: 60, visibility: "hidden" } }, p.screen);
      ctx.onFrame((t) => {
        const o = ramp(ctx, t, t0, t0 + 0.25) * (1 - ramp(ctx, t, t1 - 0.25, t1));
        el.style.visibility = o > 0.001 ? "inherit" : "hidden";
        el.style.opacity = opa(o);
      });
      ctx.sfx("pop_low", t0, { offset: -3 });
      return el;
    },
  };

  /* the pointer: comes in before each tap, presses, rests, leaves (or glides to the next) */
  const taps = [];
  const ptrScene = ctx.scene("hero-pointer", 0, ctx.duration + 1, { z: 860 });
  const dot = orb(ctx, ptrScene, { size: ctx.isMobile ? 54 : 44 });
  dot.style.visibility = "hidden";
  ctx.onFrame((t) => {
    if (!taps.length) return;
    let k = -1;
    for (let i = 0; i < taps.length; i += 1) if (taps[i].t - 0.75 <= t) k = i;
    if (k < 0) { dot.style.visibility = "hidden"; return; }
    const cur = taps[k];
    const next = taps[k + 1];
    const a = H.toStage(t, cur.dx, cur.dy);
    let x = a.x, y = a.y, o = 1;
    if (t < cur.t) {
      const prev = taps[k - 1];
      const chained = prev && cur.t - prev.t < 1.6;
      const u = ramp(ctx, t, cur.t - 0.7, cur.t - 0.06, "glide");
      if (chained) {
        const b = H.toStage(t, prev.dx, prev.dy);
        x = mix(b.x, a.x, u); y = mix(b.y, a.y, u);
      } else {
        x = a.x + (1 - u) * (ctx.isMobile ? 260 : 320); y = a.y + (1 - u) * 200;
        o = ramp(ctx, t, cur.t - 0.75, cur.t - 0.45);
      }
    } else if (!(next && next.t - cur.t < 1.6)) {
      const u = ramp(ctx, t, cur.t + 0.45, cur.t + 0.95, "power2.in");
      x = a.x + u * 200; y = a.y + u * 120; o = 1 - u;
    }
    dot.style.visibility = o > 0.001 ? "inherit" : "hidden";
    dot.style.opacity = opa(o);
    dot.style.left = `${(x - (ctx.isMobile ? 27 : 22)).toFixed(2)}px`;
    dot.style.top = `${(y - (ctx.isMobile ? 27 : 22)).toFixed(2)}px`;
  });
  H.press = (t) => press(ctx, dot, t, { sound: null, ring: false });
  const origTap = H.tap;
  H.tap = (t, dx, dy, opts) => { origTap(t, dx, dy, opts); H.press(t); return H; };
  return H;
}

/**
 * A screen shown in the phone's display from t0 to t1. `id` is a display
 * (docs/marketing/screens/<id>-<platform>.png). With `full`, a tall capture
 * (docs/marketing/source/<full>.webp) scrolls under the status bar of `id`
 * by `scroll`: [[t, y], ...] in capture px.
 */
function screenShow(ctx, H, id, t0, t1, { enter = "slide", dur = 0.5, full = null, scroll = null, z = 1, patch = null } = {}) {
  /* later screens lie on top, and a screen stays under the next one until that one has landed */
  const wrap = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${DW}px`, height: `${DH}px`, overflow: "hidden", zIndex: String(z + Math.round(t0 * 20)), visibility: "hidden" } }, H.p.screen);
  const display = ctx.src.display(id, H.platform);
  let mover = null;
  if (full) {
    const strip = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${DW}px`, height: `${BAR_PX}px`, overflow: "hidden", zIndex: 2 } }, wrap);
    ctx.img(display, { class: "abs", style: { left: "0px", top: "0px", width: `${DW}px`, height: `${DH}px` } }, strip);
    mover = ctx.img(ctx.src.capture(full), { class: "abs", style: { left: "0px", top: `${BAR_PX}px`, width: `${DW}px`, height: "auto", maxWidth: "none" } }, wrap);
  } else {
    ctx.img(display, { class: "abs", style: { left: "0px", top: "0px", width: `${DW}px`, height: `${DH}px` } }, wrap);
  }
  /* A patch redraws a line of the screen's own copy (never to add a claim:
     only to keep the payments partner unnamed, as the founder rules). */
  for (const pt of patch ?? []) {
    const el = ctx.el("div", { class: "abs", style: { left: `${pt.x}px`, top: `${pt.y}px`, width: `${pt.w}px`, height: `${pt.h}px`, background: pt.bg, zIndex: 3, font: `${pt.weight ?? 400} ${pt.size}px/${pt.lh ?? 1.42} Inter, sans-serif`, color: pt.color, letterSpacing: "-0.005em", paddingTop: `${pt.pad ?? 0}px` } }, wrap);
    el.innerHTML = pt.lines.map((l) => `<div style="white-space:nowrap">${l}</div>`).join("");
  }
  const scrollAt = scroll ? keyed(ctx, scroll.map(([t, y, e]) => [t, { y }, e ?? "power2.inOut"])) : null;
  ctx.onFrame((t) => {
    const on = t >= t0 - 0.001 && t < t1 + 0.7;
    wrap.style.visibility = on ? "inherit" : "hidden";
    if (!on) return;
    const u = enter === "cut" ? 1 : ramp(ctx, t, t0, t0 + dur, "power3.out");
    let tf = "";
    if (enter === "slide") tf = `translateX(${((1 - u) * DW).toFixed(1)}px)`;
    else if (enter === "left") tf = `translateX(${((u - 1) * DW).toFixed(1)}px)`;
    else if (enter === "rise") tf = `translateY(${((1 - u) * DH * 0.6).toFixed(1)}px)`;
    wrap.style.transform = tf;
    wrap.style.opacity = enter === "fade" || enter === "rise" ? opa(u) : "0.9999";
    if (mover && scrollAt) mover.style.transform = `translateY(${(-scrollAt(t).y).toFixed(1)}px)`;
  });
  if (enter === "slide" || enter === "left") ctx.sfx("swipe", t0, { offset: -4 });
  return wrap;
}

/* ------------------------------------------------------------- the window */

/**
 * The desktop film's browser window (one for the film), at content scale s
 * (1440 x 900 content px). W.path([[t, {x, y, s, opacity}]]), W.show(id, t0,
 * t1, opts) with d-* captures, W.click(t, cx, cy) with the pointer.
 */
export function windowRig(ctx, { url = "vallospaces.com" } = {}) {
  const root = ctx.scene("hero-window", 0, ctx.duration + 1, { z: 380 });
  const win = browserWindow(ctx, { parent: root, width: 1440, url, theme: "dark" });
  win.root.style.visibility = "hidden";
  let poseAt = () => ({ x: 0, y: 0, s: 1, opacity: 0 });
  ctx.onFrame((t) => {
    const q = { opacity: 1, ...poseAt(t) };
    win.root.style.transformOrigin = "0 0";
    win.root.style.transform = `translate(${q.x.toFixed(2)}px, ${q.y.toFixed(2)}px) scale(${q.s.toFixed(5)})`;
    win.root.style.opacity = opa(q.opacity);
    win.root.style.visibility = q.opacity > 0.001 ? "inherit" : "hidden";
  });
  const clicks = [];
  const dot = orb(ctx, ctx.scene("window-pointer", 0, ctx.duration + 1, { z: 861 }), { size: 40 });
  dot.style.visibility = "hidden";
  const W = {
    win,
    path(list) { poseAt = keyed(ctx, list.sort((a, b) => a[0] - b[0])); return W; },
    at: (t) => ({ opacity: 1, ...poseAt(t) }),
    toStage(t, cx, cy) { const q = W.at(t); return { x: q.x + cx * q.s, y: q.y + (56 + cy) * q.s }; },
    show(id, t0, t1, { enter = "slide", dur = 0.5, scroll = null, full = false } = {}) {
      const wrap = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: "1440px", height: "900px", overflow: "hidden", visibility: "hidden", zIndex: String(Math.round(t0 * 20)) } }, win.content);
      const img = ctx.img(ctx.src.capture(id), { class: "abs", style: { left: "0px", top: "0px", width: "1440px", height: full ? "auto" : "900px", maxWidth: "none" } }, wrap);
      const scrollAt = scroll ? keyed(ctx, scroll.map(([t, y, e]) => [t, { y }, e ?? "power2.inOut"])) : null;
      ctx.onFrame((t) => {
        const on = t >= t0 - 0.001 && t < t1 + 0.7;
        wrap.style.visibility = on ? "inherit" : "hidden";
        if (!on) return;
        const u = enter === "cut" ? 1 : ramp(ctx, t, t0, t0 + dur, "power3.out");
        wrap.style.transform = enter === "slide" ? `translateX(${((1 - u) * 1440).toFixed(1)}px)` : enter === "rise" ? `translateY(${((1 - u) * 500).toFixed(1)}px)` : "";
        wrap.style.opacity = enter === "fade" || enter === "rise" ? opa(u) : "0.9999";
        if (scrollAt) img.style.transform = `translateY(${(-scrollAt(t).y).toFixed(1)}px)`;
      });
      if (enter === "slide") ctx.sfx("swipe", t0, { offset: -4 });
      return wrap;
    },
    url(t0, text) { ctx.text(win.url, (t) => (t >= t0 ? text : win.url.textContent)); return W; },
    click(t, cx, cy) {
      clicks.push({ t, cx, cy });
      const ring = ctx.el("div", { class: "abs", style: { left: `${cx - 60}px`, top: `${cy - 60}px`, width: "120px", height: "120px", borderRadius: "50%", border: "4px solid rgb(0 105 254 / 0.8)", opacity: 0, zIndex: 40 } }, win.content);
      ctx.tl.fromTo(ring, { scale: 0.2, opacity: 1 }, { scale: 1.2, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, t);
      ctx.onFrame((u) => { ring.style.visibility = u >= t && u < t + 0.55 ? "inherit" : "hidden"; });
      press(ctx, dot, t, { sound: "tap", ring: false });
      return W;
    },
  };
  ctx.onFrame((t) => {
    if (!clicks.length) return;
    let k = -1;
    for (let i = 0; i < clicks.length; i += 1) if (clicks[i].t - 0.8 <= t) k = i;
    if (k < 0) { dot.style.visibility = "hidden"; return; }
    const cur = clicks[k];
    const next = clicks[k + 1];
    const a = W.toStage(t, cur.cx, cur.cy);
    let x = a.x, y = a.y, o = 1;
    if (t < cur.t) {
      const prev = clicks[k - 1];
      const u = ramp(ctx, t, cur.t - 0.75, cur.t - 0.06, "glide");
      if (prev && cur.t - prev.t < 1.8) { const b = W.toStage(t, prev.cx, prev.cy); x = mix(b.x, a.x, u); y = mix(b.y, a.y, u); }
      else { x = a.x + (1 - u) * 300; y = a.y + (1 - u) * 180; o = ramp(ctx, t, cur.t - 0.8, cur.t - 0.5); }
    } else if (!(next && next.t - cur.t < 1.8)) {
      const u = ramp(ctx, t, cur.t + 0.5, cur.t + 1.0, "power2.in");
      x = a.x + u * 220; y = a.y + u * 120; o = 1 - u;
    }
    dot.style.visibility = o > 0.001 ? "inherit" : "hidden";
    dot.style.opacity = opa(o);
    dot.style.left = `${(x - 20).toFixed(2)}px`;
    dot.style.top = `${(y - 20).toFixed(2)}px`;
  });
  return W;
}

/* ----------------------------------------------------------------- bodies */

/**
 * A real component lifted off the phone's screen: the crop (display px of
 * `id`'s display image) rises from where it sits on the screen at t0, flies to
 * `to` {x, y, s (stage px per display px), r}, floats, and at t1 leaves
 * (exit: "back" returns to the screen, "fade", "up", "left", "right").
 */
export function lift(ctx, H, { id, crop, t0, t1, to, exit = "fade", fly = 0.7, z = 720, radius = 40, seed = 1, sound = "pop", src = null, scrolled = 0, label = null, framed = true, fade = true }) {
  (window.__dbg ??= { shows: [], taps: [], lifts: [] }).lifts.push({ id, crop, t0, src: !!src });
  (ctx.__holds ??= []).push([t0 + 0.3, t1]);
  const root = ctx.scene(`lift-${id}-${t0.toFixed(2)}`, t0 - 0.01, t1 + 0.8, { z });
  const S = to.s;
  const w = crop.w * S, h = crop.h * S;
  /*
   * THE FRAME, AND WHY THERE IS ONE.
   *
   * THE BLUEPRINT'S OWN MOVE (the founder, 16 October, circling pump.fun's
   * floating card twice): their card is not a card they designed. It is one
   * row of their own app, lifted off the glass, blown up, given a THICK
   * bright edge and dropped back over the place it came from. So this is a
   * component of the live product at size, inside one heavy sky rule, lit by
   * its own glow. The crop's box must sit on the component's own edges, so
   * nothing is ever cut: that, and not a vignette, is what stops a part
   * looking torn out.
   */
  /* the heavy rule, the same one the containers carry (16 October) */
  const BW = Math.max(5, w * 0.013);
  const pad = framed && label ? Math.max(13, w * 0.028) : 0;
  const card = ctx.el("div", {
    class: "abs",
    attrs: { "data-furn": "1" },
    style: {
      left: "0px", top: "0px", width: `${w + pad * 2}px`, padding: `${pad}px`, boxSizing: "border-box",
      borderRadius: `${radius * S * 1.4 + pad}px`,
      background: pad ? "#000208" : "transparent",
      border: pad ? `${BW}px solid #8FD3FF` : "none",
      boxShadow: pad ? "0 0 48px -6px rgb(143 211 255 / 0.45), 0 44px 82px -26px rgb(0 0 10 / 0.92)" : "none",
    },
  }, root);
  if (label) {
    ctx.el("div", {
      text: label,
      style: { margin: `${pad * 0.12}px 0 ${pad * 0.72}px ${pad * 0.5}px`, font: `600 ${Math.max(15, w * 0.034).toFixed(0)}px/1 Inter, sans-serif`, letterSpacing: "0.01em", color: "rgb(173 203 255 / 0.9)", whiteSpace: "nowrap" },
    }, card);
  }
  const clip = ctx.el("div", {
    style: {
      position: "relative", width: `${w}px`, height: `${h}px`, borderRadius: `${radius * S * 1.4}px`, overflow: "hidden", background: "#000208",
      ...(pad ? {} : { border: `${BW}px solid #8FD3FF`, boxSizing: "content-box", boxShadow: "0 0 48px -6px rgb(143 211 255 / 0.45), 0 44px 82px -26px rgb(0 0 10 / 0.92)" }),
    },
  }, card);
  /* src: a tall capture (crop in its own px, 1320 wide); scrolled: how far the screen is scrolled, so the part rises from where it is seen */
  if (src) ctx.img(src, { style: { position: "absolute", left: `${-crop.x * S}px`, top: `${-crop.y * S}px`, width: `${DW * S}px`, height: "auto", maxWidth: "none" } }, clip);
  else ctx.img(ctx.src.display(id, H.platform), { style: { position: "absolute", left: `${-crop.x * S}px`, top: `${-crop.y * S}px`, width: `${DW * S}px`, height: `${DH * S}px`, maxWidth: "none" } }, clip);
  /* the cut edges breathe out rather than stopping dead */
  void fade;
  const sheen = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${w * 0.6}px`, height: `${h * 3}px`, transform: "rotate(20deg)", background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.26) 50%, transparent)", pointerEvents: "none" } }, clip);
  const from = H.toStage(t0, crop.x + crop.w / 2, crop.y + crop.h / 2 - scrolled + (src ? BAR_PX : 0));
  const phase = ctx.random(seed)() * Math.PI * 2;
  const back = exit === "back" ? H.toStage(t1, crop.x + crop.w / 2, crop.y + crop.h / 2 - scrolled + (src ? BAR_PX : 0)) : null;
  card.style.visibility = "hidden";
  ctx.onFrame((t) => {
    if (t < t0 || t >= t1 + 0.8) { card.style.visibility = "hidden"; return; }
    const u = ramp(ctx, t, t0, t0 + fly, "glide");
    const v = ramp(ctx, t, t1, t1 + 0.6, exit === "back" ? "glide" : "power2.in");
    const float = Math.sin((t - t0) * 2.1 + phase) * 7 * u;
    let x = mix(from.x, to.x, u), y = mix(from.y, to.y, u) + float, s = mix(from.s / S, 1, u) * (1 + 0.035 * Math.sin(Math.PI * u));
    let r = mix(0, to.r ?? 0, u) + Math.sin((t - t0) * 1.4 + phase) * 0.8 * u, o = 1;
    if (v > 0) {
      if (back) { x = mix(x, back.x, v); y = mix(y, back.y, v); s = mix(s, back.s / S, v); r = mix(r, 0, v); o = v > 0.96 ? 0 : 1; }
      else if (exit === "up") { y -= v * 420; o = 1 - v; }
      else if (exit === "left") { x -= v * 700; o = 1 - v; }
      else if (exit === "right") { x += v * 700; o = 1 - v; }
      else { s *= 1 - 0.12 * v; o = 1 - v; }
    }
    place(card, { x, y, s, r, o });
    const sp = ramp(ctx, t, t0 + fly * 0.6, t0 + fly + 0.6, "power2.inOut");
    sheen.style.transform = `translate(${(-w * 0.7 + sp * w * 1.9).toFixed(1)}px, ${(-h).toFixed(1)}px) rotate(20deg)`;
    sheen.style.opacity = opa(Math.sin(Math.PI * sp));
  });
  if (sound) ctx.sfx(sound, t0 + 0.05, { offset: -2 });
  return card;
}

/**
 * A part held up off the DESKTOP page, the way `lift` holds one off the
 * phone. The crop is in the capture's own CSS pixels (the desktop pages are
 * 1440 x 900, captured at 2x), and it leaves from the point on the window
 * where that thing sits, so it reads as the page's own content coming
 * forward. Mounted in the same frame, for the same reason.
 */
export function windowLift(ctx, W, { id, crop, t0, t1, to, exit = "fade", fly = 0.7, z = 720, radius = 18, seed = 1, sound = "pop", label = null, framed = true, fade = true, scrolled = 0 }) {
  const root = ctx.scene(`wlift-${id}-${t0.toFixed(2)}`, t0 - 0.01, t1 + 0.8, { z });
  const S = to.s;
  const w = crop.w * S, h = crop.h * S;
  const BW = Math.max(5, w * 0.012);
  const pad = framed && label ? Math.max(12, w * 0.026) : 0;
  const card = ctx.el("div", {
    class: "abs",
    attrs: { "data-furn": "1" },
    style: {
      left: "0px", top: "0px", width: `${w + pad * 2}px`, padding: `${pad}px`, boxSizing: "border-box",
      borderRadius: `${radius * S + pad}px`,
      background: pad ? "#000208" : "transparent",
      border: pad ? `${BW}px solid #8FD3FF` : "none",
      boxShadow: pad ? "0 0 48px -6px rgb(143 211 255 / 0.45), 0 44px 82px -26px rgb(0 0 10 / 0.92)" : "none",
    },
  }, root);
  if (label) {
    ctx.el("div", {
      text: label,
      style: { margin: `${pad * 0.12}px 0 ${pad * 0.72}px ${pad * 0.5}px`, font: `600 ${Math.max(15, w * 0.034).toFixed(0)}px/1 Inter, sans-serif`, letterSpacing: "0.01em", color: "rgb(173 203 255 / 0.9)", whiteSpace: "nowrap" },
    }, card);
  }
  const clip = ctx.el("div", {
    style: {
      position: "relative", width: `${w}px`, height: `${h}px`, borderRadius: `${radius * S}px`, overflow: "hidden", background: "#000208",
      ...(pad ? {} : { border: `${BW}px solid #8FD3FF`, boxSizing: "content-box", boxShadow: "0 0 48px -6px rgb(143 211 255 / 0.45), 0 44px 82px -26px rgb(0 0 10 / 0.92)" }),
    },
  }, card);
  ctx.img(ctx.src.capture(id), { style: { position: "absolute", left: `${-crop.x * S}px`, top: `${-crop.y * S}px`, width: `${1440 * S}px`, height: "auto", maxWidth: "none" } }, clip);
  void fade;
  const sheen = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${w * 0.6}px`, height: `${h * 3}px`, transform: "rotate(20deg)", background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.26) 50%, transparent)", pointerEvents: "none" } }, clip);
  const from = W.toStage(t0, crop.x + crop.w / 2, crop.y + crop.h / 2 - scrolled);
  const back = exit === "back" ? W.toStage(t1, crop.x + crop.w / 2, crop.y + crop.h / 2 - scrolled) : null;
  const phase = ctx.random(seed)() * Math.PI * 2;
  const fromS = W.at(t0).s;
  card.style.visibility = "hidden";
  (ctx.__holds ??= []).push([t0 + 0.3, t1]);
  ctx.onFrame((t) => {
    if (t < t0 || t >= t1 + 0.8) { card.style.visibility = "hidden"; return; }
    const u = ramp(ctx, t, t0, t0 + fly, "glide");
    const v = ramp(ctx, t, t1, t1 + 0.6, exit === "back" ? "glide" : "power2.in");
    const float = Math.sin((t - t0) * 2.1 + phase) * 7 * u;
    let x = mix(from.x, to.x, u), y = mix(from.y, to.y, u) + float, s = mix(fromS / S, 1, u) * (1 + 0.035 * Math.sin(Math.PI * u));
    let r = mix(0, to.r ?? 0, u) + Math.sin((t - t0) * 1.4 + phase) * 0.8 * u, o = 1;
    if (v > 0) {
      if (back) { x = mix(x, back.x, v); y = mix(y, back.y, v); s = mix(s, W.at(t1).s / S, v); r = mix(r, 0, v); o = v > 0.96 ? 0 : 1; }
      else if (exit === "up") { y -= v * 420; o = 1 - v; }
      else if (exit === "left") { x -= v * 700; o = 1 - v; }
      else if (exit === "right") { x += v * 700; o = 1 - v; }
      else { s *= 1 - 0.12 * v; o = 1 - v; }
    }
    place(card, { x, y, s, r, o });
    const sp = ramp(ctx, t, t0 + fly * 0.6, t0 + fly + 0.6, "power2.inOut");
    sheen.style.transform = `translate(${(-w * 0.7 + sp * w * 1.9).toFixed(1)}px, ${(-h).toFixed(1)}px) rotate(20deg)`;
    sheen.style.opacity = opa(Math.sin(Math.PI * sp));
  });
  if (sound) ctx.sfx(sound, t0 + 0.05, { offset: -2 });
  return card;
}

/* ------------------------------------------------------------------ words */

/**
 * Kinetic headline: lines of [text, key] parts; words rise out of their masks
 * one after another from t0, key words in sky; at t1 they rise away.
 * box: { x, y } is the top-left (align left) or top-centre (align center).
 */
export function headline(ctx, parent, { lines, x, y, size = 110, t0, t1, align = "left", weight = 700, color = "#ffffff", key = "#8FD3FF", stagger = 0.055, lineGap = 1.04, sound = null, sheen = true, keyStyle = "colour" }) {
  const box = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: align === "center" ? "0px" : "auto" } }, parent);
  const all = [];
  const shimmer = [];
  /* `keyStyle: "chip"` sets the key word in a rounded box, the blueprint's own
     way of marking the word that matters (the founder, 16 October). The box
     opens behind the word as the word lands. */
  const chips = [];
  lines.forEach((parts, li) => {
    const row = ctx.el("div", { class: "abs display", style: { left: align === "center" ? "50%" : "0px", top: `${li * size * lineGap}px`, whiteSpace: "nowrap", fontSize: `${size}px`, fontWeight: String(weight), color, transform: align === "center" ? "translateX(-50%)" : "none" } }, box);
    for (const [text, isKey] of parts) {
      const chip = isKey && keyStyle === "chip";
      const w = words(ctx, text, { parent: row, cls: "display", style: { position: "relative", display: "inline", fontSize: "inherit", fontWeight: "inherit", color: chip ? "#ffffff" : isKey ? key : "inherit" } });
      w.el.className = "display";
      if (chip) {
        Object.assign(w.el.style, {
          display: "inline-block", padding: `${(size * 0.02).toFixed(1)}px ${(size * 0.2).toFixed(1)}px ${(size * 0.08).toFixed(1)}px`,
          margin: `0 ${(size * 0.02).toFixed(1)}px`, borderRadius: `${(size * 0.3).toFixed(1)}px`,
          background: "#04071C", boxShadow: `inset 0 0 0 ${(size * 0.062).toFixed(1)}px #8FD3FF`,
          transformOrigin: "50% 60%",
        });
        chips.push({ el: w.el, i: all.length });
      }
      w.words.forEach((n) => all.push(n));
      if (isKey && !chip && sheen) w.words.forEach((n) => { Object.assign(n.style, { backgroundImage: `linear-gradient(100deg, ${key} 0%, ${key} 38%, #ffffff 50%, ${key} 62%, ${key} 100%)`, backgroundSize: "300% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }); shimmer.push(n); });
    }
  });
  all.forEach((n, i) => {
    ctx.tl.fromTo(n, { yPercent: 118, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 0.62, ease: "land", immediateRender: false }, t0 + i * stagger);
    if (t1 != null) ctx.tl.fromTo(n, { yPercent: 0, rotate: 0 }, { yPercent: -118, rotate: -3, duration: 0.42, ease: "power3.in", immediateRender: false }, t1 + i * stagger * 0.4);
  });
  ctx.onFrame((t) => {
    /* a word is on screen until ITS OWN exit has finished: a single window for
       the whole line left the last word's mask showing a sliver of a glyph
       after the line had gone */
    for (let i = 0; i < all.length; i += 1) {
      const gone = t1 == null ? Infinity : t1 + i * stagger * 0.4 + 0.46;
      all[i].style.visibility = t >= t0 - 0.01 && t < gone ? "inherit" : "hidden";
    }
    const p = ramp(ctx, t, t0 + 0.5, t0 + 1.6, "power1.inOut");
    for (const n of shimmer) n.style.backgroundPosition = `${(100 - p * 100).toFixed(1)}% 0%`;
    for (const c of chips) {
      const u = ramp(ctx, t, t0 + c.i * stagger + 0.1, t0 + c.i * stagger + 0.46, "back.out(1.5)");
      const gone = t1 == null ? Infinity : t1 + c.i * stagger * 0.4 + 0.3;
      c.el.style.transform = `scaleX(${(0.3 + 0.7 * u).toFixed(4)})`;
      c.el.style.opacity = opa(t < gone ? u : 0);
    }
  });
  if (sound) ctx.sfx(sound, t0, { offset: -3 });
  return box;
}

/** A small glass label with an icon (lucide), in at t0, out at t1. */
export function kicker(ctx, parent, { text, icon = null, x, y, t0, t1, size = 30, tone = "dark", anchor = "left" }) {
  const el = ctx.el("div", {
    class: "abs",
    style: {
      left: "0px", top: "0px", display: "flex", alignItems: "center", gap: `${size * 0.42}px`, padding: `${size * 0.42}px ${size * 0.8}px`, borderRadius: "999px", whiteSpace: "nowrap",
      font: `600 ${size}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.01em",
      ...(tone === "dark" ? { background: "rgb(10 16 60 / 0.78)", color: "#fff", border: "1.5px solid rgb(120 170 255 / 0.35)", boxShadow: "0 18px 40px -18px rgb(0 0 20 / 0.8)" } : { background: "rgb(255 255 255 / 0.96)", color: "#0b1230", boxShadow: "0 18px 40px -18px rgb(10 30 80 / 0.45)" }),
    },
  }, parent);
  if (icon) { const i = ctx.icon(icon, { size: Math.round(size * 1.1), stroke: 2.2 }, el); i.style.color = tone === "dark" ? "#8FD3FF" : "#0069fe"; }
  ctx.el("span", { text }, el);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.45, "back.out(1.7)");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.3, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b);
    const dx = anchor === "center" ? -50 : anchor === "right" ? -100 : 0;
    el.style.transform = `translate(${x}px, ${y}px) translateX(${dx}%) translateY(${((1 - a) * 26 - b * 20).toFixed(1)}px) scale(${(0.9 + 0.1 * a).toFixed(4)})`;
    el.style.opacity = opa(o);
    el.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  ctx.sfx("pop", t0, { offset: -6 });
  return el;
}

/** The live status chip: a green dot that breathes and the words. */
export function liveChip(ctx, parent, { text = "Live now", x, y, t0, t1, size = 30, anchor = "left" }) {
  const el = kicker(ctx, parent, { text, x, y, t0, t1, size, anchor });
  const dotEl = ctx.el("span", { style: { width: `${size * 0.5}px`, height: `${size * 0.5}px`, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 6px rgb(34 197 94 / 0.22)", order: "-1" } }, el);
  ctx.onFrame((t) => { dotEl.style.boxShadow = `0 0 0 ${(4 + 4 * Math.abs(Math.sin(t * 2.4))).toFixed(1)}px rgb(34 197 94 / 0.22)`; });
  return el;
}

/** A glass card with a big rolling number and a label (odometer). */
export function numberCard(ctx, parent, { value, prefix = "₦", label, x, y, t0, t1, tOut, size = 96, anchor = "center" }) {
  const card = ctx.el("div", { class: "abs glass-dark", style: { left: "0px", top: "0px", padding: `${size * 0.32}px ${size * 0.45}px`, borderRadius: `${size * 0.36}px`, display: "flex", flexDirection: "column", gap: `${size * 0.12}px`, alignItems: "flex-start" } }, parent);
  if (label) ctx.el("div", { text: label, style: { font: `500 ${Math.round(size * 0.3)}px/1.1 Inter, sans-serif`, color: "rgb(255 255 255 / 0.72)" } }, card);
  const num = odometer(ctx, card, { value, t0, t1, prefix, fontSize: size, color: "#ffffff" });
  num.style.position = "relative";
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0 - 0.35, t0 + 0.1, "back.out(1.5)");
    const b = tOut == null ? 0 : ramp(ctx, t, tOut, tOut + 0.35, "power2.in");
    const o = Math.min(ramp(ctx, t, t0 - 0.35, t0 - 0.1), 1 - b);
    const dx = anchor === "center" ? -50 : 0;
    card.style.transform = `translate(${x}px, ${y}px) translateX(${dx}%) translateY(${((1 - a) * 40 - b * 30).toFixed(1)}px) scale(${(0.92 + 0.08 * a).toFixed(4)})`;
    card.style.opacity = opa(o);
    card.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  for (let k = 0; k < 8; k += 1) ctx.sfx("counter_tick", t0 + ((t1 - t0) * k) / 8, { offset: -4 });
  ctx.sfx("success", t1, { offset: -2 });
  void t1;
  return card;
}

/** A notification pop-up (glass), in at t, out at tOut. */
export function notify(ctx, parent, { title, line, icon = "bell", x, y, t, tOut, size = 36, example = false, from = "above", wrap = false }) {
  const card = popup(ctx, { theme: "dark", icon, title, line, now: "now", example, fontSize: size, wrap, parent, style: { position: "absolute", left: `${x}px`, top: `${y}px` } });
  card.setAttribute("data-furn", "1");
  popIn(ctx, card, t, { from, tOut, offset: -2 });
  ctx.onFrame((u) => { card.style.visibility = u >= t - 0.01 && (tOut == null || u < tOut + 0.35) ? "inherit" : "hidden"; });
  return card;
}

/** A row of small glass chips that pop in one by one (feature tags). */
export function chipRow(ctx, parent, { items, x, y, t0, gap = 0.12, t1, size = 28, icon = null, wrapW = null, anchor = "left" }) {
  const row = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, display: "flex", flexWrap: "wrap", gap: `${size * 0.5}px`, width: wrapW ? `${wrapW}px` : "auto", justifyContent: anchor === "center" ? "center" : "flex-start", transform: anchor === "center" ? "translateX(-50%)" : "none" } }, parent);
  items.forEach((it, i) => {
    const [text, ic] = Array.isArray(it) ? it : [it, icon];
    const el = ctx.el("div", { style: { display: "flex", alignItems: "center", gap: `${size * 0.35}px`, padding: `${size * 0.38}px ${size * 0.7}px`, borderRadius: "999px", background: "rgb(10 16 60 / 0.78)", border: "1.5px solid rgb(120 170 255 / 0.32)", color: "#fff", font: `600 ${size}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.01em", whiteSpace: "nowrap", boxShadow: "0 16px 36px -18px rgb(0 0 20 / 0.8)" } }, row);
    if (ic) { const n = ctx.icon(ic, { size: Math.round(size * 1.05), stroke: 2.2 }, el); n.style.color = "#8FD3FF"; }
    ctx.el("span", { text }, el);
    const ti = t0 + i * gap;
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, ti, ti + 0.4, "back.out(1.8)");
      const b = t1 == null ? 0 : ramp(ctx, t, t1 + i * 0.03, t1 + i * 0.03 + 0.3, "power2.in");
      const o = Math.min(ramp(ctx, t, ti, ti + 0.15), 1 - b);
      el.style.transform = `translateY(${((1 - a) * 30 - b * 24).toFixed(1)}px) scale(${(0.86 + 0.14 * a).toFixed(4)})`;
      el.style.opacity = opa(o);
      el.style.visibility = o > 0.001 ? "inherit" : "hidden";
    });
    ctx.sfx("pop", ti, { offset: -8 });
  });
  return row;
}

/** A glass panel with an icon plate, a title and a line (a feature card). */
export function featureCard(ctx, parent, { icon, title, line, x, y, w, t0, t1, size = 34, from = "below", anchor = "left" }) {
  const card = ctx.el("div", { class: "abs glass-dark", style: { left: "0px", top: "0px", width: `${w}px`, padding: `${size * 0.7}px`, borderRadius: `${size * 0.9}px`, display: "flex", gap: `${size * 0.6}px`, alignItems: "flex-start" } }, parent);
  const plate = ctx.el("div", { style: { flex: "none", width: `${size * 2}px`, height: `${size * 2}px`, borderRadius: `${size * 0.6}px`, display: "grid", placeItems: "center", background: "linear-gradient(150deg, #2f7cff, #003f98)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)" } }, card);
  const ic = ctx.icon(icon, { size: Math.round(size * 1.15), stroke: 2.2 }, plate); ic.style.color = "#fff";
  const body = ctx.el("div", {}, card);
  ctx.el("div", { text: title, style: { font: `700 ${size}px/1.12 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: "#fff" } }, body);
  if (line) ctx.el("div", { text: line, style: { marginTop: `${size * 0.25}px`, font: `500 ${Math.round(size * 0.72)}px/1.3 Inter, sans-serif`, color: "rgb(255 255 255 / 0.74)" } }, body);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.55, "land");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.35, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b);
    const off = from === "below" ? [0, 60] : from === "left" ? [-80, 0] : [80, 0];
    const dx = anchor === "center" ? -50 : 0;
    card.style.transform = `translate(${x}px, ${y}px) translateX(${dx}%) translate(${((1 - a) * off[0]).toFixed(1)}px, ${((1 - a) * off[1] - b * 30).toFixed(1)}px)`;
    card.style.opacity = opa(o);
    card.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  ctx.sfx("card_slide", t0, { offset: -6 });
  return card;
}

/* ------------------------------------------------------------ the wall */

/* Live listings on Vallo (the platform's example stock, as the app labels it), read from the database on 14 October. */
export const LISTINGS = [
  /* title, place, price, "to move in" or null, beds, baths, m², photo: as the home's SpaceCard shows them (captured 14 October) */
  ["Five bedroom villa on Banana Island", "Banana Island, Lagos", "₦36.2m", true, 5, 5, 520, "villa-pool-skyline-01"],
  ["Four bedroom villa in Maitama", "Maitama, Abuja", "₦26.1m", true, 4, 4, 380, "living-room-dusk"],
  ["Three bedroom terrace for sale in Karsana", "Karsana, Abuja", "₦95m", false, 3, 3, 195, "bedroom-02"],
  ["Mini flat in Yaba", "Yaba, Lagos", "₦1.8m", true, 1, 1, 42, "villa-exterior-gate"],
  ["Five bedroom detached house in Asokoro", "Asokoro, Abuja", "₦18m", true, 5, 5, 420, "bedroom-02"],
  ["Four bedroom detached house for sale on Chevron Drive", "Chevron Drive, Lagos", "₦180m", false, 4, 4, 310, "living-room-dusk"],
  ["Four bedroom terrace in Lekki Phase 1", "Lekki Phase 1, Lagos", "₦9.7m", true, 4, 4, 210, "bedroom-02"],
  ["Two bedroom flat in Independence Layout", "Independence Layout, Enugu", "₦1.6m", true, 2, 2, 84, "living-room-dusk"],
  ["Four bedroom house for sale in Old GRA", "Old GRA, Port Harcourt", "₦145m", false, 4, 4, 300, "bedroom-02"],
];

/**
 * The app's SpaceCard (home Premium, Featured, Best matches, New listings),
 * drawn at width w.
 *
 * `full` lets the title wrap onto a second line instead of ending in an
 * ellipsis. The app cuts a long title because its card is 400 px wide in a
 * scrolling row; a card the film holds up at three times that size has the
 * room, and a cut title there reads as a fault, not as the product.
 */
function listingCard(ctx, parent, [title, place, price, moveIn, beds, baths, m2, photo], w, { full = false } = {}) {
  const k = w / 400;
  const card = ctx.el("div", { style: { position: "relative", flex: "none", width: `${w}px`, padding: `${8 * k}px`, borderRadius: `${26 * k}px`, background: "linear-gradient(180deg, #0d1640, #0a1033)", border: `${1.5 * k}px solid rgb(90 130 230 / 0.28)`, boxShadow: "0 30px 60px -26px rgb(0 0 20 / 0.85)" } }, parent);
  const ph = ctx.el("div", { style: { position: "relative", width: "100%", height: `${w * 0.56}px`, overflow: "hidden", borderRadius: `${20 * k}px` } }, card);
  ctx.img(ctx.src.photo(`${photo}-640.jpg`), { style: { width: "100%", height: "100%", objectFit: "cover" } }, ph);
  ctx.el("div", { text: "Example", style: { position: "absolute", left: `${12 * k}px`, top: `${12 * k}px`, padding: `${6 * k}px ${12 * k}px`, borderRadius: "999px", background: "#fff", color: "#0b1230", font: `600 ${14 * k}px/1 Inter, sans-serif` } }, ph);
  const heart = ctx.el("div", { style: { position: "absolute", right: `${12 * k}px`, top: `${10 * k}px`, width: `${40 * k}px`, height: `${40 * k}px`, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" } }, ph);
  const hi = ctx.icon("heart", { size: Math.round(20 * k), stroke: 2.2 }, heart); hi.style.color = "#0b1230";
  const dots = ctx.el("div", { style: { position: "absolute", left: "50%", bottom: `${10 * k}px`, transform: "translateX(-50%)", display: "flex", gap: `${4 * k}px` } }, ph);
  [18, 7, 7, 7].forEach((d, i) => ctx.el("span", { style: { width: `${d * k}px`, height: `${7 * k}px`, borderRadius: "99px", background: i ? "rgb(255 255 255 / 0.6)" : "#fff" } }, dots));
  const info = ctx.el("div", { style: { marginTop: `${8 * k}px`, padding: `${14 * k}px ${14 * k}px ${14 * k}px`, borderRadius: `${18 * k}px`, background: "#040a22" } }, card);
  const row = ctx.el("div", { style: { display: "flex", justifyContent: "space-between", gap: `${10 * k}px`, alignItems: "flex-start" } }, info);
  ctx.el("div", {
    text: title,
    style: full
      ? { flex: "1", minWidth: "0", font: `600 ${17 * k}px/1.25 Inter, sans-serif`, color: "#fff" }
      : { flex: "1", minWidth: "0", font: `600 ${17 * k}px/1.25 Inter, sans-serif`, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  }, row);
  const pr = ctx.el("div", { style: { textAlign: "right", flex: "none" } }, row);
  ctx.el("div", { text: price, style: { font: `700 ${18 * k}px/1.1 Inter, sans-serif`, color: "#fff" } }, pr);
  if (moveIn) ctx.el("div", { text: "to move in", style: { font: `500 ${13 * k}px/1.3 Inter, sans-serif`, color: "rgb(214 221 249 / 0.62)" } }, pr);
  const loc = ctx.el("div", { style: { marginTop: `${8 * k}px`, display: "flex", alignItems: "center", gap: `${5 * k}px`, font: `500 ${14 * k}px/1.2 Inter, sans-serif`, color: "rgb(214 221 249 / 0.7)" } }, info);
  ctx.icon("map-pin", { size: Math.round(14 * k), stroke: 2 }, loc);
  ctx.el("span", { text: place }, loc);
  const facts = ctx.el("div", { style: { marginTop: `${7 * k}px`, display: "flex", alignItems: "center", gap: `${7 * k}px`, font: `500 ${14 * k}px/1.2 Inter, sans-serif`, color: "rgb(214 221 249 / 0.7)" } }, info);
  ctx.icon("building-2", { size: Math.round(14 * k), stroke: 2 }, facts);
  ctx.el("span", { text: `${beds} ${beds === 1 ? "bed" : "beds"} · ${baths} ${baths === 1 ? "bath" : "baths"} · ${m2} m²` }, facts);
  return card;
}

/**
 * A wall of live listing cards in tilted rows drifting at parallax speeds,
 * a light sweeping across them: the films' "look how much is here" shot.
 */
/* Five stay cards from today's stays results (n-staysd-full, 880 px wide): name, price per night and the 3-night total. */
export const STAY_CARDS = (ctx) => [1530, 2495, 3455, 4419, 5376].map((y, i) => ({ src: ctx.src.capture("n-staysd-full"), crop: { x: 30, y, w: 811, h: [919, 910, 907, 899, 899][i] }, iw: 880 }));

/** A real card cropped from a capture (crop in the capture's own px, `iw` its width), drawn at width w. */
function cropCard(ctx, parent, { src, crop, iw = 1320 }, w) {
  const s = w / crop.w;
  const card = ctx.el("div", { style: { position: "relative", flex: "none", width: `${w}px`, height: `${crop.h * s}px`, overflow: "hidden", borderRadius: `${w * 0.065}px`, boxShadow: "0 30px 60px -26px rgb(0 0 20 / 0.85)" } }, parent);
  ctx.img(src, { style: { position: "absolute", left: `${-crop.x * s}px`, top: `${-crop.y * s}px`, width: `${iw * s}px`, height: "auto", maxWidth: "none" } }, card);
  return card;
}

export function listingWall(ctx, parent, { t0, t1, rows = 3, y = null, cardW = null, gap = null, tilt = -9, speed = 60, opacity = 1, seed = 5, label = true, stays = null, stayRows = [] }) {
  const M = ctx.isMobile;
  const cw = cardW ?? (M ? 330 : 300);
  const g = gap ?? cw * 0.09;
  const ch = cw * 0.56 + cw * 0.36;
  const wall = ctx.el("div", { class: "abs", attrs: { "data-wall": "1" }, style: { left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)", maskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)" } }, parent);
  const tiltBox = ctx.el("div", { class: "abs", style: { left: `${-ctx.W * 0.3}px`, top: `${(y ?? (ctx.H - rows * (ch + g)) / 2)}px`, width: `${ctx.W * 1.6}px`, transform: `rotate(${tilt}deg)`, transformOrigin: "50% 50%" } }, wall);
  const rand = ctx.random(seed);
  const strips = [];
  for (let r = 0; r < rows; r += 1) {
    const strip = ctx.el("div", { style: { position: "absolute", left: "0px", top: `${r * (ch + g)}px`, display: "flex", gap: `${g}px` } }, tiltBox);
    const n = Math.ceil((ctx.W * 1.6) / (cw + g)) + 4;
    const off = Math.floor(rand() * LISTINGS.length);
    /* a stays row carries real stay cards from the stays results; the others the home's listing cards */
    if (stays && stayRows.includes(r)) for (let i = 0; i < n; i += 1) cropCard(ctx, strip, stays[(off + i) % stays.length], cw);
    /* `full`: the wall's cards wrap their titles rather than ending in an
       ellipsis. A cut title is the product's own doing in a 400 px row, but
       on a wall the film holds up it reads as our fault (the founder, 16
       October), and the layout check counts every one. */
    else for (let i = 0; i < n; i += 1) listingCard(ctx, strip, LISTINGS[(off + i * (r + 2)) % LISTINGS.length], cw, { full: true });
    strips.push({ strip, dir: r % 2 ? 1 : -1, v: speed * (0.75 + 0.5 * rand()), span: 4 * (cw + g) });
  }
  const sweep = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W * 0.5}px`, height: `${ctx.H}px`, background: "linear-gradient(100deg, transparent 0%, rgb(143 211 255 / 0.10) 45%, rgb(255 255 255 / 0.16) 50%, rgb(143 211 255 / 0.10) 55%, transparent 100%)" } }, wall);
  if (label) ctx.el("div", { text: "Example listings on Vallo", class: "abs", style: { right: `${M ? 40 : 60}px`, bottom: `${M ? 300 : 30}px`, font: "500 20px/1 Inter, sans-serif", color: "rgb(255 255 255 / 0.45)" } }, wall);
  wall.style.visibility = "hidden";
  ctx.onFrame((t) => {
    if (t < t0 - 0.01 || t >= t1 + 0.7) { wall.style.visibility = "hidden"; return; }
    const o = ramp(ctx, t, t0, t0 + 0.7) * (1 - ramp(ctx, t, t1, t1 + 0.6));
    wall.style.visibility = o > 0.001 ? "inherit" : "hidden";
    wall.style.opacity = opa(o * opacity);
    for (const st of strips) {
      const x = ((st.dir * st.v * (t - t0)) % st.span + st.span) % st.span - st.span;
      st.strip.style.transform = `translateX(${x.toFixed(1)}px)`;
    }
    const sx = -ctx.W * 0.6 + ((t - t0) / 2.6 % 1) * ctx.W * 2;
    sweep.style.transform = `translateX(${sx.toFixed(1)}px)`;
  });
  return wall;
}

/** A light leak: a warm band of light sweeping diagonally across the frame (film transitions). */
export function leak(ctx, t, { warm = true, dur = 0.9 } = {}) {
  const root = ctx.scene(`leak-${t.toFixed(2)}`, t - dur / 2, t + dur / 2, { z: 865 });
  const band = ctx.el("div", { class: "abs", style: { left: "0px", top: `${-ctx.H * 0.25}px`, width: `${ctx.W * 0.7}px`, height: `${ctx.H * 1.5}px`, transform: "rotate(18deg)", background: warm ? "linear-gradient(90deg, transparent, rgb(255 178 122 / 0.20) 35%, rgb(255 236 210 / 0.30) 50%, rgb(143 211 255 / 0.18) 65%, transparent)" : "linear-gradient(90deg, transparent, rgb(143 211 255 / 0.25) 50%, transparent)" } }, root);
  during(ctx, t - dur / 2, t + dur / 2, (u) => {
    const p = ramp(ctx, u, t - dur / 2, t + dur / 2, "power1.inOut");
    band.style.transform = `translateX(${(-ctx.W * 0.8 + p * ctx.W * 1.9).toFixed(1)}px) rotate(18deg)`;
    band.style.opacity = opa(Math.sin(Math.PI * p));
  });
}

/* ------------------------------------------------------------------ map */

const CITIES = [
  /* Lagos first: the trails leave from it. Then the ones far enough apart
     that no two names touch, and Ibadan last, since it sits on Lagos. */
  { name: "Lagos", lon: 3.38, lat: 6.52 },
  { name: "Abuja", lon: 7.49, lat: 9.06 },
  { name: "Kano", lon: 8.52, lat: 12.0 },
  { name: "Port Harcourt", lon: 7.03, lat: 4.82 },
  { name: "Enugu", lon: 7.5, lat: 6.45 },
  { name: "Kaduna", lon: 7.44, lat: 10.52 },
  { name: "Benin City", lon: 5.62, lat: 6.34, below: true },
  { name: "Ibadan", lon: 3.9, lat: 7.38 },
];

/**
 * Nigeria's outline (world-atlas 50m) drawing itself from t0, a soft fill,
 * then the cities lighting one by one from `tCities` (every `gap` s); out at t1.
 */
export async function nigeriaMap(ctx, parent, { x, y, w, t0, t1, tCities = null, gap = 0.35, labels = true, cities = CITIES.length }) {
  const { feature } = await import("/node_modules/topojson-client/src/index.js");
  const world = await fetch("/node_modules/world-atlas/countries-50m.json").then((r) => r.json());
  const geo = feature(world, world.objects.countries.geometries.find((g) => String(g.id) === "566"));
  const polys = geo.geometry.type === "Polygon" ? [geo.geometry.coordinates] : geo.geometry.coordinates;
  const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const lon0 = Math.min(...lons), lon1 = Math.max(...lons), lat0 = Math.min(...lats), lat1 = Math.max(...lats);
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const sx = w / ((lon1 - lon0) * k);
  const h = (lat1 - lat0) * sx;
  const proj = (lon, lat) => ({ x: (lon - lon0) * k * sx, y: (lat1 - lat) * sx });
  const d = ring.map(([lon, lat], i) => { const p = proj(lon, lat); return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join("") + "Z";
  const box = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` } }, parent);
  box.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" style="overflow:visible"><defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0069fe" stop-opacity="0.35"/><stop offset="1" stop-color="#003f98" stop-opacity="0.12"/></linearGradient></defs><path class="fillp" d="${d}" fill="url(#ng)" opacity="0"/><path class="line" d="${d}" stroke="#8FD3FF" stroke-width="4" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg>`;
  const line = box.querySelector(".line");
  const fill = box.querySelector(".fillp");
  ctx.onFrame((t) => {
    const u = ramp(ctx, t, t0, t0 + 1.6, "power2.inOut");
    const out = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.4, "power2.in");
    line.setAttribute("stroke-dashoffset", (1 - u).toFixed(4));
    fill.setAttribute("opacity", (ramp(ctx, t, t0 + 0.9, t0 + 1.8) * (1 - out)).toFixed(3));
    box.style.opacity = opa(1 - out);
    box.style.visibility = t >= t0 && (t1 == null || t < t1 + 0.4) ? "inherit" : "hidden";
  });
  const tc = tCities ?? t0 + 1.4;
  CITIES.slice(0, cities).forEach((c, i) => {
    const p = proj(c.lon, c.lat);
    const dot = ctx.el("div", { class: "abs", style: { left: `${p.x - 13}px`, top: `${p.y - 13}px`, width: "26px", height: "26px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff, #8FD3FF 35%, #0069fe 75%)", boxShadow: "0 0 0 8px rgb(0 105 254 / 0.25), 0 0 30px 6px rgb(0 105 254 / 0.6)" } }, box);
    // Benin City sits just west of Enugu: its name goes under the dot, clear of Enugu's.
    const lab = labels ? ctx.el("div", { class: "abs", text: c.name, style: { left: `${c.below ? p.x : p.x + 22}px`, top: `${c.below ? p.y + 24 : p.y - 18}px`, font: `600 ${Math.round(w * 0.036)}px/1 Poppins, Inter, sans-serif`, color: "#fff", whiteSpace: "nowrap", textShadow: "0 2px 10px rgb(0 0 20 / 0.8)" } }, box) : null;
    const ti = tc + i * gap;
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, ti, ti + 0.45, "back.out(2.2)");
      dot.style.transform = `scale(${a.toFixed(4)})`;
      dot.style.opacity = opa(ramp(ctx, t, ti, ti + 0.1));
      if (lab) { lab.style.opacity = opa(ramp(ctx, t, ti + 0.1, ti + 0.4)); lab.style.transform = c.below ? `translate(-50%, ${((1 - a) * -8).toFixed(1)}px)` : `translateX(${((1 - a) * -10).toFixed(1)}px)`; }
    });
    ctx.sfx("pop", ti, { offset: -9 });
  });
  return { box, h };
}

/* ------------------------------------------------------- designed parts */

/*
 * THE FILMS DRAW THEIR OWN FURNITURE.
 *
 * A part lifted off the phone used to be a rectangle cut out of the capture
 * (`lift`). Blown up it showed its seams: a title the app had already cut
 * with an ellipsis, a slice through the row above, a sentence the crop ended
 * halfway through. The founder saw every one of them (14 October).
 *
 * So anything the film holds up close is BUILT here, from the same type,
 * radii and colours the product uses, with the whole sentence in it. `lift`
 * stays for what is honestly a picture of a screen: a badge, a button, a
 * whole self-contained block.
 */

/** The one box: a dark glass container with a hairline edge and a soft drop. */
export function panel(ctx, parent, { w = null, pad = 34, radius = 40, style = {} } = {}) {
  return ctx.el("div", {
    class: "abs",
    attrs: { "data-furn": "1" },
    style: {
      left: "0px", top: "0px", ...(w ? { width: `${w}px` } : {}), padding: `${pad}px`, borderRadius: `${radius}px`,
      background: "linear-gradient(170deg, rgb(16 26 76 / 0.96), rgb(6 12 44 / 0.96))",
      border: "1.5px solid rgb(120 170 255 / 0.30)",
      boxShadow: "0 50px 100px -32px rgb(0 0 20 / 0.85), 0 14px 32px -16px rgb(0 0 40 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.07)",
      ...style,
    },
  }, parent);
}

/**
 * A designed explainer: a title and body copy that WRAPS, so no sentence is
 * ever cut. This replaces lifting the app's own explanation sheets, whose
 * crops ended mid-line.
 */
export function sheet(ctx, parent, { icon = null, title, body = [], note = null, x, y, w, t0, t1, size = 34, anchor = "left", from = "below" }) {
  const card = panel(ctx, parent, { w, pad: size * 0.95, radius: size * 1.15 });
  const head = ctx.el("div", { style: { display: "flex", alignItems: "center", gap: `${size * 0.5}px` } }, card);
  if (icon) {
    const plate = ctx.el("div", { style: { flex: "none", width: `${size * 1.9}px`, height: `${size * 1.9}px`, borderRadius: `${size * 0.58}px`, display: "grid", placeItems: "center", background: "linear-gradient(150deg, #2f7cff, #003f98)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)" } }, head);
    const ic = ctx.icon(icon, { size: Math.round(size * 1.05), stroke: 2.2 }, plate);
    ic.style.color = "#fff";
  }
  ctx.el("div", { text: title, style: { font: `700 ${size}px/1.15 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: "#fff" } }, head);
  for (const line of body) {
    ctx.el("div", {
      text: line,
      style: { marginTop: `${size * 0.46}px`, font: `500 ${Math.round(size * 0.78)}px/1.42 Inter, sans-serif`, color: "rgb(222 232 255 / 0.80)" },
    }, card);
  }
  if (note) {
    const n = ctx.el("div", { style: { marginTop: `${size * 0.6}px`, paddingTop: `${size * 0.52}px`, borderTop: "1.5px solid rgb(120 170 255 / 0.22)", display: "flex", alignItems: "center", gap: `${size * 0.35}px` } }, card);
    ctx.el("span", { style: { width: `${size * 0.36}px`, height: `${size * 0.36}px`, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 5px rgb(34 197 94 / 0.22)" } }, n);
    ctx.el("span", { text: note, style: { font: `600 ${Math.round(size * 0.76)}px/1.25 Inter, sans-serif`, color: "#fff" } }, n);
  }
  (ctx.__holds ??= []).push([t0 + 0.3, t1]);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.58, "land");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.38, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.22), 1 - b);
    const off = from === "below" ? [0, 70] : from === "left" ? [-90, 0] : from === "above" ? [0, -70] : [90, 0];
    const dx = anchor === "center" ? -50 : anchor === "right" ? -100 : 0;
    card.style.transform = `translate(${x}px, ${y}px) translateX(${dx}%) translate(${((1 - a) * off[0]).toFixed(1)}px, ${((1 - a) * off[1] - b * 34).toFixed(1)}px) scale(${(0.96 + 0.04 * a).toFixed(4)})`;
    card.style.opacity = opa(o);
    card.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  ctx.sfx("card_slide", t0, { offset: -6 });
  return card;
}

/**
 * Flies a part the film BUILT out of the phone's screen, with the motion
 * `lift` uses: it leaves from the point on the glass where that thing is, so
 * it reads as the screen's own content coming forward.
 *   at: { x, y } in the screen's 1320x2868 pixels (where it lifts from)
 */
export function fly(ctx, H, { node, at, t0, t1, to, exit = "fade", fly: flyDur = 0.72, z = 720, seed = 3, sound = "pop", scrolled = 0 }) {
  const root = node.parentElement;
  if (root && root.style) root.style.zIndex = String(z);
  const from = H.toStage(t0, at.x, at.y - scrolled);
  const back = exit === "back" ? H.toStage(t1, at.x, at.y - scrolled) : null;
  const phase = ctx.random(seed)() * Math.PI * 2;
  const S = to.s ?? 1;
  Object.assign(node.style, { position: "absolute", left: "0px", top: "0px", transformOrigin: "50% 50%" });
  node.style.visibility = "hidden";
  ctx.onFrame((t) => {
    if (t < t0 || t >= t1 + 0.8) { node.style.visibility = "hidden"; return; }
    const u = ramp(ctx, t, t0, t0 + flyDur, "glide");
    const v = ramp(ctx, t, t1, t1 + 0.6, exit === "back" ? "glide" : "power2.in");
    const float = Math.sin((t - t0) * 2.1 + phase) * 7 * u;
    let x = mix(from.x, to.x, u), y = mix(from.y, to.y, u) + float;
    let s = mix(from.s * 0.75, S, u) * (1 + 0.03 * Math.sin(Math.PI * u));
    let r = mix(0, to.r ?? 0, u) + Math.sin((t - t0) * 1.4 + phase) * 0.7 * u;
    let o = 1;
    if (v > 0) {
      if (back) { x = mix(x, back.x, v); y = mix(y, back.y, v); s = mix(s, from.s * 0.75, v); r = mix(r, 0, v); o = v > 0.96 ? 0 : 1; }
      else if (exit === "up") { y -= v * 420; o = 1 - v; }
      else if (exit === "left") { x -= v * 700; o = 1 - v; }
      else if (exit === "right") { x += v * 700; o = 1 - v; }
      else { s *= 1 - 0.12 * v; o = 1 - v; }
    }
    place(node, { x, y, s, r, o });
    node.style.visibility = "inherit";
  });
  if (sound) ctx.sfx(sound, t0 + 0.05, { offset: -2 });
  return node;
}

/** One SpaceCard the film draws itself, at width w, with the whole title. */
export function spaceCard(ctx, parent, index, w, { full = true } = {}) {
  const card = listingCard(ctx, parent, LISTINGS[index % LISTINGS.length], w, { full });
  card.setAttribute("data-furn", "1");
  Object.assign(card.style, { boxShadow: "0 50px 100px -30px rgb(0 0 20 / 0.9), 0 0 0 1.5px rgb(143 211 255 / 0.20)" });
  return card;
}

/** One of the founder's 3D objects, standing on its own light, breathing. */
export function object3d(ctx, parent, { name, size, x, y, t0 = 0, t1 = null, drift = 1, seed = 1, delay = 0 }) {
  const box = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${size}px`, height: `${size}px` } }, parent);
  ctx.el("div", {
    class: "abs",
    style: { left: `${-size * 0.18}px`, top: `${size * 0.56}px`, width: `${size * 1.36}px`, height: `${size * 0.5}px`, borderRadius: "50%", background: "radial-gradient(50% 50% at 50% 50%, rgb(0 105 254 / 0.45), transparent 70%)", filter: "blur(10px)" },
  }, box);
  ctx.img(ctx.src.object(name), { style: { position: "absolute", left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, objectFit: "contain", filter: "drop-shadow(0 26px 40px rgb(0 0 25 / 0.75))" } }, box);
  const ph = ctx.random(seed)() * Math.PI * 2;
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0 + delay - 0.7, t0 + delay, "back.out(1.5)");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.45, "power2.in");
    const bob = Math.sin((t - t0) * 0.9 + ph) * 11 * drift;
    const sway = Math.cos((t - t0) * 0.62 + ph) * 7 * drift;
    place(box, { x: x + sway, y: y + bob - b * 90, s: (0.9 + 0.1 * a) * (1 - 0.08 * b), r: Math.sin((t - t0) * 0.5 + ph) * 1.4 * drift, o: Math.min(a, 1 - b) });
  });
  return box;
}

/** A tilted question on glass: the card the opening is built from. */
export function questionCard(ctx, parent, { text, x, y, rot = 0, t0 = 0, t1 = null, size = 38, seed = 1, delay = 0, w = null, wrap = false }) {
  const card = panel(ctx, parent, {
    ...(w ? { w } : {}), pad: size * (wrap ? 0.72 : 0.88), radius: size * (wrap ? 0.62 : 1.0),
    style: {
      background: "linear-gradient(165deg, rgb(26 44 112 / 0.90), rgb(10 19 60 / 0.92))",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      border: "1.5px solid rgb(140 185 255 / 0.26)",
      ...(wrap ? {} : { whiteSpace: "nowrap" }),
    },
  });
  ctx.el("div", {
    text,
    style: {
      font: `600 ${size}px/1.22 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: "rgb(240 246 255 / 0.98)",
      ...(wrap ? { textAlign: "center", textWrap: "balance" } : { whiteSpace: "nowrap" }),
    },
  }, card);
  const ph = ctx.random(seed)() * Math.PI * 2;
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0 + delay - 0.6, t0 + delay, "land");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.5, "power2.in");
    const bob = Math.sin((t - t0) * 0.8 + ph) * 9;
    const sway = Math.cos((t - t0) * 0.55 + ph) * 6;
    place(card, { x: x + sway - b * 40, y: y + bob - b * 70, s: 0.98 + 0.02 * a, r: rot + Math.sin((t - t0) * 0.45 + ph) * 0.8, o: Math.min(a, 1 - b) });
  });
  return card;
}

/**
 * One of the product's own night scenes, set behind a beat as its backdrop:
 * the shield and the card behind the checks, the chat and the lock behind
 * the warning, the archway behind the move-in. Low and soft, so the phone
 * and the cards stay the subject and the frame stops being empty navy.
 */
export function sceneBack(ctx, parent, { scene, t0, t1, opacity = 0.5, anchorY = 0.62, width = null }) {
  const M = ctx.isMobile;
  const aw = width ?? (M ? ctx.W * 1.04 : 1150);
  const ah = aw * (1440 / 1080);
  const left = M ? (ctx.W - aw) / 2 : ctx.W / 2 - aw / 2 + 210;
  const top = ctx.H * anchorY - ah * 0.38;
  const fadeTop = "linear-gradient(180deg, transparent 0%, #000 18%, #000 100%)";
  const fadeSide = "linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%)";
  const art = ctx.img(ctx.src.brand(`onboarding/${scene}.webp`), {
    class: "abs",
    style: {
      left: `${left.toFixed(1)}px`, top: `${top.toFixed(1)}px`, width: `${aw.toFixed(1)}px`, height: `${ah.toFixed(1)}px`, objectFit: "cover",
      WebkitMaskImage: `${fadeTop}, ${fadeSide}`, maskImage: `${fadeTop}, ${fadeSide}`,
      WebkitMaskComposite: "source-in", maskComposite: "intersect",
    },
  }, parent);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.9, "power2.out");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.6, "power2.in");
    const o = a * (1 - b);
    art.style.opacity = opa(o * opacity);
    art.style.visibility = o > 0.002 ? "inherit" : "hidden";
    art.style.transform = `scale(${(1.0 + 0.03 * a + 0.004 * Math.sin(t * 0.5)).toFixed(4)})`;
  });
  return art;
}

/**
 * THE OPENING, AND THE FRAME A CHAT SHOWS BEFORE ANYONE PRESSES PLAY.
 *
 * This is the frame the founder's reviewer liked in the first cut, rebuilt:
 * the platform's own night scene, a house and a hotel standing on blue
 * hills with a path between them, and above it the three questions anyone
 * looking for a place in Nigeria is already asking. The artwork is the
 * product's own onboarding illustration, so the thumbnail is the brand.
 *
 * It is COMPOSED AND STILL AT t = 0. Nothing fades up out of nothing,
 * because the still a chat shows before anyone presses play is the first
 * frame, and an empty blue field was what the reviewer saw the first time.
 * It breathes where it stands, then clears for the opening line.
 */
export function poster(ctx, parent, { t1, questions = QUESTIONS, scene = "step-1-dark", layout = null, size = null }) {
  const M = ctx.isMobile;
  const root = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`, overflow: "hidden" } }, parent);

  /* the night behind the hills */
  const sky = ctx.el("div", {
    class: "abs",
    style: {
      left: "0px", top: "0px", width: `${ctx.W}px`, height: `${ctx.H}px`,
      background: "radial-gradient(70% 40% at 50% 26%, rgb(0 105 254 / 0.42), transparent 72%), linear-gradient(180deg, #020733 0%, #010a2e 55%, #01103f 100%)",
    },
  }, root);

  /* The scene, placed so the house and the hotel stand in the lower third and
     the hills run off the bottom. The art is a tall 3:4, so the wide frame
     takes it narrower and melts its sides into the night rather than showing
     the edge of a picture. */
  const aw = M ? ctx.W : 1180;
  const ah = aw * (1440 / 1080);
  const left = M ? 0 : ctx.W / 2 - aw / 2 + 170;
  const top = (M ? ctx.H * 0.60 : ctx.H * 0.60) - ah * 0.38;
  const fadeTop = "linear-gradient(180deg, transparent 0%, #000 13%, #000 100%)";
  const fadeSide = "linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%)";
  const art = ctx.img(ctx.src.brand(`onboarding/${scene}.webp`), {
    class: "abs",
    style: {
      left: `${left.toFixed(1)}px`, top: `${top.toFixed(1)}px`, width: `${aw}px`, height: `${ah.toFixed(1)}px`, objectFit: "cover",
      WebkitMaskImage: M ? fadeTop : `${fadeTop}, ${fadeSide}`,
      maskImage: M ? fadeTop : `${fadeTop}, ${fadeSide}`,
      WebkitMaskComposite: M ? "source-over" : "source-in",
      maskComposite: M ? "add" : "intersect",
    },
  }, root);

  /* the questions, staggered down the frame the way the approved cut had them */
  /* Each film needs its own frame, or a chat shows four identical stills and
     nobody can tell the 2:28 from the 3:37 before pressing play. A film
     passes its own artwork, its own three lines and, when they are short, a
     layout of its own. */
  const Q = layout ? (M ? layout.mobile : layout.desktop) : (M
    ? [[404, 404, -4, 672], [628, 622, 3, 560], [430, 836, -3, 700]]
    : [[398, 318, -4, 520], [566, 494, 3, 430], [416, 700, -3, 556]]);
  const cards = [];
  questions.forEach((text, i) => {
    const [x, y, rot, w] = Q[i] ?? Q[0];
    cards.push(questionCard(ctx, root, { text, x, y, rot, w, t0: 0, t1: t1 - 0.45 - i * 0.06, size: size ?? (M ? 54 : 42), seed: 10 + i, wrap: true }));
  });

  ctx.onFrame((t) => {
    const out = ramp(ctx, t, t1 - 0.55, t1 + 0.25, "power2.inOut");
    const breath = Math.sin(t * 0.55) * 0.004;
    art.style.transform = `scale(${(1.02 + breath + out * 0.06).toFixed(4)}) translateY(${(out * ctx.H * 0.06).toFixed(1)}px)`;
    art.style.opacity = opa(1 - out);
    sky.style.opacity = opa(1 - ramp(ctx, t, t1 - 0.3, t1 + 0.3));
  });
  return root;
}

/** The three questions the old cut opened on, and the reviewer liked. */
export const QUESTIONS = ["What will it really cost?", "Who am I talking to?", "Where does my money go?"];

/* ------------------------------------------------------- the clean bodies */

/*
 * THE BODIES THE FOUNDER ASKED FOR, 14 OCTOBER.
 *
 * He sent five frames of the cut his reviewer liked and said: look how neat
 * they are, how they move, how they come off the app as clean bodies. Every
 * one of them is DRAWN, not cropped: a white card with a blue cap carrying a
 * day and a time, a month laid out in full, a booking notice, a solid blue
 * line of proof, and the money's route down a rail. White paper, dark type,
 * one idea per card, and room around it.
 *
 * So these are the parts the films hold up from now on. They carry the
 * product's own words and figures; the live screen stays on the phone
 * behind them, which is where a screenshot belongs.
 */

const INK = "#0b1230";
const INK_SOFT = "rgb(11 18 48 / 0.60)";
const BLUE = "#0069fe";

/** The white card every clean body is built on. */
function paper(ctx, parent, { w, radius = 40, pad = 0, style = {} }) {
  return ctx.el("div", {
    class: "abs",
    attrs: { "data-furn": "1" },
    style: {
      left: "0px", top: "0px", width: `${w}px`, padding: pad ? `${pad}px` : "0px", borderRadius: `${radius}px`, overflow: "hidden",
      background: "#ffffff", color: INK,
      boxShadow: "0 46px 90px -34px rgb(8 22 70 / 0.55), 0 14px 32px -16px rgb(8 22 70 / 0.30)",
      ...style,
    },
  }, parent);
}

/** Brings a drawn body in at t0 and takes it away at t1, with a little float. */
function liveCard(ctx, card, { x, y, t0, t1, rot = 0, from = "below", seed = 1, anchor = "center", sound = "card_slide" }) {
  const ph = ctx.random(seed)() * Math.PI * 2;
  (ctx.__holds ??= []).push([t0 + 0.3, t1 ?? t0 + 2]);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.6, "land");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.42, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b);
    const off = from === "below" ? [0, 90] : from === "left" ? [-110, 0] : from === "above" ? [0, -90] : [110, 0];
    const bob = Math.sin((t - t0) * 1.5 + ph) * 6 * a;
    const px = x + (1 - a) * off[0];
    const py = y + (1 - a) * off[1] + bob - b * 40;
    const dx = anchor === "left" ? 0 : anchor === "right" ? -100 : -50;
    card.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translateX(${dx}%) translateY(-50%) rotate(${(rot * a + Math.sin((t - t0) * 0.9 + ph) * 0.5).toFixed(3)}deg) scale(${(0.93 + 0.07 * a).toFixed(4)})`;
    card.style.opacity = opa(o);
    card.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  if (sound) ctx.sfx(sound, t0, { offset: -5 });
  return card;
}

/** The small blue "Example" tag the product puts on its sample content. */
function exampleTag(ctx, parent, size) {
  return ctx.el("div", {
    text: "Example",
    style: { display: "inline-block", padding: `${size * 0.22}px ${size * 0.5}px`, borderRadius: "999px", background: "rgb(0 105 254 / 0.10)", color: BLUE, font: `600 ${Math.round(size * 0.62)}px/1 Inter, sans-serif` },
  }, parent);
}

/**
 * A moment: a blue cap with the day, then the time in full, then what it
 * settled. ("Saturday / 11:00 AM / Inspection set")
 */
export function momentCard(ctx, parent, { cap, big, check, x, y, w, t0, t1, rot = -3, size = 40, seed = 1, from = "left", example = true, anchor = "center" }) {
  const card = paper(ctx, parent, { w, radius: size * 1.1 });
  const head = ctx.el("div", { style: { padding: `${size * 0.62}px ${size * 0.8}px`, background: `linear-gradient(140deg, #2f7cff, ${BLUE})` } }, card);
  ctx.el("div", { text: cap, style: { font: `700 ${size * 1.05}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: "#fff" } }, head);
  const body = ctx.el("div", { style: { padding: `${size * 0.72}px ${size * 0.8}px ${size * 0.8}px` } }, card);
  ctx.el("div", { text: big, style: { font: `700 ${size * 1.7}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.03em", color: INK } }, body);
  if (check) {
    const row = ctx.el("div", { style: { marginTop: `${size * 0.62}px`, display: "flex", alignItems: "center", gap: `${size * 0.4}px` } }, body);
    const tick = ctx.el("div", { style: { flex: "none", width: `${size * 0.92}px`, height: `${size * 0.92}px`, borderRadius: `${size * 0.3}px`, background: "rgb(0 105 254 / 0.10)", display: "grid", placeItems: "center" } }, row);
    const ic = ctx.icon("check", { size: Math.round(size * 0.62), stroke: 3 }, tick); ic.style.color = BLUE;
    ctx.el("div", { text: check, style: { font: `600 ${size * 0.88}px/1.2 Poppins, Inter, sans-serif`, color: INK } }, row);
  }
  if (example) {
    const foot = ctx.el("div", { style: { marginTop: `${size * 0.5}px`, display: "flex", justifyContent: "center" } }, body);
    exampleTag(ctx, foot, size);
  }
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/** A month, laid out in full, with one day taken. */
export function calendarCard(ctx, parent, { place, month, days = 31, start = 4, pick, x, y, w, t0, t1, tPick = null, rot = 0, seed = 2, from = "above", anchor = "center" }) {
  const k = w / 760;
  const card = paper(ctx, parent, { w, radius: 44 * k, pad: 40 * k });
  ctx.el("div", { text: place, style: { font: `600 ${24 * k}px/1.2 Inter, sans-serif`, color: INK_SOFT } }, card);
  const head = ctx.el("div", { style: { marginTop: `${10 * k}px`, display: "flex", alignItems: "center", justifyContent: "space-between" } }, card);
  ctx.el("div", { text: month, style: { font: `700 ${44 * k}px/1.1 Poppins, Inter, sans-serif`, letterSpacing: "-0.03em", color: INK } }, head);
  const navs = ctx.el("div", { style: { display: "flex", gap: `${10 * k}px` } }, head);
  for (const d of ["chevron-left", "chevron-right"]) {
    const b = ctx.el("div", { style: { width: `${52 * k}px`, height: `${52 * k}px`, borderRadius: "50%", background: "rgb(0 105 254 / 0.08)", display: "grid", placeItems: "center" } }, navs);
    const i = ctx.icon(d, { size: Math.round(24 * k), stroke: 2.4 }, b); i.style.color = BLUE;
  }
  const grid = ctx.el("div", { style: { marginTop: `${22 * k}px`, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: `${12 * k}px`, textAlign: "center" } }, card);
  for (const d of ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]) ctx.el("div", { text: d, style: { font: `600 ${22 * k}px/1.4 Inter, sans-serif`, color: INK_SOFT } }, grid);
  for (let i = 0; i < start; i += 1) ctx.el("div", { text: "" }, grid);
  const picked = [];
  for (let d = 1; d <= days; d += 1) {
    const cell = ctx.el("div", { style: { display: "grid", placeItems: "center" } }, grid);
    const dot = ctx.el("div", {
      text: String(d),
      style: { width: `${56 * k}px`, height: `${56 * k}px`, borderRadius: "50%", display: "grid", placeItems: "center", font: `${d === pick ? 700 : 500} ${26 * k}px/1 Inter, sans-serif`, color: INK },
    }, cell);
    if (d === pick) picked.push(dot);
  }
  if (picked.length) {
    const tp = tPick ?? t0 + 0.9;
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, tp, tp + 0.4, "back.out(2)");
      const dot = picked[0];
      dot.style.background = a > 0.01 ? BLUE : "transparent";
      dot.style.color = a > 0.5 ? "#fff" : INK;
      dot.style.transform = `scale(${(0.6 + 0.4 * a).toFixed(3)})`;
      dot.style.boxShadow = a > 0.01 ? `0 ${8 * k * a}px ${20 * k * a}px rgb(0 105 254 / ${(0.4 * a).toFixed(2)})` : "none";
    });
    ctx.sfx("tap", tPick ?? t0 + 0.9, { offset: -2 });
  }
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/** A notice the product would send: an object, a title, a line, and when. */
export function noticeCard(ctx, parent, { object = null, icon = "bell", title, line, x, y, w, t0, t1, rot = 0, size = 34, seed = 3, from = "above", example = true, anchor = "center" }) {
  const card = paper(ctx, parent, { w, radius: size * 1.2, pad: size * 0.7, style: { display: "flex", alignItems: "center", gap: `${size * 0.6}px` } });
  const tile = ctx.el("div", { style: { flex: "none", width: `${size * 2.1}px`, height: `${size * 2.1}px`, borderRadius: `${size * 0.66}px`, background: "rgb(0 105 254 / 0.09)", display: "grid", placeItems: "center" } }, card);
  if (object) ctx.img(ctx.src.object(object), { style: { width: `${size * 1.5}px`, height: `${size * 1.5}px`, objectFit: "contain" } }, tile);
  else { const i = ctx.icon(icon, { size: Math.round(size * 1.05), stroke: 2.3 }, tile); i.style.color = BLUE; }
  const body = ctx.el("div", { style: { flex: "1", minWidth: "0" } }, card);
  ctx.el("div", { text: title, style: { font: `700 ${size}px/1.15 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: INK } }, body);
  if (line) ctx.el("div", { text: line, style: { marginTop: `${size * 0.18}px`, font: `500 ${size * 0.78}px/1.3 Inter, sans-serif`, color: INK_SOFT } }, body);
  const meta = ctx.el("div", { style: { flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: `${size * 0.26}px` } }, card);
  if (example) exampleTag(ctx, meta, size);
  ctx.el("div", { text: "now", style: { font: `500 ${size * 0.6}px/1 Inter, sans-serif`, color: INK_SOFT } }, meta);
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/** A name and a figure: what a place costs, said once and plainly. */
export function priceCard(ctx, parent, { name, figure, unit, x, y, w, t0, t1, rot = 0, size = 36, seed = 4, from = "right", example = true, anchor = "center" }) {
  const card = paper(ctx, parent, { w, radius: size * 1.1, pad: size * 0.72 });
  const head = ctx.el("div", { style: { display: "flex", alignItems: "center", gap: `${size * 0.4}px` } }, card);
  ctx.el("div", { text: name, style: { font: `700 ${size * 0.92}px/1.15 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: INK } }, head);
  if (example) exampleTag(ctx, head, size);
  const row = ctx.el("div", { style: { marginTop: `${size * 0.4}px`, display: "flex", alignItems: "baseline", gap: `${size * 0.35}px` } }, card);
  ctx.el("div", { text: figure, style: { font: `700 ${size * 1.5}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.03em", color: INK } }, row);
  if (unit) ctx.el("div", { text: unit, style: { font: `500 ${size * 0.78}px/1 Inter, sans-serif`, color: INK_SOFT } }, row);
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/** A short list of what was checked, each line with its own tick. */
export function listCard(ctx, parent, { title, items, x, y, w, t0, t1, rot = 0, size = 34, seed = 7, from = "below", anchor = "center", stagger = 0.18 }) {
  const card = paper(ctx, parent, { w, radius: size * 1.2, pad: size * 0.85 });
  if (title) ctx.el("div", { text: title, style: { font: `700 ${size * 1.05}px/1.15 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: INK, marginBottom: `${size * 0.6}px` } }, card);
  const rows = items.map((it, i) => {
    const [head, note] = Array.isArray(it) ? it : [it, null];
    const row = ctx.el("div", { style: { display: "flex", alignItems: "flex-start", gap: `${size * 0.52}px`, marginTop: i ? `${size * 0.56}px` : "0px" } }, card);
    const tick = ctx.el("div", { style: { flex: "none", width: `${size * 1.05}px`, height: `${size * 1.05}px`, borderRadius: "50%", background: "rgb(0 105 254 / 0.10)", display: "grid", placeItems: "center" } }, row);
    const ic = ctx.icon("check", { size: Math.round(size * 0.66), stroke: 3 }, tick); ic.style.color = BLUE;
    const body = ctx.el("div", {}, row);
    ctx.el("div", { text: head, style: { font: `700 ${size * 0.92}px/1.2 Poppins, Inter, sans-serif`, color: INK } }, body);
    if (note) ctx.el("div", { text: note, style: { marginTop: `${size * 0.14}px`, font: `500 ${size * 0.74}px/1.3 Inter, sans-serif`, color: INK_SOFT } }, body);
    return row;
  });
  /* The rows follow the voice, but never so slowly that the card stands as an
     empty white box waiting for them: on the price-check beat the two words
     were a second and a half apart and the still showed a blank card. */
  const step = Math.min(stagger, 0.5);
  rows.forEach((row, i) => {
    const ti = t0 + 0.22 + i * step;
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, ti, ti + 0.4, "land");
      row.style.opacity = opa(a);
      row.style.transform = `translateX(${((1 - a) * -18).toFixed(1)}px)`;
    });
    ctx.sfx("pop", ti, { offset: -8 });
  });
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/** One plain promise on brand blue, with a tick. */
export function proofCard(ctx, parent, { lines, x, y, w, t0, t1, rot = -2, size = 40, seed = 5, from = "left", anchor = "center" }) {
  const card = paper(ctx, parent, {
    w, radius: size * 1.1, pad: size * 0.86,
    style: { background: `linear-gradient(145deg, #2f7cff, ${BLUE})`, display: "flex", alignItems: "center", gap: `${size * 0.6}px`, boxShadow: "0 46px 90px -30px rgb(0 60 180 / 0.65)" },
  });
  const tick = ctx.el("div", { style: { flex: "none", width: `${size * 1.3}px`, height: `${size * 1.3}px`, borderRadius: "50%", background: "rgb(255 255 255 / 0.22)", display: "grid", placeItems: "center" } }, card);
  const ic = ctx.icon("check", { size: Math.round(size * 0.86), stroke: 3 }, tick); ic.style.color = "#fff";
  const body = ctx.el("div", {}, card);
  for (const l of [].concat(lines)) ctx.el("div", { text: l, style: { font: `700 ${size}px/1.25 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: "#fff" } }, body);
  return liveCard(ctx, card, { x, y, t0, t1, rot, from, seed, anchor });
}

/**
 * Where the money goes, down a rail: each stop lights in turn, so the route
 * is read rather than claimed. (The provider is named the way the founder
 * rules it is named: ours, licensed, never Vallo.)
 */
export function flowRail(ctx, parent, { steps, x, y, t0, t1, gap = 250, size = 44, seed = 6, lit = null }) {
  const root = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px" } }, parent);
  const r = size * 1.5;
  const nodes = [];
  steps.forEach((label, i) => {
    const row = ctx.el("div", { class: "abs", style: { left: "0px", top: `${i * gap}px`, display: "flex", alignItems: "center", gap: `${size * 0.9}px` } }, root);
    const ring = ctx.el("div", { style: { flex: "none", width: `${r * 2}px`, height: `${r * 2}px`, borderRadius: "50%", background: "#fff", border: `${size * 0.1}px solid rgb(0 105 254 / 0.18)`, display: "grid", placeItems: "center", boxShadow: "0 18px 40px -18px rgb(8 22 70 / 0.4)" } }, row);
    const core = ctx.el("div", { style: { width: `${r * 1.1}px`, height: `${r * 1.1}px`, borderRadius: "50%", background: "#eef3ff", display: "grid", placeItems: "center", font: `700 ${size * 0.8}px/1 Poppins, Inter, sans-serif`, color: BLUE } }, ring);
    if (i === 0) ctx.el("span", { text: "₦" }, core);
    ctx.el("div", { text: label, style: { font: `700 ${size}px/1.2 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", color: INK, whiteSpace: "nowrap" } }, row);
    nodes.push({ ring, core });
    if (i < steps.length - 1) {
      const line = ctx.el("div", { class: "abs", style: { left: `${r - size * 0.05}px`, top: `${i * gap + r * 2}px`, width: `${size * 0.1}px`, height: `${gap - r * 2}px`, background: "rgb(0 105 254 / 0.22)", transformOrigin: "50% 0%" } }, root);
      nodes[i].line = line;
    }
  });
  const tLit = lit ?? steps.map((_, i) => t0 + 0.5 + i * 0.75);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.55, "land");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.4, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b);
    place(root, { x, y, s: 0.95 + 0.05 * a, o });
    nodes.forEach((n, i) => {
      const u = ramp(ctx, t, tLit[i], tLit[i] + 0.4, "back.out(1.8)");
      n.core.style.background = u > 0.5 ? BLUE : "#eef3ff";
      n.core.style.color = u > 0.5 ? "#fff" : BLUE;
      n.ring.style.boxShadow = `0 18px 40px -18px rgb(8 22 70 / 0.4), 0 0 0 ${(u * size * 0.22).toFixed(1)}px rgb(0 105 254 / 0.16)`;
      if (n.line) n.line.style.transform = `scaleY(${ramp(ctx, t, tLit[i] + 0.2, tLit[i] + 0.75).toFixed(3)})`;
    });
  });
  tLit.forEach((tt) => ctx.sfx("pop", tt, { offset: -6 }));
  (ctx.__holds ??= []).push([t0 + 0.3, t1 ?? t0 + 3]);
  return root;
}

/**
 * FOCUS.
 *
 * While the film holds a part up, the stage behind it steps back: the phone,
 * the wall and the ground sink by a stop so the thing being shown is plainly
 * the subject. Before this, a card and the screen it came from were lit the
 * same, so the card read as a screenshot pasted over a screenshot, and the
 * copy repeated underneath competed with it. Install once, after the film is
 * built, so every part registered its window first.
 */
export function installFocus(ctx, { strength = ctx.isMobile ? 0.44 : 0.28 } = {}) {
  const holds = ctx.__holds ?? [];
  if (!holds.length) return null;
  const root = ctx.scene("focus", 0, ctx.duration + 1, { z: 600 });
  const scrim = ctx.el("div", { class: "fill", style: { background: "radial-gradient(78% 58% at 50% 48%, rgb(2 5 28 / 0.72), rgb(1 2 16 / 0.93) 78%)" } }, root);
  ctx.onFrame((t) => {
    let a = 0;
    /* a white stage is already clean: dimming it would only grey the paper */
    for (const [d0, d1] of ctx.__day ?? []) if (t >= d0 - 0.3 && t <= d1 + 0.3) { scrim.style.opacity = "0"; scrim.style.visibility = "hidden"; return; }
    for (const [h0, h1] of holds) {
      if (t < h0 - 0.45 || t > h1 + 0.5) continue;
      const u = ramp(ctx, t, h0 - 0.45, h0 + 0.1) * (1 - ramp(ctx, t, h1 - 0.1, h1 + 0.5));
      if (u > a) a = u;
    }
    scrim.style.opacity = opa(a * strength);
    scrim.style.visibility = a > 0.004 ? "inherit" : "hidden";
  });
  return root;
}

/**
 * NIGERIA, RAISED, WITH THE TRAILS LEAVING IT.
 *
 * The flat outline with dots said "a map". The founder's reference says
 * something better: the country is a lit slab standing on its own glow, a
 * home sits on Lagos, and light arcs off the surface to every other city.
 * That is the picture of a platform reaching across a country, and it is
 * the shot both films open on and Video Two closes on.
 *
 * The slab is the same real outline (world-atlas 50m), squashed and turned a
 * few degrees so it reads as lying down, with its own side drawn under it for
 * thickness. The trails are drawn ABOVE that plane, so they lift off it.
 */
export async function nigeriaMap3d(ctx, parent, { x, y, w, t0, t1, tTrails = null, gap = 0.3, cities = CITIES.length, home = "Lagos", tilt = 0.66, turn = -5, labels = true }) {
  const { feature } = await import("/node_modules/topojson-client/src/index.js");
  const world = await fetch("/node_modules/world-atlas/countries-50m.json").then((r) => r.json());
  const geo = feature(world, world.objects.countries.geometries.find((g) => String(g.id) === "566"));
  const polys = geo.geometry.type === "Polygon" ? [geo.geometry.coordinates] : geo.geometry.coordinates;
  const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const lon0 = Math.min(...lons), lon1 = Math.max(...lons), lat0 = Math.min(...lats), lat1 = Math.max(...lats);
  const k = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
  const sx = w / ((lon1 - lon0) * k);
  const h = (lat1 - lat0) * sx;
  const proj = (lon, lat) => ({ x: (lon - lon0) * k * sx, y: (lat1 - lat) * sx });
  const d = ring.map(([lon, lat], i) => { const p = proj(lon, lat); return `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join("") + "Z";

  /* where a point on the lying-down slab lands on screen */
  const a = (turn * Math.PI) / 180;
  const cx = w / 2, cy = h / 2;
  const lay = (px, py) => {
    const X = px, Y = cy + (py - cy) * tilt;
    const dx = X - cx, dy = Y - cy;
    return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
  };

  const THICK = Math.max(20, w * 0.045);
  const box = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` } }, parent);

  /* the glow it stands on */
  const plate = ctx.el("div", {
    class: "abs",
    style: {
      left: `${-w * 0.3}px`, top: `${h * 0.06}px`, width: `${w * 1.6}px`, height: `${h * 1.15}px`, borderRadius: "50%",
      background: "radial-gradient(50% 50% at 50% 50%, rgb(32 140 255 / 0.95) 0%, rgb(0 105 254 / 0.62) 34%, rgb(0 70 190 / 0.30) 56%, rgb(0 40 120 / 0.12) 72%, transparent 84%)",
    },
  }, box);

  /* the slab: its side, then its lit face */
  const slab = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${w}px`, height: `${h}px`, transform: `rotate(${turn}deg) scaleY(${tilt})`, transformOrigin: "50% 50%" } }, box);
  slab.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" style="overflow:visible">
    <defs>
      <linearGradient id="ngf" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="#1f6bff" stop-opacity="0.95"/>
        <stop offset="0.55" stop-color="#0a49d8" stop-opacity="0.92"/>
        <stop offset="1" stop-color="#062a86" stop-opacity="0.9"/>
      </linearGradient>
    </defs>
    <g class="side">${Array.from({ length: 9 }, (_, i) => `<path d="${d}" fill="#05226e" opacity="${(0.95 - i * 0.05).toFixed(2)}" transform="translate(0 ${((i + 1) * THICK) / 9})"/>`).join("")}</g>
    <path class="face" d="${d}" fill="url(#ngf)"/>
    <path class="rim" d="${d}" fill="none" stroke="#8FD3FF" stroke-width="${Math.max(2, w * 0.005)}" stroke-linejoin="round" opacity="0.85"/>
  </svg>`;

  /* the trails, drawn above the plane so they lift off it */
  const over = ctx.el("div", { class: "abs", style: { left: "0px", top: "0px", width: `${w}px`, height: `${h}px`, overflow: "visible" } }, box);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(w)); svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.style.overflow = "visible";
  over.appendChild(svg);

  const list = CITIES.slice(0, cities);
  const base = list.find((c) => c.name === home) ?? list[0];
  const bp = lay(proj(base.lon, base.lat).x, proj(base.lon, base.lat).y);
  const tT = tTrails ?? t0 + 1.1;
  const trails = [];
  list.filter((c) => c !== base).forEach((c, i) => {
    const p = lay(proj(c.lon, c.lat).x, proj(c.lon, c.lat).y);
    const mx = (bp.x + p.x) / 2, my = (bp.y + p.y) / 2;
    const dist = Math.hypot(p.x - bp.x, p.y - bp.y);
    const ctrl = { x: mx, y: my - dist * 0.55 - h * 0.08 };
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M${bp.x.toFixed(1)} ${bp.y.toFixed(1)} Q${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#cfe9ff");
    path.setAttribute("stroke-width", String(Math.max(2.5, w * 0.0055)));
    path.setAttribute("stroke-linecap", "round");
    path.style.filter = `drop-shadow(0 0 ${Math.max(6, w * 0.016)}px rgb(143 211 255 / 0.95))`;
    svg.appendChild(path);
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    const head = document.createElementNS(ns, "circle");
    head.setAttribute("r", String(Math.max(4, w * 0.009)));
    head.setAttribute("fill", "#ffffff");
    head.style.filter = `drop-shadow(0 0 ${Math.max(8, w * 0.02)}px rgb(207 233 255 / 1))`;
    svg.appendChild(head);
    const dot = ctx.el("div", {
      class: "abs",
      style: { left: `${p.x - w * 0.012}px`, top: `${p.y - w * 0.012}px`, width: `${w * 0.024}px`, height: `${w * 0.024}px`, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff, #8FD3FF 40%, #0069fe 80%)", boxShadow: `0 0 ${w * 0.03}px ${w * 0.008}px rgb(0 105 254 / 0.8)` },
    }, over);
    const lab = labels ? ctx.el("div", {
      text: c.name,
      style: { position: "absolute", left: `${p.x + w * 0.022}px`, top: `${p.y - w * 0.026}px`, font: `600 ${Math.round(w * 0.042)}px/1 Poppins, Inter, sans-serif`, color: "#fff", whiteSpace: "nowrap", textShadow: "0 2px 12px rgb(0 0 25 / 0.95)" },
    }, over) : null;
    trails.push({ path, head, dot, lab, len, ti: tT + i * gap, p, bp, ctrl });
  });

  /* home: the house on Lagos, and its name on a white pill */
  const hp = bp;
  const house = ctx.img(ctx.src.object("home-small"), { class: "abs", style: { left: `${hp.x - w * 0.055}px`, top: `${hp.y - w * 0.105}px`, width: `${w * 0.11}px`, height: `${w * 0.11}px`, objectFit: "contain", filter: "drop-shadow(0 10px 18px rgb(0 0 30 / 0.7))" } }, over);
  const pill = labels ? ctx.el("div", {
    text: base.name,
    style: { position: "absolute", left: `${hp.x - w * 0.085}px`, top: `${hp.y + w * 0.022}px`, padding: `${w * 0.012}px ${w * 0.03}px`, borderRadius: "999px", background: "#ffffff", color: "#0b1230", font: `700 ${Math.round(w * 0.04)}px/1 Poppins, Inter, sans-serif`, boxShadow: "0 12px 26px -10px rgb(0 0 40 / 0.6)", whiteSpace: "nowrap" },
  }, over) : null;

  const qpt = (b, c, p, u) => ({
    x: (1 - u) * (1 - u) * b.x + 2 * (1 - u) * u * c.x + u * u * p.x,
    y: (1 - u) * (1 - u) * b.y + 2 * (1 - u) * u * c.y + u * u * p.y,
  });

  ctx.onFrame((t) => {
    const up = ramp(ctx, t, t0, t0 + 1.0, "power3.out");
    const out = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.45, "power2.in");
    const o = up * (1 - out);
    box.style.visibility = o > 0.002 ? "inherit" : "hidden";
    box.style.opacity = opa(o);
    const lift = (1 - up) * h * 0.12;
    box.style.transform = `translateY(${lift.toFixed(1)}px) scale(${(0.94 + 0.06 * up).toFixed(4)})`;
    const pulse = 0.82 + 0.12 * Math.sin(t * 0.7);
    plate.style.opacity = opa(pulse * up);
    plate.style.transform = `scale(${(0.9 + 0.1 * up + 0.015 * Math.sin(t * 0.7)).toFixed(4)})`;
    const hs = ramp(ctx, t, t0 + 0.5, t0 + 1.0, "back.out(1.8)");
    house.style.transform = `scale(${hs.toFixed(3)}) translateY(${((1 - hs) * -14).toFixed(1)}px)`;
    house.style.opacity = opa(hs);
    if (pill) { pill.style.opacity = opa(ramp(ctx, t, t0 + 0.8, t0 + 1.15)); pill.style.transform = `translateY(${((1 - ramp(ctx, t, t0 + 0.8, t0 + 1.15)) * 10).toFixed(1)}px)`; }
    for (const tr of trails) {
      const u = ramp(ctx, t, tr.ti, tr.ti + 0.85, "power2.inOut");
      tr.path.style.strokeDashoffset = String((tr.len * (1 - u)).toFixed(1));
      tr.path.style.opacity = opa(u > 0 ? 0.95 : 0);
      const q = qpt(tr.bp, tr.ctrl, tr.p, u);
      tr.head.setAttribute("cx", q.x.toFixed(1));
      tr.head.setAttribute("cy", q.y.toFixed(1));
      tr.head.style.opacity = opa(u > 0.02 && u < 0.995 ? 1 : 0);
      const land = ramp(ctx, t, tr.ti + 0.78, tr.ti + 1.1, "back.out(2)");
      tr.dot.style.transform = `scale(${land.toFixed(3)})`;
      tr.dot.style.opacity = opa(land);
      if (tr.lab) { tr.lab.style.opacity = opa(ramp(ctx, t, tr.ti + 0.9, tr.ti + 1.2)); }
    }
  });
  for (const tr of trails) ctx.sfx("whoosh_short", tr.ti, { offset: -10 });
  return { box, h };
}

/* ---------------------------------------------------------------- ending */

/**
 * The end card: the Vallo mark lands with a ring, the wordmark and "Real
 * estate, done right.", then "Live now" and the official, unmodified store
 * badges (assets/badges, SOURCES.md), then the address.
 */
export function ending(ctx, { t0, tLine, tBadges, tUrl, t1 }) {
  const M = ctx.isMobile;
  const root = ctx.scene("ending", t0 - 0.4, t1 + 1, { z: 900 });
  const bg = ctx.el("div", { class: "fill", style: { background: "radial-gradient(70% 45% at 50% 42%, rgb(0 105 254 / 0.55) 0%, rgb(0 63 152 / 0.25) 40%, transparent 72%), linear-gradient(180deg, #02063f 0%, #010118 75%)" } }, root);
  ctx.onFrame((t) => { bg.style.opacity = opa(ramp(ctx, t, t0 - 0.4, t0 + 0.1)); });
  listingWall(ctx, root, { t0: t0 - 0.2, t1: t1 + 1, rows: M ? 5 : 3, tilt: -10, speed: 40, opacity: 0.26, seed: 91, label: false, y: M ? 120 : 40 });
  ctx.el("div", { class: "fill", style: { background: "radial-gradient(60% 45% at 50% 45%, rgb(2 6 63 / 0.85), rgb(1 1 24 / 0.55) 70%, transparent)" } }, root);
  const cx = ctx.W / 2;
  const cy = M ? 760 : 380;
  const markSize = M ? 260 : 190;
  const mark = ctx.img(ctx.src.asset("logo-mark.png"), { class: "abs", style: { left: "0px", top: "0px", width: `${markSize}px`, height: `${markSize}px`, objectFit: "contain" } }, root);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.7, "back.out(1.6)");
    place(mark, { x: cx, y: cy, s: 0.4 + 0.6 * a, r: (1 - a) * -30, o: ramp(ctx, t, t0, t0 + 0.2) });
  });
  ringBurst(ctx, root, { cx, cy, r: markSize * 0.78, t: t0 + 0.1, dots: 22, seed: 41 });
  ctx.sfx("impact_soft", t0, { offset: 0 });
  headline(ctx, root, { lines: [[["Real estate, ", false], ["done right.", true]]], x: cx, y: cy + markSize * 0.75, size: M ? 78 : 64, t0: tLine, t1: null, align: "center" });
  /*
   * SOON OR LIVE, and it was neither: this end card drew "Live now on iPhone
   * and Android" and both official store badges on every render, whatever
   * --ending said. The flag reached ctx.ending and only the old engine's
   * closing scene (scenes/c-close.js) ever read it. While the apps are in
   * store review that is a false line over two badges neither store lets you
   * show for an app nobody can download yet, and FACTS-OCT.md had already
   * ruled: the films end "iPhone and Android apps coming soon", never
   * "download". So the flag now does what its name says.
   */
  const isLive = ctx.ending === "live";
  const chipY = M ? 1180 : 610;
  liveChip(ctx, root, {
    text: isLive ? "Live now on iPhone and Android" : "iPhone and Android apps coming soon",
    x: cx, y: chipY, t0: tBadges - 0.3, t1: null, size: M ? 34 : 28, anchor: "center",
  });
  const row = ctx.el("div", { class: "abs", style: { left: "0px", top: `${M ? 1290 : 690}px`, width: `${ctx.W}px`, display: "flex", justifyContent: "center", gap: `${M ? 34 : 30}px` } }, root);
  const bh = M ? 112 : 86;
  (isLive ? ["app-store-black.svg", "google-play-black.svg"] : []).forEach((f, i) => {
    const b = ctx.img(ctx.src.asset(`badges/${f}`), { style: { height: `${bh}px`, width: "auto" } }, row);
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, tBadges + i * 0.12, tBadges + i * 0.12 + 0.5, "back.out(1.6)");
      b.style.transform = `translateY(${((1 - a) * 40).toFixed(1)}px)`;
      b.style.opacity = opa(ramp(ctx, t, tBadges + i * 0.12, tBadges + i * 0.12 + 0.2));
    });
    ctx.sfx("pop", tBadges + i * 0.12, { offset: -3 });
  });
  /* With no badge row the address closes the gap rather than leaving a hole. */
  const urlY = isLive ? (M ? 1460 : 820) : (M ? 1316 : 700);
  const url = ctx.el("div", { class: "abs", text: "vallospaces.com", style: { left: "0px", top: `${urlY}px`, width: `${ctx.W}px`, textAlign: "center", font: `600 ${M ? 40 : 32}px/1 Poppins, Inter, sans-serif`, color: "rgb(255 255 255 / 0.82)", letterSpacing: "-0.01em" } }, root);
  ctx.onFrame((t) => { url.style.opacity = opa(ramp(ctx, t, tUrl, tUrl + 0.4)); url.style.transform = `translateY(${((1 - ramp(ctx, t, tUrl, tUrl + 0.5, "land")) * 20).toFixed(1)}px)`; });
  sparkles(ctx, root, { area: { x: 60, y: M ? 420 : 120, w: ctx.W - 120, h: M ? 1200 : 760 }, count: 9, seed: 77, t0, t1 });
  ctx.hideCaptions(t0 - 0.2, t1 + 1);
  return root;
}

/** V-04, the card above an account number in a chat (trust-visible.en.ts), drawn as the product draws it. */
export function flagCard(ctx, parent, M) {
  const fs = M ? 34 : 30;
  const card = ctx.el("div", { class: "abs glass-dark", style: { left: "0px", top: "0px", width: `${M ? 920 : 760}px`, padding: `${fs * 0.9}px`, borderRadius: `${fs}px`, border: "1.5px solid rgb(255 196 61 / 0.55)" } }, parent);
  const head = ctx.el("div", { style: { display: "flex", alignItems: "center", gap: `${fs * 0.5}px`, font: `600 ${fs * 0.8}px/1.2 Inter, sans-serif`, color: "#ffd27a" } }, card);
  const i = ctx.icon("shield-alert", { size: fs * 1.2, stroke: 2.2 }, head); i.style.color = "#ffc43d";
  ctx.el("span", { text: "About the account number in this message" }, head);
  ctx.el("div", { text: "The name on this account is not a name Vallo has on record for this lister.", style: { marginTop: `${fs * 0.6}px`, font: `600 ${fs}px/1.3 Poppins, Inter, sans-serif`, color: "#fff", letterSpacing: "-0.01em" } }, card);
  ctx.el("div", { text: "Pay only after inspection. Request one here.", style: { marginTop: `${fs * 0.5}px`, font: `500 ${fs * 0.78}px/1.35 Inter, sans-serif`, color: "rgb(255 255 255 / 0.72)" } }, card);
  const row = ctx.el("div", { style: { display: "flex", gap: `${fs * 0.4}px`, marginTop: `${fs * 0.8}px` } }, card);
  [["Request an inspection", true], ["Report", false], ["Block", false]].forEach(([t, main]) => {
    ctx.el("div", { text: t, style: { padding: `${fs * 0.45}px ${fs * 0.8}px`, borderRadius: "999px", font: `600 ${fs * 0.72}px/1 Poppins, Inter, sans-serif`, ...(main ? { background: "#0069fe", color: "#fff" } : { background: "rgb(255 255 255 / 0.08)", color: "#fff", border: "1px solid rgb(255 255 255 / 0.18)" }) } }, row);
  });
  return card;
}


export { orb, press, tap, words, ringBurst, sparkles, odometer, popup, popIn, browserWindow, bob };
