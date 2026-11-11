/**
 * The parts only the new Video Two draws: the opening frame's words, the
 * rolling move-in total, and the four discs that fly into the end card.
 * Every value is a pure function of t.
 */
import { ramp, place, opa, mix, odometer } from "../kit.js";
import { badgeDisc } from "../kit.js";

/**
 * THE OPENING FRAME. Composed and still at t = 0 (the still a chat shows
 * before anyone presses play): the Vallo mark, and the film's first line
 * set in three rows. Nothing rises in: it is simply there, then, when the
 * voice reaches "moving", the key word's box closes round it, and the whole
 * thing lifts away on `t1`.
 */
export function openerWords(ctx, parent, { x = 60, y = 420, size = 112, tKey, t1 }) {
  const box = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px` } }, parent);
  const mark = ctx.img(ctx.src.brand("vallo-mark.png"), { class: "abs", style: { left: "0px", top: `${-size * 1.5}px`, width: `${size * 0.78}px`, height: `${size * 0.78}px`, objectFit: "contain" } }, box);
  const rows = [["Real estate", false], ["in Nigeria", false], ["is moving.", true]].map(([text, key], i) => {
    const row = ctx.el("div", { class: "abs display", style: { left: "0px", top: `${i * size * 1.04}px`, whiteSpace: "nowrap", fontSize: `${size}px`, fontWeight: "700", color: "#fff" } }, box);
    const inner = ctx.el("span", { text, style: key ? { position: "relative", display: "inline-block", padding: `${size * 0.02}px ${size * 0.2}px ${size * 0.08}px`, margin: `0 ${size * 0.02}px 0 ${-size * 0.2}px`, borderRadius: `${size * 0.3}px`, background: "#04071C", boxShadow: `inset 0 0 0 ${(size * 0.062).toFixed(1)}px #8FD3FF`, transformOrigin: "50% 60%" } : {} }, row);
    return { row, inner, key };
  });
  ctx.onFrame((t) => {
    const out = ramp(ctx, t, t1, t1 + 0.5, "power3.in");
    rows.forEach(({ row, inner, key }, i) => {
      const o = 1 - ramp(ctx, t, t1 + i * 0.05, t1 + i * 0.05 + 0.4, "power2.in");
      row.style.transform = `translateY(${(-out * size * 0.9 * (1 + i * 0.12)).toFixed(1)}px)`;
      row.style.opacity = opa(o);
      row.style.visibility = o > 0.001 ? "inherit" : "hidden";
      if (key) {
        /* the box is already round the word at t = 0, as a still; it only breathes in on the word */
        const u = ramp(ctx, t, tKey, tKey + 0.5, "back.out(1.6)");
        inner.style.transform = `scale(${(1 + 0.045 * Math.sin(Math.PI * u)).toFixed(4)})`;
      }
    });
    const mo = 1 - ramp(ctx, t, t1 - 0.1, t1 + 0.3, "power2.in");
    mark.style.opacity = opa(mo);
    mark.style.visibility = mo > 0.001 ? "inherit" : "hidden";
  });
  return box;
}

/**
 * THE MOVE-IN TOTAL: a solid ink slab with the thick sky edge (the same
 * container as popOut), the figure rolling in on an odometer. It carries the
 * Example chip because the villa it totals is the platform's example stock.
 */
