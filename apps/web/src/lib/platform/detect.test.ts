import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLATFORM_SCRIPT, applyPlatform, readPlatform } from "./detect";
import { STARTUP_NATIVE_SCRIPT } from "@/components/startup/startup-script";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 VALLO-NATIVE";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) VALLO-NATIVE";
const ANDROID_SHELL =
  "Mozilla/5.0 (Linux; Android 14; TECNO KJ5 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 VALLO-NATIVE";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; TECNO KJ5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const TABLE: Array<{ name: string; bridge?: string; ua: string; platform: string; native: boolean }> = [
  { name: "the iPhone shell", ua: IPHONE, platform: "ios", native: true },
  { name: "an iPad shell in desktop mode", ua: IPAD_DESKTOP, platform: "ios", native: true },
  { name: "the Android shell", ua: ANDROID_SHELL, platform: "android", native: true },
  { name: "Chrome on an Android phone (the website)", ua: ANDROID_CHROME, platform: "web", native: false },
  { name: "Safari on an iPhone (the website)", ua: SAFARI, platform: "web", native: false },
  { name: "the bridge outranks the user agent", bridge: "android", ua: IPHONE, platform: "android", native: true },
  { name: "a web bridge answer falls back to the user agent", bridge: "web", ua: SAFARI, platform: "web", native: false },
];

/** Run the inline script against a fake root, the way the head runs it. */
function runScript(ua: string, bridge?: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (n: string, v: string) => (attrs[n] = v) } };
  const window = bridge ? { Capacitor: { getPlatform: () => bridge } } : {};
  new Function("window", "document", "navigator", PLATFORM_SCRIPT)(window, document, { userAgent: ua });
  return attrs;
}

describe("which platform this page is on", () => {
  for (const row of TABLE) {
    it(`${row.name}: the function and the inline script agree`, () => {
      expect(readPlatform({ bridgePlatform: row.bridge, userAgent: row.ua })).toEqual({ platform: row.platform, native: row.native });
      const attrs = runScript(row.ua, row.bridge);
      expect(attrs["data-platform"]).toBe(row.platform);
      expect(attrs["data-native"]).toBe(row.native ? "true" : undefined);
    });
  }

  it("never throws, even with no user agent and a bridge that throws", () => {
    expect(readPlatform({})).toEqual({ platform: "web", native: false });
    const document = { documentElement: { setAttribute: () => {} } };
    const window = {
      Capacitor: {
        getPlatform: () => {
          throw new Error("bridge");
        },
      },
    };
    expect(() => new Function("window", "document", "navigator", PLATFORM_SCRIPT)(window, document, {})).not.toThrow();
  });

  it("applyPlatform marks a shell and unmarks a website", () => {
    const attrs = new Map<string, string>();
    const root = { setAttribute: (n: string, v: string) => attrs.set(n, v), removeAttribute: (n: string) => attrs.delete(n) };
    applyPlatform(root, { platform: "android", native: true });
    expect(Object.fromEntries(attrs)).toEqual({ "data-platform": "android", "data-native": "true" });
    applyPlatform(root, { platform: "web", native: false });
    expect(Object.fromEntries(attrs)).toEqual({ "data-platform": "web" });
  });

  it("is the first thing the first script in <head> does, before the splash's hide", () => {
    expect(STARTUP_NATIVE_SCRIPT.startsWith(PLATFORM_SCRIPT)).toBe(true);
  });

  it("is written with the same token the shell appends to its user agent", () => {
    const config = readFileSync(join(process.cwd(), "capacitor.config.ts"), "utf8");
    expect(config).toMatch(/appendUserAgent:\s*"VALLO-NATIVE"/);
  });
});

describe("platform.css", () => {
  const css = readFileSync(join(process.cwd(), "src/app/css/platform.css"), "utf8");
  const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("is imported once, after grade1.css and before the motion setting", () => {
    const at = (name: string) => globals.indexOf(`@import "./css/${name}"`);
    expect(globals.split('@import "./css/platform.css"').length).toBe(2);
    expect(at("platform.css")).toBeGreaterThan(at("grade1.css"));
    expect(at("platform.css")).toBeLessThan(at("motion-pref.css"));
  });

  it("only travels under no-preference and stands aside for Calm and Off", () => {
    const rules = css.split("@media (prefers-reduced-motion: no-preference)");
    const outside = rules[0] ?? "";
    expect(outside).not.toMatch(/animation:\s*var\(--nf-pt-/);
    for (const rule of css.match(/[^}]*::view-transition-(?:old|new)\(root\)\s*\{\s*z-index[^}]*\}/g) ?? []) {
      expect(rule).toContain('[data-motion="calm"]');
      expect(rule).toContain('[data-motion="off"]');
    }
  });

  it("changes nothing on the website: every rule is keyed on the shell", () => {
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes[\s\S]*?\n\}/g, "")
      .match(/(^|\})\s*([^{}@]+)\{/g) ?? [];
    for (const raw of selectors) {
      const sel = raw.replace(/^\}/, "").replace(/\{$/, "").trim();
      if (!sel || sel.startsWith("from") || sel.startsWith("to") || sel.startsWith(".nf-ripple")) continue;
      if (sel === ":root" || sel === ':root[dir="rtl"]') continue;
      expect(sel, sel).toContain("[data-native]");
    }
  });
});
