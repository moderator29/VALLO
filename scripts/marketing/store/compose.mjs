/**
 * Draws the store images.
 *
 *   node scripts/marketing/store/compose.mjs [--store app-store|google-play] [--only 1,2,3]
 *        [--res 2] [--proof DIR] [--png] [--feature | --feature-only] [--verbose]
 *
 * For every shot in shots.mjs and each store, the shot's layout is laid out
 * as HTML (shots/premium.mjs, with parts from components.mjs), its phones
 * drawn by the 3D studio through phones.mjs, rendered by Chromium at `res`
 * times the store's pixel size on a transparent page, laid over the night
 * ground, brought down to the exact size with a Lanczos filter and written as
 * a 24-bit RGB PNG with no alpha channel:
 *
 *   docs/store/screenshots/app-store/<NN>-<slug>.png     1320 x 2868
 *   docs/store/screenshots/google-play/<NN>-<slug>.png   1440 x 2560 (under 8 MB)
 *
 * The ground. One raster, a vertical gradient from #050B3D (the top row reads
 * 5, 11, 61) to #010118, drawn here pixel by pixel rather than by the browser,
 * so every image carries exactly the same ground.
 *
 * The screens. A straight-on phone's display is laid on as a flat layer: the
 * capture brought down to the display's size in one Lanczos step. The page is
 * drawn twice, with the phone's display black (A) and white (B); B - A is then
 * exactly how much of the display shows through at each pixel (its rounded
 * corners, the cut-out, anything drawn over it), and A holds the glass's own
 * sheen, so the image is A + capture x (B - A). A tilted phone keeps the
 * studio's own mapping of the capture.
 *
 * A connected pair (`pairWith`) is drawn as one page twice as wide and cut
 * in two: its ground runs under both images and its one phone (`shared`)
 * crosses the seam. --feature also draws Play's 1024 x 500 feature graphic.
 * --proof writes quick JPEGs to DIR instead of the store folders (--png
 * keeps them lossless), and `STORE_SCREENS=dir` reads the displays from
 * another folder.
 *
 * Every image is checked as it is drawn: each phone stays clear of the
 * image's edge (a pair's shared phone is exempt at its seam only), every
 * word and card sits at least 40 px inside the image, every headline line
 * has at least 4.5:1 contrast against what lies behind it, and no headline
 * had to shrink to fit its measure.
 */
import { chromium } from "playwright-core";
import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OUT, STORES, screenFile } from "./lib.mjs";
import { page } from "./page.mjs";
import { Phones } from "./phones.mjs";
import { placePhone } from "./components.mjs";
import { CLEAN, cleanDisplay, PATCH, patchDisplay } from "./clean.mjs";
import { SHOTS, FEATURE, shotName, GROUND } from "./shots.mjs";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const ONLY = arg("--only")?.split(",").map(Number);
const STORE_LIST = arg("--store") ? [arg("--store")] : Object.keys(STORES);
const RES = Number(arg("--res", "2"));
const PROOF = arg("--proof");
const FEATURE_ONLY = args.includes("--feature-only");
const WITH_FEATURE = args.includes("--feature") || FEATURE_ONLY;
const VERBOSE = args.includes("--verbose");
/* --png keeps proofs lossless, for comparing pixels. */
const PROOF_EXT = args.includes("--png") ? "png" : "jpg";

const TMP = join(tmpdir(), `vallo-store-${process.pid}`);
mkdirSync(TMP, { recursive: true });

const phones = new Phones({ res: RES, verbose: VERBOSE });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage", "--force-color-profile=srgb"] });
const context = await browser.newContext({ deviceScaleFactor: RES, viewport: { width: 800, height: 800 } });
const tab = await context.newPage();
const problems = [];

/* ------------------------------------------------------------- the ground */

/**
 * The night ground as raw RGB, `w` x `h` px: each row one colour, from
 * GROUND.top at the first row to GROUND.bottom at the last, rounded to the
 * nearest level. The same function draws every image's ground.
 */
