# The passcode: "Welcome back"

Every signed-in member has an account passcode: 4 digits by default, or 6. It is an app lock on top of the normal session, in the style of a banking app. It does **not** replace the password, Google or Apple. It decides whether a browser that is already signed in may show the app and move money right now.

This document is the design. The code is in `apps/web/src/lib/passcode/`, `apps/web/src/components/passcode/` and the migration `supabase/migrations/20260929034124_passcode_member_app_lock_code_bcrypt_only.sql`.

## 1. Setup

- **Who.** Every signed-in member. A new member meets it straight after account creation: sign-up lands on `/home`, and the `(app)` layout draws the setup screen instead of the page until a code is set. An existing member meets the same screen on their next visit to any page under `(app)`. It cannot be skipped. The only other way out is **Sign out**.
- **Length.** 4 digits by default (D18). "Use a 6-digit passcode" on the first screen switches to 6, and back.
- **Twice.** The code is typed, then typed again on "Enter it again". A mismatch shakes the dots and starts again.
- **Trivial codes are refused.** These are refused on the screen before the code is sent (`lib/passcode/rules.ts`), and again by the database, which has the final say (`private.passcode_is_trivial`):
  - one repeated digit, for example `000000` or `1111`;
  - a straight run up or down, for example `123456`, `654321`, `1234` or `3456`;
  - the member's birth year, when it is known. Nothing on the platform collects a birth date today. The database reads `birth_year`, `birthdate` or `birthday` from the account's auth metadata if one ever appears. That is the hook.

## 2. Storage

- **Where.** `public.member_passcodes(user_id pk, hash, length, set_at, failed_count, locked_until, reset_required, updated_at)`, one row per member, cascading with `auth.users`.
- **Who can read it.** RLS is on and there is no policy. `anon` and `authenticated` hold no privilege on the table at all, so no member can read a hash, including their own. `service_role` keeps its usual access for support.
- **How it is hashed.** `extensions.crypt(code, extensions.gen_salt('bf', 10))`, bcrypt at cost 10. This only happens inside `SECURITY DEFINER` functions with `search_path ''`:

  | Function | Who may call it | What it does |
  |---|---|---|
  | `public.passcode_status()` | authenticated | Returns `unset`, `set` or `reset_required`, plus the length, the failure count and the cooldown. It never returns the hash. |
  | `public.passcode_set(p_code, p_length, p_current default null)` | authenticated | Sets the first code with no further proof. Replacing an existing code needs either the right current code (which is counted like any attempt) or a fresh sign-in: an `amr` entry in the verified token from the last 15 minutes. |
  | `public.passcode_verify(p_code)` | authenticated | Checks one attempt and counts it (section 4). |
  | `private.passcode_*` | nobody but the functions above | The trivial rule, the birth-year hook, the freshness check, the counted attempt and the audit write. |

- **Nothing leaks.** No function returns the hash, and nothing logs a code. The actions pass a code straight to the RPC and drop it. The audit rows carry the event, the length and the failure count, never a code. The migration's probe checks this.

## 3. The lock

The lock is the "Welcome back" screen.

### When it appears

- **In a new tab, or a new browser session.** The unlock cookie has no Max-Age, so it ends with the browser session. Each tab also keeps a mark in `sessionStorage`, and a tab without the mark locks when it opens.
- **After 5 minutes of inactivity.** Inactivity means no pointer, key, wheel, touch or scroll events.
- **After being hidden for 5 minutes or more.** This covers switching to another app or tab, or locking the phone (`visibilitychange`).
- **When the server's unlock lapses.** See "The unlocked state" below.

### The unlocked state

- **The cookie.** Unlocking is recorded in a short-lived, httpOnly, SameSite=Lax cookie, `vallo_unlock`. Its value is `v1.<user id>.<issued>.<expires>.<HMAC-SHA256>`.
- **Its key.** The HMAC key is derived from `SUPABASE_SERVICE_ROLE_KEY` under a purpose label, `lib/passcode/unlock-cookie.ts`. No generic cookie secret existed, and this adds no new environment variable. Rotating the service key asks everyone for their passcode again.
- **Who can write it.** Only the server: after a right code, after a new code is set, or after a full sign-in in the last 5 minutes.
- **It slides.** Every `POST /api/passcode/touch` re-signs it, and the browser sends one at most once a minute while the member is active. It lapses after 15 minutes with no touch, and after 12 hours in all.
- **It is tied to the user id.** A cookie minted for one account unlocks nothing for another.

