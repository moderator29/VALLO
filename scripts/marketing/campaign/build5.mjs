/**
 * THE SOCIAL POSTS, 28 OCTOBER 2026, SECOND PASS (posts5.mjs).
 *
 *   node scripts/marketing/campaign/build5.mjs [--only 1,2,3]
 *
 * Twenty posts, ONE size: 1080 x 1350 (4:5), drawn at 2x. It is the one shape
 * every feed takes without cropping the picture that matters: Instagram,
 * Facebook, X, LinkedIn and Threads all show a 4:5 image whole. The
 * founder's direction: light grounds that are NOT the app's navy, a headline
 * in two weights, the handset floating, the store badges on every post, and
 * the app's own parts lifted off the glass where a post is about a screen.
 *
 * Out: docs/marketing/social-2026-10/NN-slug.png and COPY.md (captions).
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Phones } from "../store/phones.mjs";
import { POSTS, POSE, LINK } from "./posts5.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const NM = join(HERE, "..", "node_modules");
const OUT = join(REPO, "docs", "marketing", "social-2026-10");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(Number) : null;

const W = 1080, H = 1350, DSF = 2;
const INK = "#0B1230", ELEC = "#0069FE", ELEC6 = "#0056D0", SKY = "#8FD3FF", PEACH = "#FFC59B";

const b64 = (f, m) => `data:${m};base64,${readFileSync(f).toString("base64")}`;
const FP = (w, ext = "") => join(NM, "@fontsource/poppins/files", `poppins-latin${ext}-${w}-normal.woff2`);
const FONTS = [400, 500, 600, 700].map((w) => `
  @font-face{font-family:Poppins;font-weight:${w};src:url(${b64(FP(w), "font/woff2")}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
  @font-face{font-family:Poppins;font-weight:${w};src:url(${b64(FP(w, "-ext"), "font/woff2")}) format("woff2");unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF}`).join("");
const INTER = b64(join(REPO, "apps/web/public/fonts/v2/inter-latin.woff2"), "font/woff2");
const INTER_EXT = b64(join(REPO, "apps/web/public/fonts/v2/inter-latin-ext.woff2"), "font/woff2");
const INTER_VN = b64(join(REPO, "apps/web/public/fonts/v2/inter-vietnamese.woff2"), "font/woff2");
const url = (p) => pathToFileURL(p).href;
const BRAND = (n) => url(join(REPO, "apps/web/public/brand", n));
const obj = (n) => url(join(REPO, "apps/web/public/brand/3d", `${n}@2x.webp`));
const scene = (n) => url(join(REPO, "apps/web/public/brand/scenes", `${n}.jpg`));
const photo = (n) => url(join(REPO, "apps/web/public/brand/photos", `${n}.jpg`));
const badgeSvg = (n) => url(join(REPO, "scripts/marketing/video/assets/badges", n));
const lucide = (n) => readFileSync(join(NM, "lucide-static/icons", `${n}.svg`), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const px = (v) => `${Math.round(v * 100) / 100}px`;
const SCREEN = (id) => join(REPO, "docs", "marketing", "screens", `${id}-ios.png`);

/* ----------------------------------------------------------------- phones */

const phones = new Phones({ res: 1 });
const cache = new Map();
async function phoneImg(screenFile, pose, height) {
  const key = `${screenFile}:${pose}:${height}`;
  if (!cache.has(key)) {
    const o = POSE[pose];
    const p = await phones.render({ screen: screenFile, model: "island", rotation: o.rotation, fov: o.fov, height });
    cache.set(key, { ...p, src: url(p.file) });
  }
  return cache.get(key);
}
function placePhone(p, cx, cy, z = 10) {
  const w = p.width * p.scale, h = p.height * p.scale;
  const bx = (p.bbox.x + p.bbox.width / 2) * p.scale, by = (p.bbox.y + p.bbox.height / 2) * p.scale;
  return `<img class="phone" src="${p.src}" style="left:${px(cx - bx)};top:${px(cy - by)};width:${px(w)};height:${px(h)};z-index:${z}">`;
}

