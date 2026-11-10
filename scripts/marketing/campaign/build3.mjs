/**
 * THE LAUNCH CAMPAIGN (16 October 2026).
 *
 *   node scripts/marketing/campaign/build3.mjs [--only 1,2,3]
 *
 * Thirty posts for the month a platform goes live. The founder's ruling, 16
 * October, on the first attempt: those were screenshots with motion graphics
 * on them, which is what a store listing is, not what a platform posts when
 * it launches. "I need ones for announcing we are live, first month, big
 * platform in this area kind of post. No need of screenshots or looks of our
 * app in them, just only about 2 or 3."
 *
 * So: type is the hero. Seven kinds of post, and only three of them show the
 * product at all.
 *
 *   art      the brand's own 3D artwork, full bleed, one statement on it
 *   photo    a photograph of a real space, one statement on it
 *   type     one statement on the black stage, one 3D object beside it
 *   figure   one oversized outlined phrase, and the line that explains it
 *   stack    three short lines, each on its own rule
 *   objects  a row of the brand's 3D objects, each with its word
 *   peek     the handset, once a week, with one container (three posts only)
 *
 * Out: docs/marketing/campaign-2026-10/<channel>/<NN>-<slug>.png
 *   x/ 1600 x 900   telegram/ 1280 x 720   instagram-feed/ 1080 x 1350
 *   instagram-story/ 1080 x 1920
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Phones } from "../store/phones.mjs";
import { CALLOUT_CSS, statCallout, lineCallout, cellsCallout } from "../store/callouts.mjs";
import { POSTS, LINK } from "./posts3.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const NM = join(HERE, "..", "node_modules");
const OUT = join(REPO, "docs", "marketing", "campaign-2026-10");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(Number) : null;

const b64 = (f, m) => `data:${m};base64,${readFileSync(f).toString("base64")}`;
const POPPINS = b64(join(NM, "@fontsource/poppins/files/poppins-latin-700-normal.woff2"), "font/woff2");
const POPPINS6 = b64(join(NM, "@fontsource/poppins/files/poppins-latin-600-normal.woff2"), "font/woff2");
const INTER = b64(join(REPO, "apps/web/public/fonts/v2/inter-latin.woff2"), "font/woff2");
const url = (p) => pathToFileURL(p).href;
const MARK = url(join(REPO, "scripts/marketing/video/assets/logo-mark.png"));
const WORD = url(join(REPO, "scripts/marketing/video/assets/logo-wordmark.png"));
const obj = (n) => url(join(REPO, "apps/web/public/brand/3d", `${n}@2x.webp`));
const art = (n) => url(join(REPO, "apps/web/public/brand/onboarding", `${n}.webp`));
const scene = (n) => url(join(REPO, "apps/web/public/brand/scenes", `${n}.jpg`));
const photo = (n) => url(join(REPO, "apps/web/public/brand/photos", `${n}.jpg`));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const px = (v) => `${Math.round(v * 100) / 100}px`;

/* The four sizes. `k` is the type scale: a story can carry bigger type than a
   wide card of the same area, and Telegram is the wide card at 0.8. */
const FORMATS = {
  x: { dir: "x", W: 1600, H: 900, k: 1.0, wide: true },
  telegram: { dir: "telegram", W: 1600, H: 900, k: 1.0, wide: true, scale: 0.8 },
  "instagram-feed": { dir: "instagram-feed", W: 1080, H: 1350, k: 0.92 },
  "instagram-story": { dir: "instagram-story", W: 1080, H: 1920, k: 0.98 },
};

