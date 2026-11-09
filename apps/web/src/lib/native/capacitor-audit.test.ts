import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE CAPACITOR AUDIT FOR BUILD 1.0.2 (Agent NATIVE job 8), held as tests so
 * a later change cannot quietly undo it. Read from the files the two binaries
 * are built from; nothing here runs Xcode or the Android SDK.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const repo = fileURLToPath(new URL("../../../../../", import.meta.url));
const read = (p: string) => readFileSync(p, "utf8");
const noXmlComments = (t: string) => t.replace(/<!--[\s\S]*?-->/g, "");
const plist = noXmlComments(read(`${root}ios/App/App/Info.plist`));
const manifest = noXmlComments(read(`${root}android/app/src/main/AndroidManifest.xml`));
const pkg = JSON.parse(read(`${root}package.json`)) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

const PLUGINS = ["app", "browser", "camera", "haptics", "keyboard", "push-notifications", "share", "splash-screen", "status-bar"];

describe("versions", () => {
  it("core, CLI, iOS and Android are one exact version, and every plugin is on the same major", () => {
    const v = (name: string) => (JSON.parse(read(`${repo}node_modules/@capacitor/${name}/package.json`)) as { version: string }).version;
    const core = v("core");
    for (const name of ["cli", "ios", "android"]) expect(v(name), name).toBe(core);
    const major = core.split(".")[0];
    for (const name of PLUGINS) expect(v(name).split(".")[0], name).toBe(major);
  });

  it("the iOS package list pins the installed Capacitor and lists every plugin the app declares", () => {
    const spm = read(`${root}ios/App/CapApp-SPM/Package.swift`);
    const core = (JSON.parse(read(`${repo}node_modules/@capacitor/ios/package.json`)) as { version: string }).version;
    expect(spm).toContain(`exact: "${core}"`);
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => d.startsWith("@capacitor/") && PLUGINS.includes(d.slice(11)));
    for (const dep of declared) expect(spm, dep).toContain(`node_modules/${dep}"`);
  });
});

describe("iOS", () => {
  const usage = (key: string) => plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1] ?? null;

  it("says why for every protected resource the app uses, in full sentences", () => {
    for (const key of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription", "NSPhotoLibraryUsageDescription", "NSLocationWhenInUseUsageDescription", "NSFaceIDUsageDescription"]) {
      expect(usage(key)?.length ?? 0, key).toBeGreaterThan(60);
    }
    /* Never asks for location in the background. */
    expect(plist).not.toContain("NSLocationAlwaysAndWhenInUseUsageDescription");
  });

  it("needs no photo-library ADD string, because the camera never saves to the gallery", () => {
    expect(read(`${root}src/lib/native/device.ts`)).toContain("saveToGallery: false");
    expect(plist).not.toContain("NSPhotoLibraryAddUsageDescription");
  });

  it("is a controlled status bar, background push, no arbitrary loads, exempt encryption", () => {
    expect(plist).toMatch(/<key>UIViewControllerBasedStatusBarAppearance<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>UIBackgroundModes<\/key>\s*<array>\s*<string>remote-notification<\/string>/);
    expect(plist).toMatch(/<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
    expect(plist).toMatch(/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);
  });

  it("keeps App-Bound Domains to Apple's limit of ten", () => {
    const list = plist.match(/<key>WKAppBoundDomains<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? "";
    const domains = list.match(/<string>[^<]+<\/string>/g) ?? [];
    expect(domains.length).toBeGreaterThan(0);
    expect(domains.length).toBeLessThanOrEqual(10);
  });

  it("the app's own Swift uses no required-reason API, so its privacy manifest declares none", () => {
    const swift = ["App/AppDelegate.swift", "App/SceneDelegate.swift", "App/ValloShell.swift", "VALLONotificationService/NotificationService.swift"]
      .map((f) => read(`${root}ios/App/${f}`).replace(/\/\/.*$/gm, ""))
      .join("\n");
    for (const api of ["UserDefaults", "systemUptime", "mach_absolute_time", "creationDate", "contentModificationDate", "modificationDate", "volumeAvailableCapacity", "activeInputModes"]) {
      expect(swift, api).not.toContain(api);
    }
  });
});

describe("Android", () => {
  const permissions = [...manifest.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1]);

  it("declares what the app uses, including the network state the web view needs for online and offline", () => {
    for (const p of ["INTERNET", "ACCESS_NETWORK_STATE", "POST_NOTIFICATIONS", "CAMERA", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]) {
      expect(permissions, p).toContain(`android.permission.${p}`);
    }
  });

  it("asks for nothing it does not use", () => {
    for (const p of ["ACCESS_BACKGROUND_LOCATION", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "READ_CONTACTS", "SYSTEM_ALERT_WINDOW"]) {
      expect(permissions, p).not.toContain(`android.permission.${p}`);
    }
  });

  it("no cleartext, no backup of the session, predictive back on, camera and microphone optional", () => {
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:enableOnBackInvokedCallback="true"');
    expect(manifest).toContain('<uses-feature android:name="android.hardware.camera" android:required="false" />');
    expect(manifest).toContain('<uses-feature android:name="android.hardware.microphone" android:required="false" />');
  });

  it("debugging is off in release, and https only", () => {
    const config = read(`${root}capacitor.config.ts`);
    expect(config).toContain("webContentsDebuggingEnabled: false");
    expect(config).toContain('androidScheme: "https"');
    expect(config).toContain("cleartext: false");
  });
});
