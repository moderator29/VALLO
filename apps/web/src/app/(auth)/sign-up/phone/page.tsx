import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { phoneOwedAtSignup } from "@/lib/phone-otp/signup-gate-server";
import { SIGNUP_PHONE_PATH } from "@/lib/phone-otp/signup-gate";
import { safeReturnPath } from "@/lib/security/return-path";
import { PhoneConfirmForm } from "@/app/(app)/settings/phone/PhoneConfirmForm";

export const metadata: Metadata = {
  title: "Confirm your mobile number",
  robots: { index: false, follow: false },
};

/**
 * THE PHONE STEP OF SIGNING UP (29 October 2026). A new account lands here
 * after its email is confirmed and stays until a mobile number is confirmed
 * with a code (`lib/phone-otp/signup-gate.ts` has the rule). Never loops:
 * signed out goes to sign in; nothing owed goes straight on.
 */
export const dynamic = "force-dynamic";

export default async function SignUpPhonePage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const candidate = typeof raw === "string" ? safeReturnPath(raw, "") : "";
  const next = candidate && !candidate.startsWith("/sign-up/phone") ? candidate : "/home";

  const session = await resolveSession();
  if (session.state === "signed-out") redirect(withNext("/sign-in", SIGNUP_PHONE_PATH));
  if (session.state !== "signed-in") redirect("/sign-in?notice=unconfigured");
  if (!(await phoneOwedAtSignup(session.supabase, session.user))) redirect(next);

  const copy = getDictionary(await getLocale()).trustVisible.phone;
  return (
    <section className="mx-auto w-full max-w-md space-y-block px-gutter py-block" data-testid="signup-phone">
      <h1 className="nf-h2 text-[var(--nf-content-primary)]">{copy.title}</h1>
      <p className="nf-body text-[var(--nf-content-secondary)]">{copy.why}</p>
      <PhoneConfirmForm copy={copy} next={next} />
    </section>
  );
}
