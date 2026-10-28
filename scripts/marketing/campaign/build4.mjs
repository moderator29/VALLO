/**
 * THE SOCIAL POSTS, 28 OCTOBER 2026.
 *
 *   node scripts/marketing/campaign/build4.mjs [--only 1,2,3]
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
import { POSTS, POSE, LINK } from "./posts4.mjs";

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

/** A real component of a screen, lifted and held in one heavy rule. */
function lift({ id, box, cx, cy, w, rot = 0, edge = INK, z = 30 }) {
  const [x0, y0, x1, y1] = box;
  const k = w / (x1 - x0);
  const h = (y1 - y0) * k;
  const rule = Math.max(8, w * 0.018);
  return `<div class="lift" style="left:${px(cx - w / 2)};top:${px(cy - h / 2)};width:${px(w)};height:${px(h)};border:${px(rule)} solid ${edge};border-radius:${px(w * 0.05 + rule)};transform:rotate(${rot}deg);z-index:${z}">
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
  if (kind === "paper") return `<div class="bg paper"></div>${WINDOW()}`;
  if (kind === "electric") return `<div class="bg electric"></div>${TILES("rgba(255,255,255,.075)")}`;
  if (kind === "tiles") return `<div class="bg electric"></div>${TILES("rgba(255,255,255,.12)")}`;
  if (kind === "sunset") return `<div class="bg sunset"></div>${WINDOW("opacity:.8")}`;
  if (kind === "sky") return `<div class="bg sky"></div>${TILES("rgba(255,255,255,.7)")}${SWIRL()}`;
  if (kind === "photo") return `<img class="full" src="${photo(p.photo)}"><div class="scrim"></div>`;
  if (kind === "split") return `<div class="bg paper" style="clip-path:polygon(0 0,50% 0,50% 100%,0 100%)"></div>${WINDOW("clip-path:polygon(0 0,50% 0,50% 100%,0 100%)")}<div class="bg night" style="clip-path:polygon(50% 0,100% 0,100% 100%,50% 100%)"></div>`;
  return `<div class="bg paper"></div>`;
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
const badges = (y = 1226, align = "center", left = 0) => `<div class="badges" style="top:${px(y)};${align === "center" ? "left:0;right:0;justify-content:center" : `left:${px(left)};justify-content:flex-start`}">
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

  if (L === "hero") {
    const right = p.hl !== "left";
    headHtml = `<div class="hwrap" style="${right ? `right:80px;text-align:right;left:auto` : `left:80px`};top:176px;max-width:${right ? 820 : 760}px">${head(p.lines, { size: 108, align: right ? "right" : "left", t })}</div>`;
    const ph = await phoneImg(SCREEN(p.phone.screen), p.phone.pose, p.phone.h);
    parts.push(placePhone(ph, p.phone.cx, p.phone.cy));
    for (const l of p.lifts ?? []) parts.push(lift(l));
    for (const [n, s, cx, cy, r] of p.objs ?? []) parts.push(o3(n, s, cx, cy, r));
    for (const sl of p.slabs ?? []) parts.push(slab(sl));
    parts.push(badges(1226));
  }

  if (L === "bignum") {
    parts.push(`<div class="num" style="color:#fff">${esc(p.num)}</div>`);
    headHtml = `<div class="hwrap" style="left:80px;top:720px;max-width:470px">${head(p.lines, { size: 76, t, lh: 1.08 })}</div>`;
    const ph = await phoneImg(SCREEN(p.phone.screen), p.phone.pose, p.phone.h);
    parts.push(placePhone(ph, p.phone.cx, p.phone.cy));
    parts.push(badges(1226, "left", 80));
  }

  if (L === "welcome") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 124, t, lh: 1.02 })}</div>`;
    parts.push(`<div class="sun"></div><div class="arch"><img src="${scene("villa")}"></div>`);
    parts.push(`<div class="sub" style="position:absolute;left:80px;top:520px;width:470px;z-index:45">${esc(p.sub)}</div>`);
    parts.push(o3("keys", 250, 760, 1030, 14));
    parts.push(o3("home-small", 200, 190, 900, -10));
    parts.push(badges(1226, "left", 80));
  }

  if (L === "grid4") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 100, t })}</div>`;
    const cw = 438, ch = 330, gx = 24, x0 = 80, y0 = 470;
    p.cells.forEach(([name, title, sub], i) => {
      const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gx);
      parts.push(`<div class="card" style="left:${px(x)};top:${px(y)};width:${px(cw)};height:${px(ch)}">
        <img src="${obj(name)}" style="width:190px"><div class="ct">${esc(title)}</div><div class="cs">${esc(sub)}</div></div>`);
    });
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

  if (L === "stamp") {
    parts.push(stamp({ cx: 540, cy: 520, w: 860, h: 620, rot: -3, fill: ELEC, edge: "#9FD9FF", ink: "#fff", q: p.q, a: p.a }));
    parts.push(o3("keys", 210, 830, 930, 12));
    parts.push(badges(1226));
  }

  if (L === "stampphone") {
    parts.push(stamp({ cx: 540, cy: 330, w: 900, h: 400, rot: -2, fill: "#FBFAF7", edge: "#9FD9FF", ink: INK, q: p.q, a: p.a }));
    const ph = await phoneImg(SCREEN(p.phone.screen), p.phone.pose, p.phone.h);
    parts.push(placePhone(ph, p.phone.cx, p.phone.cy));
    parts.push(badges(1226));
  }

  if (L === "homescreen") {
    const screenFile = await homeScreen();
    const ph = await phoneImg(screenFile, "corner", 1500);
    parts.push(placePhone(ph, 840, 1090));
    headHtml = `<div class="kick">${esc(p.kicker)}</div><div class="hwrap caps" style="left:80px;top:230px;max-width:540px">${head(p.lines, { size: 104, t, lh: 1.0 })}</div>`;
    parts.push(badges(1226, "left", 80));
  }

  if (L === "langs") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 108, t })}</div>`;
    p.rows.forEach(([code, name, word], i) => {
      parts.push(`<div class="lrow" style="top:${px(470 + i * 168)}"><span class="lc">${code}</span><span class="lw">${esc(word)}</span><span class="ln2">${esc(name)}</span></div>`);
    });
    parts.push(o3("local-talks", 230, 900, 650, 8, 36));
    parts.push(badges(1226));
  }

  if (L === "owner") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 108, t })}</div>`;
    parts.push(lift({ ...p.lift, edge: INK }));
    parts.push(o3("keys", 380, 380, 1030, -14));
    parts.push(o3("home-small", 230, 800, 1040, 12));
    parts.push(badges(1226, "right", 0).replace("left:0;right:0", "right:80px"));
  }

  if (L === "trust") {
    headHtml = `<div class="hwrap" style="left:80px;top:176px;max-width:920px">${head(p.lines, { size: 124, t, lh: 1.02 })}</div>`;
    parts.push(`<div class="sub dark" style="left:80px;top:520px;width:600px">${esc(p.sub)}</div>`);
    parts.push(o3("bank", 330, 790, 900, 8));
    parts.push(slab({ x: 340, y: 930, rot: -3, size: 34, tab: "Straight to", rows: [["title", "The owner"], ["line", "The host or the business"]] }));
    parts.push(badges(1226));
  }

  if (L === "daynight") {
    const day = await phoneImg(SCREEN("sc-home-lt"), "a", 760);
    const night = await phoneImg(SCREEN("sc-home"), "c", 760);
    parts.push(placePhone(day, 290, 810), placePhone(night, 790, 810));
    headHtml = `<div class="dn l">Day<br><b>mode.</b></div><div class="dn r">Night<br><b>mode.</b></div>`;
    parts.push(badges(1226));
  }

  if (L === "poll") {
    headHtml = `<div class="hwrap" style="left:0;right:0;top:150px;text-align:center">${head(p.lines, { size: 100, align: "center", t })}</div>`;
    const cw = 438, ch = 290, gx = 24, x0 = 80, y0 = 450;
    p.opts.forEach(([letter, label, name], i) => {
      const x = x0 + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * (ch + gx);
      parts.push(`<div class="opt" style="left:${px(x)};top:${px(y)};width:${px(cw)};height:${px(ch)}">
        <span class="ol">${letter}</span><span class="on">${esc(label)}</span></div>`);
      parts.push(o3(name, 150, x + cw - 100, y + ch / 2 + 6, 8, 36));
    });
    parts.push(`<div class="vote">Vote in the comments 👇</div>`);
    parts.push(badges(1226));
  }

  return { t, parts, headHtml, logoOn: !["daynight", "persona"].includes(L) };
}

