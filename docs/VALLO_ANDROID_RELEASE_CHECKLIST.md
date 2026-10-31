# Vallo Android release checklist

Written 28 September 2026, re-verified against the repository on 6 October 2026. Status words: READY (verified by a static check or test),
NEEDS CONFIGURATION, BLOCKED BY CREDENTIALS, BLOCKED BY GOOGLE (Play Console
status unconfirmed), UNVERIFIED (needs the Android SDK or a device). Release
status and findings: `VALLO_NATIVE_RELEASE_AUDIT.md`.

## Project (`apps/web/android`)

| Item | Value | Status |
| --- | --- | --- |
| `applicationId` / `namespace` | `com.vallospaces.app` | READY (`brand-domain.test.ts`) |
| SDK levels | min 24, compile 36, target 36 | READY; Android 15+ edge-to-edge handled by Capacitor 8 `SystemBars` |
| Toolchain | AGP 8.13.0, Gradle wrapper 8.14.3, google-services 4.4.4, Java `MainActivity` | Gradle scripts parse; debug build compiled in CI: the workflow header records run 36500914409 (29 September) as the first APK (not re-checked here, no Actions access in this pass). Cloud sessions still cannot build (`dl.google.com` blocked) |
| Versions | `versionCode 100000`, `versionName "0.1.0"` from `npm run sync:versions` (refuses to move backwards) | READY |
| Release build type | `debuggable false`, R8 on, `shrinkResources false` (splash resolved by name) | READY; R8 output UNVERIFIED |
| Signing | `keystore.properties` + `*.jks` gitignored; absent file gives an unsigned artefact, never debug-signed | BLOCKED BY CREDENTIALS (upload keystore) |
| Firebase | `app/google-services.json` for project `vallo-6f946`, package matches; `current_key` is a placeholder; release refuses until real | BLOCKED BY CREDENTIALS (Android API key). Server side (`FCM_*`) already in Vercel |

## Manifest

| Item | Status |
| --- | --- |
| Permissions: INTERNET, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION (`maxSdkVersion 30`), POST_NOTIFICATIONS; VIBRATE merged from haptics; Firebase's normal permissions | READY; no CAMERA (capture works by intent, see manifest), no media or storage permission, no background location |
| `allowBackup="false"` + `dataExtractionRules` (cloud and device transfer excluded) | READY (F-12) |
| `usesCleartextTraffic="false"` | READY |
| Exported components: the launcher activity only; FileProvider not exported | READY |
| App Links: `autoVerify`, host `www.vallospaces.com` only, shareable paths + `/auth/callback` | READY in the binary; BLOCKED on the two fingerprints in `assetlinks.json` |
| FCM defaults (channel `vallo_default`, `ic_stat_vallo`, colour) as `<application>` meta-data | READY (F-02) |
| `<queries>` for https VIEW (Custom Tabs resolution) | READY |

## Steps, in order

1. [ ] Play Console account (organisation); create the app `com.vallospaces.app`.
2. [ ] Firebase console, project `vallo-6f946`: copy the Android API key into `current_key` in `google-services.json` and commit it (not a secret).
3. [ ] Create the upload keystore; write `apps/web/android/keystore.properties`; store both outside git and in the CI secret store.
4. [ ] The debug APK is already built by CI on every run (artifact `vallo-android-debug-<sha>`, 14 days), so Android Studio is not needed for a first device pass: install it and run the P0 rows of `VALLO_NATIVE_TEST_MATRIX.md` (see `FOUNDER_DEVICE_TEST_BRIEF.md`). To build locally instead: `npm ci`, `CAPACITOR_SERVER_URL=https://www.vallospaces.com npm run cap:sync:dev --workspace @vallo/web`, `./gradlew assembleDebug`, install, run `VALLO_NATIVE_TEST_MATRIX.md`.
5. [ ] `VALLO_BUILD=<n> npm run sync:versions`, `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
6. [ ] Upload to Internal testing; enrol in Play App Signing.
7. [ ] Copy the app-signing SHA-256 and the upload-key SHA-256 into `assetlinks.json`; deploy; then `npm run cap:sync` passes; verify with `adb shell pm get-app-links com.vallospaces.app`.
8. [ ] Store listing (`docs/store/LISTING_COPY.md`), feature graphic, phone screenshots from this build, Data safety (`docs/store/PRIVACY_LABELS.md` Part B), content rating, target audience, app access (reviewer account, `docs/STORE_SUBMISSION_NOTES.md`), privacy URL `https://www.vallospaces.com/privacy`, account deletion URL `https://www.vallospaces.com/delete-account`.
9. [ ] Closed testing if the account type requires it, then production.

