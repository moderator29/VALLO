import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* C15: the app target's privacy manifest exists, is bundled, and says what
   docs/store/PRIVACY_LABELS.md says. */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = readFileSync(`${root}ios/App/App/PrivacyInfo.xcprivacy`, "utf8").replace(/<!--[\s\S]*?-->/g, "");
const pbxproj = readFileSync(`${root}ios/App/App.xcodeproj/project.pbxproj`, "utf8");

describe("the iOS privacy manifest (C15)", () => {
  it("is in the app target's resources", () => {
    expect(pbxproj).toMatch(/PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile/);
    expect(pbxproj).toMatch(/\/\* PrivacyInfo\.xcprivacy in Resources \*\/,\n\t\t\t\);/);
  });

  it("declares no tracking and no tracking domains", () => {
    expect(manifest).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(manifest).toMatch(/<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
  });

  it("lists the collected types the store answers name", () => {
    for (const type of ["EmailAddress", "PreciseLocation", "PhotosorVideos", "DeviceID", "ProductInteraction", "PerformanceData"]) {
      expect(manifest).toContain(`NSPrivacyCollectedDataType${type}<`);
    }
  });

  /*
   * THIS TEST SAID THE OPPOSITE UNTIL 12 NOVEMBER 2026, and it was right when
   * it was written: "not crash data while Sentry is off". Build 1.0.2 then
   * added the shell's own crash capture (`ValloCrashLog` in ValloShell.swift,
   * `ValloCrashLog.java`), which records an uncaught exception and the fatal
   * signals and posts them to /api/client-error on the next launch. That is
   * Crash Data under Apple's Diagnostics heading whether or not Sentry is on,
   * and the manifest had not moved with the code. So the rule is tied to the
   * sources now rather than to a sentence about a third party: if the shell
   * collects crashes, the manifest says so.
   */
  it("declares crash data exactly when the shell collects crashes", () => {
    const collects =
      readFileSync(`${root}ios/App/App/ValloShell.swift`, "utf8").includes("NSSetUncaughtExceptionHandler");
    expect(manifest.includes("NSPrivacyCollectedDataTypeCrashData"), collects
      ? "ValloCrashLog installs handlers, so the manifest must declare Crash Data"
      : "nothing collects crashes any more, so the manifest must not declare Crash Data").toBe(collects);
  });
});
