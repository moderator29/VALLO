/**
 * THE SIGN-UP FILM'S OWN PART.
 *
 * One thing this film needs that no other film does: a list of the three
 * things you DO NOT do to get on Vallo, struck off one at a time as the
 * voice names them ("No long form. No agent to call first. Nothing to pay.").
 *
 * It is the blueprint's container, drawn to the same description as
 * popout.js: solid #04071C, a THICK #8FD3FF edge all the way round, the
 * label as the first row, a lit dot before it. The only thing it adds is the
 * rule that travels across a line and the way the line steps back once it
 * has been struck.
 *
 * Every value is a pure function of t (BUILDING.md, "Determinism").
 */
import { ramp, place, opa } from "../kit.js";

const SKY = "rgb(143 211 255 / 0.95)";

/**
 * items: [[lucide, text, tIn, tStrike], ...] in the order they arrive.
 * The slab arrives whole at t0 with its label and three empty rows, so
 * nothing reflows when a row lands.
 */
export function strikeList(ctx, parent, { x, y, w, t0, t1, size = 36, tab, items, seed = 5, rot = 0 }) {
  const radius = size * 1.16;
  const pad = size * 0.86;
  const box = ctx.el("div", { class: "abs", attrs: { "data-furn": "1" }, style: { left: "0px", top: "0px", transformOrigin: "50% 50%" } }, parent);
  const slab = ctx.el("div", {
    style: {
      position: "relative", width: `${w}px`, padding: `${pad}px ${pad * 1.08}px`, boxSizing: "border-box",
      borderRadius: `${radius}px`, border: `${(size * 0.23).toFixed(2)}px solid #8FD3FF`, background: "#04071C",
      boxShadow: "0 54px 96px -34px rgb(0 0 10 / 0.92)", color: "#ffffff", font: `500 ${size}px/1.2 Inter, sans-serif`,
    },
  }, box);

  /* the label, the card's first row */
  const tabEl = ctx.el("div", {
    style: {
      display: "flex", alignItems: "center", gap: `${size * 0.3}px`, marginBottom: `${size * 0.56}px`,
      font: `700 ${Math.round(size * 0.6)}px/1 Inter, sans-serif`, letterSpacing: "0.14em",
      textTransform: "uppercase", whiteSpace: "nowrap", color: SKY,
    },
  }, slab);
  ctx.el("span", { style: { width: `${size * 0.3}px`, height: `${size * 0.3}px`, borderRadius: "50%", background: SKY, flex: "none" } }, tabEl);
  ctx.el("span", { text: tab }, tabEl);

  const rows = items.map(([lucide, text, tIn, tStrike], i) => {
    const row = ctx.el("div", {
      style: { display: "flex", alignItems: "center", gap: `${size * 0.66}px`, marginTop: i ? `${size * 0.56}px` : "0px" },
    }, slab);
    const d = size * 1.86;
    const plate = ctx.el("div", {
      style: {
        flex: "none", width: `${d}px`, height: `${d}px`, borderRadius: `${d * 0.33}px`, display: "grid", placeItems: "center",
        background: "linear-gradient(160deg, #4A95FF 0%, #0069FE 55%, #0050C8 100%)",
      },
    }, row);
    const ic = ctx.icon(lucide, { size: Math.round(d * 0.48), stroke: 2.1 }, plate);
    ic.style.color = "#fff";
    const hold = ctx.el("div", { style: { position: "relative", display: "inline-block" } }, row);
    const label = ctx.el("div", {
      text,
      style: { font: `700 ${size}px/1.18 Inter, sans-serif`, letterSpacing: "-0.012em", whiteSpace: "nowrap", color: "#ffffff" },
    }, hold);
    const rule = ctx.el("div", {
      style: {
        position: "absolute", left: `${-size * 0.12}px`, right: `${-size * 0.12}px`, top: "52%",
        height: `${Math.max(4, size * 0.11).toFixed(1)}px`, borderRadius: "99px", background: SKY,
        boxShadow: `0 0 ${size * 0.5}px rgb(143 211 255 / 0.55)`, transform: "scaleX(0)", transformOrigin: "0% 50%",
      },
    }, hold);
    ctx.sfx("stamp", tStrike, { offset: -4 });
    return { row, plate, label, rule, tIn, tStrike };
  });

  const ph = ctx.random(seed)() * Math.PI * 2;
  (ctx.__holds ??= []).push([t0 + 0.32, t1]);
  ctx.onFrame((t) => {
    if (t < t0 - 0.05 || t >= t1 + 0.5) { box.style.visibility = "hidden"; return; }
    const a = ramp(ctx, t, t0, t0 + 0.56, "land");
    const b = ramp(ctx, t, t1, t1 + 0.42, "power2.in");
    const o = Math.min(ramp(ctx, t, t0, t0 + 0.2), 1 - b);
    place(box, {
      x: x + Math.cos((t - t0) * 0.54 + ph) * 3.4 * a,
      y: y + (1 - a) * size * 2.4 + Math.sin((t - t0) * 0.78 + ph) * 5 * a - b * size * 1.1,
      s: (0.93 + 0.07 * a) * (1 - 0.05 * b),
      r: rot + Math.sin((t - t0) * 0.46 + ph) * 0.55 * a,
      o,
    });
    const tu = ramp(ctx, t, t0 + 0.12, t0 + 0.46, "land");
    tabEl.style.transform = `translateY(${((1 - tu) * size * 0.3).toFixed(2)}px)`;
    tabEl.style.opacity = opa(Math.min(tu, 1 - b));
    for (const r of rows) {
      /* a line waits as a ghost so the slab is never three quarters empty,
         lands on its own word, and is struck on the noun */
      const u = ramp(ctx, t, r.tIn, r.tIn + 0.4, "land");
      const k = ramp(ctx, t, r.tStrike, r.tStrike + 0.34, "power3.out");
      r.row.style.transform = `translate(${((1 - u) * size * 0.5).toFixed(2)}px, ${(k * size * 0.07).toFixed(2)}px)`;
      r.row.style.opacity = opa(Math.min(Math.max(u, 0.17 * a), 1 - b));
      r.label.style.color = k > 0 ? `rgb(214 228 255 / ${(0.95 - 0.45 * k).toFixed(3)})` : "#ffffff";
      r.plate.style.opacity = opa(1 - 0.42 * k);
      r.rule.style.transform = `scaleX(${k.toFixed(4)})`;
    }
    box.style.visibility = o > 0.001 ? "inherit" : "hidden";
  });
  ctx.sfx("card_slide", t0, { offset: -5 });
  return box;
}
