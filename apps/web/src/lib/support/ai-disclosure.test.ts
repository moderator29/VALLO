import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UX-15 / UX-25: the support chat says it is AI, "agent" is left to estate
 * agents, the Help row goes to FAQs and says so, and neither model is told
 * that every listing has a real person behind it (most are examples today).
 */
const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("the helper says what it is", () => {
  it("greets as an AI helper, not a person", () => {
    const chat = src("components/app/account/SupportChat.tsx");
    expect(chat).toContain("I am Vallo's AI support helper, not a person.");
    expect(chat).toContain("An AI helper that reads your own bookings");
    expect(chat).not.toContain("I am Vallo's support agent");
  });

  it("is told it is not a person, and that examples cannot be booked", () => {
    const support = src("app/api/support/route.ts");
    expect(support).toContain("You are Vallo's AI support helper. You are not a person");
    /* The assistant's tools live one per file since AI-01; they are model
       text too, so they are read with the route. */
    for (const file of [
      "app/api/support/route.ts",
      "app/api/assistant/route.ts",
      "lib/assistant/tools/search-listings.ts",
      "lib/assistant/tools/compare-listings.ts",
      "lib/assistant/tools/area-intel.ts",
      "lib/assistant/tools/find-screen.ts",
    ]) {
      const text = src(file);
      expect(text, file).not.toMatch(/put up by a real person/);
      expect(text, file).not.toMatch(/always somebody to message/);
    }
    expect(src("lib/assistant/tools/search-listings.ts")).toContain("...(l.isDemo ? { example: true } : {}),");
  });

  it("labels the Help row as the FAQs it opens", () => {
    /* The Help row moved into the profile's Support group (9 November 2026),
       which both the signed-in and signed-out profile draw. */
    expect(src("components/app/account/SupportGroup.tsx")).toContain('sub="FAQs, contact us"');
    expect(src("app/(app)/profile/AccountBody.tsx")).toContain("<SupportGroup />");
    const en = readFileSync(join(process.cwd(), "..", "..", "packages/i18n/src/locales/en.ts"), "utf8");
    expect(en).not.toContain("Get an answer from a person");
  });
});
