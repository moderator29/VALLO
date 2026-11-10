import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPEN_MARK_ASPECT, OPEN_MARK_SVG } from "./open-mark.generated";
import { OPEN_SCRIPT } from "./open-script";

/**
 * THE OPENING SCREEN, FIRST PAINT (10 November 2026). What must be true of the
 * files for the bright mark to be on screen from the first frame with no script.
 */
const WEB = join(__dirname, "..", "..", "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const css = strip(readFileSync(join(__dirname, "open.css"), "utf8"));
const layout = strip(readFileSync(join(WEB, "src", "app", "layout.tsx"), "utf8"));

describe("open.css", () => {
  it("shows the screen by itself in an installed app, with no script", () => {
    expect(css).toMatch(/@media \(display-mode: standalone\)\s*\{\s*\.nf-open\s*\{\s*display: block/);
  });
  it("is hidden on the native shell and when the controller says off", () => {
    expect(css).toMatch(/:root\[data-open="off"\] \.nf-open,\s*:root\[data-native\] \.nf-open\s*\{\s*display: none/);
  });
  it("lifts itself by 2,500ms with no script at all", () => {
    expect(css).toMatch(/animation: nf-open-cap 300ms [^;]* 2200ms forwards/);
    expect(css).toMatch(/@keyframes nf-open-cap\s*\{\s*to\s*\{\s*opacity: 0;\s*visibility: hidden/);
  });
  it("crossfades rather than cutting", () => {
    expect(css).toMatch(/\[data-open="leave"\] \.nf-open\s*\{[^}]*transition: opacity 320ms/);
  });
  it("stops the movement under reduced motion, Calm and Off but keeps the mark", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.nf-open__mark\s*\{\s*animation: none/);
    expect(css).toMatch(/data-motion="calm"\], \[data-motion="off"\]\) \.nf-open__mark\s*\{\s*animation: none/);
  });
  it("uses tokens only, no raw colour", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\brgba?\(|\bhsla?\(/);
    expect(css).toContain("var(--nf-surface-artwork)");
  });
  it("draws the mark at 36 per cent of the width, centred at 46 per cent, like the launch images", () => {
    expect(css).toContain("min(36vw, 11rem)");
    expect(css).toMatch(/inset-block-start: calc\(46% - var\(--nf-open-w\) \* 0\.4278\)/);
    expect(OPEN_MARK_ASPECT).toBeCloseTo(1.1687, 3);
    expect(1 / OPEN_MARK_ASPECT / 2).toBeCloseTo(0.4278, 3);
  });
  it("covers the page above everything, including the older website launch layer", () => {
    expect(css).toMatch(/z-index: 2147483600/);
  });
});

describe("the first HTML", () => {
  it("carries the mark as inline SVG, so no request stands between the tap and the picture", () => {
    expect(OPEN_MARK_SVG.startsWith("<svg")).toBe(true);
    expect(OPEN_MARK_SVG).not.toMatch(/<image|href="http|src=/);
    expect(OPEN_MARK_SVG.length).toBeLessThan(12000);
  });
  it("puts the screen first in the body and the controller in the head, before the first paint", () => {
    const head = layout.indexOf("<head>");
    const body = layout.indexOf("<body>");
    const script = layout.indexOf("OPEN_SCRIPT");
    const screen = layout.indexOf("<OpeningScreen />");
    expect(head).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(head);
    expect(script).toBeLessThan(body);
    expect(screen).toBeGreaterThan(body);
    // nothing but comments sits between the body tag and the screen
    expect(layout.slice(body + "<body>".length, screen).trim()).toBe("");
    expect(layout).toContain('import "@/components/startup/open.css"');
  });
  it("adds no <style> element, which the Content Security Policy forbids", () => {
    const sources = ["OpeningScreen.tsx", "OpenReady.tsx", "open-script.ts"].map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
    expect(sources).not.toMatch(/<style/);
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