### The gate

- **Where it runs.** `components/passcode/PasscodeGate.tsx` sits inside the `(app)` layout. That is a one-element edit, and `AppShell` is untouched. The workspaces (`/agent`, `/host`, `/admin`) wrap their pages in the same gate through `PasscodeLayer` (section 10).
- **What it draws.** It draws the page only when the session is unlocked. Otherwise it draws the lock or the setup screen *instead of* the page, so none of the page's markup reaches the browser.
- **The decision.** The rules are pure and tested in `lib/passcode/decide.ts`.
- **After unlocking.** A client guard, `PasscodeGuard.tsx`, wraps the page and runs the inactivity timer. When it locks, it clears the cookie through `lockPasscodeAction`, and the route re-renders as the lock.

### Money re-checks on the server

A locked session cannot pay, and cannot change where money is paid out.

- **Payments and bank accounts.** `guardMoney` in `lib/security/money-limits.ts` calls `passcodeMoneyRefusal` first. This covers card checkout, saved-card payments, card setup, the default card, removing a card, crypto payments, adding, resolving, defaulting or removing a bank account, and Guarantee claims. A refused call spends no rate-limit slot.
- **Payouts.** `moneyLockRefusalFor` in `lib/security/money-lock-guard.ts` does the same before the V-81 step-up is spent.
- **The exemptions.** The payment status polls (`paymentState`, `cryptoState`) and the crypto quote are not refused. They read the outcome of a payment already made, and a lock must not hide whether it went through.
- **It fails closed.** An unreadable state refuses.

### Never locked

- The public site.
- The auth pages.
- The signed-out catalogue (the gate answers `open` with no session).

### Never fails into the page

If the passcode cannot be read (an RPC error, or the function missing), the gate still draws the lock, with "We could not check your passcode just now" and **Use your password instead**. The only ways past it are:

- a valid unlock cookie, or
- a full sign-in in the last 5 minutes. The password was just typed, so this is the fallback to the password.

So the founder cannot be locked out by a broken table. Nobody is let through without authenticating either.

## 4. Brute force

- **5 wrong in a row** starts a 30-second cooldown. During it, even the right code answers "cooldown".
- **10 cumulative wrong attempts** set `reset_required`. A right code resets the count. The action then signs this browser out (`scope: local`) and sends the member to `/sign-in?notice=passcode-locked`. From then on the old code is useless everywhere. Every other signed-in device shows only "Sign in again". After a full sign-in, the setup screen asks for a new code.
- **Rate limits.** These use the existing `consume()` limiter:
  - verify: 30 per user and 120 per IP address in 10 minutes;
  - set: 12 per user per hour.

  The database's own count is what ends a guessing run. The IP limit stops one address from working through many accounts.
- **Audit.** `public.audit_log` gets a row, with entity type `member_passcode`, for each of these: `passcode.set`, `passcode.change`, `passcode.reset`, and `passcode.lockout` (with `kind` `cooldown` or `sign_out`).

## 5. Forgot the passcode

The lock, the setup screen and Settings all offer **Use your password instead**. Choosing it:

1. writes a signed, httpOnly `vallo_passcode_reset` cookie for this member, valid for 30 minutes;
2. signs this browser out;
3. sends the member to `/sign-in?notice=passcode-reset`, keeping a safe `next`.

After any full sign-in (password, Google, Apple or an emailed code), the fresh `amr` together with that cookie makes the gate draw "Set a new passcode". `passcode_set` accepts the new code without the old one because the token carries the fresh sign-in. This follows the same principle as `lib/auth/recovery-session.ts`.

## 6. Change it in Settings

The screen is under Settings, then Privacy and security, then **Passcode** (`/settings/passcode`).

