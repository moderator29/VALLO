# NATIVE BUILD QUEUE

Everything in Platform Grade 1 that needs a NEW native build (and so a new
App Store review and macOS Actions minutes) is collected here, so it ships in
ONE planned 1.0.x build when the founder agrees and minutes are available.
Web-side changes reach the app instantly and are not listed.

| # | Change | Platform | Why | Status |
|---|---|---|---|---|
| 1 | Android predictive back (`android:enableOnBackInvokedCallback`) | Android | Brief section 11 | Written in the manifest, waits for the build |
| 2 | `adjustResize` window mode for the keyboard | Android | Composer above the keyboard | Written in the manifest, waits for the build |
| 3 | New App Link and Universal Link paths for bookings, messages, notifications | Both | Deep links land on the right screen | Not started |
| 4 | Notification Service Extension for rich push images | iOS | Push with listing photos | Optional, founder to decide |
| 5 | App switcher privacy cover | iOS | Hide money screens in the app switcher | Not started |
| 6 | Native crash capture: a crash of the Swift or Kotlin shell itself (not the web pages, which the crash log already hears) written on next launch to /api/client-error with platform ios or android | Both | Founder, 7 November 2026: Vallo's own crash log in admin | Not started |
| 7 | Animated launch: the exact Vallo logo and wordmark drawn in on the splash, handing off to the web startup screen without a flash | Both | Founder, 7 November 2026: animated logo | Not started |

Nothing in this file has been built. Built items move to a "Shipped in" column
with the build number.

Not needed: the microphone permission for voice notes. `NSMicrophoneUsageDescription` (iOS Info.plist) and `RECORD_AUDIO` (Android manifest) are already declared for calls (VC1, 8 October 2026), so voice notes are web-only.
