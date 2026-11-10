/**
 * WHERE THE POP-OUTS GO.
 *
 * callouts.mjs draws the containers; this places them against the handset.
 * A shot asks for furniture in its own terms and this works out the pixels,
 * for both stores, from the placed phone:
 *
 *   pops:    [{ side: "left"|"right", at: 0.34, kind: "stat", ... }]
 *            `at` is where the card's top sits down the phone's body (0 at the
 *            top of the frame, 1 at the bottom). A card on the left starts at
 *            the image's side margin less 18 px and runs across the phone's
 *            rim; the blueprint's cards sit ON the device, not beside it.
 *   props:   [{ name: "keys", x: 0.06, y: 0.84, size: 250, rot: -8 }]
 *            x and y are fractions of the image. `x` is the left edge, or give
 *            `rx` for the right edge's distance from the right of the image.
 *   figures: [{ text: "₦26,100,000", x|rx, y, size, rot }]
 *            the oversized outlined number.
 *   mags:    [{ box: [x0, y0, x1, y1], scale, dx, dy, rotate }]
 *            THE BLUEPRINT'S OWN MOVE: one component of the app, lifted off
 *            the glass, blown up, given the heavy rule and dropped back over
 *            the place it came from. `box` is in the capture's display pixels
 *            (1320 x 2868) and must sit on the component's own edges, so
 *            nothing is ever cut. `dx`/`dy` nudge it off its own place, in
 *            page pixels, so it overlaps its neighbours as the blueprint's
 *            does.
 *   badges:  [{ name: "keys", kind: "object"|"glyph"|"mark", x|rx, y, size, rot, tone }]
 *            the round discs the blueprint scatters around the handset. Two
 *            to four, small (120 to 170), at the edges, one of them `tone:
 *            "paper"` at most.
 *
 * Every part is checked by compose.mjs: 40 px from the image's edge, and a
 * card set against the phone must not land on the camera or on a control it
 * leaves uncovered.
 *
 * COPY. DESIGN.md section 2 holds here as everywhere: no invented numbers,
 * no testimonials, no promise words, "verified" only about people. Every
 * figure a callout prints must be one the screen under it prints too.
 */
import { statCallout, lineCallout, cellsCallout, countersCallout, figureOutline, prop, badge, stagePanel, magnify } from "./callouts.mjs";

const KIND = { stat: statCallout, line: lineCallout, cells: cellsCallout, counters: countersCallout };

/** The props the brand's 3D set may be drawn at: never over about 260 px on a 1080 canvas. */
const MAX_PROP = 260;

/**
 * Lay a shot's furniture over a placed phone.
 *   m   the grid (premium.mjs M)
 *   p   the placed phone
 */
export function furnish(ctx, m, p, { pops = [], props = [], figures = [], badges = [], mags = [] } = {}) {
  const u = ctx.W / 1320;
  const s = m.card;
  const out = [];

  /* the magnified components go under the designed cards */
  for (const q of mags) {
    const { box, scale = 1.18, dx = 0, dy = 0, rotate = 0, z = 31, width, radius } = q;
    if (!p.displayUrl) throw new Error("magnify needs a flat handset");
    out.push(magnify({
      display: p.displayUrl, at: p.at, box, scale, dx: dx * u, dy: dy * u, rotate, z,
      width: (width ?? 9) * u, radius: (radius ?? 34) * u,
    }));
  }

  for (const q of pops) {
    const { side = "left", at = 0.3, y: yf, kind = "line", w, fit = true, z = 30, scale, inset = 18, ...rest } = q;
    const draw = KIND[kind];
    if (!draw) throw new Error(`no such callout: ${kind}`);
    /* `y`, a fraction of the image, overrides `at`, a fraction of the handset. */
    const y = yf !== undefined ? yf * ctx.H : m.phoneTop + at * m.phoneH;
    const edge = m.side - inset;
    const box = side === "left" ? { x: edge } : { right: edge };
    out.push(draw({ ...box, y, w: w ? w * u : undefined, fit: w ? false : fit, scale: scale ?? s, z, ...rest }));
  }

  for (const q of props) {
    const { name, x, rx, y, size = 220, rot = 0, z = 34, glow = true, flip = false } = q;
    const d = Math.min(size, MAX_PROP) * u * 1.18;
    const box = rx !== undefined ? { right: rx * ctx.W } : { x: x * ctx.W };
    out.push(prop({ name, ...box, y: y * ctx.H, size: d, rotate: rot, z, glow, flip }));
  }

  for (const q of figures) {
    const { text, x, rx, y, size = 150, rot = -3, z = 26, color, stroke, align } = q;
    const box = rx !== undefined ? { right: rx * ctx.W } : { x: x * ctx.W };
    out.push(figureOutline({ text, ...box, y: y * ctx.H, size, scale: u, rotate: rot, z, color, stroke, align }));
  }

  for (const q of badges) {
    const { name, kind = "object", x, rx, y, size = 150, rot = 0, z = 33, tone = "navy" } = q;
    const box = rx !== undefined ? { right: rx * ctx.W } : { x: x * ctx.W };
    out.push(badge({ name, kind, ...box, y: y * ctx.H, size, rot, z, tone, scale: u }));
  }

  return out.join("\n");
}

/** The soft panel the handset stands on (callouts.mjs `stagePanel`). */
export function panelFor(ctx, m) {
  const u = ctx.W / 1320;
  return stagePanel({ W: ctx.W, H: ctx.H, inset: Math.round(52 * u), radius: Math.round(96 * u), top: Math.round(m.hlTop * 0.0) });
}
