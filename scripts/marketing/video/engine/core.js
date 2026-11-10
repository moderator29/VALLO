/**
 * THE FILMS' CORE.
 *
 * One paused GSAP timeline per film, a clock taken from timeline.json (the
 * voice plan and the music grid), and the helpers every scene uses.
 *
 * The one rule: every value on screen is a function of the timeline's time.
 * Scenes add tweens at absolute times and per-frame hooks that read only `t`.
 * No timers, no requestAnimationFrame, no Math.random, no Date, no CSS
 * animations or transitions (tokens.css switches them off). Any frame must
 * render the same every time, in any order.
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase.js";

export const SIZES = { mobile: { W: 1080, H: 1920 }, desktop: { W: 1920, H: 1080 } };

const NODE = "/node_modules";
const REPO = "/repo";

export async function createContext({ film, stage, timeline = "/video/timeline.json" }) {
  gsap.registerPlugin(CustomEase);
  gsap.config({ force3D: false, nullTargetWarn: true });
  gsap.defaults({ ease: "power3.out", duration: 0.6, autoRound: false, overwrite: false });

  /* Land slowly enough to read, leave fast, nothing linear (motion rule 4). */
  CustomEase.create("land", "M0,0 C0.12,0.72 0.24,1 1,1"); // arrives quickly, settles long
  CustomEase.create("leave", "M0,0 C0.55,0 0.9,0.35 1,1"); // eases off, then goes
  CustomEase.create("glide", "M0,0 C0.62,0 0.18,1 1,1"); // a move between two rests
  CustomEase.create("whip", "M0,0 C0.78,0 0.08,1 1,1"); // a snap move, for handoffs
  CustomEase.create("drift", "M0,0 C0.3,0.2 0.7,0.8 1,1"); // slow push, almost even but never linear

  const T = await fetch(timeline, { cache: "no-store" }).then((r) => r.json());
  const { W, H } = SIZES[film];
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;

  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const scenes = [];
  const hooks = [];
  const loads = [];
  const cues = [];
  const captionGaps = [];
  const pillGaps = [];
  const { beat: BEAT, bar: BAR } = T.music;

  const norm = (s) => s.toLowerCase().replace(/[.,…?!:;'"“”‘’()]/g, "").trim();

  const ctx = {
    gsap,
    tl,
    film,
    isMobile: film === "mobile",
    isDesktop: film === "desktop",
    W,
    H,
    T,
    stage,
    duration: T.duration,
    fps: T.fps,
    BEAT,
    BAR,
    layout: {},

    /* ---------- the clock ---------- */

    /** Bar n's downbeat (bars count from 1), plus `beats` beats. */
    bar: (n, beats = 0) => (n - 1) * BAR + beats * BEAT,
    /** The k-th beat from the top (k from 0). */
    beat: (k) => k * BEAT,
    /** The nearest beat to t. */
    snap: (t) => Math.round(t / BEAT) * BEAT,
    /** Sentence i (1..22): { start, end, text }. */
    sentence(i) {
      const s = T.sentences.find((x) => x.i === i);
      if (!s) throw new Error(`no sentence ${i}`);
      return s;
    },
    /** The nth word `text` in sentence i: { start, end }. */
    word(i, text, nth = 1) {
      const want = norm(text);
      const hits = T.words.filter((w) => w.sentence === i && norm(w.word) === want);
      if (!hits[nth - 1]) throw new Error(`no word "${text}" (${nth}) in sentence ${i}`);
      return hits[nth - 1];
    },

    /* ---------- the stage ---------- */

    /** A DOM element. props: class, style (object), html, text, attrs (object). */
    el(tag, props = {}, parent = null) {
      const node = document.createElement(tag);
      if (props.class) node.className = props.class;
      if (props.style) Object.assign(node.style, props.style);
      if (props.html != null) node.innerHTML = props.html;
      if (props.text != null) node.textContent = props.text;
      if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
      if (parent) parent.appendChild(node);
      return node;
    },

    /**
     * A scene: a full-stage layer shown from `start` (inclusive) to `end`
     * (exclusive). Scenes may overlap for transitions; `z` orders them.
     * Never tween a scene root's visibility yourself: animate its children.
     */
    scene(id, start, end, { z = 0 } = {}) {
      const root = ctx.el("div", { class: "scene", attrs: { "data-scene": id, "data-off": "" }, style: { zIndex: String(z) } }, stage);
      scenes.push({ id, start, end, root, on: false });
      return root;
    },

    /** An image, decoded before the first frame and painted synchronously. */
    img(src, props = {}, parent = null) {
      const node = ctx.el("img", props, parent);
      node.decoding = "sync";
      node.loading = "eager";
      node.alt = "";
      node.src = src;
      /* A decode can fail once under memory pressure: reload up to three times. */
      const attempt = (n) => node.decode().catch(async () => {
        if (n >= 3) throw new Error(`image failed: ${src}`);
        await new Promise((r) => setTimeout(r, 400 * (n + 1)));
        node.src = `${src}${src.includes("?") ? "&" : "?"}retry=${n + 1}`;
        return attempt(n + 1);
      });
      loads.push(attempt(0));
      return node;
    },

    /** Paths to the material. */
    src: {
      capture: (id) => `${REPO}/docs/marketing/source/${id}.webp`,
      display: (id, platform = "ios") => `${REPO}/docs/marketing/screens/${id}-${platform}.png`,
      photo: (name) => `${REPO}/apps/web/public/brand/photos/${name}`,
      art: (name) => `${REPO}/apps/web/public/brand/onboarding/${name}`,
      brand: (name) => `${REPO}/apps/web/public/brand/${name}`,
      /* The founder's own 3D objects (apps/web/public/brand/3d), at 2x. */
      object: (name) => `${REPO}/apps/web/public/brand/3d/${name}@2x.webp`,
      /* A photographed place (apps/web/public/brand/scenes): house, hotel, villa, tower… */
      scene: (name) => `${REPO}/apps/web/public/brand/scenes/${name}.jpg`,
      sticker: (code) => `${NODE}/@lobehub/fluent-emoji-3d/assets/${code}.webp`,
      asset: (name) => `/video/assets/${name}`,
    },

    /** A Fluent 3D sticker (256 px source: keep it at or under ~220 px on screen). */
    sticker(code, size = 120, parent = null, props = {}) {
      return ctx.img(ctx.src.sticker(code), { ...props, style: { width: `${size}px`, height: `${size}px`, ...(props.style ?? {}) } }, parent);
    },

    /** A lucide line icon, inline, in currentColor. */
    icon(name, { size = 48, stroke = 2 } = {}, parent = null) {
      const span = ctx.el("span", { style: { display: "inline-grid", width: `${size}px`, height: `${size}px` } }, parent);
      loads.push(
        fetch(`${NODE}/lucide-static/icons/${name}.svg`)
          .then((r) => {
            if (!r.ok) throw new Error(`icon ${name}`);
            return r.text();
          })
          .then((svg) => {
            span.innerHTML = svg.replace(/width="24"/, `width="${size}"`).replace(/height="24"/, `height="${size}"`).replace(/stroke-width="2"/, `stroke-width="${stroke}"`);
          }),
      );
      return span;
    },

    /* ---------- frame hooks, sound, captions ---------- */

    /** fn(t) runs on every frame after the timeline has been set to t. */
    onFrame(fn) {
      hooks.push(fn);
    },

    /** Sets node's text to fn(t) on every frame. */
    text(node, fn) {
      let last = null;
      hooks.push((t) => {
        const value = fn(t);
        if (value !== last) {
          node.textContent = value;
          last = value;
        }
      });
    },

    /**
     * A sound effect at time t (the audio kit's names: tap, toggle_on, pop,
     * whoosh_short, chime_notify, success, ding_pay, stamp, impact_soft ...).
     * Only for real on-screen actions and real scene changes.
     */
    sfx(name, t, { offset = 0, pan = 0 } = {}) {
      /* `offset` is dB relative to the kit's own calibrated level for this
         sound (sfx/index.json, recommended_gain_db): 0 is the kit's level,
         +3 a touch louder. The mixer caps every effect under the voice. */
      cues.push({ name, t: Math.round(t * 1000) / 1000, offset_db: offset, pan });
    },

    /** No captions from t0 to t1 (the same words are already big on screen). */
    hideCaptions(t0, t1) {
      captionGaps.push([t0, t1]);
    },
    captionGaps,

    /** No chapter pill from t0 to t1 (a push brings the screen's own heading up under it). */
    hidePill(t0, t1) {
      pillGaps.push([t0, t1]);
    },
    pillGaps,

    /** A seeded random stream (mulberry32): the only randomness allowed. */
    random(seed = 1) {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let x = a;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
    },

    /** Clamp and remap helpers for hooks. */
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    progress: (t, t0, t1) => Math.min(1, Math.max(0, (t - t0) / (t1 - t0))),
    ease: (name) => gsap.parseEase(name),

    /* ---------- the film ---------- */

    async finish() {
      await Promise.all(loads.splice(0));
      await document.fonts.ready;
      await Promise.all(
        ["700 80px Poppins", "600 80px Poppins", "800 80px Poppins", "500 40px Inter", "600 40px Inter", "italic 400 80px 'Instrument Serif'", "700 80px Poppins"].map((f) =>
          document.fonts.load(f, "Vallo ₦ Yorùbá"),
        ),
      );
      /* Initialise every tween once, in time order, so a jump to any frame
         finds the same starting values as playing from the top. */
      const end = Math.max(T.duration, tl.duration());
      for (let t = 0; t <= end; t += 0.25) tl.seek(t, true);
      tl.seek(end, true);
      tl.seek(0, true);
    },

    seek(t) {
      tl.seek(t, true);
      for (const s of scenes) {
        const on = t >= s.start && t < s.end;
        if (on !== s.on) {
          s.root.style.visibility = on ? "visible" : "hidden";
          /* data-off hides every descendant too (tokens.css), even one a hook
             set to "visible", which CSS would otherwise let show through. */
          s.root.toggleAttribute("data-off", !on);
          s.on = on;
        }
      }
      for (const fn of hooks) fn(t);
    },

    cues,
    scenes,
  };
  return ctx;
}
