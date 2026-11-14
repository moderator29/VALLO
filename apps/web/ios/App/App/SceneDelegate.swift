import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // UIKIT MAY HAVE BUILT THE WINDOW ALREADY (12 November 2026).
        //
        // The scene configuration in Info.plist carries `UISceneStoryboardFile
        // = Main`, and `UISceneConfiguration(name:sessionRole:)` in AppDelegate
        // adopts the Info.plist entry of that name, so UIKit can hand this
        // delegate a window holding `Main.storyboard`'s root controller before
        // this method is called. Allocating a second window here left that
        // first one, and its web view, alive: two bridge controllers and two
        // loads of the live origin on one cold start, which on a metered data
        // bundle is the first page paid for twice.
        //
        // So the window UIKit gave is the one that is used, and its root
        // controller is replaced only when it is not already ours. The
        // storyboard now names `ValloBridgeViewController` too, so in the
        // ordinary case there is nothing to replace: one window, one web view,
        // one load, with the edge swipe back and the shell plugin on it.
        if window == nil { window = UIWindow(windowScene: windowScene) }
        if !(window?.rootViewController is ValloBridgeViewController) {
            window?.rootViewController = ValloBridgeViewController()
        }
        window?.makeKeyAndVisible()
        // THE OPENING IS THE PAGE'S (founder's ruling, 14 November 2026).
        // The mark this shell used to draw over the launch ground is retired:
        // the only opening a person sees is the page's own lockup, and the
        // plain launch ground holds until the page says it has painted.
        // `ValloShell.pageOpens` tells the page so, and it starts at once.

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    // THE APP SWITCHER COVER (build 1.0.2). iOS takes the switcher's picture
    // after the scene resigns active, so the cover goes up here when the page
    // says the screen is private, and comes down as soon as it is active again.
    func sceneWillResignActive(_ scene: UIScene) {
        PrivacyCover.shared.show(in: window)
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        PrivacyCover.shared.show(in: window)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        PrivacyCover.shared.hide()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
