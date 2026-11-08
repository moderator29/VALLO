import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forForgotPasswordForm } from "@/lib/i18n/slice";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("forgotPassword", { robots: { index: false, follow: false } });
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  return <ForgotPasswordForm t={forForgotPasswordForm(getDictionary(locale))} />;
}
