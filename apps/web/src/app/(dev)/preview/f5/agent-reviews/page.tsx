import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { ReviewsWorkspace } from "@/app/agent/reviews/ReviewsWorkspace";
import { AGENT_PROFILE, AGENT_REVIEWS, AGENT_REVIEWS_SUMMARY } from "../ops-fixtures";

/** The agent's reviews workspace, from fixture reviews. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentReviews() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/reviews" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agent.nav.reviews} subtitle="1 review is waiting on an answer." fallback="/agent/dashboard" width="wide">
      <ReviewsWorkspace
        reviews={AGENT_REVIEWS}
        summary={AGENT_REVIEWS_SUMMARY}
        filter="all"
        locale={locale}
      />
      </PageFrame>
    </AgentShell>
  );
}
