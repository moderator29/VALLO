/**
 * THE PHONE: the object that carries the mobile film.
 *
 *   const p = phone(ctx, { model: "island" | "android", parent });
 *   tl.to(p.pose, { cx, cy, height, rx, ry, rz, opacity, ... }, t);
 *   p.screen   // the display, 1320 x 2868 display px: put captures and overlays in it
 *
 * Animate `p.pose` with GSAP, never the elements: a per-frame hook turns the
 * pose into pixels. With the live 3D module (phone3d/browser/live.js) the
 * body is rendered by three.js and the display is laid over it with a
 * matrix3d homography from the projected corners; without it, a CSS phone
 * with the same proportions stands in (for layout and quick tests).
 */

const SPECS = {
  island: { w: 77.6, h: 163.0, radius: 12.6, inset: 2.35, thick: 8.25, cutout: { type: "pill", w: 0.285, h: 0.084, top: 0.026 } },
  android: { w: 76.0, h: 160.6, radius: 10.6, inset: 1.95, thick: 8.2, cutout: { type: "hole", d: 3.05, top: 2.6 } },
};
export const DISPLAY = { W: 1320, H: 2868 };

/* One import for every phone: a phone made while the import is still on its
   way waits for it, rather than falling back to the flat stand-in. */
let liveModule = null;
function loadLive() {
  liveModule ??= import("/phone3d/browser/live.js").catch(() => null);
  return liveModule;
}

/** Draws the camera cutout on the display, in display pixels. */
function drawCutout(ctx, screen, spec) {
  const dispWmm = spec.w - 2 * spec.inset;
  const px = DISPLAY.W / dispWmm;
  const c = spec.cutout;
  if (c.type === "pill") {
    const w = c.w * DISPLAY.W;
    const h = c.h * DISPLAY.W;
    const top = c.top * DISPLAY.W;
    ctx.el("div", { class: "abs", style: { left: `${(DISPLAY.W - w) / 2}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${h / 2}px`, background: "#000", zIndex: 999 } }, screen);
  } else {
    const d = c.d * px;
    const cy = c.top * px;
    ctx.el("div", { class: "abs", style: { left: `${DISPLAY.W / 2 - d / 2}px`, top: `${cy - d / 2}px`, width: `${d}px`, height: `${d}px`, borderRadius: "50%", background: "#000", boxShadow: "0 0 0 3px rgb(30 30 36 / 0.9)", zIndex: 999 } }, screen);
  }
}

