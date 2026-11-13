import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { resolveSession } from "@/lib/actions/session";
import { getMyBusinessLadder, getMyBusinesses } from "@/lib/host/queries";
import { loadSettingsState } from "@/lib/profile/queries";
import { authHref, returnHref } from "@/components/auth/auth-intent";
import { EmptyState } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { HostShell } from "@/components/host/HostShell";
import { HostSettingsBody } from "./HostSettingsBody";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceHost.settingsPage.metaTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * /host/settings: the host workspace's own settings.
 *
 * What a host controls about the workspace, in the workspace: each business
 * and the screens that change it, what reaches them about bookings and
 * messages, and the assistant. What is one account wide (language, theme,
 * privacy, security, deletion) stays on the account's settings page and is
 * one tap away from here, never copied into a second place.
 *
 * The notification switches are the same preference document `/settings`
 * and `/agent/settings` write, in the host's words.
 */
export default async function HostSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const session = await resolveSession();

  if (session.state !== "signed-in") {
    const next = returnHref("/host/settings", "", "list");
    return (
      <HostShell fallback="/host">
        <EmptyState
          heading="h1"
          icon="hotel"
          title={t.hostWorkspace.settings.signedOutTitle}
          body={t.hostWorkspace.settings.signedOutBody}
          action={
            <ButtonLink href={authHref(next, "sign-in")} variant="primary" size="lg">
              {t.common.signIn}
            </ButtonLink>
          }
        />
      </HostShell>
    );
  }

  const [businesses, account] = await Promise.all([getMyBusinesses(), loadSettingsState()]);
  /* Each business's verification ladder, read back from the tier the database
     computed (north star 14.4: trust tiers as credentials). A failed read is
     null and that business simply draws no fan. */
  const ladders = await Promise.all(businesses.map((business) => getMyBusinessLadder(business.id)));

  return (
    /* The body's page frame carries the one way back; the bar keeps the
       host's destinations. */
    <HostShell fallback="/host" chromeBack={false} nav>
      <HostSettingsBody
        t={t}
        businesses={businesses}
        ladders={ladders}
        notifications={account.state === "signed-in" ? account.settings.notifications : null}
      />
    </HostShell>
  );
}
