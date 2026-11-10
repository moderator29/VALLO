/**
 * THE CAMPAIGN, REBUILT ON THE CONTAINERS (16 October 2026).
 *
 *   node scripts/marketing/campaign/build2.mjs [--only 1,2,3] [--sheet]
 *
 * Thirty posts, each in four sizes, drawn in the same language as the store
 * set and the films: a solid black stage, the handset, ONE COMPONENT OF THE
 * APP lifted off its screen and blown up inside one heavy sky rule, a drawn
 * container for the thing no screen says in one place, one of the brand's 3D
 * objects, two round badges, and the headline with its key word in a box.
 *
 * Out: docs/marketing/campaign-2026-10/<channel>/<NN>-<slug>.png
 *   x/ 1600 x 900   telegram/ 1600 x 900 at 0.8   instagram-feed/ 1080 x 1350
 *   instagram-story/ 1080 x 1920
 *
 * The parts come from store/callouts.mjs, so a change there reaches the
 * store images, the posts and (through popout.js) the films together.
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Phones } from "../store/phones.mjs";
import { CALLOUT_CSS, statCallout, lineCallout, cellsCallout, countersCallout, prop, badge, figureOutline } from "../store/callouts.mjs";
import { POSTS, LINK } from "./posts2.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const NM = join(HERE, "..", "node_modules");
const OUT = join(REPO, "docs", "marketing", "campaign-2026-10");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(Number) : null;

const b64 = (f, mime) => `data:${mime};base64,${readFileSync(f).toString("base64")}`;
const POPPINS = b64(join(NM, "@fontsource/poppins/files/poppins-latin-700-normal.woff2"), "font/woff2");
const POPPINS6 = b64(join(NM, "@fontsource/poppins/files/poppins-latin-600-normal.woff2"), "font/woff2");
const INTER = b64(join(REPO, "apps/web/public/fonts/v2/inter-latin.woff2"), "font/woff2");
const LOGO_MARK = b64(join(REPO, "scripts/marketing/video/assets/logo-mark.png"), "image/png");
const LOGO_WORD = b64(join(REPO, "scripts/marketing/video/assets/logo-wordmark.png"), "image/png");
const screen = (id) => join(REPO, "docs", "marketing", "screens", `${id}-ios.png`);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const px = (v) => `${Math.round(v * 100) / 100}px`;

/*
 * The four sizes, and where each part stands in them. Everything is a
 * fraction of the canvas, so one recipe serves a wide post and a tall one.
 *   head   the headline block's left edge and top, and its type size
 *   phone  the handset's height, and the centre of its body
 *   mag    the lifted component's width and the centre it hangs on
 *   pop    the drawn container's centre, and which edge of it that names
 */
const FORMATS = {
  x: {
    dir: "x", W: 1600, H: 900,
    head: { x: 0.06, y: 0.25, size: 76, w: 0.40, sub: 30 },
    brand: { x: 0.06, y: 0.075 },
    cta: { x: 0.06, y: 0.71 },
    phone: { h: 0.82, cx: 0.78, cy: 0.50 },
    mag: { w: 0.28, cx: 0.585, cy: 0.33 },
    pop: { cx: 0.565, cy: 0.80, scale: 0.70 },
    prop: { x: 0.395, y: 0.60, size: 140 },
    badges: [{ x: 0.902, y: 0.155, size: 104 }, { x: 0.878, y: 0.825, size: 92 }],
  },
  telegram: { dir: "telegram", W: 1600, H: 900, scale: 0.8, inherit: "x" },
  "instagram-feed": {
    dir: "instagram-feed", W: 1080, H: 1350,
    head: { x: 0.07, y: 0.075, size: 82, w: 0.86, sub: 30 },
    brand: { x: 0.07, y: 0.035 },
    cta: { x: 0.07, y: 0.285 },
    phone: { h: 0.58, cx: 0.5, cy: 0.755 },
    mag: { w: 0.55, cx: 0.5, cy: 0.475 },
    pop: { cx: 0.5, cy: 0.945, scale: 0.76 },
    prop: { x: 0.05, y: 0.815, size: 145 },
    badges: [{ x: 0.865, y: 0.545, size: 100 }, { x: 0.055, y: 0.605, size: 90 }],
  },
  "instagram-story": {
    dir: "instagram-story", W: 1080, H: 1920,
    head: { x: 0.07, y: 0.135, size: 84, w: 0.86, sub: 31 },
    brand: { x: 0.07, y: 0.075 },
    cta: { x: 0.07, y: 0.252 },
    phone: { h: 0.50, cx: 0.5, cy: 0.675 },
    mag: { w: 0.55, cx: 0.5, cy: 0.45 },
    pop: { cx: 0.5, cy: 0.875, scale: 0.78 },
    prop: { x: 0.05, y: 0.775, size: 145 },
    badges: [{ x: 0.865, y: 0.515, size: 102 }, { x: 0.055, y: 0.575, size: 90 }],
  },
};

/* ------------------------------------------------------------- the parts */

