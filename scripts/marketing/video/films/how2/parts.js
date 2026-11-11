/**
 * VIDEO ONE (the 2026-11 cut), ITS OWN PARTS.
 *
 * Two helpers the kit does not have:
 *
 *  - `standingHeadline`: the opening frame's headline. `headline()` builds its
 *    words with GSAP tweens that start at t0, and a tween cannot start before
 *    t = 0 without shifting the whole timeline, so a headline that must
 *    ALREADY be standing on the first frame (the still a chat shows before
 *    anyone presses play) cannot be made with it. This one is a pure
 *    function of t: every word is up at t = 0, and they rise away on t1.
 *
 *  - `examplePill`: the small "Example" tag a card carries when it shows a
 *    listing, a stay or a table (DESIGN.md section 2).
 *
 * Everything here is a pure function of t (BUILDING.md, "Determinism").
 */
import { ramp, opa } from "../kit.js";

export { placeBack } from "../listing/parts.js";

/**
 * Lines of [text, key] parts, all standing at t = 0, leaving on t1.
 * `keyStyle: "chip"` boxes the key word in the blueprint's rounded rule.
 */
export function standingHeadline(ctx, parent, { lines, x, y, size = 108, t1, weight = 700, align = "left", lineGap = 1.04, stagger = 0.05, key = "#8FD3FF" }) {
  const box = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: align === "center" ? "0px" : "auto" } }, parent);
  const items = [];
  lines.forEach((parts, li) => {
    const row = ctx.el("div", {
      class: "abs display",
      style: { left: align === "center" ? "50%" : "0px", top: `${(li * size * lineGap).toFixed(1)}px`, whiteSpace: "nowrap", fontSize: `${size}px`, fontWeight: String(weight), color: "#ffffff", transform: align === "center" ? "translateX(-50%)" : "none" },
    }, box);
    for (const [text, isKey] of parts) {
      text.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { ctx.el("span", { text: " ", style: { display: "inline-block" } }, row); return; }
        const mask = ctx.el("span", { style: { display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: `${size * 0.14}px`, marginBottom: `${-size * 0.14}px` } }, row);
        const inner = ctx.el("span", {
          text: tok,
          class: "display",
          style: { display: "inline-block", position: "relative", fontSize: "inherit", fontWeight: "inherit", color: isKey ? "#ffffff" : "inherit", willChange: "transform" },
        }, mask);
        if (isKey) {
          Object.assign(inner.style, {
            padding: `${(size * 0.02).toFixed(1)}px ${(size * 0.2).toFixed(1)}px ${(size * 0.08).toFixed(1)}px`,
            borderRadius: `${(size * 0.3).toFixed(1)}px`, background: "#04071C", boxShadow: `inset 0 0 0 ${(size * 0.062).toFixed(1)}px ${key}`,
          });
        }
        items.push({ mask, inner });
      });
    }
  });
  ctx.onFrame((t) => {
    items.forEach(({ mask, inner }, i) => {
      const u = ramp(ctx, t, t1 + i * stagger * 0.4, t1 + i * stagger * 0.4 + 0.42, "power3.in");
      inner.style.transform = `translateY(${(-118 * u).toFixed(2)}%) rotate(${(-3 * u).toFixed(2)}deg)`;
      mask.style.visibility = u >= 0.999 ? "hidden" : "inherit";
    });
  });
  return box;
}

/** A small "Example" tag (info glyph and the word), in at t0, out at t1. */
export function examplePill(ctx, parent, { x, y, t0, t1, size = 30, label = "Example" }) {
  const el = ctx.el("div", {
    class: "abs",
    style: {
      left: "0px", top: "0px", display: "inline-flex", alignItems: "center", gap: `${size * 0.3}px`, padding: `${size * 0.28}px ${size * 0.7}px`,
      borderRadius: "999px", border: "1.5px solid rgb(255 255 255 / 0.28)", background: "rgb(1 1 24 / 0.72)", whiteSpace: "nowrap", visibility: "hidden",
      font: `600 ${size}px/1 Inter, sans-serif`, color: "#E8EFFF",
    },
  }, parent);
  const ic = ctx.icon("info", { size: Math.round(size * 1.05), stroke: 2.2 }, el);
  ic.style.color = "#E8EFFF";
  ctx.el("span", { text: label }, el);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.4, "back.out(1.5)");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.35, "power2.in");
    const o = Math.min(a, 1 - b);
    el.style.visibility = o > 0.001 ? "inherit" : "hidden";
    el.style.opacity = opa(o);
    el.style.transform = `translate(${x}px, ${y + (1 - a) * 14}px) translate(-50%, -50%)`;
  });
  return el;
}
