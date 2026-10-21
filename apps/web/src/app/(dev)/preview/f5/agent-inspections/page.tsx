import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { Section, Stack, TYPE } from "@/components/app/Screen";
import { InspectionRows } from "@/components/app/inspections/InspectionRows";
import { AGENT_INSPECTIONS, AGENT_PROFILE } from "../ops-fixtures";

/**
 * The agent's inspections desk, from fixture requests: the three states a
 * lister answers, on the same frame the route draws.
 */
export const dynamic = "force-dynamic";

export default async function PreviewAgentInspections() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const open = AGENT_INSPECTIONS.filter((one) => one.state !== "COMPLETED");
  return (
    <AgentShell t={t} locale={locale} active="/agent/inspections" profile={AGENT_PROFILE}>
      <div className="nf-console">
        <h1 className="nf-h1">Inspections</h1>
        <p className={`mt-2xs ${TYPE.bodyLg}`}>
          Somebody wanting to see a property is the closest thing to a deal this platform has.
          Both of you see the same state on the same request.
        </p>
        <Stack className="mt-xl">
          <Section
            title="Waiting on somebody"
            description="These are the ones with a person on the other end of them."
          >
            <InspectionRows inspections={open} side="lister" locale={locale} viewingCopy={t.threads.rental} flowCopy={t.memberFlows.inspection} />
          </Section>
        </Stack>
      </div>
    </AgentShell>
  );
}
