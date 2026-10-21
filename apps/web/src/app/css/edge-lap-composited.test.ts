import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE EDGE LIGHTS TURN ON THE COMPOSITOR (17 October 2026).
 *
 * The capsule's edge lap and the dock's "+" rim turned a conic gradient by
 * animating a registered angle, which only the main thread can do: the
 * element was restyled and repainted on every frame of both laps, on every
 * public page and every signed-in screen. On a production build of /terms
 * that was 297 frames in five seconds against 40 without it, about 360 ms of
 * main thread work and twice the raster (site.css, THE EDGE LAP). Both now
 * paint the gradient once and turn it with `rotate` (`nf-edge-turn`). This
 * holds them there.
 */
const dir = join(process.cwd(), "src/app/css");
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const sheet = (file: string) => strip(readFileSync(join(dir, file), "utf8"));

describe("the edge lights are turned by the compositor", () => {
  it("the registered lap angle is gone, and no edge light turns a gradient's start angle", () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
      expect(sheet(file), file).not.toContain("--nf-logo-lap");
    }
    /* ambient.css's live card keeps a static `from var(--nf-spin)`: it is a
       resting angle, not an animation, and is not an edge light. */
    for (const file of ["site.css", "shell-m.css", "edge-m.css"]) {
      expect(sheet(file), file).not.toMatch(/conic-gradient\(\s*from var\(/);
    }
  });

  it("the capsule's lap turns a painted square behind a fixed ring", () => {
    const site = sheet("site.css");
    const light = site.slice(site.indexOf(".nf-edge-lap__ring::before"));
    expect(light).toMatch(/animation: nf-edge-turn var\(--nf-edge-lap-speed\) linear 2 both;/);
    expect(light).toMatch(/aspect-ratio: 1;/);
    const ring = site.slice(site.indexOf(".nf-edge-lap__ring {"), site.indexOf(".nf-edge-lap__ring::before"));
    expect(ring).toMatch(/mask:/);
    expect(ring).toMatch(/container-type: size;/);
  });

  it("the dock's plus turns its ring, two laps", () => {
    const shell = sheet("shell-m.css");
    const plus = shell.slice(shell.indexOf(".nf-dock-plus::before {"), shell.indexOf(".nf-dock-create:active"));
    expect(plus).toContain("animation: nf-edge-turn 5s linear 2 both;");
  });

  it("the host renders the ring the light shows through", () => {
    const lap = readFileSync(join(process.cwd(), "src/components/site/EdgeLap.tsx"), "utf8");
    expect(lap).toContain("<EdgeLapRing />");
    const band = readFileSync(join(process.cwd(), "src/components/ui/HeroBand.tsx"), "utf8");
    expect(band).toContain("{lap ? <EdgeLapRing /> : null}");
  });
});
