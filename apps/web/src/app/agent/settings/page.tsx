import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { agentProfileFrom, getAgentContext } from "@/lib/agent/listings-queries";
import { getPayoutAccounts } from "@/lib/agent/payout-queries";
import { loadSettingsState } from "@/lib/profile/queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ListingPitch } from "../list/ListingPitch";
import { readMyAgentLookup } from "@/lib/doors/queries";
import { IconPlate } from "@/components/ui/IconPlate";
import { readMyAgentHours, readMyReplyTemplates } from "@/lib/agent/tools-read";
import { AgentSettingsBody } from "./AgentSettingsBody";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.agent.nav.settings, robots: { index: false, follow: false } };
}

/**
 * /agent/settings: what a host controls about their own account.
 *
 * This was an eleven-line coming-soon stub, and the one thing it should have
 * carried was already half built elsewhere: the notification switches on
 * /settings wrote to profiles.settings and nothing read them. Now that
 * private.notify and the email recipient resolver both honour that document,
 * the switches genuinely govern what reaches a host, so they belong where a
 * host works as well as where a guest does. There is one preference document
 * per account; this is a second door to it, not a second copy.
 *
 * The trading identity is deliberately read-only. It is the name Vallo
 * verified, it appears on every listing and every thread, and letting an
 * approved host rewrite it after approval would make the verified badge mean
 * nothing. The page says that plainly and gives the route to change it.
 */
export default async function Page() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const context = await getAgentContext();

  if (context.state === "signed-out" || context.state === "not-agent") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/settings" profile={null}>
        <ListingPitch copy={t.agentListings.pitch} signedIn={context.state === "not-agent"} />
      </AgentShell>
    );
  }

  if (context.state === "unconfigured") {
    return (
      <AgentShell t={t} locale={locale} active="/agent/settings" profile={null}>
        <div className="mx-auto max-w-md py-10 text-center">
          <IconPlate size="lg">
            <UiIcon name="settings-gear" size={24} />
          </IconPlate>
          <h1 className="nf-h2 mt-5">{t.agent.nav.settings}</h1>
          <p className="mx-auto mt-sm max-w-[42ch] text-[var(--nf-content-secondary)]">
            We cannot reach your preferences right now.
          </p>
          <Link href="/agent/dashboard" className="nf-btn nf-btn--glass mt-lg">
            {t.agent.nav.dashboard}
          </Link>
        </div>
      </AgentShell>
    );
  }

  const [account, payout, lookup, templates, hours] = await Promise.all([
    loadSettingsState(),
    getPayoutAccounts(),
    readMyAgentLookup(),
    readMyReplyTemplates(),
    readMyAgentHours(),
  ]);
  const agent = context.agent;
  const accounts = payout.state === "ready" ? payout.accounts : [];

  return (
    <AgentShell t={t} locale={locale} active="/agent/settings" profile={agentProfileFrom(agent)}>
      <AgentSettingsBody
        t={t}
        agent={agentProfileFrom(agent)}
        accounts={accounts}
        notifications={account.state === "signed-in" ? account.settings.notifications : null}
        lookup={lookup}
        templates={templates}
        hours={hours}
      />
    </AgentShell>
  );
}
