# Video calling: web, iOS and Android

**Status, plainly: no native build has been made and no phone has run a call.**
Everything below about the shells is read from Capacitor 8.5.2's source in
`node_modules` and from the projects in `apps/web/ios` and `apps/web/android`.
The only real call so far ran between two headless desktop Chromium pages
(`VIDEO-CALLING-TEST-REPORT.md`).

## How calls work in the shell

The shells load `https://www.vallospaces.com` in a system WebView (WKWebView,
Android System WebView). A call is plain WebRTC in that page (`livekit-client`),
so no Capacitor plugin is needed for a call in the foreground. The origin is
https, a secure context, which `getUserMedia` requires.

### What VC1 changed (needs a native rebuild and `cap sync`)

| Where | Change | Why |
|---|---|---|
| `next.config.ts` | `Permissions-Policy: camera=(self), microphone=(self)` (was `()`) | `()` made every `getUserMedia` fail with no prompt, in browsers and in both shells |
| `lib/security/csp.ts` | `connect-src` adds the LiveKit host from `LIVEKIT_URL` (`*.livekit.cloud` for Cloud) | signalling over wss and the region lookup over https |
| Android `AndroidManifest.xml` | `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`; `uses-feature` camera, autofocus, microphone `required="false"` | Capacitor's `BridgeWebChromeClient.onPermissionRequest` maps the page's VIDEO_CAPTURE to CAMERA and AUDIO_CAPTURE to MODIFY_AUDIO_SETTINGS + RECORD_AUDIO as one runtime batch and grants the page only if all are granted; undeclared permissions are refused silently. The features keep the app installable on devices without a camera |
| iOS `Info.plist` | `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` now name calls | iOS shows them in the system prompt; Capacitor's `WebViewDelegationHandler` already grants WebKit's media-capture request (iOS 15+, the deployment target) and `allowsInlineMediaPlayback` is already on |
| `MainActivity.java` | **no change needed** | the bridge's own WebChromeClient handles the grant |

### A side effect on Android photo capture

With CAMERA declared, a `capture` file input (ShowMe video, arrival photos)
and the Camera plugin now ask for the camera permission first (once). Before,
they went straight to the system camera app. A refusal returns no photo to
that input; choosing from the gallery still works. Accepted for calls; the
manifest comment records it.

## What the screens must do on mobile (frontend)

- Ask for media only after a tap (start or answer), never on page load.
- Denied: show recovery. iOS: Settings > Vallo > Camera / Microphone.
  Android: App info > Permissions. Android stops prompting after two
  refusals, so never loop the request. Offer voice only, or keep messaging.
- Audio routing: WebRTC in a WebView plays through the earpiece or speaker
  as the OS decides; `setSinkId` is not available in WKWebView. Offer a
  speaker toggle only where `HTMLMediaElement.setSinkId` exists (Android
  Chrome WebView), otherwise rely on the OS (Bluetooth and wired headsets are
  routed by the OS).
- Camera switch: `room.switchActiveDevice('videoinput', ...)` or restart the
  track with `facingMode`; test both phones.
- Background: on iOS the WebView's capture stops when the app leaves the
  foreground; on resume, republish or show "camera paused". Listen to
  `App.addListener('appStateChange')`. Android keeps the WebView alive briefly
  but the OS may kill it.
- Network change (Wi-Fi to mobile): `livekit-client` resumes or reconnects by
  itself; the server keeps the call INTERRUPTED for 30 s meanwhile. Draw the
  reconnecting state from `CallSnapshot.state === "INTERRUPTED"` and from the
  client's `Reconnecting` event.
- Cleanup: stop every local track and `room.disconnect()` on end, on route
  change, on `pagehide`; a forgotten track keeps the camera light on.
- Safe areas, orientation, keyboard: the existing shell CSS handles insets;
  the call screen should be full-bleed with controls inside the safe area.

## Notifications on a phone

An incoming call reaches a phone as an ordinary push (FCM on Android, APNs on
iOS once its flag and keys are in) carrying `/messages/<id>?call=<callId>`;
`lib/native/push-taps.ts` already routes a tap to that path. The push is sent
immediately (the drain is woken) and expires with the 45 s ring.

## What is NOT supported, and must not be claimed

- **No CallKit (iOS) and no ConnectionService (Android).** No native incoming
  call screen, no lock-screen answer, no ringing while the app is closed. A
  call can only be answered by opening the app from the push in time.
- **No reliable background incoming calls.** No PushKit/VoIP push, no
  `voip` background mode, no full-screen intent, no foreground service.
- Quiet hours hold pushes, so a call during quiet hours does not ring a
  locked phone (`VIDEO-CALLING-OPEN-QUESTIONS.md`).
- No screen sharing on mobile, no picture in picture, no group calls.

Building those is a separate, native project: LiveKit's Swift and Kotlin
SDKs with CallKit / ConnectionService and VoIP push, as a Capacitor plugin,
after the web flow is proven. Apple requires CallKit for VoIP pushes.

## Device test list (to run before switching `video_calls` on)

| # | Case | iPhone (release build) | Android (release build) | Desktop Chrome, Safari |
|---|---|---|---|---|
| 1 | First call: prompts appear once, with the new strings | | | |
| 2 | Deny camera and microphone; recovery screen; retry after allowing in Settings | | | |
| 3 | Voice call: camera never requested, cannot be published | | | |
| 4 | Video both ways, mute, camera off, camera switch | | | |
| 5 | Speaker vs earpiece; Bluetooth headset; wired headset | | | |
| 6 | Background the app mid-call and return | | | |
| 7 | Wi-Fi to mobile data mid-call (reconnecting, then back) | | | |
| 8 | Weak network (throttle): quality drops, call holds | | | |
| 9 | Push for an incoming call: app open, backgrounded, killed; tap opens the ringing call | | | |
| 10 | Push tap after the ring ended: missed-call screen, no dead call | | | |
| 11 | Photo capture after CAMERA is declared (Android): one prompt, then works | | | |
| 12 | End call: camera light goes off on both | | | |

## TURN and ICE review (31 October 2026)

Read from the code, not proven on a device. The client sets no ICE servers and no `iceTransportPolicy` on purpose: the LiveKit server returns its TURN servers during the join, and LiveKit Cloud provides them (UDP 3478, TLS 5349 and 443). That fallback to TLS over 443 is what rescues a call behind a mobile carrier that blocks UDP, which is common in Nigeria. So there is nothing to configure in the app. What must be true on the server: `LIVEKIT_URL` is a `wss://<project>.livekit.cloud` address (Cloud), or, if self-hosted, TURN is enabled with a TLS certificate on 443. Check this first if calls connect on Wi-Fi but not on mobile data.

The media settings in `components/calls/media/session.ts` are already the recommended ones: Opus speech preset with DTX and RED for voice, echo cancellation, noise suppression and auto gain asked for, simulcast with dynacast and adaptive stream for video. No change recommended without a device trace.
