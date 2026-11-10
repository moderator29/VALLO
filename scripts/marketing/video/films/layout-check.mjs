/**
 * Walks a film second by second and reports the layout faults a viewer sees:
 * text cut with an ellipsis, a card or label hanging off the frame, two
 * labels sitting on top of each other, and a pop-up whose body is clipped by
 * its own box.
 *
 *   node films/layout-check.mjs <how|vision> <mobile|desktop> [step] > faults.json
 *
 * It reads the page the renderer reads, so what it measures is what renders.
 */
import { chromium } from "playwright-core";
import { startServer } from "../engine/server.mjs";

const [proj, film, stepArg] = process.argv.slice(2);
const step = Number(stepArg ?? 0.5);

const { server, url } = await startServer();
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--font-render-hinting=none", "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: film === "desktop" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } });
await page.goto(`${url}/film.html?proj=${proj}&film=${film}&ending=live`, { timeout: 120_000 });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300_000, polling: 200 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error(err); await browser.close(); server.close(); process.exit(1); }
const duration = await page.evaluate(() => window.__film.duration);

/* Measured in the page: one sweep of the DOM at the current time. */
const SWEEP = () => {
  const W = window.innerWidth, H = window.innerHeight;
  const seen = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.35) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.visibility === "hidden" || ps.display === "none" || Number(ps.opacity) < 0.35) return false;
    }
    return true;
  };
  const faults = [];
  const label = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70);

  /* 1. text cut with an ellipsis, and text overflowing its own box */
  for (const el of document.querySelectorAll("div, span, p")) {
    if (el.children.length || !el.textContent?.trim() || !seen(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 10) continue;
    if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) faults.push({ kind: "ellipsis", text: label(el), w: Math.round(r.width) });
    else if (s.overflow === "hidden" && el.scrollHeight > el.clientHeight + 2) faults.push({ kind: "clipped-box", text: label(el), lost: el.scrollHeight - el.clientHeight });
  }

  /* 2. furniture hanging off the frame, and 3. furniture overlapping furniture.
     "Furniture" is what the film draws over the scene: pills, glass cards,
     pop-ups, number cards, captions. Not the phone, not the wall behind. */
  const furniture = [];
  for (const el of document.querySelectorAll(".popup, .glass-dark, .glass-light, [data-furn]")) {
    if (!seen(el)) continue;
    if (el.closest(".phone-screen, .wall, [data-wall]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 30 || r.height < 16) continue;
    furniture.push({ el, r, text: label(el), caption: !!el.closest(".captions, #captions") });
  }
  /* the rounded pills the kit draws (kicker, chipRow) carry no class, so take
     absolutely-placed leaf-ish boxes with a pill radius and a border */
  for (const el of document.querySelectorAll("div")) {
    if (!seen(el)) continue;
    const s = getComputedStyle(el);
    if (!s.borderRadius.startsWith("999") && s.borderRadius !== "9999px") continue;
    if (!el.textContent?.trim()) continue;
    if (el.closest(".phone-screen, .wall, [data-wall]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20 || r.height > 220) continue;
    furniture.push({ el, r, text: label(el), caption: !!el.closest(".captions, #captions") });
  }
  const PAD = 8;
  for (const f of furniture) {
    const out = [];
    if (f.r.left < -PAD) out.push("left");
    if (f.r.top < -PAD) out.push("top");
    if (f.r.right > W + PAD) out.push("right");
    if (f.r.bottom > H + PAD) out.push("bottom");
    if (out.length) faults.push({ kind: "off-frame", text: f.text, edges: out.join("+"), box: [Math.round(f.r.left), Math.round(f.r.top), Math.round(f.r.width), Math.round(f.r.height)] });
  }
  for (let i = 0; i < furniture.length; i += 1) {
    for (let j = i + 1; j < furniture.length; j += 1) {
      const a = furniture[i].r, b = furniture[j].r;
      if (furniture[i].caption && furniture[j].caption) continue;
      /* a card and its own buttons are not two things colliding */
      const ea = furniture[i].el, eb = furniture[j].el;
      if (ea.contains(eb) || eb.contains(ea)) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox <= 2 || oy <= 2) continue;
      const share = (ox * oy) / Math.min(a.width * a.height, b.width * b.height);
      if (share > 0.18) faults.push({ kind: "overlap", a: furniture[i].text, b: furniture[j].text, share: +share.toFixed(2) });
    }
  }
  return faults;
};

const out = [];
for (let t = 0; t <= duration; t += step) {
  await page.evaluate((time) => window.__film.seek(time), +t.toFixed(3));
  const faults = await page.evaluate(SWEEP);
  for (const f of faults) out.push({ t: +t.toFixed(2), ...f });
}
await browser.close();
server.close();

/* Collapse a fault that persists over many frames into one run. */
const key = (f) => `${f.kind}|${f.text ?? ""}|${f.a ?? ""}|${f.b ?? ""}|${f.edges ?? ""}`;
const runs = new Map();
for (const f of out) {
  const k = key(f);
  const prev = runs.get(k);
  if (prev && f.t - prev.last <= step * 2.5) { prev.last = f.t; prev.n += 1; continue; }
  runs.set(k, { ...f, first: f.t, last: f.t, n: 1, k });
  if (prev) (runs.done ??= []).push(prev);
}
const list = [...runs.values()].concat(runs.done ?? []).filter((r) => r.kind).sort((a, b) => a.first - b.first);
console.log(JSON.stringify({ proj, film, duration, step, faults: list.map(({ k, t, ...r }) => r) }, null, 1));
