import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { ListingsWorkspace } from "@/app/agent/listings/ListingsWorkspace";
import { AGENT_LISTINGS, AGENT_PROFILE } from "../ops-fixtures";

/** The agent's properties workspace, from fixture listings. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentListings() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/listings" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame
        title={t.agentListings.workspace.title}
        subtitle={t.agentListings.workspace.lede}
        fallback="/agent/dashboard"
        width="wide"
        actions={
          <ButtonLink href="/agent/list" variant="primary">
            {t.agentListings.workspace.start}
          </ButtonLink>
        }
      >
      <ListingsWorkspace
        t={t.agentListings}
        reference={t.listingReference}
        listings={AGENT_LISTINGS}
        locale={locale}
      />
      </PageFrame>
    </AgentShell>
  );
}
