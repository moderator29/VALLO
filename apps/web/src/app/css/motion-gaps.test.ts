import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FIVE GAPS AGAINST MOTION_SYSTEM.md CLOSED (Session 3, C1; the table is in the
 * scratchpad's `c1/motion-gaps.md`), HELD BY SOURCE. Chromium checks of the
 * same rules are in `motion-gaps.dom.test.tsx`.
 */
const src = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");
const css = (file: string) => src(`app/css/${file}`);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");

describe("principle 10: nothing loops forever", () => {
  it("the edge light's runners take two laps and stop (the dock, the hero bands, the summary card)", () => {
    const edge = strip(css("edge-m.css"));
    expect(edge).not.toMatch(/infinite/);
    expect(edge).toMatch(/animation: nf-edge-long var\(--nf-edge-lap, 7\.5s\) linear\s+var\(--nf-edge-delay, 0s\) 2 both/);
    expect(edge).toMatch(/animation: nf-edge-side var\(--nf-edge-lap, 7\.5s\) linear\s+var\(--nf-edge-delay, 0s\) 2 both/);
    expect(edge).toContain("animation: nf-edge-turn var(--nf-edge-lap, 7.5s) linear 2 both");
  });

  it("the runners end shrunk to a point, so stopping leaves nothing drawn", () => {
    const edge = strip(css("edge-m.css"));
    const long = edge.slice(edge.indexOf("@keyframes nf-edge-long"), edge.indexOf("@keyframes nf-edge-side"));
    expect(long.trimEnd().replace(/\s+/g, " ")).toMatch(/100% \{ translate: var\(--nf-edge-x0\) 0; scale: 0 1; \} \}$/);
    const side = edge.slice(edge.indexOf("@keyframes nf-edge-side"), edge.indexOf("The round dock button"));
    expect(side.replace(/\s+/g, " ")).toMatch(/100% \{ translate: var\(--nf-edge-xl\) var\(--nf-edge-y0\); scale: 1 0; \}/);
  });

  it("the supplier flows' step-bar sheen stops after two passes, and the head object no longer floats", () => {
    const flow = strip(css("flow-m.css"));
    expect(flow).not.toMatch(/infinite/);
    expect(flow).toContain("animation: nf-flow-sheen 2.6s var(--nf-ease-standard) 600ms 2 both");
    /* Round 5 (140a1618e): the wizard's steps change at browsing pace, and the
       object's float, a motion that answered nothing, is gone with its keyframes. */
    expect(flow).not.toContain("nf-flow-float");
  });
});

describe("the dock pill springs on drift at 240ms", () => {
  const shell = strip(css("shell-m.css"));
  const from = shell.indexOf(".nf-tabbar .nf-tab {\n    flex: 1 1 0;");
  /* From the slot rule through the pill rule (about 3.5KB of the dock block). */
  const dock = shell.slice(from, from + 3500);

  it("the slot and its pill travel on drift at the base rung", () => {
    /* flex-grow (the slot) and the pill. The chosen word and the body's slide
       went with the word (7 October: the dock is icon only). */
    const through = shell.slice(from, shell.indexOf('.nf-tabbar :is(.nf-tab__link[aria-current="page"], .nf-tab__link[data-on])::after', from));
    expect(through.match(/var\(--nf-duration-base\) var\(--nf-ease-spring\)/g)).toHaveLength(2);
    expect(through).not.toMatch(/--nf-duration-slow\) var\(--nf-ease-spring\)/);
    expect(dock).not.toMatch(/(?:max-width|margin) var\(--nf-duration-base\)/);
  });
});

describe("the form error, for every form (whip 160ms, 4px, once)", () => {
  const controls = strip(css("controls.css"));

  it("shakes the shared Field when it becomes invalid, and leaves the auth screens to their own", () => {
    expect(controls).toContain(".nf-field[data-refused]:not(.nf-auth .nf-field) {");
    expect(controls).not.toContain('.nf-field[aria-invalid="true"]:not(.nf-auth .nf-field)');
    expect(controls).toContain("animation: nf-field-refuse var(--nf-duration-fast) var(--nf-ease-whip) both");
    const frames = controls.slice(controls.indexOf("@keyframes nf-field-refuse"), controls.indexOf("@keyframes nf-field-refuse") + 200);
    expect(frames).toContain("translate3d(-4px, 0, 0)");
    expect(frames).toContain("translate3d(4px, 0, 0)");
    expect(frames).not.toMatch(/width|height|top|left|filter|color/);
  });

  it("draws none under reduced motion, Calm or Off", () => {
    expect(controls).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.nf-field\[data-refused\]:not\(\.nf-auth \.nf-field\) \{\s*animation: none;/);
    expect(controls).toMatch(/\[data-motion="calm"\], \[data-motion="off"\]\) \.nf-field\[data-refused\] \{\s*animation: none;/);
  });
});

