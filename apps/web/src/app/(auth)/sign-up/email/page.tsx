import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forEmailAuthForm } from "@/lib/i18n/slice";
import { chooserEmail, signUpWithEmail } from "@/lib/auth/actions";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { resolveProviderStates } from "@/lib/auth/providers";
import { requestSurface } from "@/lib/auth/surface";
import { emailFromQuery } from "@/components/auth/auth-intent";
import { inviteCodeFromCookie, inviteDoor } from "@/lib/referral/server";
import { FunnelBeacon } from "@/components/site/FunnelBeacon";

export const metadata: Metadata = {
  title: "Create your account with email",
  robots: { index: false, follow: false },
};

/**
 * The sign-up form, on one screen (A1, 30 September), reached from "Sign up
 * with email" on the options page (`/sign-up`), from the email-first
 * chooser, from a link that carries `?email=`, or from "Change it" on the
 * code screen. Where somebody stays is asked after the account exists, so
 * no list of states comes down with this page any more.
 */
export default async function SignUpEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const surface = await requestSurface();
  const providers = await resolveProviderStates(surface);
  const ready = (id: "google" | "apple") => providers.some((p) => p.id === id && p.configured);

  /* An invite link that was opened first left its code in a cookie: show who
     it names, so the person sees the link was read. */
  const keptCode = await inviteCodeFromCookie();
  const door = keptCode ? await inviteDoor(keptCode) : null;
  const invite = keptCode && door?.found ? { code: keptCode, firstName: door.firstName } : null;

  return (
    <>
      {/* A6: the funnel's "sign-up opened" step; draws nothing. */}
      <FunnelBeacon step="signup_opened" />
      <EmailAuthForm
        mode="sign-up"
        t={forEmailAuthForm(t)}
        action={signUpWithEmail}
        next={next}
        initialEmail={emailFromQuery(email) || (await chooserEmail())}
        googleReady={ready("google")}
        appleReady={ready("apple")}
        surface={surface}
        invite={invite}
      />
    </>
  );
}
