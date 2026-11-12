import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE OPENING, ON BOTH PHONES (founder's ruling, 7 November 2026, replacing
 * D68c): the exact mark draws itself in on the iPhone, the wordmark slides
 * out from behind it on both, never longer than about 2.2 s, never taking a
 * touch, a plain fade under Reduce Motion. Read from the sources the two
 * binaries are built from; nothing here runs Xcode or the Android SDK.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (p: string) => readFileSync(`${root}${p}`, "utf8");
const swift = read("ios/App/App/ValloShell.swift").replace(/\/\/.*$/gm, "");
const java = read("android/app/src/main/java/com/vallospaces/app/LaunchMark.java");
const num = (src: string, re: RegExp) => Number(src.match(re)?.[1]);

describe("the iPhone's drawn opening", () => {
  it("draws the ring along a centre line of 48 points inside the mark's box", () => {
    const body = swift.match(/static let ringLine: \[CGFloat\] = \[([\s\S]*?)\]/)?.[1] ?? "";
    const values = body.split(",").map((v) => v.trim()).filter(Boolean).map(Number);
    expect(values).toHaveLength(96);
    for (const v of values) expect(v >= 0 && v <= 1).toBe(true);
    expect(swift).toMatch(/ringMask\.path = line\.cgPath/);
    expect(swift).toMatch(/animate\(ringMask, "strokeEnd", from: 0, to: 1/);
  });

  it("raises four towers and slides five letters, then lands and hands over inside 2.2 s", () => {
    expect(swift).toMatch(/\(1\.\.\.4\)\.map \{ imageLayer\("LaunchTower/);
    expect(swift).toMatch(/\["V", "A", "L1", "L2", "O"\]\.map \{ imageLayer\("LaunchLetter/);
    const end = num(swift, /static let sequenceEnd: CFTimeInterval = ([\d.]+)/);
    const ceiling = num(swift, /static let ceiling: CFTimeInterval = ([\d.]+)/);
    const fade = num(swift, /static let fadeDuration: TimeInterval = ([\d.]+)/);
    const lastLetter = 0.74 + 0.06 * 4 + 0.42;
    expect(swift).toContain("delay: 0.74 + 0.06 * Double(i), duration: 0.42");
    expect(lastLetter).toBeLessThanOrEqual(end);
    expect(ceiling + fade).toBeLessThanOrEqual(2.2);
  });

  it("never takes a touch and honours Reduce Motion", () => {
    expect(swift).toMatch(/ground\.isUserInteractionEnabled = false/);
    expect(swift).toMatch(/quiet = UIAccessibility\.isReduceMotionEnabled[\s\S]*if quiet \{[\s\S]*UIView\.animate\(withDuration: 0\.2\)/);
  });

  it("reads its version line from the bundle", () => {
    expect(swift).toContain('Bundle.main.infoDictionary?["CFBundleShortVersionString"]');
  });
});

describe("Android's opening, drawn the same way (founder's ruling, 7 November 2026)", () => {
  it("keeps the system splash bare navy, so the drawing is the first mark anybody sees", () => {
    expect(read("android/app/src/main/res/values/styles.xml")).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/splash_blank</item>');
    expect(read("capacitor.config.ts")).toContain('androidSplashResourceName: "splash_blank"');
    for (const f of ["launch_ring", "launch_tower1", "launch_tower2", "launch_tower3", "launch_tower4", "launch_letter_v", "launch_letter_a", "launch_letter_l1", "launch_letter_l2", "launch_letter_o"]) {
      expect(existsSync(`${root}android/app/src/main/res/drawable-nodpi/${f}.png`), f).toBe(true);
    }
  });

  it("draws the ring along the SAME centre line as the iPhone, with the same stroke", () => {
    const iosBody = swift.match(/static let ringLine: \[CGFloat\] = \[([\s\S]*?)\]/)?.[1] ?? "";
    const androidBody = java.match(/static final float\[\] RING_LINE = \{([\s\S]*?)\};/)?.[1] ?? "";
    const ios = iosBody.split(",").map((v) => v.trim()).filter(Boolean).map(Number);
    const android = androidBody.split(",").map((v) => v.trim().replace(/f$/, "")).filter(Boolean).map(Number);
    expect(android).toEqual(ios);
    expect(java).toContain("RING_STROKE = 0.132f * 1.35f");
    expect(swift).toContain("ringStroke: CGFloat = 0.132 * 1.35");
  });

  it("plays every step on the iPhone's timings", () => {
    const ms = (name: string) => num(java, new RegExp(`${name} = (\\d+)`));
    expect(ms("RING_MS")).toBe(620);
    expect(ms("TOWER_BEGIN_MS")).toBe(200);
    expect(ms("TOWER_STEP_MS")).toBe(90);
    expect(ms("TOWER_MS")).toBe(460);
    expect(ms("LETTER_BEGIN_MS")).toBe(740);
    expect(ms("LETTER_STEP_MS")).toBe(60);
    expect(ms("LETTER_MS")).toBe(420);
    expect(ms("VERSION_BEGIN_MS")).toBe(950);
    expect(ms("SEQUENCE_END_MS")).toBe(num(swift, /static let sequenceEnd: CFTimeInterval = ([\d.]+)/) * 1000);
    expect(ms("SEQUENCE_CEILING_MS")).toBe(num(swift, /static let ceiling: CFTimeInterval = ([\d.]+)/) * 1000);
    expect(ms("SEQUENCE_CEILING_MS") + ms("FADE_MS")).toBeLessThanOrEqual(2200);
  });

  it("starts on the window's first real draw, never behind the splash", () => {
    expect(java).toMatch(/Build\.VERSION\.SDK_INT >= 31\) \{[\s\S]*?addOnDrawListener/);
    expect(java).toMatch(/static void handOff\(\) \{[\s\S]*?if \(!started\) start\(\);/);
  });

  it("never takes a touch, steps aside when animations are off, and is shown and handed over from the shell", () => {
    expect(java).toContain("g.setClickable(false)");
    expect(java).toContain("IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS");
    expect(java).toMatch(/if \(!animatorsOn\(\)\) \{\s*remove\(ground\);/);
    expect(read("android/app/src/main/java/com/vallospaces/app/MainActivity.java")).toContain("LaunchMark.show(this)");
    expect(read("android/app/src/main/java/com/vallospaces/app/ValloShellPlugin.java")).toContain("runOnUiThread(LaunchMark::handOff)");
  });
});

/*
 * THE OVERLAY ALWAYS GOES, ON EVERY PATH (audit, 12 November 2026).
 *
 * The queue says the opening is "over by 2.17 s" and that there is "a ceiling
 * if the page never hands over". Both were true on the iPhone and only partly
 * true on Android, and the test above pinned the TIMINGS without pinning the
 * EXITS, which is where the defect was: below Android 12 nothing arms the
 * sequence, so the only thing that ever started it was the page's hand-over,
 * and the packaged offline card never sent one. The overlay was then a BLANK
 * navy rectangle (ring undrawn, letters off the top, version line
 * transparent) until `giveUp` at CEILING_MS, six seconds, over App Review's
 * airplane mode cold start. minSdkVersion is 24.
 *
 * These pin the exits rather than the look, because the exits are what a
 * person is trapped by.
 */
describe("every way out of the opening", () => {
  const shellJs = read("native-shell/shell.js");

  it("the packaged offline card hands the launch mark over, as the live page does", () => {
    /* The card is what `server.errorPath` loads when the live origin cannot
       be reached, and it is the ONE page that can be sure the live app's
       startup script never ran. It hides the splash through the raw bridge
       primitive; it must hand the mark over the same way. */
    expect(shellJs).toContain('nativePromise("SplashScreen", "hide"');
    expect(shellJs).toContain('nativePromise("ValloShell", "handoff"');
    /* Both on the one path the card has. */
    expect(shellJs).toMatch(/function start\(win, doc\) \{\s*hideSplash\(win\);\s*handOffLaunchMark\(win\);/);
  });

  it("the iPhone schedules its ceiling in `show`, so no path can hold the overlay", () => {
    expect(swift).toMatch(/let ceiling = quiet \? quietMinimum \+ 1\.0 : LaunchMark\.ceiling/);
    expect(swift).toMatch(/asyncAfter\(deadline: \.now\(\) \+ ceiling\) \{ \[weak self\] in self\?\.handOff\(\) \}/);
    /* And the hand-over never waits past the ceiling, however early it came. */
    expect(swift).toContain("let wait = max(0, min(landed, LaunchMark.ceiling) - elapsed)");
  });

  it("Android schedules one too, for the paths that never reach `start`", () => {
    /* Two of them: animations switched off (finishAll, no animators to end)
       and, before the card was fixed, below Android 12 with no hand-over.
       `start` arms its own ceiling for a sequence that is really running, so
       a slow first draw is still not cut short. */
    expect(java).toMatch(/MAIN\.postDelayed\(LaunchMark::ceilingForIdle, SEQUENCE_CEILING_MS\)/);
    expect(java).toMatch(/private static void ceilingForIdle\(\) \{[\s\S]*?if \(!started \|\| !animatorsOn\(\)\) leave\(\);/);
    expect(java).toMatch(/MAIN\.postDelayed\(LaunchMark::leave, SEQUENCE_CEILING_MS\)/);
  });

  it("a rebuilt activity gets its own overlay instead of holding the dead one alive", () => {
    /* `MainActivity.recoverRenderer` calls recreate() when the system stops
       the web view's renderer for memory, and onCreate calls show() again.
       These fields are static: an overlay left from the activity that has
       gone kept that Activity alive here and this launch got no opening. */
    expect(java).toMatch(/if \(ground\.getContext\(\) == activity\) return;\s*remove\(ground\);/);
    expect(read("android/app/src/main/java/com/vallospaces/app/MainActivity.java")).toContain("recreate()");
  });
});

/*
 * WHICH CONTROLLER THE IPHONE ACTUALLY LAUNCHES (audit, 12 November 2026).
 *
 * Info.plist's scene configuration names `Main` as its storyboard and
 * AppDelegate builds `UISceneConfiguration(name: "Default Configuration")`,
 * which adopts that Info.plist entry, so UIKit can hand SceneDelegate a
 * window of its own before `willConnectTo` runs. The storyboard named
 * Capacitor's CAPBridgeViewController, which carries neither the edge swipe
 * back nor ValloShellPlugin, and SceneDelegate then allocated a SECOND window
 * unconditionally. Either half of that is a defect on its own: a launch on
 * the storyboard's controller silently loses the privacy cover, the crash
 * hand-over and the launch hand-over, and two windows mean two web views and
 * two loads of the live origin on one cold start.
 */
describe("the iPhone's launch, from the storyboard to the window", () => {
  const storyboard = read("ios/App/App/Base.lproj/Main.storyboard");
  const sceneDelegate = read("ios/App/App/SceneDelegate.swift");

  it("the storyboard instantiates Vallo's controller, not Capacitor's", () => {
    expect(storyboard).toContain('customClass="ValloBridgeViewController"');
    expect(storyboard).not.toContain('customClass="CAPBridgeViewController"');
    /* Exposed to the runtime under its plain name, so the storyboard resolves
       it whatever the target's module is called: a storyboard that cannot
       find its class kills the app at launch. */
    expect(swift).toContain("@objc(ValloBridgeViewController)");
    expect(swift).toMatch(/class ValloBridgeViewController: CAPBridgeViewController/);
  });

  it("that controller is the one carrying the gesture and the plugin", () => {
    expect(swift).toContain("webView?.allowsBackForwardNavigationGestures = true");
    expect(swift).toContain("bridge?.registerPluginInstance(ValloShellPlugin())");
  });

  it("one window: the one UIKit gave, if it gave one", () => {
    expect(sceneDelegate).toContain("if window == nil { window = UIWindow(windowScene: windowScene) }");
    expect(sceneDelegate).toMatch(/if !\(window\?\.rootViewController is ValloBridgeViewController\) \{/);
    expect(sceneDelegate).toContain("LaunchMark.shared.show(in: window)");
  });
});

/*
 * THE CRASH LOG, ON THE WAY DOWN (audit, 12 November 2026).
 *
 * NATIVE_BUILD_QUEUE item 6 says the fatal signals are "chained to the
 * previous handler and re-raised". Only the NSException half chained: the
 * install loop threw away `signal()`'s return value, so whatever was handling
 * the signal before this app was dropped for good. And `writeSignal` had no
 * re-entrancy guard, although `signal()` blocks only the signal it is
 * handling: a different fatal signal raised inside the handler re-opened the
 * record with O_TRUNC and lost it.
 */
describe("the iPhone's crash log in a signal context", () => {
  it("keeps every previous handler and runs it before the system's", () => {
    expect(swift).toMatch(/for sig in handled \{\s*let old = signal\(sig, valloSignalHandler\)/);
    expect(swift).toContain("previousSignal?[i] = unsafeBitCast(old, to: Int.self)");
    /* 0, 1 and -1 are the C ABI's SIG_DFL, SIG_IGN and SIG_ERR: not handlers. */
    expect(swift).toContain("if bits != 0, bits != 1, bits != -1 {");
    expect(swift).toMatch(/signal\(sig, SIG_DFL\)\s*raise\(sig\)/);
  });

  it("cannot re-enter itself when a second signal arrives on the way down", () => {
    expect(swift).toMatch(/if !writing \{\s*writing = true\s*writeSignal\(sig\)/);
  });

  it("primes every static the handler reads, so swift_once never runs in it", () => {
    /* Swift initialises a static stored property lazily through `swift_once`,
       which takes a lock, and a lock in a signal handler can hang a process
       that is already dying. Each of these is assigned in `install`, while
       the app is still healthy, which consumes its token. */
    const install = swift.match(/static func install\(\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
    expect(install.length).toBeGreaterThan(0);
    for (const primed of ["signalPath = ", "frames = ", "previousSignal = ", "writing = false"]) {
      expect(install, primed).toContain(primed);
    }
  });

  it("calls nothing in the handler that is not async-signal-safe", () => {
    /* `writeSignal` is the whole of what runs on the crashing thread besides
       the chain above. The path is strdup'd and the frame buffer allocated in
       `install`, and the label is a StaticString, so the handler allocates
       nothing. If a line here ever grows a Foundation call, this fails. */
    const body = swift.match(/static func writeSignal\(_ sig: Int32\) \{([\s\S]*?)\n    \}/)?.[1] ?? "";
    expect(body.length).toBeGreaterThan(0);
    for (const safe of ["open(path", "write(fd", "backtrace(frames", "backtrace_symbols_fd(frames", "close(fd)"]) {
      expect(body, safe).toContain(safe);
    }
    for (const unsafeCall of ["String(", "Data(", "JSONSerialization", "FileManager", "DispatchQueue", "NSLog", "print("]) {
      expect(body, unsafeCall).not.toContain(unsafeCall);
    }
    expect(swift).toContain("signalPath = strdup(");
    expect(swift).toContain("private static func signalLabel(_ sig: Int32) -> StaticString");
  });
});

/*
 * VALLO'S OWN NOTIFICATION SOUND (queue item 12): "the same samples" on both
 * phones. Read from the two files rather than believed. A CAF whose header
 * claims the wrong byte order plays the right samples as white noise on a
 * lock screen, and nothing in this repository could ever have heard it.
 */
describe("the chime, byte for byte", () => {
  const caf = readFileSync(`${root}ios/App/App/vallo_chime.caf`);
  const wav = readFileSync(`${root}android/app/src/main/res/raw/vallo_chime.wav`);
  /* 16-bit mono at 44.1 kHz for 0.8 s. */
  const PCM = 0.8 * 44100 * 2;

  it("is 0.8 s of 16-bit mono 44.1 kHz on both phones, the same bytes", () => {
    expect(wav.subarray(0, 4).toString("latin1")).toBe("RIFF");
    expect(wav.readUInt16LE(22)).toBe(1); /* channels */
    expect(wav.readUInt32LE(24)).toBe(44100); /* sample rate */
    expect(wav.readUInt16LE(34)).toBe(16); /* bits */
    expect(wav.length - 44).toBe(PCM);
    expect(caf.subarray(0, 4).toString("latin1")).toBe("caff");
    /* 8 bytes of file header, then the `desc` chunk: 4 of type, 8 of size,
       then the body (Float64 sample rate, then the four-character format). */
    expect(caf.subarray(8, 12).toString("latin1")).toBe("desc");
    expect(caf.readDoubleBE(20)).toBe(44100);
    expect(caf.subarray(28, 32).toString("latin1")).toBe("lpcm");
    expect(caf.subarray(-PCM).equals(wav.subarray(-PCM))).toBe(true);
  });

  it("the CAF says little endian, which is what those bytes are", () => {
    /* kCAFLinearPCMFormatFlagIsFloat is bit 0, IsLittleEndian is bit 1. The
       samples came from the WAV, which is little endian by definition, so a
       CAF without this bit is noise on the lock screen. */
    const flags = caf.readUInt32BE(32);
    expect(flags & 1, "not float").toBe(0);
    expect(flags & 2, "little endian").toBe(2);
  });

  it("is in the app target's resources, and named by the server for both phones", () => {
    expect(read("ios/App/App.xcodeproj/project.pbxproj")).toContain("vallo_chime.caf in Resources");
    const family = read("src/lib/push/family.ts");
    expect(family).toContain('CHIME_IOS = "vallo_chime.caf"');
    expect(family).toContain('CHIME_ANDROID = "vallo_chime"');
  });
});