const grounds = new Map();
function groundRaw(w, h) {
  const key = `${w}x${h}`;
  if (!grounds.has(key)) {
    const buf = Buffer.alloc(w * h * 3);
    const [t, b] = [GROUND.top, GROUND.bottom];
    for (let y = 0; y < h; y += 1) {
      const k = h > 1 ? y / (h - 1) : 0;
      const c = [0, 1, 2].map((i) => Math.round(t[i] + (b[i] - t[i]) * k));
      for (let x = 0; x < w; x += 1) buf.set(c, (y * w + x) * 3);
    }
    grounds.set(key, buf);
  }
  return grounds.get(key);
}

/** A transparent page shot laid over the ground at the same size, as raw RGB. */
async function overGround(shot) {
  const meta = await sharp(shot).metadata();
  const g = groundRaw(meta.width, meta.height);
  return sharp(g, { raw: { width: meta.width, height: meta.height, channels: 3 } })
    .composite([{ input: shot }])
    .removeAlpha()
    .raw()
    .toBuffer();
}

/** Raw RGB at `res` times the page, brought down to the page's size. */
async function down(raw2, w2, h2, w, h) {
  return sharp(raw2, { raw: { width: w2, height: h2, channels: 3 } }).resize(w, h, { kernel: "lanczos3" }).raw().toBuffer();
}

/* ------------------------------------------------------------- displays */

/** The display for capture `id`: the cleaned one for the few that need it (clean.mjs). */
async function displayFile(id, store) {
  let file = CLEAN[id] ? await cleanDisplay(id, store) : screenFile(id, store);
  if (PATCH[id]) file = await patchDisplay(id, store, file);
  if (!existsSync(file)) throw new Error(`missing display ${file}`);
  return file;
}

/* ------------------------------------------------------------- the context */

/** The context a layout draws with: one image, its store, its handsets. */
function makeCtx(shot, store, offset) {
  const S = STORES[store];
  const placed = [];
  const flats = [];
  const ctx = {
    n: shot.n,
    store,
    W: S.W,
    H: S.H,
    model: S.model,
    ios: store === "app-store",
    offset,
    u: S.W / 1320,
    placed,
    flats,
    screen: (id) => screenFile(id, store),
    /**
     * Render and place a handset showing capture `id`, its body centred on
     * (cx, cy) and `h` tall. A handset is never allowed within `margin` of the
     * image's edge: it is slid inwards, and made smaller only if it cannot fit.
     * `flat: true` (straight-on phones only) lays the capture on as a flat
     * layer after the page is drawn (see the file's head).
     */
    async phone({ id, cx, cy, h, rotation, fov, color, z = 20, extra = "", reflection, exposure, envIntensity, keyLight, margin, flat = false }) {
      const file = await displayFile(id, store);
      const m = margin ?? 60 * ctx.u;
      let height = h;
      let pl;
      let pair;
      for (let pass = 0; pass < 4; pass += 1) {
        const o = { model: S.model, color, rotation, fov, height, reflection, exposure, envIntensity, keyLight };
        pair = flat ? await phones.renderFlat(o) : { black: await phones.render({ ...o, screen: file }) };
        const p = pair.black;
        let x = cx;
        let y = cy;
        pl = placePhone(p, { cx: x, cy: y, z, extra });
        const b = pl.box;
        const { W: CW, H: CH } = ctx;
        const tooWide = b.w > CW - 2 * m;
        const tooTall = b.h > CH - 2 * m;
        if (tooWide || tooTall) {
          const k = Math.min((CW - 2 * m) / b.w, (CH - 2 * m) / b.h) * 0.995;
          height = Math.floor(height * k);
          continue;
        }
        if (b.x < m) x += m - b.x;
        if (b.r > CW - m) x -= b.r - (CW - m);
        if (b.y < m) y += m - b.y;
        if (b.b > CH - m) y -= b.b - (CH - m);
        if (x !== cx || y !== cy) pl = placePhone(p, { cx: x, cy: y, z, extra });
        break;
      }
      placed.push({ id, ...pl.box });
      if (flat) {
        /* The camera cut-out, in page px, for the cards' clearance check. */
        const c = pair.camera;
        if (c) {
          const k = pl.img.w / pair.black.width;
          pl.camera = { x: pl.img.left + c.x * k, y: pl.img.top + c.y * k, r: pl.img.left + c.r * k, b: pl.img.top + c.b * k };
        }
        /* The white twin is swapped in for page B. */
        pl.html = pl.html.replace('<img class="phone"', `<img class="phone" data-white="file://${pair.white.file}"`);
        flats.push({ id, file, quad: pl.quad });
      }
      return pl;
    },
  };
  return ctx;
}

