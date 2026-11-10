/**
 * THE VALLO LOGO, AS GEOMETRY (D81, 8 October 2026).
 *
 * The founder supplied the new mark and wordmark as two renders on a dark navy
 * ground (`docs/design/references/2026-10-08/logo-mark-new.png` and
 * `logo-wordmark-new.png`). A render on navy cannot sit on paper, on a navy
 * pill, in a favicon or in an email, so this file redraws both as vectors with
 * a transparent ground, and every logo file on the platform is built from it
 * by `scripts/build-brand-logo.mjs`.
 *
 * THE COORDINATES ARE THE REFERENCES' OWN PIXELS. Every point below was read
 * off the founder's render (1254 by 1254 for the mark, 2023 by 777 for the
 * wordmark), so the drawing can be laid over the reference at 50 per cent and
 * checked shape for shape. The viewBox crops to the artwork.
 *
 * THE MARK. Four towers, three blue and one orange, standing inside an orbit
 * ring that sweeps from cyan at the back left, through royal blue across the
 * front, to orange at the right. The ring is one band between two ellipses:
 * the inner one is lifted toward the back left, so the band tapers to a point
 * there and is thickest across the front. The towers are clipped above the
 * band's inner edge, so they stand behind the front of the ring, and the ring's
 * far right end runs behind the last tower.
 *
 * THE WORDMARK. VALLO in cyan-to-royal-blue letters. The V is two ribbons, the
 * right one laid over the left so the fold shows; the A carries an orange
 * triangle in its counter; the O carries an orange sweep over its upper right.
 *
 * ONE COLOUR SET, EVERYWHERE (D82, the founder, 8 October 2026: "make the
 * logo and the text to be not change color should be same either on light
 * mode or dark mode"). The founder's own colours: cyan to electric to royal
 * blue on the towers and letters, orange on the fourth tower, the A's
 * triangle and the O's sweep, the ring blue into orange. There is no day
 * palette, no reversed palette and no recolouring by theme: the same artwork
 * on navy, on paper and on the brand blue. No glow is baked in.
 */

const r2 = (n) => Math.round(n * 10) / 10;
const pt = ([x, y]) => `${r2(x)} ${r2(y)}`;

/* ---------- palettes ---------- */

export const COLOURS = {
  /* BRAND REFRESH (10 November 2026): the same blues and oranges, lifted. The
     founder found the mark dull on a dark home screen. Every stop is brighter
     (the low blue was #1238C8, close to the navy ground), the shaded tower
     face is lighter, and the gloss is stronger, so the towers read clean and
     crisp on navy and on white alike. */
  blueTop: "#5BE7FF",
  blueMid: "#2F95FF",
  blueLow: "#2F6BFF",
  blueDeep: "#2455F2",
  cyan: "#5BE7FF",
  orangeTop: "#FFB25E",
  orange: "#FF9244",
  orangeLow: "#F96B28",
  sheen: 0.34,
  side: "#1D47D8",
};

/* ---------- small geometry helpers ---------- */