/** A real component of a screen, lifted and held in one heavy rule. The rule is
    sky with a dark ring outside it, so it reads on a light ground and over a dark screen. */
function lift({ id, box, cx, cy, w, rot = 0, z = 30 }) {
  const [x0, y0, x1, y1] = box;
  const k = w / (x1 - x0);
  const h = (y1 - y0) * k;
  const rule = Math.max(9, w * 0.019);
  return `<div class="lift" style="left:${px(cx - w / 2)};top:${px(cy - h / 2)};width:${px(w)};height:${px(h)};border:${px(rule)} solid ${SKY};border-radius:${px(w * 0.05 + rule)};box-shadow:0 0 0 ${px(5)} #04071C,0 44px 64px -22px rgba(8,30,100,.6);transform:rotate(${rot}deg);z-index:${z}">
    <img src="${url(SCREEN(id))}" style="left:${px(-x0 * k)};top:${px(-y0 * k)};width:${px(1320 * k)}"></div>`;
}

/** One of the brand's 3D objects, with a soft contact shadow. */
const o3 = (name, size, cx, cy, rot = 0, z = 35) =>
  `<img class="o3" src="${obj(name)}" style="left:${px(cx - size / 2)};top:${px(cy - size / 2)};width:${px(size)};transform:rotate(${rot}deg);z-index:${z}">`;

/* ----------------------------------------------------------------- grounds */

const WINDOW = (extra = "") => `<svg class="win" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="${extra}">
  <defs><linearGradient id="wl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>
  <g transform="translate(-60 610) skewX(-16) rotate(-5)" fill="url(#wl)">
    <rect x="0" y="0" width="330" height="420"/><rect x="360" y="0" width="330" height="420"/>
    <rect x="0" y="450" width="330" height="420"/><rect x="360" y="450" width="330" height="420"/></g>
  <g transform="translate(640 -120) skewX(-16) rotate(-5)" fill="url(#wl)" opacity=".7">
    <rect x="0" y="0" width="260" height="330"/><rect x="290" y="0" width="260" height="330"/></g></svg>`;

const TILES = (c) => `<div class="tiles" style="--tl:${c}"></div>`;
const SWIRL = (c = "rgba(0,105,254,.22)") => `<svg class="swirl" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round">
  <path d="M-40 330 C 220 150, 720 60, 900 220 C 1060 360, 880 560, 560 610 C 300 650, 90 760, 180 900 C 270 1040, 760 960, 1000 1100 C 1160 1190, 1100 1330, 800 1400"/></svg>`;

function ground(kind, p) {
  if (kind === "ivory") return `<div class="bg ivory"></div>${WINDOW("opacity:.9")}`;
  if (kind === "ice") return `<div class="bg ice"></div>${WINDOW("opacity:.85")}`;
  if (kind === "electric") return `<div class="bg electric"></div>${TILES("rgba(255,255,255,.075)")}`;
  if (kind === "sunset") return `<div class="bg sunset"></div>${WINDOW("opacity:.8")}`;
  if (kind === "sky") return `<div class="bg sky"></div>${TILES("rgba(255,255,255,.7)")}${SWIRL()}`;
  if (kind === "photo") return `<img class="full" src="${photo(p.photo)}"><div class="scrim"></div>`;
  return `<div class="bg ice"></div>`;
}

/* --------------------------------------------------------------- the parts */

const THEME = {
  light: { reg: INK, bold: ELEC6, logo: "vallo-wordmark-light.png", url: "rgba(11,18,48,.55)" },
  electric: { reg: "#fff", bold: PEACH, logo: "vallo-wordmark-light.png", white: true, url: "rgba(255,255,255,.78)" },
  sunset: { reg: INK, bold: "#0A2FA8", logo: "vallo-wordmark-light.png", url: "rgba(11,18,48,.6)" },
};