describe("pull to refresh: the mark turns with the drag and spins once on release", () => {
  const details = strip(css("details.css"));
  const tsx = src("components/ui/PullToRefresh.tsx");

  it("rotates the ring from the pull, as a direct response to the finger", () => {
    expect(tsx).toContain("const turn = Math.round((refreshing ? 1 : progress) * 270)");
    expect(tsx).toContain("transform: `rotate(${turn}deg)`");
    expect(tsx).toContain('"--nf-ptr-a": `${turn}deg`');
  });

  it("spins one full turn on glide over the deliberate rung when refreshing starts, and never loops", () => {
    expect(details).toContain(".nf-ptr[data-refreshing] .nf-ptr__ring {\n    animation: nf-ptr-spin var(--nf-duration-deliberate) var(--nf-ease-standard) both;");
    expect(details).toMatch(/@keyframes nf-ptr-spin \{\s*to \{\s*transform: rotate\(calc\(var\(--nf-ptr-a, 0deg\) \+ 360deg\)\);/);
    expect(details).not.toMatch(/nf-ptr[^{]*\{[^}]*infinite/);
  });

  it("is still under reduced motion, Calm and Off", () => {
    expect(details).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.nf-ptr\[data-refreshing\] \.nf-ptr__ring \{\s*animation: none;/);
    expect(details).toMatch(/\[data-motion="calm"\], \[data-motion="off"\]\) \.nf-ptr\[data-refreshing\] \.nf-ptr__ring \{\s*animation: none;/);
  });
});

describe("principle 10, the marketing and loading loops (Session 3, C1)", () => {
  it("the skeleton sweeps four times and rests on the still tint, in the app and the social slab", () => {
    const controls = strip(css("controls.css"));
    expect(controls).toContain("animation: nf-shimmer 1.4s linear 4 forwards;");
    expect(controls).not.toMatch(/nf-shimmer[^;]*infinite/);
    /* W2, round 5: the band is the slab's ::after and only `transform` moves it, from one slab-width
       left of the box to one slab-width right; the rest position is the base value. Nothing in the
       app slab animates or sets `background-position` any more. */
    expect(controls).toMatch(/@keyframes nf-shimmer \{\s*from \{\s*transform: translateX\(-100%\);\s*\}\s*to \{\s*transform: translateX\(100%\);/);
    expect(controls).toMatch(/\.nf-skeleton::after \{[^}]*transform: translateX\(100%\);[^}]*animation: nf-shimmer 1\.4s linear 4 forwards;/);
    expect(controls).not.toMatch(/(nf-skeleton|nf-shimmer)[^}]*background-position/);
    const social = strip(src("app/social.css"));
    /* The social slab sweeps the same way (W2, round 5): its band is the ::after, moved by transform alone,
       resting one slab-width right of the box, and the slab itself sets no background position. */
    expect(social).toMatch(/\.nf-social-skeleton::after \{[^}]*transform: translateX\(100%\);[^}]*animation: nf-social-shimmer 1\.4s linear 4 forwards;/);
    expect(social).toMatch(/@keyframes nf-social-shimmer \{\s*from \{\s*transform: translateX\(-100%\);\s*\}\s*to \{\s*transform: translateX\(100%\);/);
    expect(social).not.toMatch(/(nf-social-skeleton|nf-social-shimmer)[^}]*background-(position|size)/);
    expect(social).toMatch(/transparent 19\.2%,\s*color-mix\(in oklab, var\(--nf-content-muted\) 18%, transparent\) 50%,\s*transparent 80\.8%/);
    /* Drawn at 90 degrees, so the band is a vertical stripe and rests clean on a tall slab. */
    expect(controls).not.toMatch(/nf-skeleton[^}]*var\(--nf-light-angle\)/);
    expect(controls.match(/linear-gradient\(\s*90deg,\s*transparent 19\.2%/g)).toHaveLength(1);
  });

  it("the docs flow pulse walks twice, then rests (the landing columns left with the cinema kit)", () => {
    const docs = strip(css("docs-motion.css"));
    expect(docs).toContain("animation: nf-flow-pulse 5.6s var(--nf-ease-standard) 1.4s 2;");
    expect(docs).not.toMatch(/infinite/);
  });

  it("data saver stops the slabs (the pulse already answered to it)", () => {
    const saver = strip(css("data-saver.css"));
    for (const sel of [".nf-skeleton::after", ".nf-social-skeleton::after"]) {
      expect(saver).toContain(`:root[data-save-data="on"] ${sel}`);
    }
    expect(strip(css("docs-motion.css"))).toContain('[data-save-data="on"]) .nf-flow__pulse');
  });

  /*
   * THE INVENTORY. Every `infinite` left in the product's stylesheets is named
   * here with the reason it may stay; a new one fails this test until somebody
   * decides (principle 10: nothing loops forever except the aurora and the
   * assistant's thinking).
   */
  it("every remaining infinite animation is a listed exception", () => {
    const KEPT: Record<string, number> = {
      "app/css/ported.css": 1, // the assistant's thinking lines (spec)
      "components/app/assistant/assistant-answer.css": 1, // the assistant's thinking orb (spec)
      /* KEPT BY THE LEAD'S RULING (Session 3): live presence signals, like the assistant's
         thinking, each stopped by reduced motion, Calm, Off and data saver. */
      "app/css/motion.css": 1, // the counterpart's typing dots
      /* VC1: the ring round a calling avatar, a live signal like the typing
         dots, that lasts only while a call rings (45 s at most) and is
         stopped by reduced motion, Calm, Off and data saver. */
      "app/css/calls.css": 1,
      /* THE FOUNDER'S RESTORATION (7 October 2026): the login, sign-up and
         welcome screens back exactly as they were before the redesign, with
         their own loops (the code caret, the focal glow, the welcome scenes'
         float and breath). Each is stopped by reduced motion, Calm and Off.
         The onboarding's own loops (onboarding-motion.css) became finite on
         7 October: each floats or sweeps a few times and rests. */
      "app/css/auth.css": 5,
      "app/welcome/welcome.css": 3,
      /* THE FOUNDER'S RULING (October 2026): the landing's floating 3D objects
         keep their gentle continuous float. Only when ObjectField sets
         `data-on` (never under reduced motion, Calm, Off, data saver or a
         low-end device), and paused while the field is off screen. */
      /* THE FOUNDER'S RULING (7 October 2026, "do animations"): the hero's
         brand-blue aurora drifts behind the copy, paused unless the hero's
         object field is on screen and allowed to move, and still under
         reduced motion, Calm, Off, data saver and a low-end device. */
      "app/css/landing-3d.css": 2, // the floating 3D objects' gentle bob, and the hero's aurora
      /* D81 (8 October 2026): the new mark as the loader. While a page or a
         sign-in link is still being fetched, a light runs round the mark's
         ring; it is a wait signal like the assistant's thinking, gone the
         moment the page arrives, and never drawn under reduced motion, Calm,
         Off or data saver. */
      "app/css/logo-motion.css": 1, // the orbit loader's light
    };
    const root = join(process.cwd(), "src");
    const found: Record<string, number> = {};
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".css")) {
          const n = (strip(readFileSync(full, "utf8")).match(/infinite/g) ?? []).length;
          if (n) found[full.slice(root.length + 1)] = n;
        }
      }
    };
    walk(root);
    expect(found).toEqual(KEPT);
  });

  it("the verifying bar, the flip cover's breathing and the opt-in symbol loop are bounded, with a held rest", () => {
    const anim = strip(css("animation.css"));
    expect(anim).toContain("nf-verify-sweep 1.15s var(--nf-ease-whip) 3,");
    expect(anim).toContain("nf-verify-settle var(--nf-duration-deliberate) var(--nf-ease-entrance) 3.45s forwards;");
    expect(anim).toMatch(/@keyframes nf-verify-settle \{\s*from \{\s*transform: translateX\(-110%\);\s*\}\s*to \{\s*transform: translateX\(100%\);/);
    const flip = strip(css("side-flip.css"));
    expect(flip.match(/nf-flip-mini-breathe 1\.2s var\(--nf-ease-standard\) 3;/g)).toHaveLength(2);
    /* It ends where it started: full light, so there is no jump when it stops. */
    expect(flip).toMatch(/@keyframes nf-flip-mini-breathe \{\s*0%, 100% \{ opacity: 1; \}\s*50% \{ opacity: 0\.55; \}/);
    expect(strip(css("symbols.css"))).toMatch(/\.nf-sym--loop \{\s*animation-iteration-count: 3;/);
  });

  it("the two kept loops, and the bounded ones, are still under data saver", () => {
    const saver = strip(css("data-saver.css"));
    for (const sel of [".nf-verify-sweep", ".nf-typing-dot", ".nf-code__cell[data-next]::after", ".nf-flip-cover__miniature[data-shimmer] > li"]) {
      expect(saver).toContain(`:root[data-save-data="on"] ${sel}`);
    }
  });

  it("the dock draws no chosen label at all (7 October: icon only), so no word animates", () => {
    const shell = strip(css("shell-m.css"));
    expect(shell).toMatch(/\.nf-tabbar \.nf-tab__label \{\s*display: none;\s*\}/);
    expect(shell).not.toMatch(/nf-tab__link\[data-on\] \.nf-tab__label \{[^}]*opacity: 1/);
    expect(shell).not.toContain("transition-delay: 60ms, 0s, 0s, 0s, var(--nf-duration-base);");
  });
});
