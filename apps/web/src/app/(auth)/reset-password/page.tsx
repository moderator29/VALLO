import "@/app/css/auth.css";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/i18n/public-metadata";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forResetPasswordForm } from "@/lib/i18n/slice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { AuthPillLink } from "@/components/auth/slate";
import { passwordChangeProof, type PasswordChangeProof } from "@/lib/auth/password-change-proof";

/* A10: the title and description in the page's own language, with its
   canonical and hreflang (lib/i18n/public-metadata.ts; words in publicMeta). */
export async function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata("resetPassword", { robots: { index: false, follow: false } });
}

/*
 * The session is the ticket, so this page has to run per request. Cached, it
 * would serve one visitor's answer to the next.
 */
export const dynamic = "force-dynamic";

/**
 * The end of the reset flow.
 *
 * A recovery link goes to `/auth/callback`, which exchanges its code for a
 * session and forwards here. So arriving here with a session means the link
 * worked, and arriving without one means it expired, was already used, or the
 * URL was opened directly - and each of those deserves the same plain sentence
 * and a way to ask for another link, rather than a password form that would
 * fail on submit for reasons nobody could see.
 */
export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const proof = await (async (): Promise<PasswordChangeProof | null> => {
    if (!isSupabaseConfigured()) return null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      return data.user ? await passwordChangeProof(supabase, data.user) : null;
    } catch {
      return null;
    }
  })();

  if (!proof) {
    return (
      <div className="nf-auth__screen nf-slate-stagger">
        <h1 className="nf-auth__title">{t.auth.resetExpiredTitle}</h1>
        <p className="nf-auth__sub">{t.auth.resetExpiredLead}</p>
        <div className="nf-auth__form">
          <AuthPillLink href="/forgot-password" className="nf-auth__cta">
            {t.auth.resetSend}
          </AuthPillLink>
          {/* A link opened in another browser lands here, and the code in the
              same email works anywhere. */}
          <AuthPillLink href="/forgot-password/code" quiet>
            {t.auth.resetEnterCode}
          </AuthPillLink>
        </div>
      </div>
    );
  }

  return <ResetPasswordForm t={forResetPasswordForm(t)} askCurrent={proof === "current-password"} />;
}