function checkPlacement(shot, store, ctx) {
  const m = 24;
  for (const b of ctx.placed) {
    if (b.x < m || b.y < m || b.r > ctx.W - m || b.b > ctx.H - m) {
      problems.push(`${store} ${shotName(shot)}: handset ${b.id} is ${Math.round(Math.min(b.x, b.y, ctx.W - b.r, ctx.H - b.b))}px from an edge`);
    }
  }
}

/* ------------------------------------------------------------- drawing */

async function waitImages() {
  await tab.evaluate(async () => {
    await Promise.all([...document.images].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
  });
  await tab.waitForTimeout(120);
}

/**
 * Draw the page: shot A as laid out, and, when it holds flat phones, shot B
 * with each flat phone's white twin. Both are transparent PNGs at `res`.
 */
async function renderHtml(html, width, height, withB) {
  const file = join(TMP, "page.html");
  writeFileSync(file, html);
  await tab.setViewportSize({ width, height });
  await tab.goto(`file://${file}`, { waitUntil: "load" });
  await tab.waitForFunction(() => window.__fit === true, null, { timeout: 30000 });
  await waitImages();
  const a = await tab.screenshot({ type: "png", fullPage: false, omitBackground: true });
  let b = null;
  if (withB) {
    await tab.evaluate(() => {
      for (const im of document.querySelectorAll("img.phone[data-white]")) {
        im.dataset.black = im.src;
        im.src = im.dataset.white;
      }
    });
    await waitImages();
    b = await tab.screenshot({ type: "png", fullPage: false, omitBackground: true });
    await tab.evaluate(() => {
      for (const im of document.querySelectorAll("img.phone[data-black]")) im.src = im.dataset.black;
    });
    await waitImages();
  }
  return { a, b };
}

/**
 * The finished page at 1x, as raw RGB: A over the ground, brought down, and
 * each flat phone's capture laid on through B - A.
 */
async function finish({ a, b }, pageW, pageH, flats) {
  const w2 = pageW * RES;
  const h2 = pageH * RES;
  const A = await down(await overGround(a), w2, h2, pageW, pageH);
  if (!b || !flats.length) return A;
  const B = await down(await overGround(b), w2, h2, pageW, pageH);
  const out = Buffer.from(A);
  for (const f of flats) {
    const [tl, tr, br, bl] = f.quad;
    const x0 = (tl[0] + bl[0]) / 2;
    const y0 = (tl[1] + tr[1]) / 2;
    const dw = (tr[0] - tl[0] + br[0] - bl[0]) / 2;
    const dh = (bl[1] - tl[1] + br[1] - tr[1]) / 2;
    const fw = Math.round(dw);
    const fh = Math.round(dh);
    const fx = Math.round(x0 + (dw - fw) / 2);
    const fy = Math.round(y0 + (dh - fh) / 2);
    if (process.env.STORE_DEBUG) console.log(`  flat ${f.id}: display at ${fx},${fy} ${fw}x${fh} (exact ${x0.toFixed(2)},${y0.toFixed(2)} ${dw.toFixed(2)}x${dh.toFixed(2)})`);
    const F = await sharp(f.file).removeAlpha().toColourspace("srgb").resize(fw, fh, { kernel: "lanczos3", fit: "fill" }).raw().toBuffer();
    /* The display plus a 2 px margin: B - A is zero outside it anyway. */
    for (let y = Math.max(0, fy - 2); y < Math.min(pageH, fy + fh + 2); y += 1) {
      for (let x = Math.max(0, fx - 2); x < Math.min(pageW, fx + fw + 2); x += 1) {
        const i = (y * pageW + x) * 3;
        const sx = Math.min(fw - 1, Math.max(0, x - fx));
        const sy = Math.min(fh - 1, Math.max(0, y - fy));
        const j = (sy * fw + sx) * 3;
        for (let c = 0; c < 3; c += 1) {
          const d = B[i + c] - A[i + c];
          if (d <= 0) continue;
          out[i + c] = Math.max(0, Math.min(255, Math.round(A[i + c] + (F[j + c] / 255) * d)));
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------- checks */

/**
 * WCAG contrast of every headline line and subline against what is behind
 * it: the text is hidden, the page shot again over the ground, and each text
 * box compared with the worst 3% of the pixels under it.
 */
async function contrastCheck(min) {
  const items = await tab.evaluate(() => {
    const out = [];
    const halves = [...document.querySelectorAll(".half")];
    for (const el of document.querySelectorAll(".hl .ln, .hl .sub span")) {
      const r = el.getBoundingClientRect();
      const colors = [getComputedStyle(el).color];
      const half = halves.findIndex((h) => h.contains(el));
      out.push({ x: r.left, y: r.top, w: r.width, h: r.height, colors, half, text: el.textContent.trim().slice(0, 30) });
    }
    return out;
  });
  await tab.addStyleTag({ content: ".hl { visibility: hidden !important; }" });
  const shot = await tab.screenshot({ type: "png", omitBackground: true });
  const meta = await sharp(shot).metadata();
  const data = await overGround(shot);
  const info = { width: meta.width, height: meta.height };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const parse = (s) => {
    const n = s.match(/[\d.]+/g).map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  };
  const out = [];
  for (const it of items) {
    const x0 = Math.max(0, Math.floor(it.x * RES));
    const y0 = Math.max(0, Math.floor(it.y * RES));
    const x1 = Math.min(info.width, Math.ceil((it.x + it.w) * RES));
    const y1 = Math.min(info.height, Math.ceil((it.y + it.h) * RES));
    let worst = Infinity;
    for (const c of it.colors) {
      const [cr, cg, cb, ca] = parse(c);
      const ratios = [];
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * info.width + x) * 3;
          const br = data[i], bgc = data[i + 1], bb = data[i + 2];
          const lt = L(ca * cr + (1 - ca) * br, ca * cg + (1 - ca) * bgc, ca * cb + (1 - ca) * bb);
          const lb = L(br, bgc, bb);
          ratios.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05));
        }
      }
      ratios.sort((a, b) => a - b);
      const k = ratios[Math.floor(ratios.length * 0.03)] ?? Infinity;
      worst = Math.min(worst, k);
    }
    out.push({ ...it, ratio: worst });
  }
  return out.filter((o) => o.ratio < min);
}

/**
 * Every word, card, pill and sticker must sit at least `m` px inside its own
 * image (bridges across a seam are drawn outside the halves and exempt).
 */
async function edgeCheck(m) {
  return tab.evaluate((m) => {
    const out = [];
    const halves = [...document.querySelectorAll(".half")];
    halves.forEach((half, k) => {
      const hr = half.getBoundingClientRect();
      const els = [
        ...half.querySelectorAll(".st, .pop, .pill, .card, .abs:not(.g), .hl .ln, .hl .sub span, .ebpill, [data-chk]"),
      ];
      for (const el of els) {
        if (el.closest("[data-bleed]") && !el.hasAttribute("data-chk")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const d = Math.min(r.left - hr.left, hr.right - r.right, r.top - hr.top, hr.bottom - r.bottom);
        if (d < m) {
          const label = (el.className || el.tagName) + " " + (el.textContent || el.getAttribute("src") || "").trim().slice(0, 40);
          out.push({ half: k, d: Math.round(d), label });
        }
      }
    });
    return out;
  }, m);
}


/**
 * The clearance between each headline's two lines: line 1 alone and line 2
 * alone are shot as masks, and in every column the space from line 1's lowest
 * ink to line 2's highest ink within three columns either side is measured.
 * Returns the headlines whose tightest gap (page px) is under `min`.
 */
async function lineGapCheck(min) {
  const heads = await tab.evaluate(() => {
    const halves = [...document.querySelectorAll(".half")];
    return [...document.querySelectorAll(".hl")].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, n: el.querySelectorAll(".ln").length, half: halves.findIndex((h) => h.contains(el)), text: el.textContent.trim().slice(0, 40) };
    });
  });
  const mask = async (k) => {
    const tag = await tab.addStyleTag({ content: `#stage * { visibility: hidden !important; } #stage .hl .ln:nth-of-type(${k}), #stage .hl .ln:nth-of-type(${k}) * { visibility: visible !important; }` });
    const shot = await tab.screenshot({ type: "png", omitBackground: true });
    await tag.evaluate((n) => n.remove());
    const { data, info } = await sharp(shot).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  };
  const A = await mask(1);
  const B = await mask(2);
  const out = [];
  for (const hd of heads) {
    if (hd.n < 2) continue;
    const x0 = Math.max(0, Math.floor(hd.x * RES)), x1 = Math.min(A.w, Math.ceil((hd.x + hd.w) * RES));
    const y0 = Math.max(0, Math.floor(hd.y * RES)), y1 = Math.min(A.h, Math.ceil((hd.y + hd.h) * RES));
    const low = new Int32Array(x1 - x0).fill(-1);
    const high = new Int32Array(x1 - x0).fill(1e9);
    for (let x = x0; x < x1; x += 1) {
      for (let y = y0; y < y1; y += 1) {
        const i = y * A.w + x;
        if (A.data[i] > 64) low[x - x0] = y;
        if (B.data[i] > 64 && high[x - x0] === 1e9) high[x - x0] = y;
      }
    }
    let gap = Infinity;
    const r = 3 * RES;
    for (let x = 0; x < low.length; x += 1) {
      if (low[x] < 0) continue;
      for (let d = -r; d <= r; d += 1) {
        const xx = x + d;
        if (xx < 0 || xx >= high.length || high[xx] === 1e9) continue;
        gap = Math.min(gap, (high[xx] - low[x] - 1) / RES);
      }
    }
    if (process.env.STORE_DEBUG) console.log(`  line gap "${hd.text}": ${gap}`);
    if (gap < min) out.push({ ...hd, gap });
  }
  return out;
}