const phones = new Phones({ res: 1 });
const cache = new Map();
async function phoneImg(id, height) {
  const key = `${id}:${height}`;
  if (!cache.has(key)) {
    const p = await phones.render({ screen: join(REPO, "docs", "marketing", "screens", `${id}-ios.png`), model: "island", rotation: { x: 0, y: 0, z: 0 }, fov: 20, height });
    cache.set(key, { ...p, src: url(p.file) });
  }
  return cache.get(key);
}
function placePhone(p, cx, cy, z = 10) {
  const w = p.width * p.scale, h = p.height * p.scale;
  const bx = (p.bbox.x + p.bbox.width / 2) * p.scale, by = (p.bbox.y + p.bbox.height / 2) * p.scale;
  return `<img src="${p.src}" style="position:absolute;left:${px(cx - bx)};top:${px(cy - by)};width:${px(w)};height:${px(h)};z-index:${z}">`;
}
function magnify({ id, box, cx, cy, w, z = 20 }) {
  const [x0, y0, x1, y1] = box;
  const k = w / (x1 - x0);
  const h = (y1 - y0) * k;
  const rule = Math.max(5, w * 0.016);
  const src = url(join(REPO, "docs", "marketing", "screens", `${id}-ios.png`));
  return `<div class="magc" style="left:${px(cx - w / 2)};top:${px(cy - h / 2)};width:${px(w)};height:${px(h)};border-width:${px(rule)};border-radius:${px(w * 0.045 + rule)};z-index:${z}">
    <img src="${src}" style="position:absolute;left:${px(-x0 * k)};top:${px(-y0 * k)};width:${px(1320 * k)};height:auto;max-width:none"></div>`;
}

/** The headline: `*a word*` goes in the box. */
const head = (lines) => lines.map((l) => `<div class="ln">${esc(l).replace(/\*(.+?)\*/g, '<span class="kw">$1</span>')}</div>`).join("");

/* ------------------------------------------------------------- the kinds */