- **Passcode length.** A 6 or 4 digits choice.
- **Change passcode.** This asks for the current code first, unless the member signed in within the last 15 minutes. It then asks for the new code twice.
- **Changing the length is changing the code.** A hash cannot be shortened, so a new length means a new code.
- **Forgotten.** The screen also offers Use your password instead.

## 7. The screens

- **The top.** The shared Slate block (`AuthCurveBlock`, compact, from `components/auth/slate.tsx`) is the same door as sign-in. In light mode it is brand navy and the rest of the screen is white. In dark mode the block is inverted to a light surface and the rest is dark.
- **Under the arc:**
  - the avatar, or the initial;
  - "Welcome back, {first name}";
  - 6 or 4 dots;
  - a status line;
  - a 3 by 4 keypad of large round keys, with a delete key and a press state (scale and fill), using the shared haptic grammar (`feedback("select")`);
  - **Use your password instead**.
- **The keyboard works too.** Digits type and Backspace deletes.
- **A wrong code** shakes the dots sideways and colours them with the error colour. The status line says how many tries are left before the pause, and then before the sign-out.
- **Reduced motion.** Under the system setting, or the app's own Motion "off", nothing moves: no shake, no scale, and the Slate block's drop and morph are off.
- **It is a real dialog.** The lock is a `<dialog>` promoted with `showModal()`, so everything behind it, including the shell's rail and tab bar, is inert. It cannot be dismissed with Escape.
- **Screenshots.** They are kept with the change that built this.

## 8. Native (Capacitor)

**Unlock with Face ID or fingerprint (built 30 September 2026, C14).** A member who holds a platform key (the one the money lock enrols, `money_credentials`) sees a key on the keypad's bottom-left slot (`components/passcode/PasskeyUnlockKey.tsx`). It runs the V-81 WebAuthn ceremony (`lib/security/webauthn.ts`) through `lib/passcode/passkey-unlock.ts`: the challenge is bound to THIS session and to unlocking (digest `passcode-unlock:<session id>`, the same pattern as the console's `console:<session id>`), so a proof made for money or for the console cannot unlock the passcode. The server verifies the assertion and only then writes the unlock cookie. It unlocks only a passcode that is set: ten wrong codes (password-only mode) still need the password. No migration: it reuses the money lock's tables. Works in any browser with a platform authenticator; in the Capacitor shell it depends on the web view's WebAuthn support (iOS 16+ WKWebView with the Associated Domains entitlement; Android WebView support varies), so it must be tried on a device (release audit section 8). `lib/passcode/native-unlock.ts` is unchanged.

**The fifteen-minute idle lock, behind a setting.** On a device with a key, Settings, Passcode offers "Lock after 15 minutes idle" (per device, `lib/passcode/idle-setting.ts`). Off by default: five minutes stays the rule until the member turns it on. Fifteen minutes equals the server's sliding unlock (`UNLOCK_IDLE_SECONDS`), so the cookie never outlives the client lock. The founder decides whether to keep the setting (RECS_C C14).

## 9. Browser specs and the store reviewer

**Browser specs.** A spec that signs in would otherwise stop at the setup or lock screen. `apps/web/tests/_passcode.mjs` gets it through the way a member would. Call `passcodeReady(context, page)` straight after the spec's own sign-in. It does three things:

1. It marks every tab in the context as unlocked.
2. If the setup screen shows, it types `QA_MEMBER_PASSCODE` twice on the real keypad. The default code is 480913.
3. It posts `/api/passcode/touch`. Straight after a sign-in, that stores the signed unlock cookie in the context, so a `storageState` taken afterwards carries it.

For a context built from that state, call `markEveryTab(context)`. For a run longer than 15 idle minutes, `addUnlockCookie(context)` writes the cookie directly. It needs the server's `SUPABASE_SERVICE_ROLE_KEY` in the spec environment. `src/lib/passcode/spec-helper.test.ts` keeps the helper's signing identical to the app's.

The five QA-login specs already call it:

- `session-b-signin-live`
- `session-b-feed-live`
- `session-b-profile-live`
- `listing-exits`
- `theme-choice`

