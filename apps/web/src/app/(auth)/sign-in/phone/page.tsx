import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forCodeSignInForm } from "@/lib/i18n/slice";
import { CodeSignInForm } from "@/components/auth/CodeSignInForm";
import { phoneSignInEnabled } from "@/lib/auth/phone-sign-in-flag";
import { safeReturnPath } from "@/lib/security/return-path";

export const metadata: Metadata = { title: "Sign in with your phone", robots: { index: false, follow: false } };

/** A2. Phone sign-in, a 404 until `PHONE_SIGNIN_ENABLED=true` (docs/PHONE_SIGNIN.md). */
export default async function SignInWithPhonePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!phoneSignInEnabled()) notFound();
  const t = getDictionary(await getLocale());
  const { next } = await searchParams;
  return <CodeSignInForm mode="phone" t={forCodeSignInForm(t)} next={typeof next === "string" ? (safeReturnPath(next, "") ?? undefined) : undefined} />;
}