/** A polygon with each corner rounded by its own radius (0 for sharp). */
function roundedPolygon(points, radii) {
  const n = points.length;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const r = radii[i] ?? 0;
    if (!r) {
      segs.push({ start: p, end: p, ctrl: null });
      continue;
    }
    const v1 = [prev[0] - p[0], prev[1] - p[1]];
    const v2 = [next[0] - p[0], next[1] - p[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const u1 = [v1[0] / l1, v1[1] / l1];
    const u2 = [v2[0] / l2, v2[1] / l2];
    const cos = u1[0] * u2[0] + u1[1] * u2[1];
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    /* distance from the corner to where the arc meets each edge */
    let d = r / Math.tan(half);
    d = Math.min(d, l1 * 0.48, l2 * 0.48);
    const a = [p[0] + u1[0] * d, p[1] + u1[1] * d];
    const b = [p[0] + u2[0] * d, p[1] + u2[1] * d];
    /* a cubic that hugs the corner like a circular arc */
    const k = 0.5523;
    const c1 = [a[0] + (p[0] - a[0]) * k * 1.2, a[1] + (p[1] - a[1]) * k * 1.2];
    const c2 = [b[0] + (p[0] - b[0]) * k * 1.2, b[1] + (p[1] - b[1]) * k * 1.2];
    segs.push({ start: a, end: b, ctrl: [c1, c2] });
  }
  let d = `M${pt(segs[0].end)}`;
  for (let i = 1; i <= n; i++) {
    const s = segs[i % n];
    d += `L${pt(s.start)}`;
    if (s.ctrl) d += `C${pt(s.ctrl[0])} ${pt(s.ctrl[1])} ${pt(s.end)}`;
  }
  return `${d}Z`;
}

/** A point on a rotated ellipse at parametric angle `t` (degrees). */
function onEllipse(e, t) {
  const a = (t * Math.PI) / 180;
  const rot = (e.rot * Math.PI) / 180;
  const x = e.rx * Math.cos(a);
  const y = e.ry * Math.sin(a);
  return [e.cx + x * Math.cos(rot) - y * Math.sin(rot), e.cy + x * Math.sin(rot) + y * Math.cos(rot)];
}

/** Sample an elliptical arc from t0 to t1 as a polyline string of L commands. */
function arcPoints(e, t0, t1, steps = 48) {
  const out = [];
  for (let i = 0; i <= steps; i++) out.push(onEllipse(e, t0 + ((t1 - t0) * i) / steps));
  return out;
}

/* ---------- THE MARK ---------- */

/**
 * The ring is drawn from a centre line and a thickness. The centre line is an
 * ellipse tilted to rise to the right; the band is pointed at the back-left
 * tip, thickest across the front, and thins as it climbs the right side to run
 * behind the last tower.
 */
const RING = { cx: 629, cy: 690, rx: 345, ry: 152, rot: -11.5 };
/** Parametric degrees on the centre line: the back-left tip, and the end behind tower four. */
const RING_FROM = 228;
const RING_TO = -40;
const RING_MAX = 86;
const RING_END = 8;

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function ringThickness(s) {
  /* An ease-out cubic: steep from the tip, flat (and curvature-free) by the front. */
  const x = Math.min(1, s / 0.42);
  const rise = 1 - (1 - x) ** 3;
  const fall = smooth(0.55, 1.08, s);
  return RING_MAX * rise * (1 - fall) + RING_END * fall;
}

/** The ring's two edges, sampled from the tip to the end. */
function ringEdges(steps = 96, grow = 0) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const t = RING_FROM + (RING_TO - RING_FROM) * s;
    const c = onEllipse(RING, t);
    /* the outward normal: the gradient of the implicit ellipse, rotated */
    const a = (t * Math.PI) / 180;
    const rot = (RING.rot * Math.PI) / 180;
    const lx = Math.cos(a) / RING.rx;
    const ly = Math.sin(a) / RING.ry;
    let nx = lx * Math.cos(rot) - ly * Math.sin(rot);
    let ny = lx * Math.sin(rot) + ly * Math.cos(rot);
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;
    const h = ringThickness(s) / 2;
    outer.push([c[0] + nx * h, c[1] + ny * h]);
    inner.push([c[0] - nx * (h + grow), c[1] - ny * (h + grow)]);
  }
  return { outer, inner };
}

function bandD() {
  const { outer, inner } = ringEdges();
  return `M${outer.map(pt).join("L")}L${inner.reverse().map(pt).join("L")}Z`;
}

/** Everything above the band's inner edge, with a hairline gap: where the towers may show. */
function aboveRingD() {
  const { inner: all } = ringEdges(96, 7);
  /* Stop at the inner edge's right-most point: past it the band runs across
     the back, where the towers stand in front of it. */
  let turn = 0;
  for (let i = 1; i < all.length; i++) if (all[i][0] > all[turn][0]) turn = i;
  const inner = all.slice(0, turn + 1);
  const first = inner[0];
  const last = inner[inner.length - 1];
  return `M${pt([first[0], 0])}L${inner.map(pt).join("L")}L${pt([last[0] + 400, last[1]])}L${pt([last[0] + 400, 0])}Z`;
}

export const MARK_VIEWBOX = { x: 236, y: 250, w: 776, h: 664 };