async function compose(F, p) {
  const { W, H, k, wide } = F;
  const u = Math.min(W, H) / 1080;
  const S = k * u;
  const pad = wide ? 0.065 * W : 0.075 * W;
  const parts = [];
  let bg = `<div class="bg"></div>`;
  let copy = "";
  let size = p.size ?? (wide ? 104 : 112);
  let align = "left";
  let top = wide ? 0.22 : 0.26;

  if (p.kind === "art" || p.kind === "photo") {
    const src = p.kind === "art" ? art(p.art) : (p.scene ? scene(p.scene) : photo(p.photo));
    const pos = p.focus ?? "50% 45%";
    bg = `<img class="full" src="${src}" style="object-position:${pos}">
      <div class="scrim"></div>`;
    top = p.top ?? (wide ? 0.44 : 0.55);
    size = p.size ?? (wide ? 96 : 104);
  } else if (p.kind === "type") {
    top = p.top ?? (wide ? 0.26 : 0.30);
  } else if (p.kind === "figure") {
    top = p.top ?? (wide ? 0.30 : 0.34);
    size = p.size ?? (wide ? 150 : 140);
  } else if (p.kind === "stack") {
    top = p.top ?? (wide ? 0.24 : 0.28);
    size = p.size ?? (wide ? 76 : 80);
    copy = p.stack.map((s, i) => `<div class="row"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="txt">${esc(s)}</span></div>`).join("");
  } else if (p.kind === "objects") {
    top = p.top ?? (wide ? 0.20 : 0.22);
    size = p.size ?? (wide ? 86 : 92);
    const n = p.objects.length;
    const row = p.objects.map(([name, word]) => `<div class="cell"><img src="${obj(name)}"><span>${esc(word)}</span></div>`).join("");
    parts.push(`<div class="objrow" style="${wide ? `left:${px(pad)};right:${px(pad)};top:${px(0.60 * H)}` : `left:${px(pad)};right:${px(pad)};top:${px(0.62 * H)}`};--n:${n}">${row}</div>`);
  } else if (p.kind === "peek") {
    top = p.top ?? (wide ? 0.24 : 0.10);
    size = p.size ?? (wide ? 84 : 90);
    const ph = await phoneImg(p.capture, Math.round((wide ? 0.80 : 0.52) * H));
    parts.push(placePhone(ph, (wide ? 0.78 : 0.5) * W, (wide ? 0.52 : 0.70) * H));
    parts.push(magnify({ id: p.capture, box: p.box, w: (wide ? 0.27 : 0.55) * W, cx: (wide ? 0.575 : 0.5) * W, cy: (wide ? 0.34 : 0.455) * H }));
    if (p.pop) {
      const draw = { stat: statCallout, line: lineCallout, cells: cellsCallout }[p.pop.kind];
      const { kind, ...rest } = p.pop;
      parts.push(draw({ ...rest, x: 0, y: (wide ? 0.80 : 0.945) * H, center: true, fit: true, scale: (wide ? 0.70 : 0.76) * u, z: 30, cls: "cocentre" }));
    }
  }

  /* one of the brand's objects, wherever a post asks for it */
  if (p.object && p.kind !== "objects" && p.kind !== "peek") {
    parts.push(`<img class="obj" src="${obj(p.object)}" style="${wide ? `right:${px(0.085 * W)};top:${px(0.28 * H)};width:${px(330 * S)}` : `right:${px(0.075 * W)};bottom:${px(0.115 * H)};width:${px(300 * S)}`}">`);
  }

  const headBlock = p.kind === "stack"
    ? `<div class="stack">${copy}</div>`
    : `<div class="h">${head(p.lines)}</div>${p.support ? `<div class="s">${esc(p.support)}</div>` : ""}`;
  const w = p.kind === "peek" && wide ? 0.40 : p.width ?? (wide ? 0.62 : 0.86);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Poppins;font-weight:700;src:url(${POPPINS}) format("woff2")}
    @font-face{font-family:Poppins;font-weight:600;src:url(${POPPINS6}) format("woff2")}
    @font-face{font-family:Inter;font-weight:100 900;src:url(${INTER}) format("woff2")}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:${W}px;height:${H}px;overflow:hidden;background:#010118;font-family:Inter,sans-serif}
    .bg{position:absolute;inset:0;background:radial-gradient(80% 60% at 78% 8%,rgb(0 105 254 / .34) 0%,transparent 64%),linear-gradient(180deg,#050b3d 0%,#010118 72%)}
    .full{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgb(1 1 24 / .62) 0%,rgb(1 1 24 / .30) 32%,rgb(1 1 24 / .80) 72%,rgb(1 1 24 / .95) 100%)}
    .mark{position:absolute;left:${px(pad)};top:${px(wide ? 0.085 * H : 0.055 * H)};display:flex;align-items:center;gap:${px(14 * S)};z-index:40}
    .mark img.m{width:${px(50 * S)}}.mark img.w{width:${px(140 * S)}}
    .copy{position:absolute;left:${px(pad)};top:${px(top * H)};width:${px(w * W)};z-index:40}
    .h{font:700 ${px(size * S)}/1.05 Poppins,sans-serif;letter-spacing:-0.035em;color:#fff;text-align:${align}}
    .ln{white-space:nowrap;width:max-content;max-width:none}
    .kw{display:inline-block;padding:0.02em 0.20em 0.08em;margin:0 0.03em;border-radius:0.26em;background:#04071C;box-shadow:inset 0 0 0 0.06em #8FD3FF;color:#fff}
    .s{margin-top:${px(26 * S)};font:500 ${px(32 * S)}/1.42 Inter,sans-serif;color:rgb(216 231 255 / .84);letter-spacing:-0.004em;max-width:${px(0.78 * w * W)}}
    .stack .row{display:flex;align-items:baseline;gap:${px(26 * S)};padding:${px(26 * S)} 0;border-bottom:${px(2 * S)} solid rgb(143 211 255 / .22)}
    .stack .row:first-child{border-top:${px(2 * S)} solid rgb(143 211 255 / .22)}
    .stack .num{font:700 ${px(28 * S)}/1 Inter,sans-serif;letter-spacing:.14em;color:#8FD3FF;flex:none;width:${px(70 * S)}}
    .stack .txt{font:700 ${px(size * S)}/1.08 Poppins,sans-serif;letter-spacing:-0.03em;color:#fff;white-space:nowrap}
    .fig{position:absolute;left:${px(pad)};top:${px(top * H)};z-index:40}
    .fig .edge{font:700 ${px(size * S)}/0.94 Poppins,sans-serif;letter-spacing:-0.04em;color:transparent;-webkit-text-stroke:${px(size * S * 0.028)} #8FD3FF;white-space:nowrap;display:block;width:max-content}
    .fig .ghost{position:absolute;left:0;top:0;font:700 ${px(size * S)}/0.94 Poppins,sans-serif;letter-spacing:-0.04em;color:#8FD3FF;opacity:.16;white-space:nowrap;display:block;width:max-content}
    .obj{position:absolute;z-index:30;filter:drop-shadow(0 ${px(30 * S)} ${px(40 * S)} rgb(0 0 25 / .7))}
    .objrow{position:absolute;display:flex;justify-content:space-between;gap:${px(24 * S)};z-index:30}
    .objrow .cell{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:${px(18 * S)}}
    .objrow .cell img{width:${px(170 * S)};filter:drop-shadow(0 ${px(22 * S)} ${px(30 * S)} rgb(0 0 25 / .65))}
    .objrow .cell span{font:600 ${px(30 * S)}/1 Inter,sans-serif;color:#fff;letter-spacing:-0.01em;white-space:nowrap}
    .cta{position:absolute;left:${px(pad)};bottom:${px(wide ? 0.10 * H : 0.065 * H)};display:inline-flex;align-items:center;
      padding:${px(20 * S)} ${px(36 * S)};border-radius:99px;background:#0069FE;border:${px(4 * S)} solid #CFE6FF;
      font:600 ${px(27 * S)}/1 Inter,sans-serif;color:#fff;white-space:nowrap;z-index:40}
    .magc{position:absolute;overflow:hidden;border-style:solid;border-color:#8FD3FF;background:#000208;
      box-shadow:0 0 ${px(44 * u)} ${px(-6 * u)} rgb(143 211 255 / .45), 0 ${px(34 * u)} ${px(64 * u)} ${px(-24 * u)} rgb(0 0 10 / .92)}
    .magc img{display:block;filter:brightness(1.07) saturate(1.05)}
    .cocentre{left:50% !important;transform:translate(-50%,-50%) !important}
    ${CALLOUT_CSS}
  </style></head><body>
    ${bg}
    <div class="mark"><img class="m" src="${MARK}"><img class="w" src="${WORD}"></div>
    <script>
      /* THE TYPE IS SET TO THE CANVAS, not guessed: each nowrap line is
         measured after the fonts land and the block is stepped down until the
         widest line fits its measure. A launch post is the same sentence in
         four shapes, so no one size can be right in all of them. */
      document.fonts.ready.then(() => {
        /* every line and the figure are laid out at max-content width, so
           each one's box IS the width of its words; a plain block would report
           its container's width instead, and scrollWidth never falls below
           that, which is how five headlines ran off the edge and then every
           headline shrank to nothing */
        const fit = (box, lines, max) => {
          if (!box || !lines.length) return;
          let size = parseFloat(getComputedStyle(box).fontSize);
          const widest = () => Math.max(...lines.map((l) => l.getBoundingClientRect().width));
          let guard = 400;
          while (widest() > max && size > 14 && guard-- > 0) { size -= 1; box.style.fontSize = size + "px"; }
        };
        const copy = document.querySelector(".copy");
        const h = document.querySelector(".copy .h");
        if (h) fit(h, [...h.querySelectorAll(".ln")], copy.getBoundingClientRect().width * 0.985);
        const fig = document.querySelector(".fig");
        if (fig) {
          const edge = fig.querySelector(".edge"), ghost = fig.querySelector(".ghost");
          const max = (${W} - fig.getBoundingClientRect().left - ${pad}) * 0.97;
          let size = parseFloat(getComputedStyle(edge).fontSize);
          let guard = 600;
          while (edge.getBoundingClientRect().width > max && size > 20 && guard-- > 0) {
            size -= 1; edge.style.fontSize = size + "px"; ghost.style.fontSize = size + "px";
            edge.style.webkitTextStroke = (size * 0.028).toFixed(2) + "px #8FD3FF";
          }
        }
        const stack = document.querySelector(".stack");
        if (stack) {
          const txts = [...stack.querySelectorAll(".txt")];
          const num = stack.querySelector(".num");
          const max = stack.getBoundingClientRect().width - (num ? num.getBoundingClientRect().width : 0) - ${26 * 2};
          let size = parseFloat(getComputedStyle(txts[0]).fontSize);
          let guard = 400;
          while (Math.max(...txts.map((t) => t.getBoundingClientRect().width)) > max && size > 16 && guard-- > 0) {
            size -= 1; for (const t of txts) t.style.fontSize = size + "px";
          }
        }
        window.__fit = true;
      });
    </script>
    ${p.kind === "figure"
      ? `<div class="fig"><span class="ghost">${esc(p.figure)}</span><span class="edge">${esc(p.figure)}</span></div>
         <div class="copy" style="top:${px((top + (wide ? 0.22 : 0.14)) * H)}"><div class="h" style="font-size:${px((wide ? 64 : 68) * S)}">${head(p.lines)}</div>${p.support ? `<div class="s">${esc(p.support)}</div>` : ""}</div>`
      : `<div class="copy">${headBlock}</div>`}
    <div class="cta">${esc(p.cta)} &nbsp;·&nbsp; vallospaces.com</div>
    ${parts.join("\n")}
  </body></html>`;
}

/* ------------------------------------------------------------- the run */

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-color-profile=srgb"] });
const TMP = join(tmpdir(), `vallo-launch-${process.pid}.html`);
let made = 0;
for (const p of POSTS) {
  if (only && !only.includes(p.n)) continue;
  for (const F of Object.values(FORMATS)) {
    const html = await compose(F, p);
    const page = await browser.newPage({ viewport: { width: F.W, height: F.H }, deviceScaleFactor: F.scale ?? 1 });
    writeFileSync(TMP, html);
    await page.goto(url(TMP), { waitUntil: "load" });
    await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map((i) => i.decode().catch(() => {}))]));
    await page.waitForFunction(() => window.__fit === true, null, { timeout: 15000 });
    await page.waitForTimeout(70);
    const dir = join(OUT, F.dir);
    mkdirSync(dir, { recursive: true });
    await sharp(await page.screenshot({ type: "png" })).removeAlpha().png({ compressionLevel: 9 })
      .toFile(join(dir, `${String(p.n).padStart(2, "0")}-${p.slug}.png`));
    await page.close();
    made += 1;
  }
  console.log(`post ${String(p.n).padStart(2, "0")} ${p.slug}  (${p.kind})`);
}
await browser.close();
await phones.close();

const out = [
  "# Vallo launch campaign, first month", "",
  `Destination link for every post: ${LINK}`, "",
  "Thirty posts for the month the platform goes live. Type is the hero. Only",
  "three posts show the app at all (09, 19, 26): the rest are the announcement,",
  "the promise, the places and the people.", "",
  "Rules (scripts/marketing/DESIGN.md section 2): no invented numbers, no",
  "testimonials or counts, no promise words, \"verified\" only about people and",
  "businesses, no em dashes. The web platform is live; the iPhone and Android",
  "apps are in store review, so no post says \"download\".", "",
  "Folders: `x/` 1600 x 900 (also fine for LinkedIn), `telegram/` 1280 x 720,",
  "`instagram-feed/` 1080 x 1350, `instagram-story/` 1080 x 1920.", "",
];
for (const p of POSTS) {
  out.push(`## ${String(p.n).padStart(2, "0")}  ${p.topic}  (day ${p.day}, ${p.kind})`, "",
    `**On the image:** ${(p.lines ?? p.stack ?? [p.figure]).join(" ").replace(/\*/g, "")}`,
    ...(p.support ? [`**Under it:** ${p.support}`] : []),
    `**Call to action:** ${p.cta}`, "", "**X**", "", p.x, "", "**Instagram caption**", "", p.ig, "", "**Telegram**", "", p.tg, "");
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "COPY.md"), out.join("\n"));
console.log(`made ${made} images, copy written`);
