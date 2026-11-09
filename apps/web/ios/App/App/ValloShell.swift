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
//   LaunchMark                 the exact Vallo mark drawing itself in over the
//                              launch ground, the wordmark sliding out after
//                              it, handing over to the page without a flash
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
        CAPPluginMethod(name: "handoff", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notePath", returnType: CAPPluginReturnPromise)
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

    /// Android keeps the path for renderer recovery; WKWebView's own reload
    /// after a lost content process is Capacitor's, so iOS only answers.
    @objc func notePath(_ call: CAPPluginCall) {
        call.resolve()
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

/// THE OPENING, DRAWN (founder's ruling, 7 November 2026, replacing D68c:
/// "seriously animated, lovely and attractive"). Over the launch navy, the
/// exact Vallo mark draws itself in and the wordmark follows:
///
///   0.00 s  the ring draws round from its left tip, under the towers, to its
///           orange end (a stroke along its own centre line masks the ring)
///   0.20 s  the four towers rise one after another, left to right
///   0.74 s  the letters V A L L O slide down out from behind the mark, one by one
///   0.95 s  the version line fades in at the foot
///   1.40 s  the sequence has landed; the layer fades onto the page as soon as
///           the page has painted (`handoff`), and by 1.95 s at the latest, so
///           the whole opening is over inside 2.2 s
///
/// The pieces are the brand files themselves (`public/brand/vallo-mark.svg`
/// and `vallo-wordmark.svg`) cut into layers (ring, four towers, five
/// letters) that recompose to the whole logo pixel for pixel; the drawing is
/// done by vector masks over them. The Android overlay (`LaunchMark.java`)
/// shares the letters' timings and the centre line, held equal by
/// `src/lib/native/launch-sequence.test.ts`.
/// It never takes a touch: a tap lands on the page under it. Reduce Motion:
/// the finished logo fades in and out, nothing travels.
final class LaunchMark {
    static let shared = LaunchMark()
    private var layer: UIView?
    private var shownAt: CFTimeInterval = 0
    private var quiet = false

    /// Where the sequence has landed, and the ceiling for the hand-over.
    static let sequenceEnd: CFTimeInterval = 1.40
    static let ceiling: CFTimeInterval = 1.95
    static let fadeDuration: TimeInterval = 0.22
    /// Reduce Motion: the plain fade is not held longer than this for nothing.
    private let quietMinimum: CFTimeInterval = 0.45

    /// The ring's centre line, as fractions of the mark's box (x, y pairs),
    /// from its left tip round the bottom to its right end. Measured from the
    /// ring's own outline in vallo-mark.svg; `ringStroke` is its widest
    /// thickness, times 1.35 so the mask covers the antialiased edge.
    static let ringLine: [CGFloat] = [
        0.186, 0.5652, 0.161, 0.5844, 0.1372, 0.6058, 0.1151, 0.6299,
        0.0956, 0.6569, 0.0801, 0.6874, 0.0705, 0.721, 0.0701, 0.7561,
        0.0804, 0.7883, 0.0978, 0.816, 0.12, 0.8393, 0.1455, 0.858,
        0.1729, 0.8731, 0.2017, 0.8848, 0.2313, 0.8938, 0.2614, 0.9004,
        0.2917, 0.905, 0.3223, 0.9078, 0.3529, 0.909, 0.3836, 0.9087,
        0.4142, 0.9071, 0.4448, 0.9043, 0.4753, 0.9003, 0.5057, 0.8953,
        0.5359, 0.889, 0.5659, 0.8817, 0.5957, 0.8733, 0.6253, 0.8639,
        0.6547, 0.8534, 0.6837, 0.8417, 0.7123, 0.8288, 0.7405, 0.8147,
        0.7681, 0.7992, 0.7951, 0.7822, 0.8213, 0.7637, 0.8465, 0.7435,
        0.8704, 0.7212, 0.8927, 0.6969, 0.9125, 0.67, 0.9291, 0.6403,
        0.9404, 0.6076, 0.944, 0.5726, 0.9371, 0.538, 0.9207, 0.508,
        0.8981, 0.4838, 0.8721, 0.465, 0.8442, 0.4504, 0.8151, 0.4391,
    ]
    static let ringStroke: CGFloat = 0.132 * 1.35

    private static let markSize = CGSize(width: 76, height: 65)
    private static let wordSize = CGSize(width: 124, height: 26)
    /// The mark sits at the centre of the screen; the wordmark below it.
    private static let wordDrop: CGFloat = 58

    func show(in window: UIWindow) {
        guard layer == nil else { return }
        let ground = UIView(frame: window.bounds)
        ground.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        ground.backgroundColor = valloGround
        ground.isUserInteractionEnabled = false
        ground.accessibilityElementsHidden = true

        let size = LaunchMark.markSize
        let markFrame = CGRect(x: ground.bounds.midX - size.width / 2, y: ground.bounds.midY - size.height / 2, width: size.width, height: size.height)
        let mark = UIView(frame: markFrame)
        let word = UIView(frame: CGRect(x: ground.bounds.midX - LaunchMark.wordSize.width / 2,
                                        y: ground.bounds.midY + LaunchMark.wordDrop - LaunchMark.wordSize.height / 2,
                                        width: LaunchMark.wordSize.width, height: LaunchMark.wordSize.height))
        word.clipsToBounds = true
        for view in [mark, word] {
            view.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin, .flexibleBottomMargin]
            ground.addSubview(view)
        }

        let version = UILabel()
        version.text = "Version \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")"
        version.font = UIFont.systemFont(ofSize: 12, weight: .medium)
        version.textColor = UIColor.white.withAlphaComponent(0.55)
        version.sizeToFit()
        version.center = CGPoint(x: ground.bounds.midX, y: ground.bounds.maxY - max(window.safeAreaInsets.bottom, 34) - 16)
        version.autoresizingMask = [.flexibleLeftMargin, .flexibleRightMargin, .flexibleTopMargin]
        ground.addSubview(version)

        let ring = imageLayer("LaunchRing", in: mark.bounds)
        let towers = (1...4).map { imageLayer("LaunchTower\($0)", in: mark.bounds) }
        let letters = ["V", "A", "L1", "L2", "O"].map { imageLayer("LaunchLetter\($0)", in: word.bounds) }
        mark.layer.addSublayer(ring)
        towers.forEach { mark.layer.addSublayer($0) }
        letters.forEach { word.layer.addSublayer($0) }

        window.addSubview(ground)
        layer = ground
        shownAt = CACurrentMediaTime()
        quiet = UIAccessibility.isReduceMotionEnabled

        if quiet {
            for view in [mark, word, version] { view.alpha = 0 }
            UIView.animate(withDuration: 0.2) {
                for view in [mark, word, version] { view.alpha = 1 }
            }
        } else {
            draw(ring: ring, towers: towers, letters: letters, version: version, start: shownAt)
        }
        let ceiling = quiet ? quietMinimum + 1.0 : LaunchMark.ceiling
        DispatchQueue.main.asyncAfter(deadline: .now() + ceiling) { [weak self] in self?.handOff() }
    }

    private func imageLayer(_ name: String, in bounds: CGRect) -> CALayer {
        let l = CALayer()
        l.frame = bounds
        l.contents = UIImage(named: name)?.cgImage
        l.contentsGravity = .resize
        l.contentsScale = UIScreen.main.scale
        return l
    }

    private func draw(ring: CALayer, towers: [CALayer], letters: [CALayer], version: UILabel, start: CFTimeInterval) {
        let entrance = CAMediaTimingFunction(controlPoints: 0.16, 1, 0.3, 1)
        let sweep = CAMediaTimingFunction(controlPoints: 0.45, 0, 0.2, 1)
        let box = ring.bounds.size

        // The ring: a stroke along its own centre line is the mask, drawn on.
        let line = UIBezierPath()
        let pts = LaunchMark.ringLine
        for i in stride(from: 0, to: pts.count - 1, by: 2) {
            let p = CGPoint(x: pts[i] * box.width, y: pts[i + 1] * box.height)
            if i == 0 { line.move(to: p) } else { line.addLine(to: p) }
        }
        let ringMask = CAShapeLayer()
        ringMask.frame = ring.bounds
        ringMask.path = line.cgPath
        ringMask.fillColor = nil
        ringMask.strokeColor = UIColor.white.cgColor
        ringMask.lineWidth = LaunchMark.ringStroke * box.width
        ringMask.lineCap = .round
        ringMask.lineJoin = .round
        ring.mask = ringMask
        animate(ringMask, "strokeEnd", from: 0, to: 1, begin: start, delay: 0, duration: 0.62, timing: sweep)

        // The towers: each rises out of the ring, a mask growing up from its foot.
        for (i, tower) in towers.enumerated() {
            let wipe = CALayer()
            wipe.backgroundColor = UIColor.white.cgColor
            wipe.anchorPoint = CGPoint(x: 0.5, y: 1)
            wipe.frame = tower.bounds
            tower.mask = wipe
            animate(wipe, "transform.scale.y", from: 0.001, to: 1, begin: start, delay: 0.20 + 0.09 * Double(i), duration: 0.46, timing: entrance)
        }

        // The letters: out from behind the mark, one after another.
        for (i, letter) in letters.enumerated() {
            animate(letter, "transform.translation.y", from: -LaunchMark.wordSize.height, to: 0, begin: start, delay: 0.74 + 0.06 * Double(i), duration: 0.42, timing: entrance)
        }

        version.alpha = 0
        UIView.animate(withDuration: 0.3, delay: 0.95, options: [.curveEaseOut]) { version.alpha = 1 }
    }

    /// One property, from its first value (held until its start) to its last (kept).
    private func animate(_ target: CALayer, _ key: String, from: CGFloat, to: CGFloat, begin: CFTimeInterval, delay: CFTimeInterval, duration: CFTimeInterval, timing: CAMediaTimingFunction) {
        let a = CABasicAnimation(keyPath: key)
        a.fromValue = from
        a.toValue = to
        a.beginTime = begin + delay
        a.duration = duration
        a.timingFunction = timing
        a.fillMode = .backwards
        target.setValue(to, forKeyPath: key)
        target.add(a, forKey: key)
    }

    func handOff() {
        guard let ground = layer else { return }
        let elapsed = CACurrentMediaTime() - shownAt
        let landed = quiet ? quietMinimum : LaunchMark.sequenceEnd
        // Not before the logo has landed; never after the ceiling.
        let wait = max(0, min(landed, LaunchMark.ceiling) - elapsed)
        layer = nil
        UIView.animate(withDuration: LaunchMark.fadeDuration, delay: wait, options: [.curveEaseIn, .beginFromCurrentState]) {
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
