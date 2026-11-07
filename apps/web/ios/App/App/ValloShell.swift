import UIKit
import WebKit
import Capacitor

// VALLO'S OWN SHELL, BUILD 1.0.2 (Agent NATIVE, job 2, 7 November 2026).
//
// Everything the iPhone app does that a web page cannot, kept in one file:
//
//   ValloBridgeViewController  the web view with the iPhone's own edge swipe
//                              back, and Vallo's shell plugin registered
//   ValloShellPlugin           what the page can ask of the shell
//                              (`src/lib/native/shell-plugin.ts`)
//   PrivacyCover               the app switcher picture of a money or identity
//                              screen shows the Vallo ground and mark instead
//   LaunchMark                 the exact Vallo mark and wordmark drawn in over
//                              the launch ground while the first page loads,
//                              handing over to it without a flash
//   ValloCrashLog              a crash of the shell itself, written on the way
//                              down and handed to the page on the next launch,
//                              which sends it to Vallo's own crash log
//
// NONE OF THIS SHIPS UNTIL BUILD 1.0.2 (docs/handoff/NATIVE_BUILD_QUEUE.md).
// Written against Capacitor 8.5 as installed; built and NOT tested on a
// device: no Xcode runs in this repository.

/// The launch ground, `CHROME_COLOUR.dark` (#010118), the same navy as the
/// launch storyboard, the splash plugin and the page's own first frame.
private let valloGround = UIColor(red: 1.0 / 255.0, green: 1.0 / 255.0, blue: 24.0 / 255.0, alpha: 1)

// MARK: - The web view

class ValloBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // THE IPHONE'S OWN BACK GESTURE. A swipe from the left edge walks the
        // web view's history with WebKit's live preview of the page beneath,
        // exactly as Safari does. The App Router answers the resulting
        // `popstate` without a view transition of its own, so the page never
        // animates twice for one swipe.
        webView?.allowsBackForwardNavigationGestures = true
        bridge?.registerPluginInstance(ValloShellPlugin())
    }
}

// MARK: - The plugin

@objc(ValloShellPlugin)
public class ValloShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ValloShellPlugin"
    public let jsName = "ValloShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPrivacyCover", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeCrashReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "handoff", returnType: CAPPluginReturnPromise)
    ]

    @objc func setPrivacyCover(_ call: CAPPluginCall) {
        let on = call.getBool("on", false)
        DispatchQueue.main.async { PrivacyCover.shared.wanted = on }
        call.resolve()
    }

    @objc func takeCrashReport(_ call: CAPPluginCall) {
        if let report = ValloCrashLog.take() {
            call.resolve(["report": report])
        } else {
            call.resolve(["report": NSNull()])
        }
    }

    @objc func handoff(_ call: CAPPluginCall) {
        DispatchQueue.main.async { LaunchMark.shared.handOff() }
        call.resolve()
    }
}

// MARK: - The app switcher cover

/// The page says whether the screen now showing is private (wallet, checkout,
/// payouts, passcode, identity documents: `privacy-cover-rule.ts`). When the
/// scene is about to leave the screen, the cover goes up before iOS takes the
/// switcher's picture, and comes down the moment the scene is active again.
final class PrivacyCover {
    static let shared = PrivacyCover()
    var wanted = false
    private var cover: UIView?

    func show(in window: UIWindow?) {
        guard wanted, cover == nil, let window = window else { return }
        let ground = UIView(frame: window.bounds)
        ground.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        ground.backgroundColor = valloGround
        ground.isUserInteractionEnabled = false
        if let image = UIImage(named: "LaunchMark") {
            let mark = UIImageView(image: image)
            mark.contentMode = .scaleAspectFit
            mark.frame = CGRect(x: 0, y: 0, width: 76, height: 65)
            mark.center = CGPoint(x: ground.bounds.midX, y: ground.bounds.midY)
            mark.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin]
            ground.addSubview(mark)
        }
        window.addSubview(ground)
        cover = ground
    }

    func hide() {
        cover?.removeFromSuperview()
        cover = nil
    }
}