const phones = new Phones({ res: 1 });
const cache = new Map();
async function phoneImg(id, height) {
  const key = `${id}:${height}`;
  if (!cache.has(key)) {
    const p = await phones.render({ screen: screen(id), model: "island", rotation: { x: 0, y: 0, z: 0 }, fov: 20, height });
    cache.set(key, { ...p, src: pathToFileURL(p.file).href });
  }
  return cache.get(key);
}
/** A rendered handset placed so its body's centre sits at (cx, cy). */
function placePhone(p, cx, cy, z = 10) {
  const w = p.width * p.scale, h = p.height * p.scale;
  const bx = (p.bbox.x + p.bbox.width / 2) * p.scale, by = (p.bbox.y + p.bbox.height / 2) * p.scale;
  return `<img src="${p.src}" style="position:absolute;left:${px(cx - bx)};top:${px(cy - by)};width:${px(w)};height:${px(h)};z-index:${z}">`;
}

/**
 * THE BLUEPRINT'S MOVE: one component of the app, cut on its own edges
 * (the boxes the store set measured), held up at `w` wide inside the heavy
 * rule, centred on (cx, cy).
 */
function magnify({ id, box, cx, cy, w, rot = 0, z = 20 }) {
  const [x0, y0, x1, y1] = box;
  const k = w / (x1 - x0);
  const h = (y1 - y0) * k;
  const rule = Math.max(5, w * 0.016);
  const src = pathToFileURL(screen(id)).href;
  return `<div class="magc" style="left:${px(cx - w / 2)};top:${px(cy - h / 2)};width:${px(w)};height:${px(h)};border-width:${px(rule)};border-radius:${px(w * 0.045 + rule)};transform:rotate(${rot}deg);z-index:${z}">
    <img src="${src}" style="position:absolute;left:${px(-x0 * k)};top:${px(-y0 * k)};width:${px(1320 * k)};height:auto;max-width:none"></div>`;
}

const KIND = { stat: statCallout, line: lineCallout, cells: cellsCallout, counters: countersCallout };

/* ------------------------------------------------------------- the page */