/** `*bold*` is the second weight. Each line is measured and fitted by the page. */
const head = (lines, { size = 108, align = "left", t, lh = 1.04 }) =>
  `<div class="hb" data-size="${size}" style="text-align:${align};--reg:${t.reg};--bold:${t.bold};font-size:${px(size)};line-height:${lh}">${lines.map((l) =>
    `<div class="ln">${esc(l).replace(/\*(.+?)\*/g, '<b>$1</b>')}</div>`).join("")}</div>`;

const logo = (t) => `<img class="logo" src="${BRAND(t.logo)}" style="${t.white ? "filter:brightness(0) invert(1)" : ""}"><div class="url" style="color:${t.url}">${LINK}</div>`;
const badges = (y = 1226, align = "center", left = 0, h = 70) => `<div class="badges" style="--bh:${h}px;top:${px(y)};${align === "center" ? "left:0;right:0;justify-content:center" : `left:${px(left)};justify-content:flex-start`}">
  <img src="${badgeSvg("google-play-black.svg")}"><img src="${badgeSvg("app-store-black.svg")}"></div>`;

/** An ink container: solid, one heavy rule, its label as the first row. */
function slab({ x, y, rot = 0, size = 34, tab, rows = [], edge = SKY, z = 40 }) {
  const body = rows.map(([k, a, b]) => k === "title" ? `<div class="st">${esc(a)}</div>` : k === "line" ? `<div class="sl">${esc(a)}</div>`
    : `<div class="sf"><span>${esc(a)}</span><em>${esc(b ?? "")}</em></div>`).join("");
  return `<div class="slab" style="left:${px(x)};top:${px(y)};font-size:${px(size)};border:${px(size * 0.23)} solid ${edge};transform:translate(-50%,-50%) rotate(${rot}deg);z-index:${z}">
    ${tab ? `<div class="tab"><i></i>${esc(tab)}</div>` : ""}${body}</div>`;
}

/** A card with postage-stamp edges: half-circle notches all the way round. */
function stampPath(w, h, r) {
  const nx = Math.max(3, Math.round(w / (r * 3.4))), ny = Math.max(3, Math.round(h / (r * 3.4)));
  const sx = w / nx, sy = h / ny;
  let d = "M0 0";
  for (let i = 0; i < nx; i++) { const c = sx * (i + 0.5); d += ` L${c - r} 0 A${r} ${r} 0 0 0 ${c + r} 0`; }
  d += ` L${w} 0`;
  for (let i = 0; i < ny; i++) { const c = sy * (i + 0.5); d += ` L${w} ${c - r} A${r} ${r} 0 0 0 ${w} ${c + r}`; }
  d += ` L${w} ${h}`;
  for (let i = nx - 1; i >= 0; i--) { const c = sx * (i + 0.5); d += ` L${c + r} ${h} A${r} ${r} 0 0 0 ${c - r} ${h}`; }
  d += ` L0 ${h}`;
  for (let i = ny - 1; i >= 0; i--) { const c = sy * (i + 0.5); d += ` L0 ${c + r} A${r} ${r} 0 0 0 0 ${c - r}`; }
  return d + " Z";
}
function stamp({ cx, cy, w, h, rot = 0, fill, edge, ink, q, a, z = 40 }) {
  const r = 17;
  return `<div class="stamp" style="left:${px(cx - w / 2)};top:${px(cy - h / 2)};width:${px(w)};height:${px(h)};transform:rotate(${rot}deg);z-index:${z}">
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${stampPath(w, h, r)}" fill="${fill}" stroke="${edge}" stroke-width="7" stroke-linejoin="round"/></svg>
    <div class="si" style="color:${ink}"><div class="q">${esc(q)}</div><div class="a">${esc(a)}</div></div></div>`;
}

