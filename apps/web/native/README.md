# Native Capacitor Plugins

Source files for native plugins that live outside the JS bundle. After
writing or changing a file here, copy it into the generated Capacitor
project (see below) and run `npx cap sync`. No Xcode or Android Studio
interaction is needed.

## ValloCallKit

Bridges the JS call lifecycle (`src/lib/native/call-kit.ts`) to iOS
CallKit and Android notification-based calling.

### How it works

- **iOS**: `CXProvider` for the system call UI (lock screen answer
  button, connected timer, mute/speaker from CarPlay or AirPods).
  CallKit and AVFoundation are system frameworks that link automatically.
- **Android**: high-priority notification with a full-screen intent for
  incoming calls, `AudioManager` for audio routing, notification
  channels for sound and vibration.

### iOS setup (all terminal, no Xcode)

The plugin files are already placed in the Capacitor project at
`ios/App/App/Plugins/ValloCallKit/`. If you ever need to re-copy from
the source templates:

```sh
cd apps/web
mkdir -p ios/App/App/Plugins/ValloCallKit
cp native/ios/ValloCallKit/ValloCallKitPlugin.swift ios/App/App/Plugins/ValloCallKit/
cp native/ios/ValloCallKit/ValloCallKitPlugin.m     ios/App/App/Plugins/ValloCallKit/
npx cap sync ios
```

CallKit and AVFoundation are system frameworks. The `import` statements
in the Swift file are enough; no Podfile or SPM change is needed.

**Background ringing (not yet wired)**: for CallKit to ring the phone
while the app is backgrounded, the `voip` background mode must be in
`Info.plist` and PushKit must deliver a VoIP push token. That is a
separate integration (see `VoipPushData` in `call-kit.ts`). Without it,
calls ring only while the app is on screen, which is the current state.

### Android setup (all terminal, no Android Studio)

The plugin file is already placed in the Capacitor project at
`android/app/src/main/java/com/vallospaces/app/plugins/callkit/`.
If you ever need to re-copy from the source template:

```sh
cd apps/web
mkdir -p android/app/src/main/java/com/vallospaces/app/plugins/callkit
cp native/android/vallocallkit/ValloCallKitPlugin.java \
   android/app/src/main/java/com/vallospaces/app/plugins/callkit/
npx cap sync android
```

**Registration**: the plugin is registered in `MainActivity.java`:

```java
registerPlugin(com.vallospaces.app.plugins.callkit.ValloCallKitPlugin.class);
```

**Permissions**: `FOREGROUND_SERVICE` and `USE_FULL_SCREEN_INTENT` are
declared in `AndroidManifest.xml` for the incoming-call notification.

### Building

```sh
cd apps/web
npx cap sync          # copies web assets + config into native projects
npx cap build ios     # produces the iOS archive
npx cap build android # produces the Android APK / AAB
```

### Testing

Built, not tested on a device. CallKit does not work in the iOS
simulator (no telephony). Test on a real iPhone and a real Android
phone. The JS bridge spec is in `src/lib/native/call-kit.ts`.