// MARK: - The launch mark

/// The exact Vallo mark and wordmark (`public/brand/vallo-mark.svg` and
/// `vallo-wordmark.svg`, drawn into the asset catalogue) over the launch
/// ground while the first page loads. The mark settles in, the wordmark
/// follows, and the whole layer fades onto the page once the page says it has
/// painted (`handoff`, from the first script in the document) or after
/// `ceiling` seconds whatever happens. It never takes a touch, so a tap on the
/// page under it lands. Reduce Motion: it simply fades in and out.
final class LaunchMark {
    static let shared = LaunchMark()
    private var layer: UIView?
    private var shownAt: CFTimeInterval = 0
    /// A half-drawn mark leaving reads as a glitch: it stays this long at least.
    private let minimumVisible: CFTimeInterval = 0.45
    private let ceiling: TimeInterval = 3.0

    func show(in window: UIWindow) {
        guard layer == nil else { return }
        let ground = UIView(frame: window.bounds)
        ground.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        ground.backgroundColor = valloGround
        ground.isUserInteractionEnabled = false

        let mark = UIImageView(image: UIImage(named: "LaunchMark"))
        mark.contentMode = .scaleAspectFit
        mark.frame = CGRect(x: 0, y: 0, width: 76, height: 65)
        let word = UIImageView(image: UIImage(named: "LaunchWordmark"))
        word.contentMode = .scaleAspectFit
        word.frame = CGRect(x: 0, y: 0, width: 124, height: 26)

        let midX = ground.bounds.midX
        let midY = ground.bounds.midY
        mark.center = CGPoint(x: midX, y: midY - 24)
        word.center = CGPoint(x: midX, y: midY + 34)
        for view in [mark, word] {
            view.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin]
            ground.addSubview(view)
        }
        window.addSubview(ground)
        layer = ground
        shownAt = CACurrentMediaTime()

        mark.alpha = 0
        word.alpha = 0
        if UIAccessibility.isReduceMotionEnabled {
            UIView.animate(withDuration: 0.2) {
                mark.alpha = 1
                word.alpha = 1
            }
        } else {
            mark.transform = CGAffineTransform(scaleX: 0.86, y: 0.86)
            word.transform = CGAffineTransform(translationX: 0, y: 8)
            UIView.animate(withDuration: 0.56, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0, options: [.curveEaseOut]) {
                mark.alpha = 1
                mark.transform = .identity
            }
            UIView.animate(withDuration: 0.36, delay: 0.16, options: [.curveEaseOut]) {
                word.alpha = 1
                word.transform = .identity
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + ceiling) { [weak self] in self?.handOff() }
    }

    func handOff() {
        guard let ground = layer else { return }
        layer = nil
        let wait = max(0, minimumVisible - (CACurrentMediaTime() - shownAt))
        UIView.animate(withDuration: 0.22, delay: wait, options: [.curveEaseIn, .beginFromCurrentState]) {
            ground.alpha = 0
        } completion: { _ in
            ground.removeFromSuperview()
        }
    }
}

// MARK: - The crash log

/// A crash of the shell itself: an uncaught Objective-C exception (a plugin,
/// UIKit) or a fatal signal. Written on the way down to Application Support
/// and handed to the page once, on the next launch (`takeCrashReport`), which
/// posts it to `/api/client-error` with platform `ios`. The record holds the
/// type, the reason and the shell's own frames: never page content.
enum ValloCrashLog {
    private static let exceptionName = "vallo-crash.json"
    private static let signalName = "vallo-crash.signal"
    private static var signalPath: UnsafeMutablePointer<CChar>?
    private static var frames: UnsafeMutablePointer<UnsafeMutableRawPointer?>?
    private static var previousException: (@convention(c) (NSException) -> Void)?

