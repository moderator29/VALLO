/**
 * The film page's entry. /film.html?film=mobile|desktop[&scenes=a,b][&t=12.5][&captions=0]
 *
 * Builds every scene module listed in /video/scenes/index.js (or the ones
 * named in `scenes`), the captions and the grain, then waits for every image
 * and font. The renderer drives it through window.__film.seek(t).
 */
import { createContext } from "./core.js";
import { installCaptions, installGrain, installChapterPill } from "./components.js";

const q = new URLSearchParams(location.search);
const film = q.get("film") === "desktop" ? "desktop" : "mobile";
/* A reel: its own scene list and clock under /video/reels/<name>/ (no voice plan, captions or chapter pill). */
const reel = q.get("reel");
/* An October film: its scenes, clock and chapters under /video/films/<name>/ (with captions and the pill). */
const proj = q.get("proj");

try {
  const list = q.get("scenes") ? q.get("scenes").split(",") : proj ? (await import(`/video/films/${proj}/index.js`)).SCENES : reel ? (await import(`/video/reels/${reel}/index.js`)).SCENES : (await import("/video/scenes/index.js")).SCENES;
  const stage = document.getElementById("stage");
  const ctx = await createContext({ film, stage, ...(proj ? { timeline: `/video/films/${proj}/timeline.json` } : reel ? { timeline: `/video/reels/${reel}/timeline.json` } : {}) });
  ctx.proj = proj;
  ctx.reel = reel;
  /* The ending: "soon" (Coming soon on iPhone and Android, no badges) or
     "live" (the official store badges; only once Vallo is in both stores). */
  ctx.ending = q.get("ending") === "live" ? "live" : "soon";
  window.__ctx = ctx;
  for (const id of list) {
    const mod = await import(proj ? `/video/films/${proj}/${id}.js` : reel ? `/video/reels/${reel}/${id}.js` : `/video/scenes/${id}.js`);
    await mod.build(ctx);
  }
  if (!reel && q.get("captions") !== "0") installCaptions(ctx);
  if (!reel) {
    const { CHAPTERS, groundAt } = await import(proj ? `/video/films/${proj}/chapters.js` : "/video/scenes/chapters.js");
    ctx.groundAt = groundAt;
    if (q.get("pill") !== "0") installChapterPill(ctx, CHAPTERS, { theme: groundAt });
  }
  if (q.get("grain") === "1" || (proj && q.get("grain") !== "0")) installGrain(ctx, { opacity: proj ? 0.028 : 0.045 });
  /* the October films' lens: a soft vignette over everything but the captions */
  if (proj) ctx.el("div", { class: "fill", style: { zIndex: 875, pointerEvents: "none", background: "radial-gradient(120% 90% at 50% 45%, transparent 62%, rgb(0 0 12 / 0.38) 100%)" } }, stage);
  await Promise.all(ctx.pending ?? []);
  await ctx.finish();
  ctx.seek(Number(q.get("t") ?? 0));
  window.__film = {
    film,
    duration: ctx.duration,
    seek: (t) => ctx.seek(t),
    cues: () => ctx.cues,
    scenes: () => ctx.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end })),
  };
  window.__ready = true;
} catch (error) {
  window.__error = `${error?.message ?? error}\n${error?.stack ?? ""}`;
  console.error(window.__error);
}