/** The 4x4 CSS matrix that maps a w x h box onto the quad [tl, tr, br, bl]. */
export function quadMatrix(w, h, q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + hh * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + hh * p3.y, f = p0.y;
  // normalise from the unit square to w x h
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(9)).join(",")})`;
}

/** Extra display px drawn under the phone's black border, so the display edge shows no seam. */
const BLEED = 10;

export function phone(ctx, { model = "island", color = "black-titanium", parent = ctx.stage, z = 0, use3d = true, shadow = true, edge = "#010118", env = "dark" } = {}) {
  const spec = SPECS[model];
  const pose = { cx: ctx.W / 2, cy: ctx.H / 2, height: ctx.isMobile ? 1400 : 860, rx: 0, ry: 0, rz: 0, fov: 24, opacity: 1 };
  const root = ctx.el("div", { class: "abs", style: { left: 0, top: 0, width: `${ctx.W}px`, height: `${ctx.H}px`, zIndex: String(z), pointerEvents: "none" } }, parent);
  const shade = shadow
    ? ctx.el("div", { class: "abs", style: { left: 0, top: 0, width: "100px", height: "100px", borderRadius: "50%", background: "radial-gradient(closest-side, rgb(0 0 12 / 0.55), rgb(0 0 12 / 0.2) 55%, transparent)" } }, root)
    : null;
  /* The display: `screen` is 1320 x 2868 display px; `frame` carries it with a
     bleed in the edge colour and is what gets mapped onto the phone. */
  const frame = ctx.el("div", {
    class: "abs",
    style: { left: 0, top: 0, width: `${DISPLAY.W + 2 * BLEED}px`, height: `${DISPLAY.H + 2 * BLEED}px`, background: edge, transformOrigin: "0 0", overflow: "hidden" },
  });
  const screen = ctx.el("div", {
    class: "abs",
    style: { left: `${BLEED}px`, top: `${BLEED}px`, width: `${DISPLAY.W}px`, height: `${DISPLAY.H}px`, overflow: "hidden", background: edge },
  }, frame);
  const self = { pose, screen, frame, root, spec, model, mode: "css" };

  const dispW = spec.w - 2 * spec.inset;
  const dispH = spec.h - 2 * spec.inset;
  const dispRadiusMm = Math.max(1, spec.radius - spec.inset);
  const scene = () => root.closest(".scene");

  function placeShade() {
    const w = pose.height * (spec.w / spec.h) * 1.1;
    shade.style.width = `${w}px`;
    shade.style.height = `${w * 0.2}px`;
    shade.style.transform = `translate(${pose.cx - w / 2}px, ${pose.cy + pose.height * 0.46}px)`;
    shade.style.opacity = String(pose.opacity * 0.85);
  }

  const live3d = use3d ? loadLive() : Promise.resolve(null);
  ctx.pending = (ctx.pending ?? []).concat(
    live3d.then(async (mod) => {
      if (!mod?.createLivePhones) {
        buildCss();
        return;
      }
      /* The display lies under the canvas; the canvas draws the border, the
         cut-out and the glass over it (setScreen("clear")). */
      root.appendChild(frame);
      const canvas = ctx.el("canvas", { class: "abs", style: { left: 0, top: 0 } }, root);
      const live = await mod.createLivePhones({ canvas, width: ctx.W, height: ctx.H, dpr: window.devicePixelRatio || 1, env, aa: "ss", supersample: 1.5 });
      const handle = live.add({ model, color });
      handle.setScreen("clear");
      self.mode = "3d";
      self.handle = handle;
      let drawn = null;
      let lastT = null;
      ctx.onFrame((t) => {
        /* A seek that is not the next frame (a worker starting its segment, a
           check run) can leave Chromium holding an empty raster for the warped
           display layer: the bezel draws and the screen is blank. Rebuilding
           the layer on every jump makes the frame the same in any order. */
        const jumped = lastT === null || Math.abs(t - lastT) > 0.2;
        lastT = t;
        if (jumped) {
          const next = frame.nextSibling;
          frame.remove();
          root.insertBefore(frame, next);
          drawn = null;
        }
        const s = scene();
        const on = pose.opacity > 0.001 && (!s || s.style.visibility === "visible");
        canvas.style.visibility = on ? "visible" : "hidden";
        frame.style.visibility = on ? "visible" : "hidden";
        if (shade) shade.style.visibility = on ? "visible" : "hidden";
        if (!on) return;
        const key = [pose.cx, pose.cy, pose.height, pose.rx, pose.ry, pose.rz, pose.fov].map((v) => v.toFixed(4)).join(",");
        if (key !== drawn) {
          handle.set({ cx: pose.cx, cy: pose.cy, height: pose.height, rotation: { x: pose.rx, y: pose.ry, z: pose.rz }, fov: pose.fov, visible: true });
          live.render();
          frame.style.transform = handle.screenCss(DISPLAY.W, DISPLAY.H, BLEED);
          frame.style.clipPath = handle.screenClip(DISPLAY.W, DISPLAY.H, BLEED);
          drawn = key;
        }
        canvas.style.opacity = String(pose.opacity);
        frame.style.opacity = String(pose.opacity);
        if (shade) placeShade();
      });
    }),
  );

  /* The CSS stand-in: the same proportions, a frame band on each side for a
     hint of thickness, and the display inside. */
  function buildCss() {
    const body = ctx.el("div", { class: "abs", style: { left: 0, top: 0, transformStyle: "preserve-3d" } }, root);
    const face = ctx.el("div", {
      class: "abs",
      style: { inset: 0, background: "linear-gradient(135deg, #5a5e69 0%, #22242b 22%, #3c3f48 48%, #18191e 72%, #4b4e58 100%)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)" },
    }, body);
    const bezel = ctx.el("div", { class: "abs", style: { background: "#050507" } }, face);
    const holder = ctx.el("div", { class: "abs", style: { overflow: "hidden" } }, bezel);
    holder.appendChild(screen);
    screen.style.left = "0px";
    screen.style.top = "0px";
    screen.style.transformOrigin = "0 0";
    drawCutout(ctx, screen, spec);
    const sides = ["left", "right"].map(() => ctx.el("div", { class: "abs", style: { top: 0, background: "linear-gradient(180deg, #4a4d57, #1c1d23 30%, #3a3d46 70%, #16171c)" } }, body));
    ctx.onFrame(() => {
      const H = pose.height;
      const mm = H / spec.h;
      const W = spec.w * mm;
      const R = spec.radius * mm;
      body.style.width = `${W}px`;
      body.style.height = `${H}px`;
      face.style.borderRadius = `${R}px`;
      const band = 0.75 * mm;
      Object.assign(bezel.style, { left: `${band}px`, top: `${band}px`, right: `${band}px`, bottom: `${band}px`, borderRadius: `${R - band}px` });
      const inset = (spec.inset - 0.75) * mm;
      const dw = dispW * mm;
      const dh = dispH * mm;
      Object.assign(holder.style, { left: `${inset}px`, top: `${inset}px`, width: `${dw}px`, height: `${dh}px`, borderRadius: `${dispRadiusMm * mm}px` });
      screen.style.transform = `scale(${dw / DISPLAY.W})`;
      const th = spec.thick * mm;
      sides.forEach((el, k) => {
        Object.assign(el.style, { width: `${th}px`, height: `${H - 2 * R}px`, top: `${R}px`, left: k === 0 ? `${-th / 2}px` : `${W - th / 2}px`, transform: `rotateY(${k === 0 ? -90 : 90}deg)`, borderRadius: `${th / 2}px` });
      });
      body.style.transformOrigin = `${W / 2}px ${H / 2}px`;
      body.style.transform = `translate(${pose.cx - W / 2}px, ${pose.cy - H / 2}px) perspective(${H * 2.4}px) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg)`;
      body.style.opacity = String(pose.opacity);
      if (shade) placeShade();
    });
  }

  return self;
}