    private static var folder: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?.appendingPathComponent("vallo", isDirectory: true)
    }

    static func install() {
        guard let folder = folder else { return }
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        signalPath = strdup(folder.appendingPathComponent(signalName).path)
        frames = UnsafeMutablePointer<UnsafeMutableRawPointer?>.allocate(capacity: 64)

        previousException = NSGetUncaughtExceptionHandler()
        NSSetUncaughtExceptionHandler { exception in
            ValloCrashLog.writeException(exception)
            ValloCrashLog.previousException?(exception)
        }
        for sig in [SIGABRT, SIGSEGV, SIGBUS, SIGILL, SIGFPE, SIGTRAP] {
            signal(sig, valloSignalHandler)
        }
    }

    fileprivate static func writeSignal(_ sig: Int32) {
        guard let path = signalPath else { return }
        let fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0o600)
        guard fd >= 0 else { return }
        let name = signalLabel(sig)
        _ = write(fd, name.utf8Start, name.utf8CodeUnitCount)
        let newline: StaticString = "\n"
        _ = write(fd, newline.utf8Start, newline.utf8CodeUnitCount)
        if let frames = frames {
            let count = backtrace(frames, 64)
            backtrace_symbols_fd(frames, count, fd)
        }
        close(fd)
    }

    private static func writeException(_ exception: NSException) {
        guard let folder = folder else { return }
        let record: [String: Any] = [
            "name": exception.name.rawValue,
            "message": exception.reason ?? "",
            "stack": exception.callStackSymbols.prefix(60).joined(separator: "\n"),
            "release": release,
            "at": Int(Date().timeIntervalSince1970 * 1000)
        ]
        if let data = try? JSONSerialization.data(withJSONObject: record) {
            try? data.write(to: folder.appendingPathComponent(exceptionName), options: .atomic)
        }
    }

    private static var release: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(version) (\(build))"
    }

    /// The last run's crash, once: the files are removed as they are read. An
    /// uncaught exception also aborts, so when both files exist the exception,
    /// which says more, is the one handed over.
    static func take() -> JSObject? {
        guard let folder = folder else { return nil }
        let exceptionURL = folder.appendingPathComponent(exceptionName)
        let signalURL = folder.appendingPathComponent(signalName)
        defer {
            try? FileManager.default.removeItem(at: exceptionURL)
            try? FileManager.default.removeItem(at: signalURL)
        }
        if let data = try? Data(contentsOf: exceptionURL),
           let record = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return [
                "name": record["name"] as? String ?? "NSException",
                "message": record["message"] as? String ?? "",
                "stack": record["stack"] as? String ?? "",
                "release": record["release"] as? String ?? release,
                "at": record["at"] as? Int ?? 0
            ]
        }
        if let text = try? String(contentsOf: signalURL, encoding: .utf8) {
            var lines = text.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
            let name = lines.isEmpty ? "SIGNAL" : lines.removeFirst()
            return [
                "name": name,
                "message": "The app stopped on \(name)",
                "stack": lines.prefix(60).joined(separator: "\n"),
                "release": release,
                // Dated when read: a file timestamp would be a required
                // reason API in the privacy manifest for one number.
                "at": Int(Date().timeIntervalSince1970 * 1000)
            ]
        }
        return nil
    }

    private static func signalLabel(_ sig: Int32) -> StaticString {
        switch sig {
        case SIGABRT: return "SIGABRT"
        case SIGSEGV: return "SIGSEGV"
        case SIGBUS: return "SIGBUS"
        case SIGILL: return "SIGILL"
        case SIGFPE: return "SIGFPE"
        case SIGTRAP: return "SIGTRAP"
        default: return "SIGNAL"
        }
    }
}

/// Runs on the crashing thread with the process already broken: writes the
/// record with plain system calls, then hands the signal back to the system,
/// so the operating system's own crash report is still made.
private func valloSignalHandler(_ sig: Int32) {
    ValloCrashLog.writeSignal(sig)
    signal(sig, SIG_DFL)
    raise(sig)
}
