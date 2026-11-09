import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * OPS-15: the one script tag production served without a nonce.
 *
 * It was the async <script> Next renders for a layout's own client chunk
 * (`script-0` in the RSC payload). Next 16.2.12, which the live deployment
 * was built with, rendered it with no nonce, so `strict-dynamic` refused it on
 * every page. Next 16.3 passes `ctx.nonce` to it. These two assertions fail if
 * the dependency ever goes back to a renderer that drops it, and
 * `scripts/check-script-nonces.mjs` checks a served build end to end.
 */
const require = createRequire(import.meta.url);
const nextRoot = dirname(require.resolve("next/package.json"));
const renderer = (file: string) => readFileSync(join(nextRoot, "dist/server/app-render", file), "utf8");

describe("Next stamps the nonce on a layout's own script", () => {
  it.each(["create-component-styles-and-scripts.js", "get-layer-assets.js"])("%s", (file) => {
    const source = renderer(file);
    const script = source.slice(source.indexOf("createElement('script'"));
    expect(script.slice(0, 400)).toContain("nonce: ctx.nonce");
  });

  /*
   * UI-12 is this same finding (A06's report of `11-v4cdswovuj.js`). The
   * build uses the INSTALLED Next, which the lockfile pins, not the range in
   * package.json, so the installed version is what is checked. Main's
   * lockfile still pins 16.2.12, and production (dpl_BSh7…, checked on 24
   * September with scripts/check-script-nonces.mjs) still serves that one
   * tag bare; it goes when the release branch deploys.
   */
  it("the installed Next, which the build uses, has that fix (UI-12)", () => {
    const installed = (JSON.parse(readFileSync(join(nextRoot, "package.json"), "utf8")) as { version: string }).version;
    const [major, minor] = installed.split(".").map(Number);
    expect(major! > 16 || (major === 16 && minor! >= 3), installed).toBe(true);
    /* The lockfile is at the repo root, which is NOT a fixed two levels above
       the installed `next`: in this workspace npm installs it under
       `apps/web/node_modules` and hoists nothing, so walk up from there until
       `package-lock.json` is found. */
    let dir = nextRoot;
    let lockPath = "";
    for (let i = 0; i < 10; i += 1) {
      const candidate = join(dir, "package-lock.json");
      if (existsSync(candidate)) { lockPath = candidate; break; }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    expect(lockPath, "package-lock.json above the installed next").not.toBe("");
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages: Record<string, { version?: string }>;
    };
    /* The key is the install path relative to the lockfile: `node_modules/next`
       when hoisted, `apps/web/node_modules/next` under the workspace. */
    const pinned = Object.entries(lock.packages).find(
      ([key]) => key === "node_modules/next" || key.endsWith("/node_modules/next"),
    );
    expect(pinned?.[1].version, "the lockfile pins the installed next").toBe(installed);
  });

  it("the app asks for a Next with that fix", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    const [major, minor] = (pkg.dependencies.next ?? "").replace(/^[^\d]*/, "").split(".").map(Number);
    expect(major! > 16 || (major === 16 && minor! >= 3)).toBe(true);
  });
});
