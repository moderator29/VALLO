/**
 * The HTML document every store image is drawn in: the fonts, the shared
 * styles of the parts in components.mjs, and the one script that sets each
 * headline on its measure.
 *
 * The page itself is transparent: compose.mjs lays it over the night ground
 * (one raster, the same in every image) after Chromium has drawn it.
 */
import { fontCss } from "./lib.mjs";
import { CALLOUT_CSS } from "./callouts.mjs";

const BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: transparent; overflow: hidden; }
  body { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; font-family: "Inter", sans-serif; }
  #stage { position: relative; overflow: hidden; }
  .half { position: absolute; top: 0; overflow: hidden; }
  .g, .hl, .pop, .phone, .abs { position: absolute; }
  .phone { display: block; }
  img { display: block; }

  /* headline (DESIGN.md section 6a) */
  .hl h1 { font-family: "Poppins", sans-serif; letter-spacing: -0.03em; font-feature-settings: "kern" 1; }
  .hl .ln { display: inline; white-space: nowrap; position: relative; }
  .hl .sub { font-family: "Inter", sans-serif; font-weight: 500; line-height: 1.3; letter-spacing: -0.005em; white-space: nowrap; }
  .hl .sub span { position: relative; }
  /* the marked word in a rounded box (the blueprint's way, 16 October) */
  .hl .kw.chip { display: inline-block; padding: 0.02em 0.20em 0.08em; margin: 0 0.03em; border-radius: 0.28em;
    background: #04071C; box-shadow: inset 0 0 0 0.062em #8FD3FF; color: #FFFFFF; }

  /* pop-up card (DESIGN.md section 4): opaque navy, so nothing on the screen shows through it */
  .pop { display: flex; align-items: center; font-family: "Inter", sans-serif; }
  .pop.dk { color: #FFFFFF;
    background: linear-gradient(180deg, rgb(22 31 92) 0%, rgb(12 18 66) 100%);
    box-shadow: inset 0 0 0 1.5px rgb(120 170 255 / 0.35), 0 26px 40px -18px rgb(0 0 12 / 0.85), 0 10px 22px -10px rgb(0 0 20 / 0.6); }
  .pchip { flex: none; border-radius: 50%; display: grid; place-items: center; }
  .pop .pchip.solid { background: linear-gradient(160deg, #4A95FF 0%, #0069FE 55%, #0050C8 100%); box-shadow: inset 0 2px 0 rgb(255 255 255 / 0.3); }
  .ptxt { flex: 1; min-width: 0; }
  .ptop { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
  .pright { display: inline-flex; align-items: center; flex: none; }
  .ptitle { font-weight: 700; letter-spacing: -0.012em; white-space: nowrap; }
  .pline { font-weight: 500; margin-top: 8px; white-space: nowrap; letter-spacing: -0.004em; color: rgb(208 222 255 / 0.84); }
  .pline2 { font-weight: 500; margin-top: 6px; white-space: nowrap; letter-spacing: -0.002em; color: rgb(190 206 245 / 0.66); }
  .pamt { font-weight: 700; margin-top: 10px; letter-spacing: -0.015em; color: #FFFFFF; }
  .pmeta { font-weight: 500; white-space: nowrap; color: rgb(200 214 250 / 0.78); }

  /* the Example chip, as the product draws it */
  .ex { display: inline-flex; align-items: center; border-radius: 999px; font-family: "Inter", sans-serif; font-weight: 600; line-height: 1; white-space: nowrap; letter-spacing: 0.005em; }
  .ex.dk { background: rgb(1 1 24 / 0.50); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.26); color: #E8EFFF; }
${CALLOUT_CSS}`;

/*
 * Each headline is set on its ink, not on its type box: a line's box carries
 * its first letter's side bearing and the tracking after its last letter, so
 * a box-centred line sits a few pixels off. The ink of every line (and
 * subline) is measured on a canvas in the same font, size and tracking, and
 * the line is moved so its ink is centred on the headline's centre, or starts
 * exactly at its left edge. A line that would overrun the measure shrinks the
 * whole headline (compose.mjs reports that as a fault).
 */
const FIT = `
  (() => {
    const cv = document.createElement('canvas').getContext('2d');
    const ink = (el) => {
      const cs = getComputedStyle(el);
      cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      cv.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      cv.fontKerning = 'normal';
      const m = cv.measureText(el.textContent);
      const r = el.getBoundingClientRect();
      return { l: r.left - m.actualBoundingBoxLeft, r: r.left + m.actualBoundingBoxRight, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight };
    };
    for (const el of document.querySelectorAll('.hl')) {
      const h1 = el.querySelector('h1');
      const max = +el.dataset.max;
      let size = +el.dataset.size;
      const min = size * 0.9;
      const lines = [...h1.querySelectorAll('.ln')];
      const widest = () => Math.max(...lines.map((s) => ink(s).w));
      while (widest() > max && size > min) { size -= 1; h1.style.fontSize = size + 'px'; }
      el.dataset.fit = String(size);
      const box = el.getBoundingClientRect();
      const centre = box.left + box.width / 2;
      const subs = [...el.querySelectorAll('.sub span')];
      for (const s of [...lines, ...subs]) {
        const k = ink(s);
        const dx = el.dataset.align === 'left' ? box.left - k.l : centre - (k.l + k.r) / 2;
        s.style.left = dx + 'px';
      }
    }
  })();
`;

/** One page: `width` x `height` CSS pixels holding `body`. */
export function page({ width, height, body, css = "" }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}${BASE}${css}
  #stage { width: ${width}px; height: ${height}px; }
  html, body { width: ${width}px; height: ${height}px; }
  </style></head><body><div id="stage">${body}</div><script>document.fonts.ready.then(() => { ${FIT}; window.__fit = true; });</script></body></html>`;
}
