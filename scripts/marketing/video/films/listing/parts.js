/**
 * THE LISTING FILM'S OWN PARTS.
 *
 * One helper, used once: the rule that strikes a figure out. Sentence two
 * ("No agency fee. No middle man taking a cut you did not agree to.") holds
 * up the live cost screen's own agency fee and takes it away again, and the
 * only honest way to take a figure away is to draw through it.
 *
 * Everything is a pure function of t (BUILDING.md, "Determinism").
 */
import { ramp, opa } from "../kit.js";

/**
 * A PHOTOGRAPHED PLACE, LAID INTO THE NIGHT.
 *
 * The kit's `sceneBack` reads from brand/onboarding, which is Videos One and
 * Two's artwork and is banned in the three shorts (SHORTS.md). This is the
 * same move on the brand's photographed places (brand/scenes), so the opening
 * line has a real building under it rather than an empty field: the photograph
 * is masked away at its top and sides, darkened, and it drifts while it is up.
 */
export function placeBack(ctx, parent, { scene, t0, t1, y = 900, opacity = 0.46, width = null }) {
  const aw = width ?? ctx.W * 1.14;
  const ah = aw * 0.68;
  const fadeTop = "linear-gradient(180deg, transparent 0%, #000 22%, #000 74%, transparent 100%)";
  const fadeSide = "linear-gradient(90deg, transparent 0%, #000 15%, #000 85%, transparent 100%)";
  const art = ctx.img(ctx.src.scene(scene), {
    class: "abs",
    style: {
      left: `${((ctx.W - aw) / 2).toFixed(1)}px`, top: `${y.toFixed(1)}px`,
      width: `${aw.toFixed(1)}px`, height: `${ah.toFixed(1)}px`, objectFit: "cover",
      WebkitMaskImage: `${fadeTop}, ${fadeSide}`, maskImage: `${fadeTop}, ${fadeSide}`,
      WebkitMaskComposite: "source-in", maskComposite: "intersect",
      filter: "saturate(0.9) brightness(0.72)",
    },
  }, parent);
  ctx.onFrame((t) => {
    const a = ramp(ctx, t, t0, t0 + 0.9, "power2.out");
    const b = t1 == null ? 0 : ramp(ctx, t, t1, t1 + 0.5, "power2.in");
    const o = a * (1 - b);
    art.style.opacity = opa(o * opacity);
    art.style.visibility = o > 0.002 ? "inherit" : "hidden";
    /* it keeps moving the whole time it is up: a slow push with a little lift */
    art.style.transform = `scale(${(1.0 + 0.045 * a + 0.005 * Math.sin(t * 0.55)).toFixed(4)}) translateY(${(-18 * a).toFixed(1)}px)`;
  });
  return art;
}

/**
 * A thick rule drawn through a node, left to right, from t0.
 *
 * `node` is a row of a container (popOut returns its rows), not the whole
 * slab: a strike across a slab would cross its label too, and the label is
 * what names the thing being struck.
 */
export function strikeThrough(ctx, node, { t0, dur = 0.42, color = "#FF6B1A", thick = 11, pad = 16, sound = "stamp" }) {
  node.style.position = "relative";
  const bar = ctx.el("div", {
    class: "abs",
    style: {
      left: `${-pad}px`, top: "50%", width: `calc(100% + ${pad * 2}px)`, height: `${thick}px`,
      borderRadius: `${thick}px`, background: color,
      boxShadow: `0 0 ${(thick * 2.6).toFixed(0)}px rgb(255 107 26 / 0.55)`,
      transformOrigin: "0% 50%", transform: "translateY(-50%) scaleX(0)", visibility: "hidden",
    },
  }, node);
  ctx.onFrame((t) => {
    /* anticipation: the rule pulls back a hair before it runs */
    const back = ramp(ctx, t, t0 - 0.16, t0, "power2.out") * 0.06;
    const u = ramp(ctx, t, t0, t0 + dur, "power3.out");
    bar.style.transform = `translateY(-50%) scaleX(${Math.max(0, u - back * (1 - u)).toFixed(4)})`;
    bar.style.opacity = opa(u > 0.001 ? 1 : 0);
    bar.style.visibility = u > 0.001 ? "inherit" : "hidden";
  });
  if (sound) ctx.sfx(sound, t0, { offset: -2 });
  return bar;
}