async function layout(fmt, post) {
  const F = fmt.inherit ? { ...FORMATS[fmt.inherit], ...fmt } : fmt;
  const { W, H } = F;
  const u = Math.min(W, H) / 1080;
  const parts = [];

  const ph = await phoneImg(post.capture, Math.round(F.phone.h * H));
  parts.push(placePhone(ph, F.phone.cx * W, F.phone.cy * H));

  parts.push(magnify({
    id: post.capture, box: post.box, w: F.mag.w * W,
    cx: F.mag.cx * W, cy: F.mag.cy * H, rot: post.magRot ?? 0,
  }));

  if (post.pop) {
    const draw = KIND[post.pop.kind];
    const { kind, ...rest } = post.pop;
    const scale = F.pop.scale * u;
    /* the container hangs on its own centre, so its height need not be known */
    parts.push(draw({ ...rest, x: 0, y: F.pop.cy * H, center: true, fit: true, scale, z: 30, cls: "cocentre", card: false }));
  }

  parts.push(prop({ name: post.prop, x: F.prop.x * W, y: F.prop.y * H, size: F.prop.size, rotate: post.propRot ?? -6, scale: u, z: 24 }));
  post.badges.slice(0, F.badges.length).forEach((b, i) => {
    const g = F.badges[i];
    parts.push(badge({ ...b, x: g.x * W, y: g.y * H, size: g.size, scale: u, z: 26 }));
  });
  if (post.figure) {
    parts.push(figureOutline({ text: post.figure.text, x: post.figure.x * W, y: post.figure.y * H, size: post.figure.size ?? 110, scale: u, rotate: post.figure.rot ?? -3, z: 18 }));
  }

  const head = post.lines
    .map((l) => `<div class="ln">${esc(l).replace(/\*(.+?)\*/g, '<span class="kw">$1</span>')}</div>`)
    .join("");
  const hx = F.head.x * W;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Poppins;font-weight:700;src:url(${POPPINS}) format("woff2")}
    @font-face{font-family:Poppins;font-weight:600;src:url(${POPPINS6}) format("woff2")}
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER}) format("woff2")}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${W}px;height:${H}px;overflow:hidden;background:#010118}
    .bg{position:absolute;inset:0;background:linear-gradient(180deg,#050b3d 0%,#010118 100%)}
    .stage{position:absolute;left:${px(36 * u)};top:${px(36 * u)};right:${px(36 * u)};bottom:${px(36 * u)};
      border-radius:${px(72 * u)};background:#01020C;box-shadow:inset 0 0 0 ${px(2 * u)} rgb(143 211 255 / 0.16);overflow:hidden;z-index:1}
    .stage i{position:absolute;border-radius:50%;filter:blur(${px(70 * u)})}
    .stage i.a{left:-8%;top:2%;width:64%;height:32%;background:rgb(0 105 254 / 0.22)}
    .stage i.b{right:-12%;bottom:-6%;width:70%;height:36%;background:rgb(70 48 170 / 0.16)}
    .brand{position:absolute;left:${px(hx)};top:${px(F.brand.y * H)};display:flex;align-items:center;gap:${px(14 * u)};z-index:40}
    .brand img.m{width:${px(54 * u)}}.brand img.w{width:${px(152 * u)}}
    .copy{position:absolute;left:${px(hx)};top:${px(F.head.y * H)};width:${px(F.head.w * W)};z-index:40}
    .h{font:700 ${px(F.head.size * u)}/1.06 Poppins,sans-serif;letter-spacing:-0.03em;color:#fff}
    .ln{white-space:nowrap}
    .kw{display:inline-block;padding:0.02em 0.20em 0.08em;margin:0 0.03em;border-radius:0.28em;background:#04071C;box-shadow:inset 0 0 0 0.062em #8FD3FF;color:#fff}
    .s{margin-top:${px(22 * u)};font:500 ${px(F.head.sub * u)}/1.4 Inter,sans-serif;color:rgb(214 230 255 / .86);letter-spacing:-0.005em}
    .cta{position:absolute;left:${px(hx)};top:${px(F.cta.y * H)};display:inline-flex;align-items:center;
      padding:${px(20 * u)} ${px(36 * u)};border-radius:99px;background:#0069FE;border:${px(4 * u)} solid #CFE6FF;
      font:600 ${px(27 * u)}/1 Inter,sans-serif;color:#fff;white-space:nowrap;z-index:40}
    .magc{position:absolute;overflow:hidden;border-style:solid;border-color:#8FD3FF;background:#000208;
      box-shadow:0 0 ${px(44 * u)} ${px(-6 * u)} rgb(143 211 255 / 0.45), 0 ${px(34 * u)} ${px(64 * u)} ${px(-24 * u)} rgb(0 0 10 / 0.92)}
    .magc img{display:block;filter:brightness(1.07) saturate(1.05)}
    .cocentre{left:50% !important;transform:translate(-50%,-50%) !important}
    ${CALLOUT_CSS}
  </style></head><body>
    <div class="bg"></div><div class="stage"><i class="a"></i><i class="b"></i></div>
    <div class="brand"><img class="m" src="${LOGO_MARK}"><img class="w" src="${LOGO_WORD}"></div>
    <div class="copy"><div class="h">${head}</div><div class="s">${esc(post.support)}</div></div>
    <div class="cta">${esc(post.cta)} &nbsp;·&nbsp; vallospaces.com</div>
    ${parts.join("\n")}
  </body></html>`;
}

/* ------------------------------------------------------------- the run */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-color-profile=srgb"] });
const TMP = join(tmpdir(), `vallo-campaign-${process.pid}.html`);
const made = [];
for (const post of POSTS) {
  if (only && !only.includes(post.n)) continue;
  for (const fmt of Object.values(FORMATS)) {
    const html = await layout(fmt, post);
    const page = await browser.newPage({ viewport: { width: fmt.W, height: fmt.H }, deviceScaleFactor: fmt.scale ?? 1 });
    /* the page is written to disk and opened, not set as content: a page with
       an about:blank origin cannot load the file:// captures, handsets and
       3D objects the parts point at */
    writeFileSync(TMP, html);
    await page.goto(pathToFileURL(TMP).href, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map((i) => i.decode().catch(() => {}))]));
    await page.waitForTimeout(80);
    const dir = join(OUT, fmt.dir);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${String(post.n).padStart(2, "0")}-${post.slug}.png`);
    await sharp(await page.screenshot({ type: "png" })).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
    await page.close();
    made.push(file);
  }
  console.log(`post ${String(post.n).padStart(2, "0")} ${post.slug}`);
}
await browser.close();
await phones.close();

/* ---------- the copy file ---------- */
const lines = [
  "# Vallo campaign, rebuilt 16 October 2026", "",
  `Destination link for every post: ${LINK}`, "",
  "Thirty posts in four sizes. Every image is built in the same language as the",
  "store set and the films: the screen's own component lifted and blown up inside",
  "one heavy rule, a drawn container only where no screen says the thing in one",
  "place, a 3D object, two badges, and the key word in a box.", "",
  "Rules (scripts/marketing/DESIGN.md section 2): no invented numbers, no",
  "testimonials or counts, no promise words, \"verified\" only about people and",
  "businesses, no em dashes. Every figure shown is printed on the screen under it.",
  "The listings and stays on screen are the platform's own example listings.", "",
  "Folders: `x/` 1600 x 900 (also fine for LinkedIn), `telegram/` 1280 x 720,",
  "`instagram-feed/` 1080 x 1350, `instagram-story/` 1080 x 1920.", "",
];
for (const p of POSTS) {
  lines.push(`## ${String(p.n).padStart(2, "0")}  ${p.topic}  (day ${p.day})`, "",
    `**Headline:** ${p.lines.join(" ").replace(/\*/g, "")}`, `**Supporting text:** ${p.support}`,
    `**Call to action:** ${p.cta}`, `**Screen:** ${p.capture}`, `**Link:** ${LINK}`, "",
    "**X**", "", p.x, "", "**Instagram caption**", "", p.ig, "", "**Telegram**", "", p.tg, "");
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "COPY.md"), lines.join("\n"));
console.log(`made ${made.length} images, copy written`);