## Verified on 6 October 2026

| Claim | Finding |
| --- | --- |
| CI builds only a debug APK, no release or AAB job, no secrets | **Confirmed for the build.** `.github/workflows/native-android.yml` job `debug` runs `./gradlew assembleDebug` (line 103) and uploads `app-debug.apk` (lines 140-147). No `bundleRelease` or AAB step, and no `secrets.` expression anywhere in the file (grep returned nothing); the secret names at lines 22-23 are in a comment about a future job. `permissions: contents: read`. **Correction:** the file has a second job, `emulator` (line 158, `continue-on-error`), that installs the debug APK on an Android 14 emulator and keeps four screenshots (rows 1, 2, 23 and a deep link to `/open`). Pass or fail is a person reading the screenshots. |
| `assetlinks.json` fingerprints are placeholders | **Confirmed.** Lines 8-9 hold `PLACEHOLDER_REPLACE_WITH_PLAY_APP_SIGNING_SHA256_SEE_ANDROIDMANIFEST_XML` and `PLACEHOLDER_REPLACE_WITH_UPLOAD_KEY_SHA256_SEE_ANDROIDMANIFEST_XML`. `cd apps/web && node scripts/check-deep-links.mjs --platform=android` exits 1 with "DEEP LINKS ARE DEAD, AND A BINARY MUST NOT BE CUT IN THIS STATE", flagging both entries as not a SHA-256 fingerprint. |
| `google-services.json` `current_key` is a placeholder | **Confirmed.** `apps/web/android/app/google-services.json:18`: `"current_key": "PASTE_THE_ANDROID_API_KEY_FROM_FIREBASE_HERE"`. |
| Stale `store/` paths | **Fixed** in step 8: `docs/store/LISTING_COPY.md`, `docs/store/PRIVACY_LABELS.md`, `docs/STORE_SUBMISSION_NOTES.md`. All three exist. |
| Anything more done than claimed | Yes, two things. (1) Row "Toolchain" said the build was UNVERIFIED; CI has compiled a debug APK since 29 September (per the workflow header; run not re-inspected). (2) Step 4 implied Android Studio was needed; a CI artifact replaces it. The iOS association file is real (`check-deep-links.mjs --platform=ios`), which is the iOS-side counterpart and not an Android claim. Nothing else in the Project or Manifest tables was found more done: `keystore.properties` does not exist, and R8 output and `bundleRelease` have never run. |
| Values spot-checked | `versionCode 100000`, `versionName "0.1.0"`, `debuggable false`, `shrinkResources false` in `app/build.gradle` (lines 54-55, 88, 111); min 24, compile 36, target 36 in `variables.gradle`. Manifest rows, AGP and Gradle versions and the R8 behaviour were not re-read in this pass. |

## Who is blocking what

**Founder-blocked (needs an account or a secret only the founder can create):**

- Play Console organisation account and the app `com.vallospaces.app` (step 1).
- The upload keystore and `keystore.properties` (step 3).
- Play App Signing enrolment, which yields the two SHA-256 fingerprints that
  `assetlinks.json` needs (steps 6 and 7). Until then Android links open the
  browser, not the app.
- The Firebase Android API key for `current_key` (step 2). Until then Android
  push does not work and a release build refuses.

**Engineering-blocked:** there is no release CI job at all. Nothing builds
`bundleRelease`, so R8 output and release signing have never been exercised.
The job cannot be written usefully until the keystore and Firebase key exist,
and needs four Actions secrets (`ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).

## 1.0.1 (31 October 2026)

Repository (done, needs `npx cap sync` and a build): `versionName 1.0.1`, `versionCode 10001000` (plus the CI build slot), `@capacitor/network` added (cap sync wires it into `capacitor.settings.gradle`).

Calls: the manifest declares camera, microphone and audio-settings permissions. It does **not** declare `USE_FULL_SCREEN_INTENT` and the project has no native incoming-call service, on purpose: a full-screen call screen needs a native `FirebaseMessagingService` that posts a `fullScreenIntent` notification (and a Play Console declaration for that permission on Android 14). Until that is built, an incoming call is a high-priority push on the loud Calls channel that opens the call when tapped. Battery optimisation can still delay it on some phones; the device test script lists it.

Run rows 35 to 38 of `VALLO_NATIVE_TEST_MATRIX.md`.