function towers() {
  /* Each tower is a slab with a sloped roof; the bottoms run long and are
     clipped by the ring (see `towerClip`). */
  return [
    {
      id: "t1",
      tone: "blue",
      points: [
        [395, 524],
        [488, 478],
        [488, 900],
        [395, 900],
      ],
      radii: [7, 7, 0, 0],
    },
    {
      id: "t2",
      tone: "blue",
      points: [
        [503, 372],
        [522, 344],
        [684, 263],
        [684, 900],
        [503, 900],
      ],
      radii: [16, 10, 7, 0, 0],
      side: [
        [503, 372],
        [522, 344],
        [524, 900],
        [503, 900],
      ],
    },
    {
      id: "t3",
      tone: "orange",
      points: [
        [708, 388],
        [802, 441],
        [802, 900],
        [708, 900],
      ],
      radii: [7, 7, 0, 0],
    },
    {
      id: "t4",
      tone: "blue",
      points: [
        [828, 514],
        [895, 549],
        [895, 900],
        [828, 900],
      ],
      radii: [6, 6, 0, 0],
    },
  ];
}

function ellipseD(e) {
  const pts = arcPoints(e, 0, 360, 120);
  return `M${pts.map(pt).join("L")}Z`;
}

/** The mark's gradients, as data, so the inline drawing in the app uses the same ones. */
export function markGradients() {
  const c = COLOURS;
  return [
    { id: "blue", x1: 0, y1: 260, x2: 0, y2: 830, user: true, stops: [[0, c.blueTop], [0.45, c.blueMid], [1, c.blueDeep]] },
    { id: "orange", x1: 0, y1: 388, x2: 0, y2: 760, user: true, stops: [[0, c.orangeTop], [0.35, c.orange], [1, c.orangeLow]] },
    { id: "sheen", x1: 0, y1: 0, x2: 1, y2: 1, user: false, stops: [[0, "#FFFFFF", c.sheen], [0.45, "#FFFFFF", 0]] },
    {
      id: "ring",
      x1: 250,
      y1: 0,
      x2: 995,
      y2: 0,
      user: true,
      stops: [[0, c.cyan], [0.16, c.blueMid], [0.38, c.blueLow], [0.6, c.blueMid], [0.74, c.blueLow], [0.9, c.orange], [1, c.orangeTop]],
    },
    {
      id: "ringShade",
      x1: 0,
      y1: 560,
      x2: 0,
      y2: 900,
      user: true,
      stops: [[0, "#FFFFFF", r2(c.sheen * 0.9)], [0.55, "#FFFFFF", 0], [1, "#000000", 0.12]],
    },
  ];
}

function gradientSvg(g, id) {
  const stops = g.stops
    .map(([o, col, op]) => `<stop offset="${o}" stop-color="${col}"${op === undefined ? "" : ` stop-opacity="${op}"`}/>`)
    .join("");
  return `<linearGradient id="${id(g.id)}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"${g.user ? ' gradientUnits="userSpaceOnUse"' : ""}>${stops}</linearGradient>`;
}

/**
 * The mark as parts, for the inline drawing the app animates
 * (`apps/web/src/lib/brand/logo-geometry.ts` is written from this).
 */
export function markParts() {
  return {
    viewBox: MARK_VIEWBOX,
    ring: bandD(),
    /* The band's centre line, tip to end: the path the ring's sweep and the
       orbiting light travel along. */
    ringCentre: `M${arcPoints(RING, RING_FROM, RING_TO, 64).map(pt).join("L")}`,
    above: aboveRingD(),
    towers: towers().map((t) => ({
      id: t.id,
      tone: t.tone,
      d: roundedPolygon(t.points, t.radii),
      side: t.side ? roundedPolygon(t.side, [16, 0, 0, 0]) : null,
    })),
  };
}

export function markSvg({ title = "Vallo" } = {}) {
  const c = COLOURS;
  const vb = MARK_VIEWBOX;
  const id = (s) => `vm-${s}`;
  const ts = towers();

  const towerFill = (t) => (t.tone === "orange" ? `url(#${id("orange")})` : `url(#${id("blue")})`);
  const towerEls = ts
    .map((t) => {
      const d = roundedPolygon(t.points, t.radii);
      const side = t.side ? `<path d="${roundedPolygon(t.side, [16, 0, 0, 0])}" fill="${c.side}" opacity="0.55"/>` : "";
      return `<path d="${d}" fill="${towerFill(t)}"/>${side}<path d="${d}" fill="url(#${id("sheen")})"/>`;
    })
    .join("");

  /* The towers stand behind the front of the ring: clip them to everything
     above the band's inner edge. */
  const clip = `<path d="${aboveRingD()}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<defs>`,
    ...markGradients().map((g) => gradientSvg(g, id)),
    `<clipPath id="${id("above")}">${clip}</clipPath>`,
    `</defs>`,
    `<path d="${bandD()}" fill="url(#${id("ring")})"/>`,
    `<g clip-path="url(#${id("above")})">${towerEls}</g>`,
    `<path d="${bandD()}" fill="url(#${id("ringShade")})"/>`,
    `</svg>`,
  ].join("");
}