export function totalPlate(ctx, parent, { x, y, t0, t1, tRoll0, tRoll1, value = 26100000, size = 40, label = "Total to move in", rot = -1.2 }) {
  const box = ctx.el("div", { class: "abs", attrs: { "data-furn": "1" }, style: { left: "0px", top: "0px", transformOrigin: "50% 50%" } }, parent);
  const slab = ctx.el("div", {
    style: {
      position: "relative", padding: `${size * 0.8}px ${size * 1.1}px ${size * 0.9}px`, borderRadius: `${size * 1.16}px`,
      border: `${(size * 0.23).toFixed(2)}px solid #8FD3FF`, background: "#04071C", boxShadow: "0 54px 96px -34px rgb(0 0 10 / 0.92)", color: "#fff",
    },
  }, box);
  const head = ctx.el("div", { style: { display: "flex", alignItems: "center", gap: `${size * 0.3}px`, marginBottom: `${size * 0.36}px` } }, slab);
  ctx.el("span", { style: { width: `${size * 0.3}px`, height: `${size * 0.3}px`, borderRadius: "50%", background: "rgb(143 211 255 / 0.95)", flex: "none" } }, head);
  ctx.el("span", { text: label, style: { font: `700 ${Math.round(size * 0.6)}px/1 Inter, sans-serif`, letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap", color: "rgb(143 211 255 / 0.95)" } }, head);
  const chip = ctx.el("div", { style: { marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: `${size * 0.16}px`, padding: `${size * 0.14}px ${size * 0.34}px`, borderRadius: "999px", border: "1.5px solid rgb(255 255 255 / 0.26)", background: "rgb(1 1 24 / 0.5)" } }, head);
  const ic = ctx.icon("info", { size: Math.round(size * 0.6), stroke: 2.2 }, chip);
  ic.style.color = "#E8EFFF";
  ctx.el("span", { text: "Example", style: { font: `600 ${Math.round(size * 0.58)}px/1 Inter, sans-serif`, color: "#E8EFFF" } }, chip);
  const fig = ctx.el("div", { style: { position: "relative", height: `${size * 2.3}px`, width: `${size * 8.7}px` } }, slab);
  const num = odometer(ctx, fig, { value, t0: tRoll0, t1: tRoll1, fontSize: size * 2.3, prefix: "₦", color: "#ffffff" });
  num.style.position = "absolute";
  num.style.left = "0px";
  num.style.top = "0px";
  const ph = ctx.random(7)() * Math.PI * 2;
  (ctx.__holds ??= []).push([t0 + 0.3, t1]);
  ctx.onFrame((t) => {
    if (t < t0 - 0.05 || t >= t1 + 0.6) { box.style.visibility = "hidden"; return; }
    const a = ramp(ctx, t, t0, t0 + 0.58, "land");
    const b = ramp(ctx, t, t1, t1 + 0.42, "power2.in");
    place(box, { x, y: y + mix(size * 2.4, 0, a) + Math.sin((t - t0) * 0.78 + ph) * 5 * a - b * size * 1.1, s: (0.93 + 0.07 * a) * (1 - 0.05 * b), r: rot + Math.sin((t - t0) * 0.46 + ph) * 0.5 * a, o: Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b) });
  });
  /* the rolling digits tick, once for each place that lands */
  ctx.sfx("card_slide", t0, { offset: -5 });
  ctx.sfx("counter_tick", tRoll0, { offset: -4 });
  ctx.sfx("counter_tick", mix(tRoll0, tRoll1, 0.5), { offset: -7 });
  ctx.sfx("ding_pay", tRoll1, { offset: -9 });
  return box;
}

/**
 * Four round badges that float where their word is spoken, then fly to the
 * centre and become the Vallo mark of the end card (the hand-off: nothing
 * leaves, it arrives somewhere).
 *   items: [{ name, x, y, t0, label }]
 */
export function gatherDiscs(ctx, parent, { items, to, tFly, size = 210 }) {
  items.forEach((it, k) => {
    const box = ctx.el("div", { class: "abs", attrs: { "data-furn": "1" }, style: { left: "0px", top: "0px", width: `${size}px`, height: `${size}px`, borderRadius: "50%", display: "grid", placeItems: "center", background: "#04071C", border: `${(size * 0.055).toFixed(2)}px solid #8FD3FF`, boxShadow: "0 30px 52px -20px rgb(0 0 10 / 0.9)" } }, parent);
    ctx.img(ctx.src.object(it.name), { style: { width: `${size * 0.72}px`, height: `${size * 0.72}px`, objectFit: "contain", filter: "drop-shadow(0 10px 16px rgb(0 0 25 / 0.5))" } }, box);
    const lab = ctx.el("div", { class: "abs", text: it.label, style: { left: `${size / 2}px`, top: `${size * 1.12}px`, transform: "translateX(-50%)", font: "700 38px/1 Poppins, Inter, sans-serif", letterSpacing: "-0.02em", color: "#fff", whiteSpace: "nowrap" } }, box);
    const ph = ctx.random(40 + k)() * Math.PI * 2;
    const start = tFly + k * 0.07;
    ctx.onFrame((t) => {
      const a = ramp(ctx, t, it.t0 - 0.5, it.t0, "back.out(1.7)");
      const f = ramp(ctx, t, start, start + 0.62, "power3.in");
      const bob = Math.sin((t - it.t0) * 0.82 + ph) * 10 * (1 - f);
      const o = Math.min(a, 1 - ramp(ctx, t, start + 0.4, start + 0.62, "power1.in"));
      place(box, { x: mix(it.x, to.x, f), y: mix(it.y + bob, to.y, f), s: (0.86 + 0.14 * a) * (1 - 0.62 * f), r: mix(Math.sin((t - it.t0) * 0.42 + ph) * 2.4, 0, f), o });
      lab.style.opacity = opa(1 - ramp(ctx, t, start - 0.1, start + 0.2));
    });
  });
}

export { badgeDisc };
