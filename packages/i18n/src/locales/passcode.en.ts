/**
 * The passcode layer: the "Welcome back" lock, setup and confirm, the
 * settings screen and the refusals. docs/PASSCODE.md is the design.
 * `{name}`, `{count}` and `{seconds}` are filled by the component.
 */
export const passcodeEn = {
  /** The spaced-capitals name in the top block, as on the sign-in screens. */
  wordmark: "VALLO",
  welcomeBack: "Welcome back, {name}",
  welcomeBackNoName: "Welcome back",
  /** The returning greeting (reference 6, 7 October 2026): the lock's title. */
  hello: "Hello, {name}",
  helloNoName: "Hello again",
  /** Under the greeting: ends this session and opens sign in, for another account. */
  switchAccount: "Switch account",
  /** The second capsule where a passkey leads: the keypad. */
  withPasscode: "Use your passcode",
  /**
   * FACE ID OR FINGERPRINT, MADE DISCOVERABLE (7 October 2026, "set and build
   * Face ID to work"). The key is the WebAuthn platform key the money lock
   * already enrols (`money_credentials`); the same key unlocks the passcode.
   * Offered once after a new passcode is set, and in Settings, Passcode.
   */
  bioOfferTitle: "Unlock with Face ID next time?",
  bioOfferBody: "Your phone's own lock opens Vallo in a look or a touch. Your passcode stays as the way in whenever it cannot.",
  bioOfferSetUp: "Set up Face ID or fingerprint",
  bioOfferLater: "Not now",
  bioGroup: "Face ID or fingerprint",
  bioRowTitle: "Unlock with Face ID or fingerprint",
  bioRowUnset: "Set it up once with your password. The same key then unlocks Vallo and confirms payments.",
  bioRowSet: "Offered first when Vallo is locked. Your passcode stays as the fallback.",
  bioRowUnsupported: "This browser cannot reach this device's Face ID or fingerprint. The Vallo app and most phone browsers can.",
  enterCode: "Enter your passcode",
  lockedTitle: "Vallo is locked",
  wrong: "That is not your passcode.",
  /*
   * THE COUNT IS SHOWN ONLY WHEN IT IS THE LAST ONE (MOTION_SYSTEM section 6:
   * never "a count of remaining attempts shown before the final one"). A
   * wrong code says `wrong` and nothing more until exactly one try is left
   * before the short pause or before the sign-out; then it says so, once,
   * because that is the one moment the count changes what somebody does.
   */
  wrongLeft: {
    one: "That is not your passcode. Try again: 1 more try before a short pause.",
    other: "That is not your passcode. Try again: {count} more tries before a short pause.",
  },
  wrongLastBeforeSignOut: {
    one: "That is not your passcode. Try again carefully: 1 more wrong try signs you out.",
    other: "That is not your passcode. Try again carefully: {count} more wrong tries sign you out.",
  },
  cooldown: "Too many tries. Wait {seconds} seconds.",
  paced: "Too many tries from here. Wait a little and try again.",
  unavailable: "We could not check your passcode just now. Try it, or use your password.",
  passwordOnly: "Your passcode was entered wrongly too many times. Sign in again to set a new one.",
  signInAgain: "Sign in again",
  error: "That did not go through. Check your connection and try again.",
  /* A weak signal (2 November 2026): the lock keeps asking instead of giving up. */
  slow: "Weak connection. Still checking your passcode.",
  unreachable: "We could not reach Vallo. Your passcode is still entered: check your signal and tap Try again.",
  tryAgain: "Try again",
  wrongOffline: "That is not your passcode.",
  usePassword: "Use your password instead",
  /** C14 and MOTION_SYSTEM section 6: the biometric door, offered before the keypad where the member has a platform key. */
  passkeyUnlock: "Unlock with Face ID or fingerprint",
  /** 27 October 2026: the door names the lock the device really has (`lib/security/device-lock.ts`). */
  passkeyUnlockBy: {
    "face-id": "Unlock with Face ID",
    "touch-id": "Unlock with Touch ID",
    fingerprint: "Unlock with fingerprint",
    "windows-hello": "Unlock with Windows Hello",
    "this-device": "Unlock with this device",
  },
  passkeyFailed: "That did not work. Enter your passcode instead.",
  usePasscode: "Enter your passcode instead",
  signOut: "Sign out",
  checking: "Checking",

  setupTitle: "Create your passcode",
  setupBody: "You will use it to open Vallo and before money moves. It is not your password.",
  resetTitle: "Set a new passcode",
  resetBody: "You signed in again, so you can choose a new passcode now.",
  confirmTitle: "Confirm your passcode",
  confirmBody: "Type the same {count} digits to confirm.",
  /** The setup steps' line under the title; the longer setup or reset line sits under the dots. */
  stepChoose: "Step 1 of 2. Choose {count} digits.",
  stepConfirm: "Step 2 of 2. Type the same {count} digits.",
  currentTitle: "Enter your current passcode",
  currentBody: "Then choose the new one.",
  useFour: "Use a 4-digit passcode",
  useSix: "Use a 6-digit passcode",
  trivial: "That one is too easy to guess. Avoid repeats, runs like 1234 and your birth year.",
  mismatch: "Those did not match. Start again.",
  proofRequired: "For your safety, sign in again before changing your passcode.",
  saved: "Passcode saved.",
  changed: "Passcode changed.",

  settingsRow: "Passcode",
  settingsRowSub: "The code that unlocks Vallo on this device",
  screenTitle: "Passcode",
  lengthLabel: "Passcode length",
  lengthSix: "6 digits",
  lengthFour: "4 digits",
  change: "Change passcode",
  forgot: "Forgot your passcode? Sign in with your password to set a new one.",
  notSet: "You have not set a passcode yet.",
  lockNote: "Vallo locks after 5 minutes away, and in every new tab.",

  keypadLabel: "Passcode keypad",
  deleteKey: "Delete",
  digitsEntered: "{count} of {total} digits entered",
  moneyLocked: "Unlock Vallo with your passcode first. Nothing was charged or changed.",

  /**
   * THE OFFER, NOT THE GATE (6 November 2026). A passcode is optional: a new
   * member goes straight in, and the home screen carries this slim alert
   * until they set one or close it. Closed, it comes back once after 60 days.
   */
  offerTitle: "Protect your account",
  offerBody: "Add a passcode, and Face ID where your phone has it, so nobody else can open Vallo on this device.",
  offerAction: "Set up",
  offerDismiss: "Not now",
};
