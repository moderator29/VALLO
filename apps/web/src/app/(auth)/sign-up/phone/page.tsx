import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { safeReturnPath } from "@/lib/security/return-path";
import { withNext } from "@/lib/auth/next-link";
import { SIGN_UP_PHONE_PATH, signUpPhoneToConfirm } from "@/lib/phone-otp/signup-step";
import { SignUpPhoneStep } from "@/components/auth/SignUpPhoneStep";

export const metadata: Metadata = {
  title: "Confirm your mobile number",
  robots: { index: false, follow: false },
};

/**
 * SIGN-UP, STEP THREE (2 November 2026): form, email code, THIS, in.
 *
 * Reached from the email code (or the email link) only when a code can reach
 * the number (`lib/phone-otp/signup-step.ts`). Opened any other time it goes
 * straight on: signed out to sign in, already confirmed or nothing to send to
 * onwards to `next`.
 */
export const dynamic = "force-dynamic";

export default async function SignUpPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: raw } = await searchParams;
  const candidate = typeof raw === "string" ? safeReturnPath(raw, "") : null;
  const next = candidate && !candidate.startsWith(SIGN_UP_PHONE_PATH) ? candidate : "/home";

  if (!isSupabaseConfigured()) redirect("/sign-in?notice=unconfigured");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(withNext("/sign-in", `${SIGN_UP_PHONE_PATH}?next=${encodeURIComponent(next)}`));

  const phone = await signUpPhoneToConfirm(supabase, data.user.id);
  if (!phone) redirect(next);

  const t = getDictionary(await getLocale());
  return <SignUpPhoneStep t={t} phone={phone} next={next} />;
}