**The store reviewer.** Run `scripts/seed/store-reviewer.mjs` with `SEED_REVIEWER_PASSCODE=<6 digits>`. It sets the reviewer's code on the session it has just proved, and never prints it. Then give the code in the review notes beside the login. `docs/STORE_SUBMISSION_NOTES.md`, section 2, has the wording.

## 10. Decisions taken, and known limits

- **Every member, now.** This was the founder's decision of 29 September. Existing members are shown setup on their next visit, and it cannot be skipped. The only way out is Sign out.
- **The workspaces are locked too.** `/agent`, `/host` and `/admin` wrap their pages in `PasscodeLayer` (`components/passcode/PasscodeLayer.tsx`), which is `PasscodeGate` with its own dictionary and identity reads. `/agent` and `/host` had no layout, so each now has one that does nothing else. In `/admin`, the gate wraps the page inside both the operator frame and the staff frame.
- **The success card.** After a code is set, `PasscodeSetup` calls `showSuccess("passcode-set")`. After a change or a reset it calls `showSuccess("passcode-changed")` (`lib/ui/success-moments.ts`). The root layout's success host shows the card, so it survives the refresh that swaps the setup screen for the page. It never fires on an error, a lockout or while a save is pending. The copy is `success.moments.passcodeSet` and `passcodeChanged`.
- **New tabs.** A new tab is detected in the browser. Its server-rendered page can paint for a moment before the lock covers it. The server boundary (the cookie, and money) is not affected.
- **Offline.** An offline tab locks locally. Since 2 November 2026 it can also unlock locally, over a page already on the phone (section 11).
- **No key.** A deployment with no `SUPABASE_SERVICE_ROLE_KEY` cannot mint an unlock. Members then get in only for 5 minutes after each full sign-in. Every real deployment has the key.

## 11. A weak signal, and no signal (2 November 2026)

The founder's report: on a slow network the lock said "That did not go through. Check your connection and try again." and emptied the keypad. A banking app does not do that.

- **Patient.** `lib/passcode/patient-verify.ts`: a code whose answer is lost (a request that throws or times out, or the server failing to reach the database) is asked again with growing gaps (1, 2, 4, 6, 8 seconds), and the lock says "Weak connection. Still checking your passcode." A real answer (right, wrong, cooldown, signed out) ends it at once. A wrong code is never retried.
- **Counted once.** Each typed code carries an attempt id. `public.passcode_verify(p_code, p_attempt)` (migration `20261103084647`) answers the same id within two minutes with the same outcome, uncounted (`private.passcode_last_attempts`, one row per member). The one-argument function is unchanged.
- **Try again, with the code kept.** If nothing gets through, the dots stay full and the lock says "We could not reach Vallo. Your passcode is still entered: check your signal and tap Try again." Try again (or the signal coming back) sends the same code under the same attempt id. Typing or deleting starts a new code.
- **The phone's own check.** `lib/passcode/local-verifier.ts`: after the server accepts a code (and after setup), the device keeps PBKDF2-SHA256 of it under a random salt, 200,000 rounds, tied to the member's id, never the code. Used ONLY by the lock drawn over a page already on the phone (`PasscodeGuard`: the screen the member was on, or a copy the service worker kept), and only when the server cannot be reached. It reveals that page and nothing else: no unlock cookie is written, so every money action still refuses. The typed code is then held in memory for this tab, at most ten minutes, and sent to the server as soon as the signal returns (`server-catch-up.ts`), which writes the unlock; if the server answers wrong (the code was changed elsewhere), the verifier is forgotten and the page locks again. Five wrong codes on the phone forget the verifier; it expires after 30 days; sign-out (`forgetKeptPages`) and a change of code in Settings forget it.
- **Why that is not a weaker door.** Whoever can read this device's storage can already read the kept pages it would reveal: they are in the same origin's cache. The server, and money, are unchanged.
- **The wait after a right code.** On Save-Data, 2G or 3G the accepted unlock waits 20 seconds for the refreshed page before reloading, not 6.
