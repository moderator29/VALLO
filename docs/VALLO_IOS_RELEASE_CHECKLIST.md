# Vallo iOS release checklist

28 September 2026, corrected 6 October 2026 (directive D41, measure never quote: the
Signing, Archive and Associated Domains rows and the ordered steps had drifted to
describe Apple as more blocked than it is; each correction below cites the file and line
it was measured from). Status words: READY (verified by a static check or test),
NEEDS CONFIGURATION (a repository or Xcode step, no account needed),
BLOCKED BY APPLE DEVELOPER ACCOUNT (no longer applies to iOS: the account is held, see the Signing row), UNKNOWN (the repository cannot answer it), UNVERIFIED (needs Xcode
or a device). Release status and findings: `VALLO_NATIVE_RELEASE_AUDIT.md`.
Console click paths: `store/FOUNDER_STEPS.md` (that is `docs/store/FOUNDER_STEPS.md`; every path here that starts `store/` is under `docs/`).

## Project (`apps/web/ios/App`)

| Item | Value | Status |
| --- | --- | --- |
| Bundle ID | `com.vallospaces.app` (Debug and Release) | READY (`brand-domain.test.ts`) |
| Deployment target | iOS 15.0; iPhone only (`TARGETED_DEVICE_FAMILY = 1`) | READY (`ios-project.test.ts`) |
| Dependencies | Swift Package Manager, `CapApp-SPM/Package.swift`, `capacitor-swift-pm` exact 8.5.0 + 9 plugins; no CocoaPods | READY (`cap sync`); resolution UNVERIFIED |
| Lifecycle | `AppDelegate` + `SceneDelegate` exactly as Capacitor 8's template | READY (diffed against `ios-spm-template.tar.gz`) |
| `AppDelegate.swift` | APNs token success/failure posted to Capacitor; no notification-centre delegate (Capacitor's router owns it) | READY; the compile error fixed 28 Sep (F-01). **Compilation UNVERIFIED** |
| Versions | `MARKETING_VERSION 0.1.0`, `CURRENT_PROJECT_VERSION 100000` from `npm run sync:versions` | READY (`--check` in sync) |
| Signing | Automatic, team `X74KD52994` (`project.pbxproj:117` `DevelopmentTeam`; `CODE_SIGN_STYLE = Automatic` at lines 306 and 329). The same ID is in the association file (`apps/web/public/.well-known/apple-app-site-association:6`). The programme is held; the earlier "no team" was true on 28 September only | READY (measured 6 Oct). Whether the account is Individual or Organization is UNKNOWN from the repository |
| Archive | RAN AND SUCCEEDED on 3 October 2026: GitHub Actions run 37103086939, jobs `iOS compile (unsigned, simulator)` and `iOS signed archive (App Store)` both `success`, all four Apple secrets present (`.github/workflows/native-ios.yml:159` to `:272`). The `Keep the IPA` step was skipped, and it is gated on `success() && !inputs.upload` (`native-ios.yml:272`), so the export ran with `destination=upload` (`:247` to `:248`) and the IPA went to App Store Connect | READY. Whether it is processed and visible in TestFlight is UNKNOWN from the repository; the founder reads App Store Connect |

## Info.plist

| Key | Status |
| --- | --- |
| `NSLocationWhenInUseUsageDescription` (map locate; host pin saved to listing) | READY |
| `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (walkthrough video) | READY |
| No `Always` location, contacts, calendar, tracking, Face ID keys | READY (nothing uses them) |
| `UIBackgroundModes: remote-notification` | READY |
| `ITSAppUsesNonExemptEncryption = false` | READY (https and platform storage only) |
| `NSAllowsArbitraryLoads = false` | READY |
| `UIRequiredDeviceCapabilities: arm64` | READY |
| `UIViewControllerBasedStatusBarAppearance = true` (StatusBar plugin needs it) | READY |

## Entitlements (`App/App.entitlements`, adopted by the project)

| Entitlement | Value | Status |
| --- | --- | --- |
| Associated Domains | `applinks:www.vallospaces.com` only (apex removed, F-06). Adopted: `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` in both configurations (`project.pbxproj:305` and `:328`). The iOS association file is real and passes its checker (`cd apps/web && node scripts/check-deep-links.mjs --platform=ios` exits 0, measured 6 Oct) | READY in the repository. Apple's CDN copy at `https://app-site-association.cdn-apple.com/a/v1/www.vallospaces.com` is UNKNOWN (not fetched); a universal link opening the app is UNVERIFIED on a device |
| `aps-environment` | `development` (distribution signing writes `production`) | Check the archive's entitlements once. The APNs key and the `APNS_*` Vercel variables are UNKNOWN (none existed on 28 Sep; no later reading is in the repository) |
| Sign in with Apple | present | Tick the capability on the App ID anyway: signing refuses an entitlement the App ID lacks. The button still cannot show until a Capacitor 8 plugin exists (F-10) |

## Steps, in order

Marked DONE where the repository proves it, OPEN where it does not. Do not redo a DONE step.

1. [x] DONE: Apple Developer Program enrolment. The team `X74KD52994` is committed in the project and the association file, and a signed archive used it on 3 October. Do not enrol again. The app still moves to the VALLO SPACES LTD account by an App Store transfer once the company's Organization enrolment completes; the Team ID then changes, and the capabilities on the App ID, the APNs key (step 3), the link file (step 4) and the CI secrets are redone for the new team (`docs/MOBILE.md` section 7).
2. [x] DONE in effect: App ID `com.vallospaces.app` with Push Notifications, Associated Domains and Sign In with Apple. The signed export of 3 October succeeded with all three in the entitlements file, so the profile carried them. Confirm in the portal if in doubt; the repository cannot show the portal.
3. [ ] OPEN, UNKNOWN: APNs key. Set `APNS_KEY_ID`, `APNS_TEAM_ID` (`X74KD52994`), `APNS_PRIVATE_KEY`, `APNS_PRODUCTION=true` in Vercel Production. Never commit the `.p8`. No `APNS_*` variable existed on 28 September and nothing later is recorded.
4. [x] DONE: Team ID in `apps/web/public/.well-known/apple-app-site-association` (line 6). OPEN, UNKNOWN: confirm Apple's CDN serves it at `https://app-site-association.cdn-apple.com/a/v1/www.vallospaces.com`.
5. [x] DONE on CI: `npm ci` and the production-origin sync ran in the signed job (`Capacitor sync (release gate)`, run 37103086939). On a Mac, the command is `CAPACITOR_SERVER_URL=https://www.vallospaces.com npm run cap:sync:ios --workspace @vallo/web`. The all-platform `cap:sync` still refuses until the Android fingerprints are in; use `cap:sync:ios` for iOS.
6. [x] DONE: team chosen and the entitlements file adopted (`project.pbxproj:117`, `:305`, `:328`). Nothing to add in Xcode.
7. [ ] OPEN, the most valuable next step: build to a device and run `VALLO_NATIVE_TEST_MATRIX.md`. Measured 0 of 34 rows run, 0 of 10 P0 rows (D43).
8. [x] DONE once (build number from the run number, archive, export with upload, run 37103086939). Repeat with `VALLO_BUILD=<n> npm run sync:versions` for each new upload, or dispatch the workflow again with `upload` ticked.
9. [ ] OPEN, UNKNOWN: App Store Connect record, App Privacy (`docs/store/PRIVACY_LABELS.md` Part A), age rating, screenshots (made: 35 at 1320 x 2868 in `docs/store/screenshots/app-store/`, handbook `docs/store/APP_STORE_SCREENSHOTS_HANDBOOK.md`), review notes and reviewer account (`docs/STORE_SUBMISSION_NOTES.md`), support URL `https://www.vallospaces.com/help`, privacy URL `https://www.vallospaces.com/privacy`. Whether the record and any of these fields are filled is UNKNOWN from the repository. Route existence is assessed in `docs/LEGAL_AND_NDPC_READINESS.md`.
10. [ ] OPEN, UNKNOWN: TestFlight internal testing, then submit. Whether the 3 October build is processed and distributed to any tester is UNKNOWN from the repository.

Steps 5 to 8 run on GitHub Actions (`.github/workflows/native-ios.yml`, the signed archive job). The four secrets in `docs/NATIVE_CI.md` exist (the job's presence check passed on 3 October), so no Mac is needed for the build itself.

A device build needs a Mac with Xcode, or a TestFlight install of the uploaded build. The unsigned simulator compile on CI proves the project compiles; it does not prove the app runs on a phone.

## 1.0.1 (31 October 2026): what changed in the repository, and what only Apple's portal can do

Repository (done, needs `npx cap sync` and a build): version 1.0.1 (`npm run sync:versions`, build number 10001000 plus the CI build slot), the `@capacitor/network` plugin for true connectivity (`lib/native/network.ts`), the brief opening on the shell.

Apple portal (founder, cannot be done from the repository):

1. **Push Notifications** must be ticked on the App ID `com.vallospaces.app`, then the provisioning profile regenerated. The 1.0.0 build page listed no `aps-environment` entitlement, which is why an iPhone cannot register for push (and so cannot receive an incoming-call alert). The entitlements file already carries the key (`App.entitlements`, value `development`; automatic signing rewrites it to `production` for an archive); the profile is what was missing. After the build, confirm `aps-environment` on the build's page in App Store Connect.
2. **Time Sensitive Notifications** (call alerts). The server already sends `interruption-level: time-sensitive` for a call (`lib/push/transport/apns.ts`), but iOS honours it only for an app whose profile has the `com.apple.developer.usernotifications.time-sensitive` entitlement. Tick the capability on the App ID, regenerate the profile, then add the key to `App.entitlements`. It is NOT added to the file yet on purpose: with a profile that lacks it, signing fails.
3. Do not remove 1.0.0 from review. 1.0.1 is a separate submission after 1.0.0 is approved.
4. Run rows 35 to 39 of `VALLO_NATIVE_TEST_MATRIX.md` on the TestFlight build.

PushKit and CallKit are not available to a Capacitor web-view shell without a native plugin and a native call UI; until that exists an iPhone call is an alert push (sound, time sensitive) that opens the call screen when tapped.
