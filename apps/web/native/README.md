# Native Capacitor Plugins

These files go into the generated Capacitor native project after `npx cap sync`.

## ValloCallKit

Bridges the JS call lifecycle to iOS CallKit and Android notification-based calling.

### iOS Setup

1. Run `npx cap sync ios`
2. Copy `ios/ValloCallKit/` into the Xcode project under `App/App/Plugins/ValloCallKit/`
3. Add the CallKit and AVFoundation frameworks to the target
4. Add the `voip` background mode in Info.plist (`UIBackgroundModes`)
5. Build and test on a real device (CallKit does not work in the simulator)

### Android Setup

1. Run `npx cap sync android`
2. Copy `android/vallocallkit/ValloCallKitPlugin.kt` into `android/app/src/main/java/com/vallo/app/plugins/callkit/`
3. Register the plugin in `MainActivity.kt`:
   ```kotlin
   add(com.vallo.app.plugins.callkit.ValloCallKitPlugin::class.java)
   ```
4. Add the `FOREGROUND_SERVICE` and `USE_FULL_SCREEN_INTENT` permissions to AndroidManifest.xml
5. Build and test on a real device
