# Build Vallo on your laptop

A step-by-step guide to get the iOS and Android apps building on your
own machine. Written for someone who has never done a native build
before.

You need a **Mac** for the iOS build. Android can be built on Mac,
Windows or Linux.

---

## Step 0: One-time laptop setup

Install these if you do not have them already. Each one is a single
terminal command.

### Node.js (you probably already have this)

```bash
node --version      # should print v18 or higher
```

If missing: https://nodejs.org -- download the LTS installer.

### Xcode (iOS only, Mac only)

Open the App Store on your Mac, search **Xcode**, install it. It is
large (about 12 GB). After it installs, open it once and accept the
license.

Then run:

```bash
xcode-select --install     # installs command-line tools
sudo xcodebuild -license accept
```

You never need to open Xcode to build Vallo. The Capacitor CLI drives
it from the terminal.

### Android Studio (Android only)

Download from https://developer.android.com/studio -- open it once so
it downloads the Android SDK. Then close it. You do not need to open it
again; the Capacitor CLI drives it from the terminal.

Add Android tools to your shell (put this in `~/.zshrc` or
`~/.bash_profile`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # Mac path
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Then `source ~/.zshrc` (or open a new terminal).

### CocoaPods (iOS only)

```bash
sudo gem install cocoapods
```

---

## Step 1: Pull the latest code

```bash
cd VALLO
git pull origin main       # or whichever branch has the latest
npm install                # installs everything in the monorepo
```

---

## Step 2: Build the web app

The mobile apps load the live website. But `cap sync` still needs the
offline shell built:

```bash
cd apps/web
npm run shell:config       # writes the offline shell config
```

---

## Step 3: Sync to the native projects

This copies everything into the iOS and Android projects:

```bash
cd apps/web
CAPACITOR_SERVER_URL="https://www.vallospaces.com" npm run cap:sync
```

That one command:
- Writes the shell config
- Checks deep links
- Copies web assets into both native projects
- Updates all native plugin registrations

---

## Step 4: Build the apps

### iOS

```bash
cd apps/web
npx cap build ios
```

This opens Xcode with the project ready. Click the **play button** or
go to Product > Archive for a release build. Connect your iPhone or
pick a simulator.

If Xcode asks about signing: go to the **Signing & Capabilities** tab,
pick your Apple Developer team. First time only.

### Android

For a debug APK you can install on your phone:

```bash
cd apps/web/android
./gradlew assembleDebug
```

The APK lands at:
`android/app/build/outputs/apk/debug/app-debug.apk`

Transfer it to your phone (AirDrop, email, USB) and install it.

For a release AAB (what goes to the Play Store):

```bash
cd apps/web/android
./gradlew bundleRelease
```

---

## Step 5: Install on your phone

### iOS
- Connect your iPhone to your Mac with a cable
- In Xcode, select your phone from the device dropdown at the top
- Press the play button
- First time: your phone will ask you to trust the developer in
  Settings > General > VPN & Device Management

### Android
- Enable **Developer Options** on your phone:
  Settings > About phone > tap Build number 7 times
- Enable **USB debugging** in Developer Options
- Connect with USB
- Run: `adb install android/app/build/outputs/apk/debug/app-debug.apk`
- Or just transfer the APK file and open it on the phone

---

## Quick reference

| What                 | Command                                                      |
| -------------------- | ------------------------------------------------------------ |
| Sync everything      | `CAPACITOR_SERVER_URL="https://www.vallospaces.com" npm run cap:sync` |
| Build iOS            | `npx cap build ios`                                          |
| Build Android debug  | `cd android && ./gradlew assembleDebug`                      |
| Build Android release| `cd android && ./gradlew bundleRelease`                      |
| Update versions      | `npm run sync:versions` (from repo root)                     |
| Regenerate icons     | `node scripts/build-native-icons.mjs && npx @capacitor/assets generate --iconBackgroundColor '#010118' --splashBackgroundColor '#010118'` |

---

## Troubleshooting

**"No provisioning profiles found"** (iOS): you need an Apple Developer
account ($99/year). Sign up at https://developer.apple.com, then select
your team in Xcode's signing tab.

**"SDK not found"** (Android): open Android Studio once so it downloads
the SDK, then check `ANDROID_HOME` is set.

**"Command not found: cap"**: run `npm install` in the `apps/web`
directory first.

**The app opens but shows "No connection"**: you forgot
`CAPACITOR_SERVER_URL`. Run the sync command from Step 3 again with
the variable set.
