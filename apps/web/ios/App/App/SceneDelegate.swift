import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Build 1.0.2: Vallo's own bridge controller (ValloShell.swift): the
        // edge swipe back and the shell plugin.
        window?.rootViewController = ValloBridgeViewController()
        window?.makeKeyAndVisible()
        // The exact mark and wordmark drawn in over the launch ground while
        // the first page loads; it hands over when the page has painted.
        if let window = window {
            LaunchMark.shared.show(in: window)
        }

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