/* ------------------------------------------------------------- writing */

async function write(raw, pageW, pageH, file, { width, height, left = 0 }) {
  const img = sharp(raw, { raw: { width: pageW, height: pageH, channels: 3 } }).extract({ left, top: 0, width, height });
  mkdirSync(join(file, ".."), { recursive: true });
  if (PROOF && PROOF_EXT === "jpg") {
    await img.jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toFile(file);
    return;
  }
  /* 24-bit truecolour: in sharp, `effort` or `colours` would switch on palette mode. */
  await img.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toFile(file);
  const out = await sharp(file).metadata();
  if (out.width !== width || out.height !== height || out.hasAlpha || out.channels !== 3 || out.isPalette) {
    throw new Error(`${file}: ${out.width}x${out.height} channels=${out.channels} alpha=${out.hasAlpha} palette=${out.isPalette}`);
  }
  const size = statSync(file).size;
  if (size > 8 * 1024 * 1024) problems.push(`${file} is ${(size / 1048576).toFixed(1)} MB, over Play's 8 MB`);
}

const outFile = (store, shot) =>
  PROOF ? join(PROOF, store, `${shotName(shot)}.${PROOF_EXT}`) : join(OUT, store, `${shotName(shot)}.png`);

/* ------------------------------------------------------------- the run */

