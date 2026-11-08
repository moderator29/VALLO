import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forResetCodeForm } from "@/lib/i18n/slice";
import { chooserEmail, verifyPasswordResetCode } from "@/lib/auth/actions";
import { ResetCodeForm } from "@/components/auth/ResetCodeForm";

export const metadata: Metadata = {
  title: "Enter your reset code",
  robots: { index: false, follow: false },
};

/**
 * The code half of the reset email. The link half lands on `/auth/callback`
 * and only works in the browser that asked for it; the code works anywhere.
 * A right code redirects to /reset-password with a recovery session.
 *
 * The address is prefilled from the chooser's cookie when this device typed
 * it there, and is otherwise typed, because the code is often read on
 * another device.
 */
export default async function ForgotPasswordCodePage() {
  const locale = await getLocale();
  return (
    <ResetCodeForm
      t={forResetCodeForm(getDictionary(locale))}
      verify={verifyPasswordResetCode}
      initialEmail={await chooserEmail()}
    />
  );
}