/* ------------------------------------------------------------ the layouts */

async function layout(p) {
  const t = THEME[p.theme ?? "light"];
  const parts = [];
  let headHtml = "";
  const L = p.layout;

  /* THE HANDSET, NEARLY STRAIGHT ON. `phone` is two columns: the words and the
     lifted part on the left, one big handset rising off the bottom edge on the
     right. `phoneC` is one column: the headline, the handset centred under it,
     the lifted part across its corner. */
  if (L === "phone" || L === "phoneC") {
    const C = L === "phoneC";
    const ph = await phoneImg(SCREEN(p.phone.screen), p.phone.pose ?? "s", p.phone.h ?? (C ? 760 : 1060));
    parts.push(placePhone(ph, p.phone.cx ?? (C ? 540 : 770), p.phone.cy ?? (C ? 810 : 830)));
    if (C) {
      headHtml = `<div class="hwrap" style="left:80px;top:168px;max-width:920px">${head(p.lines, { size: 104, t })}</div>`;
      parts.push(badges(1226));
    } else {
      const top = p.kicker ? 238 : 196;
      headHtml = `${p.kicker ? `<div class="kick" style="top:176px;color:${t.reg}">${esc(p.kicker)}</div>` : ""}<div class="hwrap" style="left:80px;top:${top}px;max-width:392px">${head(p.lines, { size: 104, t, lh: 1.04 })}${p.sub ? `<div class="sub" style="color:${t.reg}">${esc(p.sub)}</div>` : ""}</div>`;
      parts.push(badges(1236, "left", 80, 60));
    }
    for (const l of p.lifts ?? []) parts.push(lift(l));
    for (const sl of p.slabs ?? []) parts.push(slab(sl));
    for (const [n, s, cx, cy, r] of p.objs ?? []) parts.push(o3(n, s, cx, cy, r));
  }

  if (L === "bignum") {
    parts.push(`<div class="num">${esc(p.num)}</div>`);
    headHtml = `<div class="hwrap" style="left:80px;top:720px;max-width:430px">${head(p.lines, { size: 76, t, lh: 1.08 })}</div>`;
    const ph = await phoneImg(SCREEN(p.phone.screen), "s", p.phone.h);
    parts.push(placePhone(ph, p.phone.cx, p.phone.cy));
    parts.push(badges(1236, "left", 80, 60));
  }

  if (L === "stamp") {
    parts.push(stamp({ cx: 540, cy: 540, w: 880, h: 640, rot: -3, fill: ELEC, edge: "#9FD9FF", ink: "#fff", q: p.q, a: p.a }));
    parts.push(o3("keys", 210, 830, 960, 12));
    parts.push(badges(1226));
  }

  if (L === "steps") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 108, t })}</div>`;
    const cw = 290, gap = 25, x0 = 80, y0 = 480;
    p.steps.forEach(([name, label], i) => {
      parts.push(`<div class="card" style="left:${px(x0 + i * (cw + gap))};top:${px(y0)};width:${px(cw)};height:${px(360)};gap:14px">
        <div class="sn">0${i + 1}</div><img src="${obj(name)}" style="width:150px"><div class="ct" style="font-size:33px;text-align:center;padding:0 16px">${esc(label)}</div></div>`);
    });
    parts.push(slab({ x: 540, y: 990, rot: -2, size: 40, tab: "Good to know", rows: [["title", p.pill]] }));
    parts.push(badges(1226));
  }

  if (L === "trust") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 124, t, lh: 1.02 })}</div>`;
    parts.push(`<div class="sub dark" style="left:80px;top:520px;width:600px">${esc(p.sub)}</div>`);
    parts.push(o3("bank", 330, 790, 900, 8));
    parts.push(slab({ x: 340, y: 930, rot: -3, size: 34, tab: "Straight to", rows: [["title", "The owner"], ["line", "The host or the business"]] }));
    parts.push(badges(1226));
  }

  if (L === "quiz") {
    headHtml = `<div class="hwrap" style="left:0;right:0;top:150px;text-align:center">${head(p.lines, { size: 100, align: "center", t })}</div>`;
    const tw = 430, th = 340, gx = 28, x0 = (W - 2 * tw - gx) / 2, y0 = 420;
    p.tiles.forEach(([letter, label, sc, chip], i) => {
      const x = x0 + (i % 2) * (tw + gx), y = y0 + Math.floor(i / 2) * (th + 26);
      parts.push(`<div class="tile" style="left:${px(x)};top:${px(y)};width:${px(tw)};height:${px(th)}">
        <img class="tp" src="${scene(sc)}"><div class="tl">${letter}</div>
        <div class="tn">${esc(label)}</div></div>`);
      parts.push(o3(chip, 120, x + tw - 66, y + 74, 8, 36));
    });
    parts.push(badges(1226));
  }

  if (L === "persona") {
    headHtml = `<div class="ptitle"><span>${esc(p.title)}</span></div>`;
    parts.push(`<div class="pcard"><img src="${scene(p.photo)}"></div>`);
    parts.push(o3(p.chip, 190, 868, 468, 8, 36));
    parts.push(`<div class="quote">${esc(p.quote)}</div>`);
    parts.push(badges(1226));
  }

  if (L === "langs") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 108, t })}</div>`;
    p.rows.forEach(([code, name, word], i) => {
      parts.push(`<div class="lrow" style="top:${px(470 + i * 168)}"><span class="lc">${code}</span><span class="lw">${esc(word)}</span><span class="ln2">${esc(name)}</span></div>`);
    });
    parts.push(o3("local-talks", 230, 900, 650, 8, 36));
    parts.push(badges(1226));
  }

  /* THE APP ICON, as itself: the one honest way to say "look for this". */
  if (L === "icon") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 112, t })}</div>`;
    parts.push(`<div class="iglow"></div><div class="appicon"><img src="${BRAND("vallo-icon.png")}"></div>`);
    parts.push(`<div class="sub center" style="color:#fff">${esc(p.sub)}</div>`);
    parts.push(o3("keys", 230, 170, 800, -12));
    parts.push(o3("home-small", 200, 910, 840, 12));
    parts.push(badges(1180, "center", 0, 88));
  }

  return { t, parts, headHtml, logoOn: L !== "persona" };
}

