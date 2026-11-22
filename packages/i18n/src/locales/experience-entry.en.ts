/**
 * Session 3's copy for auth, the welcome tour and onboarding beyond Get Started (W11).
 *
 * One module per owner so agents can add strings without editing en.ts at
 * the same time. English only: ha, ig and yo fall back to it through
 * `withFallback` until a translator supplies a line, because an invented
 * translation of a new line is worse than none. Money sentences never live
 * here; they come from `lib/money/copy.ts` (Session 2).
 */
export const experienceEntryEn = {
  /* The resend clock (`components/auth/ResendClockView.tsx`). `{time}` is the
     real time left until the server's window ends, drawn as a tabular clock. */
  resendWindow: "That is every code we can send for now. You can ask for another in {time}.",
  resendReady: "You can ask for a new code now.",

  /* The offline page (`app/offline/`). Shown ONLY for a page this phone has
     never opened, asked for with no signal: every page opened before opens
     from the phone instead (`public/sw.js`). So it is small and calm, says
     what is true, and offers the way back to what does work. It is
     precached and static, so English. */
  offlineTitle: "This page needs a connection",
  offlineBody: "You have not opened it on this phone yet. Pages you have opened still work while you are offline.",
  offlineRetry: "Try again",
  offlineHome: "Go to Home",
  offlineStatusOnline: "Your phone reports a connection. Tap Try again.",
  offlineStatusOffline: "We will open it by ourselves when the signal is back.",

  /* The code field (`components/auth/CodeInput.tsx`): how far the code has
     got, read by a screen reader with the field's description. */
  codeProgress: "{n} of {total} in",

  /* THE REFUSALS THE AUTH ACTIONS ANSWER WITH (`lib/auth/actions.ts`, U1).
     Each says what went wrong and the one thing to do next; none says
     "invalid credentials", and none says whether an account exists.
     `{when}` is the limiter's own phrase ("in a minute"); `{count}` is a
     numeral. */
  refusals: {
    notConnected: "We cannot reach accounts right now. Nothing you typed was lost. Try again in a minute.",
    tooMany: "Too many attempts just now. Try again {when}.",
    credentials: "That email and password do not match. Check both, or reset your password.",
    /* The email carries a code and nothing to click (the Send Email Hook), so
       this never mentions a link. A sign-in refused this way goes straight to
       the code screen (`lib/auth/unconfirmed.ts`); this is the sentence for
       any other place GoTrue answers "Email not confirmed". */
    unconfirmed: "This email is not confirmed yet. Enter the code we emailed you to finish.",
    taken: "An account already uses that email address. Sign in instead, or reset your password.",
    rateLimited: "Too many attempts just now. Wait a minute, then try again.",
    passwordRefused: "That password was refused. Use at least 8 characters, mixing letters and numbers.",
    generic: "We could not finish that just now, and nothing was changed. Try again in a moment.",
    emailMissing: "Enter your email address.",
    emailTooLong: "That email address is too long. Check it for anything pasted in with it.",
    emailInvalid: "That does not look like an email address. Check it has an @ and a dot.",
    passwordMissing: "Enter your password.",
    passwordShort: "Use at least 8 characters.",
    passwordTooLong: "That password is too long. Use 200 characters or fewer.",
    signUpEmail: "Enter the email address you signed up with.",
    codeShape: "Type the {count} digits from the email we sent you.",
    codeWrong:
      "That code did not work. Type the code from your newest email; your last try is selected, so typing replaces it.",
    resendSent: "If that address is waiting on a code, a new one is on its way. It lasts an hour.",
    /* The reset email carries a code (`passwordReset`), typed at
       /forgot-password/code. A link is drawn only when the hook got no code. */
    resetSent:
      "If that email has an account, a reset code is on its way. It lasts an hour and works once.",
    resetBusy: "Too many requests just now. Wait a minute, then try again.",
    resetCodeShape: "Type the {count} digits from the reset email.",
    newPasswordMissing: "Enter a new password.",
    passwordsDiffer: "The two passwords do not match. Type the new one in both fields again.",
    resetLinkSpent:
      "That reset has expired or was already used. Ask for a new reset code and type it on the next screen.",
    resetLinkOnly:
      "To set a password on this account, ask for a reset code and type it, then choose the password within half an hour. The code is the proof it is you.",
    currentMissing: "Enter your current password.",
    currentWrong: "That is not your current password. Check it and try again.",
  },
};
