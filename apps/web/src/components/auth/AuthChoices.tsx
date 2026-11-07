import "@/app/css/auth.css";
import Link from "next/link";
import { withNext } from "@/lib/auth/next-link";
import type { Dictionary } from "@vallo/i18n/core";
import type { ProviderId, ProviderState, SignInSurface } from "@/lib/auth/providers";
import { continueWithEmail } from "@/lib/auth/actions";
import { SocialDoors } from "./SocialDoors";
import { AuthPillButton } from "./slate";
import { BannerOnArrival } from "@/components/ui/BannerOnArrival";

/**
 * The door, to the Slate references of 29 September
 * (`docs/design/references/2026-09-29`, 12 and 14).
 *
 * Under the curved top block (drawn by the auth layout): the big title, the
 * labelled email card, the Continue pill, the "Or" rule, the round Google and
 * Apple doors, and the line to the other door. The pieces are the shared
 * Slate system in `./slate.tsx`.
 *
 * SIGN-UP'S DOOR ONLY SINCE B-1 (29 September). `/sign-in` is one screen now
 * (`EmailAuthForm`, email and password together, refs 12 and 14), so this
 * chooser serves `/sign-up`; its sign-in mode is kept for any caller that
 * still asks for it and posts to `continueWithEmail`, which sends a sign-in
 * back to `/sign-in` with the address filled in.
 *
 * EMAIL FIRST, AND THE FIELD IS REAL. The render puts the address on the
 * first screen and the password on the next, which is the flow this platform
 * already runs: the chooser here, the form at `/sign-in/email`. So the field
 * is a form that posts the address to `continueWithEmail`, which holds it in
 * a short-lived httpOnly cookie (never the URL, where it would sit in history
 * and referrers) and redirects to the email screen, which opens with it
 * filled in and the cursor on the password. The
 * browser's back button still undoes the step, because it is still a route
 * and not an in-place expansion.
 *
 * GOOGLE IS DRAWN ONLY WHEN IT WORKS. `getProviderStates` says whether the
 * dashboard has the provider on; a door that can only fail is the same defect
 * as a Reserve button on a listing nobody can book, so with Google off the
 * rule and the round button are simply not there and email is the way in. The
 * door posts to the real `startGoogleOAuth` action with the destination and
 * the intent, exactly as the callback expects them (`SocialDoors`).
 *
 * A server component: every control is a link or a form posting to a server
 * action, so none of it needs to be shipped as JavaScript.
 */
export function AuthChoices({
  mode,
  t,
  providers,
  notice,
  next,
  surface = "web",
}: {
  mode: "sign-in" | "sign-up";
  t: Dictionary;
  providers: ProviderState[];
  /** Which surface the server rendered for. The redirect doors are drawn
      only on the website; inside a shell they cannot complete (STORE-03). */
  surface?: SignInSurface;
  /** A message from the auth callback, for example an expired link. */
  notice?: string | undefined;
  /**
   * Where the person was going when the middleware stopped them, carried
   * through every route out of this screen so signing in returns them there
   * rather than dropping them on the home shelf. Validated again server side,
   * because a hidden field is an input like any other.
   */
  next?: string | undefined;
}) {
  const isSignUp = mode === "sign-up";
  const configured = (id: ProviderId) => providers.find((p) => p.id === id)?.configured ?? false;
  const emailReady = configured("email");
  const googleReady = configured("google") && surface === "web";
  const appleReady = configured("apple");

  return (
    <div className="nf-auth__screen nf-slate-stagger">
      <h1 className="nf-auth__title">{isSignUp ? t.common.signUp : t.common.signIn}</h1>

      {/* The arrival sentence is said by the one banner (founder, 7 November 2026). */}
      <BannerOnArrival message={notice ?? null} tone="info" />

      {/*
        The address is posted to a server action that keeps it in a cookie
        and redirects to the email step, so it never lands in the URL.
        `next` rides along so the chain to the person's original destination
        does not break at this hop. A server action form still submits before
        hydration, so this works with no JavaScript.

        The field is the Slate card with its label above it, and the one
        primary pill follows it, so the pill sits in the first screen at
        every phone size with the keyboard up (the block above shortens while
        a field has focus). The provider doors follow as round buttons.
      */}
      <form action={continueWithEmail} className="nf-auth__form nf-auth__form--fields" noValidate={false}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="mode" value={mode} />
        <div>
          <label htmlFor="auth-email" className="nf-label">
            {t.auth.emailLabel}
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t.auth.emailPlaceholder}
            disabled={!emailReady}
            className="nf-field nf-field--glass nf-auth-input"
          />
        </div>

        {emailReady ? (
          <div className="nf-auth__actions">
            <AuthPillButton type="submit" className="nf-auth__cta">
              {t.common.continue}
            </AuthPillButton>
          </div>
        ) : (
          <p className="nf-auth__notice">{t.auth.providerUnavailable}</p>
        )}
      </form>

      {/* Google and Apple, round, under the rule; drawn only when they work
          on this surface (`SocialDoors`). */}
      <SocialDoors
        t={t}
        googleReady={googleReady}
        appleReady={appleReady && surface !== "android-native"}
        surface={surface}
        next={next}
        intent={mode}
      />

      <p className="nf-auth__swap">
        {isSignUp ? t.auth.haveAccount : t.auth.noAccount}{" "}
        {/* The other door keeps the destination too (audit UX-02, R16):
            a stranger who arrived to sign in and chose to make an account
            instead used to lose the thing that was shared with them here. */}
        <Link href={withNext(isSignUp ? "/sign-in" : "/sign-up", next)}>
          {isSignUp ? t.common.signIn : t.common.signUp}
        </Link>
      </p>

      {/* The intro for a first visit, kept as a quiet door beside the
          sign-up link rather than a toll before it. It goes to first run with
          this door as the way back (request W2), not to `/start`, which is a
          redirect and was prefetched on every render of this card. */}
      {isSignUp && (
        <p className="nf-auth__swap nf-auth__swap--quiet">
          <Link
            href={`/welcome?next=${encodeURIComponent(withNext("/sign-up", next))}`}
            prefetch={false}
            className="nf-tap"
          >
            {t.welcomeCards.label}
          </Link>
        </p>
      )}
    </div>
  );
}