/* ---------------------------------------------------- the home-screen shot */

let HOME_FILE = null;
async function homeScreen() {
  if (HOME_FILE) return HOME_FILE;
  const file = join(tmpdir(), "vallo-homescreen-display.png");
  const icons = [
    ["Calendar", "calendar-days", "#FF6B5A,#FF4C3D"], ["Camera", "camera", "#8E96A8,#5B6377"], ["Notes", "notebook-pen", "#FFD84D,#F5B800"], ["Maps", "map-pin", "#5BD08A,#1FA55E"],
    ["Weather", "cloud-sun", "#59B6FF,#2A7BF0"], ["Mail", "mail", "#4FA3FF,#1B6BE6"], ["Music", "music", "#FF5E7E,#E0245E"],
  ];
  const tile = ([name, ic, g]) => { const [a, b] = g.split(","); return `<div class="ap"><div class="ai" style="background:linear-gradient(160deg,${a},${b})">${lucide(ic).replace("<svg", '<svg width="110" height="110" stroke="#fff" stroke-width="2"')}</div><span>${name}</span></div>`; };
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER}) format("woff2")}
    *{box-sizing:border-box;margin:0;padding:0}html,body{width:1320px;height:2868px;overflow:hidden;font-family:Inter,sans-serif}
    body{background:radial-gradient(90% 40% at 70% 0%,#5AA9FF 0%,transparent 70%),radial-gradient(80% 40% at 10% 100%,#0A3FA8 0%,transparent 70%),linear-gradient(170deg,#1B6FF0,#0B2E8E 70%,#071C5C)}
    .sb{position:absolute;top:70px;left:110px;right:110px;display:flex;justify-content:space-between;color:#fff;font:700 54px/1 Inter}
    .grid{position:absolute;left:96px;right:96px;top:300px;display:grid;grid-template-columns:repeat(4,1fr);row-gap:92px;justify-items:center}
    .ap{display:flex;flex-direction:column;align-items:center;gap:22px;color:#fff;font:500 38px/1 Inter}
    .ai{width:224px;height:224px;border-radius:52px;display:grid;place-items:center;box-shadow:0 20px 40px rgba(0,10,60,.35)}
    .v .ai{background:none;overflow:hidden;position:relative;padding:0}.v img{width:100%;height:100%}
    .bd{position:absolute;right:-24px;top:-24px;width:90px;height:90px;border-radius:50%;background:#FF3B30;color:#fff;font:700 54px/90px Inter;text-align:center;border:6px solid #1B6FF0}
    .dock{position:absolute;left:70px;right:70px;bottom:90px;height:300px;border-radius:84px;background:rgba(255,255,255,.22);display:flex;justify-content:space-around;align-items:center}
    .dock .ai{width:200px;height:200px}
  </style></head><body>
    <div class="sb"><span>9:41</span><span></span></div>
    <div class="grid">
      <div class="ap v"><div class="ai" style="position:relative"><img src="${BRAND("vallo-icon.png")}" style="border-radius:52px"><div class="bd">1</div></div><span>Vallo</span></div>
      ${icons.slice(0, 3).map(tile).join("")}${icons.slice(3, 7).map(tile).join("")}
    </div>
    <div class="dock">${icons.slice(0, 4).map(([n, ic, g]) => { const [a, b] = g.split(","); return `<div class="ai" style="background:linear-gradient(160deg,${a},${b})">${lucide(ic).replace("<svg", '<svg width="100" height="100" stroke="#fff" stroke-width="2"')}</div>`; }).join("")}</div>
  </body></html>`;
  const f = join(tmpdir(), "vallo-homescreen.html");
  writeFileSync(f, html);
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const pg = await b.newPage({ viewport: { width: 1320, height: 2868 } });
  await pg.goto(url(f), { waitUntil: "load" });
  await pg.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map((i) => i.decode().catch(() => {}))]));
  await pg.screenshot({ path: file, type: "png" });
  await b.close();
  HOME_FILE = file;
  return file;
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
    .paper{background:linear-gradient(180deg,#DDE9FC 0%,#EAF2FF 55%,#F4F8FF 100%)}
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
    .lift{position:absolute;overflow:hidden;background:#fff;box-shadow:0 38px 56px -22px rgba(8,30,100,.5)}
    .lift img{position:absolute;max-width:none;display:block}
    .badges{position:absolute;display:flex;gap:22px;z-index:60}.badges img{height:70px;width:auto;filter:drop-shadow(0 8px 14px rgba(8,30,100,.28))}
    .num{position:absolute;left:62px;top:96px;font:700 640px/1 Poppins;letter-spacing:-.06em;z-index:20}
    .kick{position:absolute;left:80px;top:150px;font:700 28px/1 Inter;letter-spacing:.16em;color:rgba(255,255,255,.85);z-index:45}
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
