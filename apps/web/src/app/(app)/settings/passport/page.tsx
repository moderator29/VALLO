import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { EmptyActions } from "@/components/app/EmptyActions";
import { EmptyState, TYPE } from "@/components/app/Screen";
import { PassportSettings } from "@/components/passport/PassportSettings";
import { gateFirstRun } from "@/components/app/feature-onboarding/first-run-store";
import { resolveSession } from "@/lib/actions/session";
import { withNext } from "@/lib/auth/next-link";
import { readMyPassport } from "@/lib/passport/passport-read";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).passportV2.title };
}

export const dynamic = "force-dynamic";

/**
 * SETTINGS, VALLO PASSPORT: the owner's own page.
 *
 * Every member has a passport, whatever their side, and it is on by default
 * with every line shown. This page draws it the way a member sees it (the
 * document, in the owner's own light or dark), then a clean list of switches:
 * one for the whole passport and one for each line. Phone, email, ID numbers,
 * date of birth and address are not lines and are said not to be.
 *
 * States: signed out (sign in), a failed read (said, nothing changed), and the
 * page. Loading is `loading.tsx` beside this file.
 */
export default async function PassportSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.passportV2;
  const session = await resolveSession();
  /* One frame for every state the screen draws, so the title never moves. */
  const frame = { title: copy.title, subtitle: copy.subtitle, fallback: "/settings", width: "narrow" } as const;

  if (session.state !== "signed-in") {
    return (
      <PageFrame {...frame}>
        <EmptyState
          icon="user-verified"
          art="id-check"
          title={copy.signedOut}
          body={copy.lede}
          action={<EmptyActions primary={{ label: copy.signIn, href: withNext("/sign-in", "/settings/passport") }} />}
        />
      </PageFrame>
    );
  }

  /* THE PASSPORT'S FIRST RUN (north star 14.1, D11): once, after the sign-in
     check and before anything is read. Fails towards drawing the page. */
  await gateFirstRun("passport", "/settings/passport", await searchParams);

  const mine = await readMyPassport();
  if (!mine) {
    return (
      <PageFrame {...frame}>
        <p role="status" className={TYPE.body}>
          {copy.readFailed}
        </p>
      </PageFrame>
    );
  }

  return (
    <PageFrame {...frame} testId="passport-page">
      <p className={`${TYPE.body} text-[var(--nf-content-secondary)]`}>{copy.lede}</p>
      <PassportSettings
        facts={mine.facts}
        initial={mine.settings}
        copy={copy}
        roleCopy={t.socialProfile.roleLine}
        locale={locale}
      />
    </PageFrame>
  );
}