/* ---------- THE WORDMARK ---------- */

export const WORDMARK_VIEWBOX = { x: 170, y: 232, w: 1664, h: 352 };

const CAP = 246;
const BASE = 553;

function vLetter() {
  /* Left ribbon: top 178..283, slanting down right (dx/dy 0.58), its round
     end tucked behind the right ribbon. */
  const L = { tl: [185, CAP], tr: [290, CAP], slope: 0.58 };
  /* Right ribbon: top 489..637, slanting down left, ending in the V's round foot. */
  const R = { tl: [482, CAP], tr: [630, CAP], slope: -0.664 };

  const stroke = ({ tl, tr, slope }, depth, roundCorner) => {
    const len = Math.hypot(slope, 1);
    const u = [slope / len, 1 / len];
    const nrm = [1 / len, -slope / len]; // perpendicular, pointing right-ish
    const w = (tr[0] - tl[0]) / len; // perpendicular width
    const ct = [(tl[0] + tr[0]) / 2, CAP];
    const c = [ct[0] + u[0] * depth, ct[1] + u[1] * depth];
    const half = w / 2;
    const pR = [c[0] + nrm[0] * half, c[1] + nrm[1] * half];
    const pL = [c[0] - nrm[0] * half, c[1] - nrm[1] * half];
    const k = 0.5523 * half;
    /* Semicircle from pR round the bottom to pL. */
    const bottom = [c[0] + u[0] * half, c[1] + u[1] * half];
    const arc =
      `C${pt([pR[0] + u[0] * k, pR[1] + u[1] * k])} ${pt([bottom[0] + nrm[0] * k, bottom[1] + nrm[1] * k])} ${pt(bottom)}` +
      `C${pt([bottom[0] - nrm[0] * k, bottom[1] - nrm[1] * k])} ${pt([pL[0] + u[0] * k, pL[1] + u[1] * k])} ${pt(pL)}`;
    const rc = 46;
    let top;
    if (roundCorner === "right") {
      /* Round the top-right corner: along the top, then down the right edge. */
      const a = [tr[0] - rc, CAP];
      const b = [tr[0] + u[0] * rc, CAP + u[1] * rc];
      top = `M${pt(tl)}L${pt(a)}C${pt([tr[0] - rc * 0.3, CAP])} ${pt([tr[0] + u[0] * rc * 0.35, CAP + u[1] * rc * 0.35])} ${pt(b)}L${pt(pR)}`;
      return `${top}${arc}Z`;
    }
    /* Round the top-left corner. */
    const a = [tl[0] + u[0] * rc, CAP + u[1] * rc];
    const b = [tl[0] + rc, CAP];
    return `M${pt(a)}C${pt([tl[0] + u[0] * rc * 0.35, CAP + u[1] * rc * 0.35])} ${pt([tl[0] + rc * 0.3, CAP])} ${pt(b)}L${pt(tr)}L${pt(pR)}${arc}Z`;
  };
  return {
    back: stroke(L, 288, "right"),
    front: stroke(R, 290, "left"),
  };
}

function aLetter() {
  const apex = [756, CAP + 1];
  const innerApex = [753, 381];
  const outerL = -0.776;
  const outerR = 0.73;
  const bl = [apex[0] + outerL * (BASE - apex[1]), BASE];
  const br = [apex[0] + outerR * (BASE - apex[1]), BASE];
  const il = [innerApex[0] + outerL * (BASE - innerApex[1]), BASE];
  const ir = [innerApex[0] + outerR * (BASE - innerApex[1]), BASE];
  const outline = roundedPolygon([apex, br, ir, innerApex, il, bl], [8, 0, 34, 6, 0, 0]);
  /* The orange triangle in the counter, its sides parallel to the A's. */
  const tApex = [751, 421];
  const tBase = 519;
  const tri = roundedPolygon(
    [tApex, [tApex[0] + outerR * (tBase - tApex[1]), tBase], [tApex[0] + outerL * (tBase - tApex[1]), tBase]],
    [4, 2, 2],
  );
  return { outline, tri };
}

