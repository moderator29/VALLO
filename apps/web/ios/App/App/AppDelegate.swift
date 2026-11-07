import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Deliberately NOT claiming `UNUserNotificationCenter.current().delegate`.
        // Capacitor's bridge installs its own `NotificationRouter` as that
        // delegate when it starts (`CapacitorBridge.swift`), which replaces
        // anything set here, and the router hands foreground presentation and
        // taps to the push plugin. See the note at the bottom of this file.

        // Build 1.0.2: a crash of the shell itself is written on the way
        // down and handed to the page on the next launch (ValloShell.swift).
        ValloCrashLog.install()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // MARK: - Push notifications
    //
    // THESE THREE METHODS ARE THE ONLY BRIDGE BETWEEN APNS AND THE PLUGIN,
    // AND WITHOUT THEM PUSH FAILS SILENTLY AND COMPLETELY.
    //
    // `PushNotifications.register()` asks iOS to register with APNs. iOS
    // answers by calling one of the first two methods below on the APP
    // DELEGATE, not on the plugin. If they are absent, the token is delivered
    // to nobody, the plugin's `registration` listener never fires, and the
    // JavaScript side waits for an event that cannot arrive. Nothing errors.
    // It is the exact shape of failure this whole feature was written to
    // refuse, and it is a missing method rather than a missing line of logic.
    //
    // `NotificationCenter` is how Capacitor's plugin receives them: it
    // observes these names and does the rest. Posting the notification is all
    // that is required here, and doing more would duplicate the plugin.
    //
    // Showing a notification while the application is in the foreground is
    // NOT done here: see the note at the bottom of this file.

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications,
                                        object: deviceToken)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // A real failure to tell the web layer about: no network, no
        // entitlement, or a provisioning profile without the Push
        // Notifications capability. The last of those is what this project
        // will hit until the owner has an Apple Developer account, and it is
        // written up in `App.entitlements`.
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications,
                                        object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Notification centre delegate: owned by Capacitor, not by this class
//
// This file used to extend AppDelegate as a `UNUserNotificationCenterDelegate`
// to show banners in the foreground and forward taps. Removed on 28 September
// 2026 (native release audit), for two reasons, either of which was enough:
//
// 1. IT DID NOT COMPILE. The tap method posted
//    `Notification.Name.capacitorDidReceiveNotificationResponse`, a name that
//    does not exist in Capacitor 8.5 (`CAPNotifications.swift` defines the
//    full list). No Xcode build had ever run, so nothing caught it.
// 2. IT WOULD NEVER HAVE RUN. `CapacitorBridge` sets its `NotificationRouter`
//    as the centre's delegate when the web view loads, after launch, so the
//    router wins. The router gives `willPresent` to the push plugin, which
//    reads `plugins.PushNotifications.presentationOptions` from
//    `capacitor.config.ts` (badge, sound, alert), and gives the tap to the
//    plugin, which raises `pushNotificationActionPerformed` for
//    `src/lib/native/push-taps.ts`. Foreground banners and tap routing are
//    therefore both handled without any code here.
