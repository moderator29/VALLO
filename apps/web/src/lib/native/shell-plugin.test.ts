import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPrivateScreen } from "./privacy-cover-rule";
import { holdPrivacyCover, notePrivacyPath, privacyCoverWanted, setPrivacySink } from "./privacy-cover";
import { crashBody, sendNativeCrash, NATIVE_CRASH_KIND } from "./native-crash";
import { STARTUP_NATIVE_SCRIPT } from "@/components/startup/startup-script";

/**
 * Build 1.0.2's shell plugin (NATIVE_BUILD_QUEUE items 5, 6, 7), read from the
 * projects the binaries are built from. No Xcode and no Android SDK run here,
 * so these hold the two halves of every call to the same names, and the Swift
 * to the Capacitor API actually installed.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const repo = fileURLToPath(new URL("../../../../../", import.meta.url));
const read = (p: string) => readFileSync(`${root}${p}`, "utf8");
const noSwiftComments = (t: string) => t.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const swift = noSwiftComments(read("ios/App/App/ValloShell.swift"));
const scene = noSwiftComments(read("ios/App/App/SceneDelegate.swift"));
const delegate = noSwiftComments(read("ios/App/App/AppDelegate.swift"));
const pbxproj = read("ios/App/App.xcodeproj/project.pbxproj");
const plugin = read("src/lib/native/shell-plugin.ts");
const javaPlugin = read("android/app/src/main/java/com/vallospaces/app/ValloShellPlugin.java");
const activity = read("android/app/src/main/java/com/vallospaces/app/MainActivity.java");

const METHODS = ["setPrivacyCover", "takeCrashReport", "handoff"];

describe("the app switcher cover: which screens are private", () => {
  it("covers money, the passcode and identity screens", () => {
    for (const p of ["/wallet", "/wallet/withdraw", "/checkout/abc", "/pay/deposit/1", "/payouts", "/host/earnings/statement", "/agent/earnings", "/settings/passcode", "/verification", "/agreements/42/fund", "/rent/pay/9"]) {
      expect(isPrivateScreen(p), p).toBe(true);
    }
  });

  it("leaves browsing alone, and matches whole segments only", () => {
    for (const p of ["/home", "/search", "/listing/1", "/paying-guests", "/walletless", "/settings", "/agreements/42", "/rent"]) {
      expect(isPrivateScreen(p), p).toBe(false);
    }
  });

  it("tells the shell only when the answer changes, and a hold outlives a navigation", () => {
    const told: boolean[] = [];
    setPrivacySink((on) => told.push(on));
    notePrivacyPath("/home");
    notePrivacyPath("/search");
    notePrivacyPath("/wallet");
    notePrivacyPath("/wallet/add");
    const release = holdPrivacyCover();
    notePrivacyPath("/home");
    expect(privacyCoverWanted()).toBe(true);
    release();
    release();
    expect(told).toEqual([false, true, false]);
    setPrivacySink(null);
  });
});

describe("a crash of the shell reaches the crash log", () => {
  const report = { name: "NSException", message: "boom", stack: "0 App\n1 UIKit", release: "1.0.2 (14)", at: 1 };

  it("is sent as the client-error route reads it, with the platform", () => {
    const body = JSON.parse(crashBody(report, "ios"));
    expect(body).toMatchObject({ kind: NATIVE_CRASH_KIND, name: "NSException", message: "boom", area: "/native", platform: "ios", release: "1.0.2 (14)" });
  });

  it("reports whether it arrived, and never throws", async () => {
    const ok = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    const down = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await sendNativeCrash(report, "android", ok)).toBe(true);
    expect(await sendNativeCrash(report, "android", down)).toBe(false);
  });
});

describe("the two halves of ValloShell agree", () => {
  it("the page, iOS and Android name the same plugin and the same methods", () => {
    expect(plugin).toContain('registerPlugin<ValloShellPlugin>("ValloShell")');
    expect(swift).toContain('jsName = "ValloShell"');
    expect(javaPlugin).toContain('@CapacitorPlugin(name = "ValloShell")');
    for (const m of METHODS) {
      expect(plugin).toContain(`${m}(`);
      expect(swift).toContain(`CAPPluginMethod(name: "${m}"`);
      expect(swift).toContain(`@objc func ${m}(_ call: CAPPluginCall)`);
      expect(javaPlugin).toMatch(new RegExp(`@PluginMethod\\s+public void ${m}\\(PluginCall call\\)`));
    }
  });

  it("the launch hand-off is asked for through the raw bridge by the first script", () => {
    expect(STARTUP_NATIVE_SCRIPT).toContain("nativePromise('ValloShell','handoff'");
  });
});

describe("iOS: the shell is wired into the project", () => {
  it("ValloShell.swift is in the target's sources", () => {
    expect(pbxproj).toMatch(/\/\* ValloShell\.swift \*\/ = \{isa = PBXFileReference;[^}]*path = ValloShell\.swift;/);
    expect(pbxproj).toMatch(/\/\* ValloShell\.swift in Sources \*\/ = \{isa = PBXBuildFile;/);
    const sources = pbxproj.match(/isa = PBXSourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(sources).toContain("ValloShell.swift in Sources");
  });

  it("the scene uses Vallo's controller, shows the launch mark and covers on resign", () => {
    expect(scene).toContain("rootViewController = ValloBridgeViewController()");
    expect(scene).toContain("LaunchMark.shared.show(in: window)");
    expect(scene).toMatch(/func sceneWillResignActive[\s\S]*?PrivacyCover\.shared\.show/);
    expect(scene).toMatch(/func sceneDidBecomeActive[\s\S]*?PrivacyCover\.shared\.hide/);
    expect(delegate).toContain("ValloCrashLog.install()");
  });

  it("turns on the edge swipe back, and the launch mark honours Reduce Motion", () => {
    expect(swift).toContain("webView?.allowsBackForwardNavigationGestures = true");
    expect(swift).toContain("UIAccessibility.isReduceMotionEnabled");
    expect(swift).toMatch(/ground\.isUserInteractionEnabled = false/);
  });

  it("uses Capacitor API the installed version actually has", () => {
    const vc = readFileSync(`${repo}node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController.swift`, "utf8");
    const proto = readFileSync(`${repo}node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeProtocol.swift`, "utf8");
    expect(vc).toContain("open func capacitorDidLoad()");
    expect(proto).toContain("func registerPluginInstance(_ pluginInstance: CAPPlugin)");
  });

  it("the launch layers (the whole mark for the cover, the ring, four towers, five letters) are in the asset catalogue", () => {
    for (const set of ["LaunchMark", "LaunchRing", "LaunchTower1", "LaunchTower2", "LaunchTower3", "LaunchTower4", "LaunchLetterV", "LaunchLetterA", "LaunchLetterL1", "LaunchLetterL2", "LaunchLetterO"]) {
      const dir = `${root}ios/App/App/Assets.xcassets/${set}.imageset`;
      const contents = JSON.parse(readFileSync(`${dir}/Contents.json`, "utf8")) as { images: Array<{ filename?: string }> };
      const files = contents.images.map((i) => i.filename).filter(Boolean) as string[];
      expect(files.length).toBe(2);
      for (const f of files) expect(existsSync(`${dir}/${f}`), f).toBe(true);
    }
  });

  it("link preview is off in the config", () => {
    expect(read("capacitor.config.ts")).toMatch(/ios:\s*\{[\s\S]*allowsLinkPreview:\s*false/);
  });
});

describe("Android: the twin is registered before the bridge starts", () => {
  it("registers the plugin and arms the crash record before super.onCreate", () => {
    const body = activity.slice(activity.indexOf("public void onCreate"));
    const sup = body.indexOf("super.onCreate(");
    expect(body.indexOf("ValloCrashLog.install(this)")).toBeGreaterThan(-1);
    expect(body.indexOf("ValloCrashLog.install(this)")).toBeLessThan(sup);
    expect(body.indexOf("registerPlugin(ValloShellPlugin.class)")).toBeLessThan(sup);
    expect(body).toContain("onRenderProcessGone");
  });

  it("never blocks screenshots: the Recents cover only, on Android 13 and above", () => {
    expect(javaPlugin).toContain("setRecentsScreenshotEnabled(!on)");
    expect(javaPlugin.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain("FLAG_SECURE");
  });
});
