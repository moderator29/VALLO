import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import AuthLayout from "@/app/(auth)/layout";
import { FinishSetupForm } from "@/components/auth/FinishSetupForm";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import type { AuthFormState, EmailStatus } from "@/lib/auth/form-state";
import { deactivatedAccountNotice } from "@/lib/auth/deactivated-notice";
import { fixtureRefusal } from "./refusal";

/*
 * Every refusal the password step can show, as the server returns it. The
 * sentences are `authMessage`'s and `throttle`'s in `lib/auth/actions.ts`
 * (not exported, so copied word for word here); the deactivated one is the
 * real `deactivatedAccountNotice()`; the field errors are
 * `validateCredentials`'s.
 */
const REFUSALS: Record<string, AuthFormState> = {
  refused: {
    ok: false,
    message: "That email and password do not match. Check both, or reset your password.",
  },
  /* Live, a sign-in refused as not confirmed goes straight to the code
     screen (`lib/auth/unconfirmed.ts`); this is `refusals.unconfirmed`. */
  unconfirmed: {
    ok: false,
    message: "This email is not confirmed yet. Enter the code we emailed you to finish.",
  },
  throttled: { ok: false, message: "Too many attempts just now. Try again in a minute." },
  deactivated: { ok: false, ...deactivatedAccountNotice() },
  fields: {
    ok: false,
    fieldErrors: {
      email: "That does not look like a valid email.",
      password: "Use at least 8 characters.",
    },
  },
};

export const metadata: Metadata = {
  title: "Preview: Welcome back",
  robots: { index: false, follow: false },
};

/**
 * Welcome back, the states a sandbox cannot reach live (rule R-G).
 *
 * The real shell and the real `EmailAuthForm` (one screen, email and
 * password together, B-1), on fixture props, behind the preview gate in
 * `../../layout.tsx`. These are the answers that depend on an account
 * existing, which no test user may be created to show:
 *
 *   ?state=chooser   the one screen, as live, with a notice and the doors
 *   ?state=finish    "Finish setting up" for a new Google account (B-2),
 *                    with the provider's name filled in
 *   ?state=google    an address whose account signs in with Google
 *   ?state=none      an address no account uses (the plain password step)
 *   ?state=refused      a password the server refused ("do not match")
 *   ?state=unconfirmed  an address not yet confirmed
 *   ?state=throttled    the per-connection or per-address limit tripped
 *   ?state=deactivated  an account in its deletion grace window (the real
 *                       notice, with its link to restore)
 *   ?state=fields       the server's field errors on both fields
 *
 * Proofs taken here are fixture-backed and the ledger says so.
 */
export default async function SignInPreview({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state = "chooser" } = await searchParams;
  const t = getDictionary(await getLocale());
  const providers = [
    { id: "email" as const, configured: true },
    { id: "google" as const, configured: true },
    { id: "apple" as const, configured: false },
  ];

  let body: React.ReactNode;
  if (state === "google" || state === "none") {
    body = (
      <EmailAuthForm
        mode="sign-in"
        t={t}
        action={fixtureRefusal}
        initialEmail="ada@example.com"
        accountMethod={state as EmailStatus}
        googleReady
      />
    );
  } else if (REFUSALS[state]) {
    body = (
      <EmailAuthForm
        mode="sign-in"
        t={t}
        action={fixtureRefusal}
        initialEmail="ada@example.com"
        initialState={REFUSALS[state]}
      />
    );
  } else if (state === "finish") {
    body = (
      <FinishSetupForm t={t} action={fixtureRefusal} initialFirstName="Ada" initialSurname="Obi" />
    );
  } else {
    body = (
      <EmailAuthForm
        mode="sign-in"
        t={t}
        action={fixtureRefusal}
        googleReady={providers.some((p) => p.id === "google" && p.configured)}
        appleReady
        notice="Sign in to open that. It takes a moment, and new accounts are free."
      />
    );
  }

  return <AuthLayout>{body}</AuthLayout>;
}
