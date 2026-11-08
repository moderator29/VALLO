import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forCodeSignInForm } from "@/lib/i18n/slice";
import { CodeSignInForm } from "@/components/auth/CodeSignInForm";
import { safeReturnPath } from "@/lib/security/return-path";

export const metadata: Metadata = { title: "Sign in with a code", robots: { index: false, follow: false } };

/** A3. Sign in with a six-digit code by email, no password (`lib/auth/email-code.ts`). */
export default async function SignInWithCodePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const t = getDictionary(await getLocale());
  const { next } = await searchParams;
  return <CodeSignInForm mode="email" t={forCodeSignInForm(t)} next={typeof next === "string" ? (safeReturnPath(next, "") ?? undefined) : undefined} />;
}
