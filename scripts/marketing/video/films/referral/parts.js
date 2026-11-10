/**
 * THE REFERRAL FILM'S OWN TWO PARTS.
 *
 * Everything else this film needs is in the kit. These two are not, and they
 * belong to this film only, so they live here rather than in kit.js (three
 * films are being built at once off the same kit).
 *
 *   strikeOut   a thick sky rule drawn through a pop-out container's own row,
 *               for "Not for a click. Not for a download."
 *   bigRoll     the blueprint's oversized stroked figure, ROLLING: an
 *               odometer set at poster size, filled with nothing and drawn in
 *               one heavy sky outline, so the stage reads through the
 *               numerals while they spin.
 *
 * Every value is a pure function of t (BUILDING.md, "Determinism").
 */
import { ramp, opa, place, odometer } from "../kit.js";

const SKY = "#8FD3FF";

/**
 * Strikes a container through. `row` is the node the rule crosses (a
 * popOut's `rows[0]`), `slab` the container's body, which dims behind it.
 * The rule draws itself on from the left; it never pops.
 */
export function strikeOut(ctx, { slab, row, t0, dur = 0.3, t1 = null, dim = 0.36, sound = "swipe" }) {
  row.style.position = "relative";
  /* the rule runs a little past both ends of the row, the way a pen does */
  const bar = ctx.el("div", {
    class: "abs",
    style: {
      left: "-18px", top: "50%", width: "calc(100% + 36px)", height: "10px", marginTop: "-5px",
      borderRadius: "6px", background: SKY, boxShadow: "0 0 30px rgb(143 211 255 / 0.75)",
      transformOrigin: "0% 50%", transform: "scaleX(0)", opacity: "0",
    },
  }, row);
  ctx.onFrame((t) => {
    const u = ramp(ctx, t, t0, t0 + dur, "power3.out");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.28, "power2.in");
    bar.style.transform = `scaleX(${u.toFixed(4)})`;
    bar.style.opacity = opa(Math.min(u * 3, 1 - b));
    if (slab) slab.style.opacity = opa(1 - dim * u);
  });
  if (sound) ctx.sfx(sound, t0, { offset: -5 });
  return bar;
}

/**
 * THE FILM'S SIGNATURE FIGURE: ₦80, at poster size, stroked and rolling.
 *
 * `figureOut` draws the blueprint's oversized outline but cannot move, and
 * `odometer` rolls but is drawn solid at card size. This is both: the kit's
 * own odometer at `size` px, its fill taken away and one heavy sky stroke put
 * round it, so the ground shows through the numerals as they spin and lock.
 *
 * Each digit column clips its own overflow (that is how the roll is hidden),
 * which would have cut the stroke off the left and right of every numeral, so
 * each column is padded out and pulled back by the same amount.
 */
export function bigRoll(ctx, parent, { value, prefix = "₦", x, y, size = 380, rot = -3, t0, t1, tOut = null, seed = 3 }) {
  const box = ctx.el("div", { class: "abs", attrs: { "data-furn": "1" }, style: { left: "0px", top: "0px", transformOrigin: "50% 50%" } }, parent);
  const wrap = ctx.el("div", { style: { position: "relative", whiteSpace: "nowrap" } }, box);
  const num = odometer(ctx, wrap, { value, t0, t1, prefix, fontSize: size, color: "transparent" });
  Object.assign(num.style, {
    position: "relative",
    font: `700 ${size}px/0.98 Poppins, Inter, sans-serif`,
    letterSpacing: "-0.035em",
    WebkitTextStroke: `${(size * 0.03).toFixed(2)}px ${SKY}`,
    filter: `drop-shadow(0 0 ${Math.round(size * 0.1)}px rgb(143 211 255 / 0.35))`,
  });
  const pad = Math.ceil(size * 0.055);
  const cols = [];
  for (const col of num.children) {
    if (col.style && col.style.overflow === "hidden") {
      col.style.paddingLeft = `${pad}px`;
      col.style.paddingRight = `${pad}px`;
      col.style.marginLeft = `${-pad}px`;
      col.style.marginRight = `${-pad}px`;
      cols.push(col);
    }
  }
  /* THE SPEED BLUR, AT THIS SIZE.
     The kit's odometer blurs a column by at most 1.5px, which is enough at
     card size and nothing at all at 400: a frame caught mid-roll read "₦89"
     in letters a third of the frame high, and a figure this film may not say
     was legible on the stage. The blur is rescaled to the type, so a column
     in motion is a smear and only the landed number can ever be read. This
     hook is registered after the odometer's, so it is the one that wins. */
  const ease = ctx.ease("power3.out");
  cols.forEach((col, i) => {
    const land = t0 + ((t1 - t0) * (i + 1)) / cols.length;
    ctx.onFrame((t) => {
      const p = ease(ctx.progress(t, t0, land));
      col.style.filter = p < 0.999 ? `blur(${((1 - p) * size * 0.055).toFixed(2)}px)` : "none";
    });
  });
  /* NO HOLD IS REGISTERED. installFocus dims the stage around a part held
     up, and its scrim sits at z 600: this figure stands BEHIND the phone, at
     z 300, so a hold would dim the very thing it was meant to lift. The
     figure is the whole stage at that moment and needs no help. */
  const ph = ctx.random(seed)() * Math.PI * 2;
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0 - 0.38, t0 + 0.28, "land");
    const b = tOut == null ? 0 : ramp(ctx, t, tOut, tOut + 0.42, "power2.in");
    const o = Math.min(ramp(ctx, t, t0 - 0.38, t0 - 0.08), 1 - b);
    place(box, {
      x,
      y: y + Math.sin((t - t0) * 0.7 + ph) * 7 * a,
      s: (0.84 + 0.16 * a) * (1 + 0.06 * b),
      r: rot,
      o,
    });
  });
  return box;
}
