import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * STORE-08 / SEC-13: the privacy notice describes what the code does.
 *
 * Every third-party host the code sends personal data to must be named in
 * the notice, and the notice must not claim what the code does not do (it
 * said "analytics"; there are none). The notice is JSX, which this node suite
 * cannot render, so its source text is read.
 */
const src = fileURLToPath(new URL("../../", import.meta.url));
const privacy = readFileSync(join(src, "lib/legal/privacy.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}
const code = files(src).map((path) => readFileSync(path, "utf8")).join("\n");

/* host in the code → the name the notice must carry */
const PROCESSORS: Array<[RegExp, string]> = [
  [/supabase\.co/, "Supabase"],
  [/api\.paystack\.co|checkout\.paystack\.com/, "Paystack"],
  [/api\.ng\.termii\.com/, "Termii"],
  [/api\.twilio\.com/, "Twilio"],
  [/api\.payluk\.ng/, "Payluk"],
  [/api\.resend\.com/, "Resend"],
  [/api\.anthropic\.com/, "Anthropic"],
  [/api\.maptiler\.com/, "MapTiler"],
  [/basemaps\.cartocdn\.com/, "CARTO"],
  [/tiles\.openfreemap\.org/, "OpenFreeMap"],
  [/fcm\.googleapis\.com/, "Firebase Cloud Messaging"],
  [/api\.push\.apple\.com/, "Apple Push Notification service"],
  [/SENTRY_DSN/, "Sentry"],
  [/images\.unsplash\.com/, "Unsplash"],
];

describe("the privacy notice names every processor the code uses", () => {
  it.each(PROCESSORS)("%s → %s", (host, name) => {
    if (host.test(code)) expect(privacy).toContain(name);
  });

  it("names no processor the code does not use", () => {
    for (const [name, host] of [
      ["Termii", /termii/i],
      ["Google Places", /places\.googleapis/i],
      ["LiteAPI", /liteapi/i],
    ] as const) {
      if (!host.test(code)) expect(privacy).not.toContain(name);
    }
  });
});

describe("the notice claims nothing the code does not do", () => {
  it("claims no analytics", () => {
    expect(privacy).not.toMatch(/analytics (that|providers|help)/i);
    expect(privacy).not.toMatch(/Hosting, analytics/i);
    expect(privacy).toMatch(/no analytics/i);
  });

  it("describes location, push, device records, AI and crash data", () => {
    for (const phrase of ["Location.", "notification", "new device", "Anthropic", "crash report"]) {
      expect(privacy).toContain(phrase);
    }
  });

  it("describes verification as it runs: the selfie, the bank name check, a person deciding", () => {
    for (const phrase of ["a selfie we compare with the photo on your ID", "proof of address", "No decision about your identity is made by a machine alone", "holding your ID", "explicit consent"]) {
      expect(privacy).toContain(phrase);
    }
  });

  it("has an AI section the consent sheet can link to", () => {
    expect(privacy).toContain('id: "ai"');
    expect(readFileSync(join(src, "components/app/ai/AiConsentSheet.tsx"), "utf8")).toContain("/privacy#ai");
  });
});

describe("STORE-10: the reviewer seed accepts the versions the app serves", () => {
  it("reads TERMS_VERSION and PRIVACY_VERSION from versions.ts", async () => {
    const versions = readFileSync(join(src, "lib/legal/versions.ts"), "utf8");
    const seed = (await import("../../../../../scripts/seed/store-reviewer.mjs")) as {
      legalVersionsFrom: (source: string) => Array<{ document: string; version: string }>;
    };
    const { PRIVACY_VERSION, TERMS_VERSION } = await import("./versions");
    expect(seed.legalVersionsFrom(versions)).toEqual([
      { document: "terms", version: TERMS_VERSION },
      { document: "privacy", version: PRIVACY_VERSION },
    ]);
  });
});
