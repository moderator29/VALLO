import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forVerifyCodeForm } from "@/lib/i18n/slice";
import { pendingSignUpEmail, resendSignUpCode, verifySignUpCode } from "@/lib/auth/actions";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";

export const metadata: Metadata = {
  title: "Enter your confirmation code",
  robots: { index: false, follow: false },
};

/**
 * The screen the confirmation code was always for.
 *
 * The email has carried six digits under the words "Or enter this code" for as
 * long as the template has existed, and until now there was no screen anywhere
 * on this platform that asked for them. Somebody who read the code instead of
 * tapping the button had reached a dead end inside their own sign-up.
 *
 * Dynamic because it reads the cookie the sign-up left behind. That cookie is
 * a convenience and not a gate: the address is on the form either way, so
 * signing up on a phone and reading the email on a laptop still works.
 */
export const dynamic = "force-dynamic";

export default async function VerifySignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = getDictionary(await getLocale());
  const email = await pendingSignUpEmail();

  return (
    <VerifyCodeForm
      t={forVerifyCodeForm(t)}
      verify={verifySignUpCode}
      resend={resendSignUpCode}
      email={email}
      next={next}
    />
  );
}
