# Vallo native test matrix

Status on 6 October 2026: **0 of 34 rows have been run, and 0 of the 9 P0
rows** (the matrix has nine rows marked P0: 1, 2, 3, 4, 7, 9, 21, 23 and 29;
earlier notes said ten, which was a miscount). No row has been run on a device,
by anyone, since the matrix was written on 28 September. Every Observed cell
is empty and every Result reads NOT RUN until a person fills it in from a real
handset. Evidence is a screenshot, screen recording or log file name.

Builds that exist: a signed iOS archive was built and uploaded to App Store
Connect on 3 October (run 37103086939), so iOS is installable through
TestFlight once the build has finished processing there. Android has a debug
APK from every run of `.github/workflows/native-android.yml`. There is no
release Android build. Nobody has installed either on a handset.

The ninety-minute pass for the founder, covering the P0 rows with step-by-step
instructions, is `FOUNDER_DEVICE_TEST_BRIEF.md`. Directive D43
(`RULINGS.md`) ranks it as the next action.

Devices to use, at minimum: one current iPhone with a notch or Dynamic Island,
one smaller iPhone on the oldest iOS you support (15 is the floor), one Pixel
or Samsung on Android 14 or newer, and one Android 10 or 11 handset (the
location and App Link verification rules differ there).

Severity: P0 blocks submission; P1 blocks release quality; P2 polish.

| # | Flow | Platform | Expected | Observed | Result | Evidence | Sev | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Fresh install, cold launch online | both | Splash, then `/welcome` (signed out); no white flash; status bar legible | | NOT RUN | | P0 | |
| 2 | Cold launch in airplane mode | both | Splash hides; branded offline card; Try again returns to the app once online | | NOT RUN | | P0 | F-03 fix |
| 3 | Existing user sign-in | both | `/home`; dock visible; keyboard never hides the submit button | | NOT RUN | | P0 | |
| 4 | New user sign-up + email confirmation link | both | Link opens the app (after association files verify) and lands signed in | | NOT RUN | | P0 | blocked on deep-link values |
| 5 | Apple sign-in | iOS | Button absent (plugin not installable on Capacitor 8) | | NOT RUN | | P2 | F-10 |
| 6 | Password reset | both | Email link completes; new password works | | NOT RUN | | P1 | |
| 7 | Session persistence: kill app, reopen | both | Still signed in | | NOT RUN | | P0 | |
| 8 | Background 30 min, resume | both | Still signed in, screen intact | | NOT RUN | | P1 | |
| 9 | Log out, kill, reopen | both | Signed out; push row for this device revoked in `/settings/devices` | | NOT RUN | | P0 | F-04 |
| 10 | Shared listing link from WhatsApp | both | Opens the listing in the app (www link) | | NOT RUN | | P1 | |
| 11 | Push permission via the in-context prompt | both | One system prompt after the Vallo explainer; row appears in `/settings/devices` | | NOT RUN | | P1 | |
| 12 | Push received: app closed, backgrounded, foreground | both | Banner in all three; Android uses the Vallo icon and channel | | NOT RUN | | P1 | F-01, F-02 |
| 13 | Push tap | both | Opens the exact thread/booking, not home | | NOT RUN | | P1 | |
| 14 | Listing wizard: Take photo | both | Camera plugin opens; photo attached, orientation correct | | NOT RUN | | P1 | |
| 15 | Photo library, multiple images | both | Picker opens; all attached | | NOT RUN | | P1 | |
| 16 | Document upload (PDF, KYC) | both | File picker; upload succeeds; size limit message on an oversize file | | NOT RUN | | P1 | |
| 17 | Arrival check photo (`capture`) | Android | System camera opens without a permission prompt | | NOT RUN | | P2 | |
| 18 | Map locate me, allowed | both | Map centres | | NOT RUN | | P1 | |
| 19 | Map locate me, denied / Android 10-11 | both | Clear denied state; map still usable | | NOT RUN | | P1 | coarse-only rescue path |
| 20 | Share a profile, story or post | Android | System share sheet (not a copied link) | | NOT RUN | | P2 | F-08 |
| 21 | Paystack card payment, TEST keys only | both | Inline checkout; 3-D Secure completes inside the app; booking shows paid | | NOT RUN | | P0 | F-16; never live keys |
| 22 | Keyboard on chat, search, listing form | both | Field stays visible; dock hides while typing | | NOT RUN | | P1 | |
| 23 | Android back: sheet, nested screen, root | Android | Closes sheet; goes to parent; exits at root | | NOT RUN | | P0 | |
| 24 | iOS swipe back | iOS | Navigates back without blank frames | | NOT RUN | | P2 | |
| 25 | Network drops mid-navigation and mid-form | both | Offline screen or error, no fake success; recovers | | NOT RUN | | P1 | |
| 26 | Notch and home indicator on report sheet, delete-account sheet, site menu, drawers | iOS | Nothing under the status bar or home indicator | | NOT RUN | | P1 | F-09 |
| 27 | Light and dark theme switch | both | Status bar glyphs legible in both | | NOT RUN | | P2 | |
| 28 | Rotation | both | Portrait layout holds (iOS allows landscape) | | NOT RUN | | P2 | |
| 29 | Account deletion | both | Signed out; sign-in refused; no further pushes | | NOT RUN | | P0 | F-05 |
| 30 | Reinstall | both | Signed out; no session restored (backup excluded) | | NOT RUN | | P1 | F-12 |
| 31 | Upgrade install over an older build | both | Session kept; version shown in store increments | | NOT RUN | | P2 | |
| 32 | Notification permission denied | both | Settings screen says how to turn it on; no repeat prompt | | NOT RUN | | P2 | |
| 33 | External links: help mail, phone, legal pages, maps | both | Mail/phone to the OS; foreign https in the system browser tab; own pages in the app | | NOT RUN | | P2 | |
| 34 | App Links verification | Android | `adb shell pm get-app-links com.vallospaces.app` shows `verified` for www | | NOT RUN | | P1 | after fingerprints |
| 35 | **1.0.1** Service-worker instant path: open the app in aeroplane mode after a normal session | both | Opens straight to the last kept Home with the calm "saved copy" line; no blank, no spinner longer than the opening (about 400 ms) | | NOT RUN | | P0 | plan item 18; on Android also confirm the worker's `fetch` fires for the main document |
| 36 | **1.0.1** Captive portal or Wi-Fi with no internet | both | The connection line says offline (the operating system's verdict, `@capacitor/network`), taps queue, and they send when real signal returns | | NOT RUN | | P1 | plan item 16 |
| 37 | **1.0.1** Save-Data or a 2G link, second open | Android | Home answers from the kept copy at once with no refresh behind it (the copy is at most a day old) | | NOT RUN | | P1 | plan item 2 |
| 38 | **1.0.1** First launch right after install, then airplane mode | both | The four main tabs open from kept copies (the worker seeds them a few seconds after the first page) | | NOT RUN | | P1 | plan item 3 |
| 39 | **1.0.1** iPhone push: the build's entitlements | iOS | `aps-environment` is present in the App Store Connect build page; a push arrives on a real iPhone | | NOT RUN | | P0 | needs the Push Notifications capability on the App ID, then a fresh profile |