const made = [];
const t0 = performance.now();
for (const store of STORE_LIST) {
  const S = STORES[store];
  if (FEATURE_ONLY) break;
  for (let i = 0; i < SHOTS.length; i += 1) {
    const shot = SHOTS[i];
    if (shot.pairedFrom) continue; /* drawn with its partner */
    const partner = shot.pairWith ? SHOTS.find((s) => s.n === shot.pairWith) : null;
    const wanted = !ONLY || ONLY.includes(shot.n) || (partner && ONLY.includes(partner.n));
    if (!wanted) continue;
    const t = performance.now();
    try {
      const halves = partner ? [shot, partner] : [shot];
      const pageW = S.W * halves.length;
      const parts = [];
      const ctxs = [];
      /* A pair shares one phone drawn across its seam: laid out first, on a
         context as wide as both images, so each half can place its words
         (and the one pop-up) around it. */
      let shared = null;
      const sargs = { W: S.W, H: S.H, pageW, store, u: S.W / 1320, ios: store === "app-store" };
      let pc = null;
      if (partner && shot.shared) {
        pc = makeCtx(shot, store, 0);
        pc.W = pageW;
        shared = await shot.shared({ ...sargs, pc });
      }
      for (let k = 0; k < halves.length; k += 1) {
        const ctx = makeCtx(halves[k], store, k * S.W);
        ctx.shared = shared;
        ctxs.push(ctx);
        const body = await halves[k].layout(ctx);
        parts.push(`<div class="half" style="left:${k * S.W}px;width:${S.W}px;height:${S.H}px">${body}</div>`);
      }
      if (shared) parts.push(shared.html);
      /* Flat phones, in page coordinates (a half's own are offset by its left edge). */
      const flats = [];
      ctxs.forEach((c, k) => c.flats.forEach((f) => flats.push({ ...f, quad: f.quad.map(([x, y]) => [x + k * S.W, y]) })));
      if (pc) flats.push(...pc.flats);
      const html = page({ width: pageW, height: S.H, body: parts.join("\n") });
      const shots = await renderHtml(html, pageW, S.H, flats.length > 0);
      const raw = await finish(shots, pageW, S.H, flats);
      /* A card set from its right edge must stay clear of what it leaves
         uncovered (a layout's `cardCheck.clearOf`, the x its left edge keeps to). */
      const pops = await tab.evaluate(() => [...document.querySelectorAll(".half")].map((h) => {
        const hr = h.getBoundingClientRect();
        return [...h.querySelectorAll(".pop, .co[data-card]")].map((el) => { const r = el.getBoundingClientRect(); return { l: r.left - hr.left, r: r.right - hr.left, t: r.top, b: r.bottom }; });
      }));
      ctxs.forEach((c, k) => {
        if (!c.cardCheck) return;
        if (c.cardCheck.minCornerOverlap !== undefined && !(c.cornerOverlap >= c.cardCheck.minCornerOverlap)) problems.push(`${store} ${shotName(halves[k])}: the card's corner overlaps the rim by ${c.cornerOverlap?.toFixed(1)} px (at least ${c.cardCheck.minCornerOverlap})`);
        for (const pr of pops[k] || []) {
          /* at least 20 px from the camera and from every control it leaves uncovered */
          for (const a of c.cardCheck.avoid || []) {
            const dx = Math.max(a.x - pr.r, pr.l - a.r, 0);
            const dy = Math.max(a.y - pr.b, pr.t - a.b, 0);
            const d = Math.hypot(dx, dy);
            if (process.env.STORE_DEBUG) console.log(`  ${shotName(halves[k])} card to ${a.label}: ${d.toFixed(1)} px`);
            if (d < 20) problems.push(`${store} ${shotName(halves[k])}: the card is ${Math.round(d)} px from ${a.label} (at least 20)`);
          }
          if (c.cardCheck.rightOf !== undefined && pr.r > c.cardCheck.rightOf) problems.push(`${store} ${shotName(halves[k])}: the card's right edge (${Math.round(pr.r)}) runs over what it should leave clear (${Math.round(c.cardCheck.rightOf)})`);
          if (c.cardCheck.clearOf !== undefined && pr.l < c.cardCheck.clearOf) problems.push(`${store} ${shotName(halves[k])}: the card's left edge (${Math.round(pr.l)}) runs over what it should leave clear (${Math.round(c.cardCheck.clearOf)})`);
        }
      });
      for (const v of await edgeCheck(40 * (S.W / 1320))) {
        problems.push(`${store} ${shotName(halves[v.half])}: ${v.label.replace(/\s+/g, " ")} is ${v.d}px from the edge`);
      }
      /* One type size across the set: a headline the page had to shrink to
         fit its measure is a headline that is too long. */
      for (const v of await tab.evaluate(() => [...document.querySelectorAll(".hl")].filter((el) => el.dataset.fit && +el.dataset.fit !== +el.dataset.size).map((el) => ({ text: el.textContent.trim().slice(0, 40), fit: el.dataset.fit, size: el.dataset.size })))) {
        problems.push(`${store} ${halves.map(shotName).join("+")}: headline "${v.text}" shrunk from ${v.size} to ${v.fit} px to fit`);
      }
      /* 16 px between the lines on the App Store, 14 on Play */
      for (const v of await lineGapCheck(store === "app-store" ? 16 : 14)) {
        problems.push(`${store} ${shotName(halves[Math.max(0, v.half)])}: headline "${v.text}" has ${v.gap.toFixed(1)} px between its lines`);
      }
      for (const v of await contrastCheck(4.5)) {
        problems.push(`${store} ${shotName(halves[Math.max(0, v.half)])}: "${v.text}" contrast ${v.ratio.toFixed(2)}:1`);
      }
      for (let k = 0; k < halves.length; k += 1) {
        await write(raw, pageW, S.H, outFile(store, halves[k]), { width: S.W, height: S.H, left: k * S.W });
        checkPlacement(halves[k], store, ctxs[k]);
        made.push(`${store}/${shotName(halves[k])}`);
      }
      console.log(`${store} ${halves.map(shotName).join(" + ")}  ${((performance.now() - t) / 1000).toFixed(1)}s`);
    } catch (e) {
      problems.push(`${store} ${shotName(shot)}: ${e.message}`);
      console.log(`FAIL ${store} ${shotName(shot)}: ${e.stack}`);
    }
  }
}

if (WITH_FEATURE && FEATURE) {
  const W = 1024;
  const H = 500;
  const ctx = makeCtx({ n: 0 }, "google-play", 0);
  ctx.W = W;
  ctx.H = H;
  ctx.u = 0.5;
  const body = await FEATURE(ctx);
  const shots = await renderHtml(page({ width: W, height: H, body }), W, H, ctx.flats.length > 0);
  const raw = await finish(shots, W, H, ctx.flats);
  const file = PROOF ? join(PROOF, `feature-graphic.${PROOF_EXT}`) : join(OUT, "google-play", "feature-graphic.png");
  await write(raw, W, H, file, { width: W, height: H });
  made.push("google-play/feature-graphic");
}

await browser.close();
await phones.close();
rmSync(TMP, { recursive: true, force: true });
console.log(`\nmade ${made.length} in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exitCode = 1;
}
