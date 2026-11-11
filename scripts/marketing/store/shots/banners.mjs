/**
 * The App Store product page's two banner assets (App Store Connect, Product
 * Page Information, "Header and Search Results"), on the same night ground and
 * in the same language as the screenshots:
 *
 *   HEADER   21:9, 3840 x 1646  (Apple's creative assets specification)
 *   SEARCH   3:2,  3840 x 2560  (1920 x 1280 to 3840 x 2560 is accepted)
 *
 * Apple's advice: a single clear idea, key artwork in the centre of the
 * composition (the edges are cropped on some devices), a short phrase that
 * enhances the picture, and no prices, web addresses, other platforms' logos
 * or unearned claims. So: no ₦ figures anywhere (the three screens shown carry
 * none), no vallospaces.com, no store badges.
 */
import { lineCallout } from "../callouts.mjs";
import { brandUrl } from "../lib.mjs";

const PHONE_COLOR = "black-titanium";
const WORD = (x, y, size, text, extra = "") =>
  `<div class="abs" style="left:${x}px;top:${y}px;font:600 ${size}px/1.04 Poppins;letter-spacing:-0.03em;color:#fff;white-space:nowrap;z-index:40;${extra}">${text}</div>`;
const SUB = (x, y, size, text, extra = "") =>
  `<div class="abs" style="left:${x}px;top:${y}px;font:500 ${size}px/1.3 Inter;letter-spacing:-0.005em;color:rgb(255 255 255 / 0.62);white-space:nowrap;z-index:40;${extra}">${text}</div>`;
const KEY = (t) => `<span style="color:#8FD3FF">${t}</span>`;

/* 21:9. A fan of three phones in the middle; the idea on the left, three small cards on the right. */
export async function HEADER(ctx) {
  const { W, H } = ctx;
  const mid = await ctx.phone({ id: "v3-home", cx: W * 0.5, cy: H * 0.53, h: H * 0.90, rotation: { x: 0, y: 0, z: 0 }, fov: 20, color: PHONE_COLOR, margin: 8, z: 22 });
  const left = await ctx.phone({ id: "v3-circle", cx: W * 0.5 - 600, cy: H * 0.58, h: H * 0.68, rotation: { x: -4, y: 24, z: 5 }, fov: 22, color: PHONE_COLOR, margin: 8, z: 20 });
  const right = await ctx.phone({ id: "v3-stays", cx: W * 0.5 + 600, cy: H * 0.58, h: H * 0.68, rotation: { x: -4, y: -24, z: -5 }, fov: 22, color: PHONE_COLOR, margin: 8, z: 21 });
  const s = 1.5;
  const cards = [
    lineCallout({ x: W * 0.755, y: H * 0.17, fit: true, scale: s, z: 50, lucide: "receipt", title: "Every fee, added up", line: "Before you call anyone", meta: null }),
    lineCallout({ x: W * 0.785, y: H * 0.44, fit: true, scale: s, z: 50, lucide: "users", title: "Vallo Circle", line: "Ask, share and learn", meta: null }),
    lineCallout({ x: W * 0.755, y: H * 0.71, fit: true, scale: s, z: 50, lucide: "bed-double", title: "Stays and tables", line: "Book in a few taps", meta: null }),
  ].join("\n");
  return [
    `<img class="abs" src="${brandUrl("vallo-wordmark.png")}" style="left:${W * 0.05}px;top:${H * 0.26}px;width:${W * 0.1}px;z-index:40">`,
    WORD(W * 0.05, H * 0.39, 142, `Real estate,<br>${KEY("done right.")}`),
    SUB(W * 0.05, H * 0.70, 52, "Homes, stays, tables and people."),
    left.html, right.html, mid.html, cards,
  ].join("\n");
}

/* 3:2. State the obvious: the name, the idea, one big phone with two cards. */
export async function SEARCH(ctx) {
  const { W, H } = ctx;
  const phone = await ctx.phone({ id: "v3-home", cx: W * 0.5, cy: H * 0.695, h: H * 0.65, rotation: { x: 0, y: 0, z: 0 }, fov: 20, color: PHONE_COLOR, margin: 8, z: 22 });
  const side = await ctx.phone({ id: "v3-circle", cx: W * 0.5 - 700, cy: H * 0.755, h: H * 0.51, rotation: { x: -4, y: 24, z: 5 }, fov: 22, color: PHONE_COLOR, margin: 8, z: 20 });
  const side2 = await ctx.phone({ id: "v3-stays", cx: W * 0.5 + 700, cy: H * 0.755, h: H * 0.51, rotation: { x: -4, y: -24, z: -5 }, fov: 22, color: PHONE_COLOR, margin: 8, z: 21 });
  const s = 1.75;
  return [
    `<img class="abs" src="${brandUrl("vallo-wordmark.png")}" style="left:${W / 2 - W * 0.06}px;top:${H * 0.055}px;width:${W * 0.12}px;z-index:40">`,
    `<div class="abs" style="left:0;width:${W}px;top:${H * 0.15}px;text-align:center;font:600 190px/1.04 Poppins;letter-spacing:-0.03em;color:#fff;z-index:40">Homes, stays and<br>tables, ${KEY("in one app")}</div>`,
    side.html, side2.html, phone.html,
    lineCallout({ x: W * 0.05, y: H * 0.79, fit: true, scale: s, z: 50, lucide: "receipt", title: "Every fee, added up", line: "Before you call anyone", meta: null }),
    lineCallout({ right: W * 0.05, y: H * 0.86, fit: true, scale: s, z: 50, lucide: "users", title: "Vallo Circle", line: "Ask, share and learn", meta: null }),
  ].join("\n");
}

/* Google Play's feature graphic, 1024 x 500: the same three-phone fan as the App Store header, smaller, with the idea on the left. */
export async function PLAY(ctx) {
  const { W, H } = ctx;
  const mid = await ctx.phone({ id: "v3-home", cx: W * 0.64, cy: H * 0.54, h: H * 0.98, rotation: { x: 0, y: 0, z: 0 }, fov: 20, color: PHONE_COLOR, margin: 4, z: 22 });
  const left = await ctx.phone({ id: "v3-circle", cx: W * 0.64 - 168, cy: H * 0.60, h: H * 0.74, rotation: { x: -4, y: 24, z: 5 }, fov: 22, color: PHONE_COLOR, margin: 4, z: 20 });
  const right = await ctx.phone({ id: "v3-stays", cx: W * 0.64 + 168, cy: H * 0.60, h: H * 0.74, rotation: { x: -4, y: -24, z: -5 }, fov: 22, color: PHONE_COLOR, margin: 4, z: 21 });
  return [
    `<img class="abs" src="${brandUrl("vallo-wordmark.png")}" style="left:44px;top:132px;width:150px;z-index:40">`,
    WORD(44, 196, 58, `Real estate,<br>${KEY("done right.")}`),
    SUB(44, 340, 21, "Homes, stays, tables and people."),
    left.html, right.html, mid.html,
  ].join("\n");
}
