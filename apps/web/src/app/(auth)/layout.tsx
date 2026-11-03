import "@/app/css/auth.css";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AuthCurveBlock } from "@/components/auth/slate";
import { AuthBackBar } from "./AuthBackBar";
import { AuthFocal } from "./AuthFocal";
import { AuthHeroLine } from "./AuthHeroLine";
import { KeepPillInView } from "./KeepPillInView";
import { AuthMain } from "./AuthMain";
import { ForgetOnSignOut } from "@/components/app/offline/ForgetOnSignOut";
import { DropPassedFlag } from "./DropPassedFlag";

/**
 * Auth shell: one full-height screen, to the Slate references of 29
 * September (`docs/design/references/2026-09-29`, 12 and 14).
 *
 * Top to bottom: the CURVED TOP BLOCK, full bleed at every width (the way
 * back in its toolbar; language lives in Settings only, the founder's rule
 * of 29 September, the wordmark in spaced
 * capitals, one line under it chosen by the screen), then the screen's own
 * content in one centred column on the page colour, and the small print at
 * the foot. Every auth screen renders inside the same shell, so sign in, sign
 * up, the code, the reset and the recovery read as the same place.
 *
 * THE 3D GLASS DOOR (the founder, 30 September, after the passcode
 * reference): a bright blue bowl in both themes with the Vallo lockup, one
 * object in a glowing ring across its curve (`AuthFocal`), glass fields and
 * a glossy blue pill; the page is warm paper in light and night in dark,
 * except the sign-up flow, which is night in both (`AuthMain`). The block and its pieces are
 * `components/auth/slate.tsx`; the whole surface is `app/css/auth.css`.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <AuthMain>
      {/* V-35, V-77: a phone at the way in keeps nobody's gate code or shortlist. */}
      <ForgetOnSignOut />
      <KeepPillInView />
      <DropPassedFlag />
      <AuthCurveBlock
        brandLabel={t.a11y.logoHome}
        wordmark={t.auth.wordmark}
        start={<AuthBackBar />}
        focal={<AuthFocal />}
        line={
          <AuthHeroLine
            lines={{
              signIn: t.auth.heroSignIn,
              signUp: t.auth.heroSignUp,
              verify: t.auth.heroVerify,
              reset: t.auth.heroReset,
            }}
          />
        }
      />

      <div className="nf-auth__body">{children}</div>

      {/*
        The small print, at the foot of every auth screen. It has to be on the
        screen, because a person who makes an account with Google from here
        passes no tick.
      */}
      <p className="nf-auth__legal">
        {t.auth.termsNotice} <Link href="/terms">{t.safety.termsLink}</Link>
        {" · "}
        <Link href="/privacy">{t.safety.privacyLink}</Link>
        {" · "}
        <Link href="/eula">{t.safety.rulesLink}</Link>
        {" · "}
        <Link href="/help">{t.safety.helpLink}</Link>
        {" · "}
        <Link href="/docs">{t.safety.docsLink}</Link>
      </p>
    </AuthMain>
  );
}