function lLetter(x, stemW, footRight) {
  const footTop = 477;
  return roundedPolygon(
    [
      [x, CAP],
      [x + stemW, CAP],
      [x + stemW, footTop],
      [footRight, footTop],
      [footRight, BASE],
      [x, BASE],
    ],
    [22, 0, 44, 0, 0, 62],
  );
}

const O_OUT = { cx: 1640, cy: 407, rx: 182, ry: 170, rot: 0 };
const O_IN = { cx: 1641, cy: 408, rx: 94, ry: 86, rot: 0 };

function oLetter() {
  const ring = `${ellipseD(O_OUT)}${ellipseD({ ...O_IN })}`;
  /* The orange sweep: along the outer edge from the top round to the right,
     a curve in to the inner edge low right, the inner edge back up, and a
     curve out to the start. */
  const s1 = onEllipse(O_OUT, -84);
  const outerArc = arcPoints(O_OUT, -84, -16, 30);
  const e1 = onEllipse(O_OUT, -16);
  const i1 = onEllipse(O_IN, 58);
  const innerArc = arcPoints(O_IN, 58, -44, 30);
  const i2 = onEllipse(O_IN, -44);
  const sweep =
    `M${pt(s1)}L${outerArc.map(pt).join("L")}` +
    `C${pt([e1[0] - 8, e1[1] + 60])} ${pt([i1[0] + 52, i1[1] - 6])} ${pt(i1)}` +
    `L${innerArc.map(pt).join("L")}` +
    `C${pt([i2[0] + 4, i2[1] - 40])} ${pt([s1[0] + 40, s1[1] + 14])} ${pt(s1)}Z`;
  return { ring, sweep };
}

export function wordmarkSvg({ title = "Vallo" } = {}) {
  const c = COLOURS;
  const vb = WORDMARK_VIEWBOX;
  const id = (s) => `vw-${s}`;
  const v = vLetter();
  const a = aLetter();
  const o = oLetter();
  const blue = `url(#${id("blue")})`;
  const sheen = `url(#${id("sheen")})`;
  const letters = [v.back, v.front, a.outline, lLetter(965, 87, 1202), lLetter(1226, 89, 1439)];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<defs>`,
    `<linearGradient id="${id("blue")}" x1="0" y1="240" x2="0" y2="578" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.blueTop}"/><stop offset="0.42" stop-color="${c.blueMid}"/><stop offset="1" stop-color="${c.blueLow}"/></linearGradient>`,
    `<linearGradient id="${id("orange")}" x1="0" y1="236" x2="0" y2="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.orangeTop}"/><stop offset="0.4" stop-color="${c.orange}"/><stop offset="1" stop-color="${c.orangeLow}"/></linearGradient>`,
    `<linearGradient id="${id("sheen")}" x1="0" y1="240" x2="0" y2="578" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="${c.sheen * 0.8}"/><stop offset="0.3" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="${id("fold")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000000" stop-opacity="0.22"/><stop offset="0.3" stop-color="#000000" stop-opacity="0"/></linearGradient>`,
    `</defs>`,
    /* V: the back ribbon, then the front one over it with a soft fold shadow. */
    `<path d="${v.back}" fill="${blue}"/>`,
    `<path d="${v.front}" fill="${blue}"/>`,
    `<path d="${v.front}" fill="url(#${id("fold")})"/>`,
    `<path d="${a.outline}" fill="${blue}"/>`,
    `<path d="${a.tri}" fill="url(#${id("orange")})"/>`,
    `<path d="${letters[3]}" fill="${blue}"/>`,
    `<path d="${letters[4]}" fill="${blue}"/>`,
    `<path d="${o.ring}" fill="${blue}" fill-rule="evenodd"/>`,
    `<path d="${o.sweep}" fill="url(#${id("orange")})"/>`,
    `<g fill="${sheen}"><path d="${v.back}"/><path d="${v.front}"/><path d="${a.outline}"/><path d="${letters[3]}"/><path d="${letters[4]}"/><path d="${o.ring}" fill-rule="evenodd"/></g>`,
    `</svg>`,
  ].join("");
}

export { CAP, BASE };
