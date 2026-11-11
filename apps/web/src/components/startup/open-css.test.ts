import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_LAUNCH_SVG } from "./open-launch.generated";
import { OPEN_MIN_MS, OPEN_SCRIPT } from "./open-script";

/**
 * THE OPENING SCREEN, FIRST PAINT (10 November 2026). What must be true of the
 * files for the bright mark to be on screen from the first frame with no script.
 */
const WEB = join(__dirname, "..", "..", "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const css = strip(readFileSync(join(__dirname, "open.css"), "utf8"));
const layout = strip(readFileSync(join(WEB, "src", "app", "layout.tsx"), "utf8"));

describe("open.css", () => {
  it("shows the screen by itself with no script, in an installed app AND in a browser tab", () => {
    /* The founder, 11 November 2026: the website drew no opening at all. The
       media query was standalone only; a browser tab is named now too. */
    expect(css).toMatch(/@media \(display-mode: standalone\), \(display-mode: browser\)\s*\{\s*\.nf-open\s*\{\s*display: block/);
  });
  it("is hidden when the controller says off, and on the shell until it says on", () => {
    expect(css).toMatch(/:root\[data-open="off"\] \.nf-open\s*\{\s*display: none/);
    /* The shell shows it, but only once the splash is down and "on" is set. */
    expect(css).toMatch(/:root\[data-native\]:not\(\[data-open="on"\]\):not\(\[data-open="leave"\]\) \.nf-open\s*\{\s*display: none/);
  });
  it("lifts itself by 4,500ms with no script at all", () => {
    expect(css).toMatch(/animation: nf-open-cap 300ms [^;]* 4200ms forwards/);
    expect(css).toMatch(/@keyframes nf-open-cap\s*\{\s*to\s*\{\s*opacity: 0;\s*visibility: hidden/);
  });
  it("crossfades rather than cutting", () => {
    expect(css).toMatch(/\[data-open="leave"\] \.nf-open\s*\{[^}]*transition: opacity 320ms/);
  });
  it("stops every piece travelling under reduced motion, Calm and Off, and still shows the whole lockup", () => {
    /* Each piece is put at its finished value, so a sweep that never runs
       cannot leave the ring half drawn; the layer itself fades. */
    for (const block of [
      /prefers-reduced-motion: reduce\)\s*\{\s*\.nf-open__launch\s*\{\s*animation: nf-open-still/,
      /\.nf-open__launch :is\(\.sw, \.t, \.mv, \.l\)\s*\{\s*animation: none;\s*stroke-dashoffset: 0;\s*opacity: 1;\s*transform: none/,
      /data-motion="calm"\], \[data-motion="off"\]\) \.nf-open__launch\s*\{\s*animation: nf-open-still/,
    ]) expect(css).toMatch(block);
  });

  it("draws the sequence the artwork was built with: the ring, four towers, the travel, five letters", () => {
    expect(css).toMatch(/\.nf-open__launch \.sw\s*\{[^}]*animation: nf-open-sweep 640ms[^;]*40ms forwards/);
    expect(css).toMatch(/\.nf-open__launch \.t\s*\{[^}]*animation: nf-open-rise 520ms/);
    for (const [i, ms] of [200, 300, 400, 500].entries()) {
      expect(css).toMatch(new RegExp(`\\.nf-open__launch \\.t${i}\\s*\\{\\s*animation-delay: ${ms}ms`));
    }
    expect(css).toMatch(/\.nf-open__launch \.mv\s*\{[^}]*animation: nf-open-travel 540ms[^;]*760ms forwards/);
    for (const [i, ms] of [980, 1050, 1120, 1190, 1260].entries()) {
      expect(css).toMatch(new RegExp(`\\.nf-open__launch \\.l${i}\\s*\\{\\s*animation-delay: ${ms}ms`));
    }
    /* The last letter lands well inside the shortest hold, so the whole
       sequence is seen before the layer is lifted. */
    expect(1260 + 520).toBeLessThan(OPEN_MIN_MS);
  });
  it("uses tokens only, no raw colour", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(|\bhsla?\(/);
    expect(css).toContain("var(--nf-surface-artwork)");
  });
  it("centres the lockup on the same optical line the launch images use", () => {
    expect(css).toContain("min(72vw, 21rem)");
    expect(css).toMatch(/inset-block-start: calc\(46% - var\(--nf-open-lw\) \* 0\.1525\)/);
    /* 0.1525 is half of the artwork's own height over its width, read from the
       generated SVG rather than repeated by hand. */
    const vb = (OPEN_LAUNCH_SVG.match(/viewBox="([^"]+)"/)?.[1] ?? "").split(/\s+/).map(Number);
    expect(vb).toHaveLength(4);
    expect(vb[3]! / vb[2]! / 2).toBeCloseTo(0.1525, 3);
  });
  it("covers the page above everything, including the older website launch layer", () => {
    expect(css).toMatch(/z-index: 2147483600/);
  });
});

describe("the first HTML", () => {
  it("carries the lockup as inline SVG, so no request stands between the tap and the picture", () => {
    expect(OPEN_LAUNCH_SVG.startsWith("<svg")).toBe(true);
    expect(OPEN_LAUNCH_SVG).not.toMatch(/<image|href="http|src=/);
    expect(OPEN_LAUNCH_SVG.length).toBeLessThan(26000);
  });
  it("keeps the shapes the stylesheet animates, so the artwork and open.css cannot drift apart", () => {
    for (const cls of ["sw", "mv", "mk", "t t0", "t t1", "t t2", "t t3", "l l0", "l l1", "l l2", "l l3", "l l4"]) {
      expect(OPEN_LAUNCH_SVG).toContain(`class="${cls}"`);
    }
  });
  it("puts the screen first in the body and the controller in the head, before the first paint", () => {
    const head = layout.indexOf("<head>");
    const body = layout.indexOf("<body>");
    const script = layout.indexOf("__html: OPEN_SCRIPT");
    const screen = layout.indexOf("<OpeningScreen />");
    expect(head).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(head);
    expect(script).toBeLessThan(body);
    expect(screen).toBeGreaterThan(body);
    // nothing but comments sits between the body tag and the screen
    expect(layout.slice(body + "<body>".length, screen).replace(/[{}\s]/g, "")).toBe("");
    expect(layout).toContain('import "@/components/startup/open.css"');
  });
  it("adds no <style> element, which the Content Security Policy forbids", () => {
    const sources = ["OpeningScreen.tsx", "OpenReady.tsx", "open-script.ts"].map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
    expect(sources).not.toMatch(/<style/);
    /* The artwork is inlined into the document, so ITS style element is the one
       that would actually be dropped by the policy. The generator strips it and
       this holds the generator to that. */
    expect(OPEN_LAUNCH_SVG).not.toMatch(/<style/);
    expect(OPEN_SCRIPT).not.toMatch(/createElement\(['"]style/);
  });
  it("does not depend on hydration to be drawn: the screen is a server component, only the ready flag is client", () => {
    const screen = readFileSync(join(__dirname, "OpeningScreen.tsx"), "utf8");
    expect(screen).not.toMatch(/"use client"|useState|useEffect/);
    const ready = readFileSync(join(__dirname, "OpenReady.tsx"), "utf8");
    expect(ready).toContain('"use client"');
    expect(ready).toContain("__nfOpenReady");
  });
  it("does not play the older website launch layer under it", () => {
    const launch = readFileSync(join(WEB, "src", "components", "motion", "launch-script.ts"), "utf8");
    expect(launch).toContain("data-open')==='on'");
  });
});