/* ----------------------------------------------------------------- the page */

async function compose(p) {
  const { t, parts, headHtml, logoOn } = await layout(p);
  const onPhoto = p.ground === "photo";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${FONTS}
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+2000-206F,U+20AC}
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER_EXT}) format("woff2");unicode-range:U+0100-02AF,U+1E00-1EFF}
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER_VN}) format("woff2");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${W}px;height:${H}px;overflow:hidden;font-family:Inter,Poppins,sans-serif;background:#EAF1FF}
    .bg,.win,.tiles,.swirl,.full,.scrim{position:absolute;inset:0;width:100%;height:100%}
    .ivory{background:radial-gradient(70% 40% at 92% 0%,rgba(255,196,150,.5),transparent 62%),linear-gradient(180deg,#F9F5EE 0%,#F1E9DD 100%)}
    .ice{background:radial-gradient(70% 40% at 0% 0%,rgba(143,211,255,.55),transparent 62%),linear-gradient(180deg,#E3EEFD,#F3F8FF)}
    .electric{background:radial-gradient(70% 45% at 85% 0%,rgba(143,211,255,.55),transparent 62%),radial-gradient(60% 40% at 0% 100%,rgba(0,40,130,.65),transparent 70%),linear-gradient(160deg,#1B80FF,#0063F0 50%,#0049BE)}
    .sunset{background:radial-gradient(80% 45% at 88% 4%,#FFE6D3,transparent 62%),linear-gradient(170deg,#FFD6B6,#FFB885 55%,#FF9559)}
    .sky{background:linear-gradient(180deg,#D3E6FF,#E8F2FF 60%,#F2F8FF)}
    .night{background:radial-gradient(80% 50% at 80% 10%,rgba(0,105,254,.45),transparent 65%),linear-gradient(180deg,#050B3D,#010118)}
    .tiles{background-image:linear-gradient(var(--tl) 2px,transparent 2px),linear-gradient(90deg,var(--tl) 2px,transparent 2px);background-size:150px 150px;background-position:-20px -10px}
    .full{object-fit:cover}.scrim{background:linear-gradient(180deg,rgba(1,1,24,.45),rgba(1,1,24,.18) 40%,rgba(1,1,24,.78))}
    .win{filter:blur(1.5px)}
    .logo{position:absolute;left:80px;top:62px;width:236px;z-index:50}
    .url{position:absolute;right:80px;top:76px;font:600 26px/1 Inter;letter-spacing:.01em;z-index:50}
    .hwrap{position:absolute;z-index:45}
    .hb{font-family:Poppins,sans-serif;font-weight:400;letter-spacing:-.045em;color:var(--reg)}
    .hb .ln{white-space:nowrap;width:max-content;max-width:none;display:block}
    .hb[style*="text-align:right"] .ln{margin-left:auto}.hb[style*="text-align:center"] .ln{margin:0 auto}
    .hb b{font-weight:700;color:var(--bold);letter-spacing:-.05em}
    .caps .hb{text-transform:uppercase;letter-spacing:-.03em}
    .sub{font:500 34px/1.38 Inter;margin-top:30px;color:#fff;max-width:520px;letter-spacing:-.005em}
    .sub.dark{position:absolute;color:${INK};opacity:.86;margin:0;z-index:45}
    .phone{position:absolute;max-width:none;z-index:10;filter:drop-shadow(0 44px 44px rgba(8,30,100,.30)) drop-shadow(0 10px 14px rgba(8,30,100,.18))}
    .o3{position:absolute;filter:drop-shadow(0 26px 26px rgba(8,30,100,.32));z-index:35}
    .lift{position:absolute;overflow:hidden;background:#04071C}
    .lift img{position:absolute;max-width:none;display:block}
    .badges{position:absolute;display:flex;gap:22px;z-index:60}.badges img{height:var(--bh,70px);width:auto;filter:drop-shadow(0 8px 14px rgba(8,30,100,.28))}
    .num{position:absolute;left:62px;top:96px;font:700 640px/1 Poppins;letter-spacing:-.06em;z-index:20;color:#fff}
    .kick{position:absolute;left:80px;font:700 25px/1 Inter;letter-spacing:.15em;z-index:45;opacity:.82}
    .sn{position:absolute;left:22px;top:20px;font:700 24px/1 Inter;letter-spacing:.14em;color:rgba(11,18,48,.42)}
    .sub.center{position:absolute;left:0;right:0;top:1086px;max-width:none;text-align:center;margin:0;font-size:34px;z-index:45}
    .appicon{position:absolute;left:280px;top:470px;width:520px;height:520px;border-radius:116px;overflow:hidden;z-index:40;box-shadow:0 70px 90px -24px rgba(0,20,100,.7),0 0 0 14px rgba(255,255,255,.2)}
    .appicon img{width:100%;height:100%;display:block}
    .iglow{position:absolute;left:90px;top:300px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.28),transparent 66%);z-index:5}
    .sun{position:absolute;right:-150px;top:430px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFD2A8,#FF9A5B 70%);opacity:.95}
    .arch{position:absolute;left:590px;top:470px;width:400px;height:690px;border-radius:200px 200px 40px 40px;overflow:hidden;border:10px solid #fff;box-shadow:0 40px 70px -24px rgba(0,20,90,.65);transform:rotate(3deg)}
    .arch img{width:100%;height:100%;object-fit:cover}
    .card{position:absolute;background:#fff;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-shadow:0 30px 50px -26px rgba(8,30,100,.45);border:3px solid rgba(0,105,254,.14);z-index:30}
    .card img{filter:drop-shadow(0 18px 18px rgba(8,30,100,.28))}
    .ct{font:700 46px/1.1 Poppins;letter-spacing:-.03em;color:${INK}}.cs{font:500 26px/1.2 Inter;color:rgba(11,18,48,.62)}
    .tile{position:absolute;border-radius:40px;overflow:hidden;border:6px solid ${ELEC6};box-shadow:0 30px 44px -24px rgba(8,30,100,.5);z-index:30;background:#fff}
    .tp{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .tl{position:absolute;left:22px;top:22px;width:64px;height:64px;border-radius:20px;background:${INK};color:#fff;font:700 36px/64px Poppins;text-align:center}
    .tn{position:absolute;left:0;right:0;bottom:0;padding:44px 20px 20px;font:700 31px/1.1 Poppins;letter-spacing:-.025em;color:#fff;background:linear-gradient(180deg,transparent,rgba(1,1,24,.82))}
    .ptitle{position:absolute;left:0;right:0;top:230px;text-align:center;font:700 78px/1.04 Poppins;letter-spacing:-.045em;color:#0B3A9E;padding:0 60px;z-index:45}
    .pcard{position:absolute;left:80px;top:390px;width:920px;height:600px;border-radius:52px;overflow:hidden;border:8px solid ${ELEC6};box-shadow:0 36px 56px -26px rgba(8,30,100,.55);z-index:30}
    .pcard img{width:100%;height:100%;object-fit:cover}
    .quote{position:absolute;left:60px;right:60px;top:1040px;text-align:center;font:600 46px/1.18 Poppins;letter-spacing:-.03em;color:${INK};z-index:45}
    .stamp{position:absolute;filter:drop-shadow(0 34px 34px rgba(0,20,90,.4))}
    .stamp svg{position:absolute;inset:0}
    .si{position:absolute;inset:0;padding:66px 70px;display:flex;flex-direction:column;justify-content:center;gap:26px}
    .q{font:700 84px/1.04 Poppins;letter-spacing:-.045em}.a{font:500 40px/1.25 Poppins;letter-spacing:-.02em;opacity:.92}
    .lrow{position:absolute;left:80px;width:660px;height:136px;border-radius:40px;background:#fff;display:flex;align-items:center;gap:26px;padding:0 34px;box-shadow:0 26px 40px -24px rgba(8,30,100,.5);border:3px solid rgba(0,105,254,.14);z-index:30}
    .lc{width:72px;height:72px;border-radius:22px;background:${INK};color:#fff;font:700 30px/72px Poppins;text-align:center;flex:none}
    .lw{font:700 46px/1 Inter,Poppins;letter-spacing:-.03em;color:${ELEC6};flex:1;white-space:nowrap}
    .ln2{font:600 24px/1 Inter;color:rgba(11,18,48,.55);white-space:nowrap}
    .opt{position:absolute;border-radius:44px;background:#fff;border:3px solid rgba(0,105,254,.16);box-shadow:0 28px 44px -26px rgba(8,30,100,.5);z-index:30;display:flex;align-items:center;gap:22px;padding:0 34px}
    .ol{width:80px;height:80px;border-radius:24px;background:${INK};color:#fff;font:700 42px/80px Poppins;text-align:center;flex:none}
    .on{font:700 40px/1.08 Poppins;letter-spacing:-.035em;color:${INK};max-width:190px}
    .vote{position:absolute;left:0;right:0;top:1130px;text-align:center;font:600 34px/1 Inter;color:${ELEC6};z-index:45}
    .dn{position:absolute;top:150px;font:400 112px/1.0 Poppins;letter-spacing:-.05em;z-index:45}
    .dn b{font-weight:700}.dn.l{left:80px;color:${INK}}.dn.l b{color:${ELEC6}}.dn.r{right:80px;text-align:right;color:#fff}.dn.r b{color:${SKY}}
    .slab{position:absolute;background:#04071C;color:#fff;border-radius:1.16em;padding:.86em 1em;font-family:Inter,sans-serif;box-shadow:0 40px 60px -28px rgba(0,10,60,.7)}
    .tab{display:flex;align-items:center;gap:.3em;margin-bottom:.42em;font:700 .6em/1 Inter;letter-spacing:.14em;text-transform:uppercase;color:${SKY}}
    .tab i{width:.3em;height:.3em;border-radius:50%;background:${SKY};display:block}
    .st{font:700 1em/1.15 Inter;letter-spacing:-.012em;white-space:nowrap}.sl{font:500 .78em/1.3 Inter;color:rgba(214,228,255,.88);white-space:nowrap;margin-top:.24em}
  </style></head><body>
    ${ground(p.ground, p)}
    ${logoOn ? logo(t) : `<img class="logo" src="${BRAND(p.layout === "persona" ? "vallo-wordmark-light.png" : "vallo-wordmark-light.png")}">`}
    ${headHtml}
    ${parts.join("\n")}
    <script>
      document.fonts.ready.then(() => {
        /* every headline line is laid out at max-content width, so a line's
           box is the width of its words; each block is stepped down until the
           widest line fits its measure */
        for (const hb of document.querySelectorAll(".hb")) {
          const wrap = hb.parentElement;
          const left = parseFloat(wrap.style.left) || 0;
          const max = wrap.style.maxWidth ? parseFloat(wrap.style.maxWidth) : ${W} - 160;
          let size = parseFloat(hb.style.fontSize), guard = 400;
          const widest = () => Math.max(...[...hb.querySelectorAll(".ln")].map((l) => l.getBoundingClientRect().width));
          while (widest() > max && size > 20 && guard-- > 0) { size -= 1; hb.style.fontSize = size + "px"; }
        }
        const pt = document.querySelector(".ptitle");
        if (pt) { const sp = pt.querySelector("span"); sp.style.cssText = "display:inline-block;white-space:nowrap"; let s = 78, g = 200; while (sp.getBoundingClientRect().width > ${W} - 140 && s > 30 && g-- > 0) { s -= 1; pt.style.fontSize = s + "px"; } }
        window.__fit = true;
      });
    </script>
  </body></html>`;
}

/* ------------------------------------------------------------------ the run */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-color-profile=srgb"] });
const TMP = join(tmpdir(), `vallo-social-${process.pid}.html`);
mkdirSync(OUT, { recursive: true });
for (const p of POSTS) {
  if (only && !only.includes(p.n)) continue;
  const html = await compose(p);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  writeFileSync(TMP, html);
  await page.goto(url(TMP), { waitUntil: "load" });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map((i) => i.decode().catch(() => {}))]));
  await page.waitForFunction(() => window.__fit === true, null, { timeout: 15000 });
  await page.waitForTimeout(80);
  const file = join(OUT, `${String(p.n).padStart(2, "0")}-${p.slug}.png`);
  await sharp(await page.screenshot({ type: "png" })).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
  await page.close();
  console.log(`post ${String(p.n).padStart(2, "0")} ${p.slug}`);
}
await browser.close();
await phones.close();

const copy = ["# Vallo social posts, 28 October 2026", "",
  `One size for every network: 1080 x 1350 (4:5), delivered at 2160 x 2700. Link: ${LINK}`, ""];
for (const p of POSTS) copy.push(`## ${String(p.n).padStart(2, "0")}  ${p.slug}`, "", p.caption, "");
writeFileSync(join(OUT, "COPY.md"), copy.join("\n"));
console.log("captions written");
