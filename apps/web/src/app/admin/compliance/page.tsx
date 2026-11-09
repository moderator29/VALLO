import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { fill } from "../_components/copy";
import { QueueTabs } from "../_components/QueueTable";
import type { ComplianceLane } from "./_lanes/lane";
import { StrLane } from "./_lanes/StrLane";
import { ThresholdLane } from "./_lanes/ThresholdLane";
import { sanctionsLane } from "./_lanes/SanctionsLane";
import { riskLane } from "./_lanes/RiskLane";
import { pepLane } from "./_lanes/PepLane";
import { beneficialOwnershipLane } from "./_lanes/BeneficialOwnershipLane";

export const dynamic = "force-dynamic";

/**
 * /admin/compliance: THE AML/CFT DESK. SCUML-EFCC checklist for DNFBPs,
 * Money Laundering (Prevention and Prohibition) Act 2022.
 *
 * Staff only: it sits under the console layout, which runs `requireAdmin`
 * before anything is read. Nothing on this desk is ever shown to a member.
 *
 * THE LANE TABLE. One line per obligation, a plain array so that builders
 * adding lanes in parallel merge as a union. Add your lane file under
 * `_lanes/` and ONE line here; keep the order by checklist item.
 */
const LANES: ComplianceLane[] = [
  StrLane, // SCUML item 6
  ThresholdLane, // SCUML item 7
  sanctionsLane, // SCUML items 8 and 9
  riskLane, // SCUML item 15
  beneficialOwnershipLane, // SCUML item 17
  pepLane, // SCUML item 20
];

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const c = t.compliance.desk;
  const ui = adminUi(t, locale);
  const params = await searchParams;
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const lane = LANES.find((entry) => entry.key === raw) ?? LANES[0];

  return (
    <div className="nf-console">
      <PageHead title={c.title} lede={c.lede} />
      {lane ? (
        <>
          <QueueTabs
            label={c.tabsLabel}
            tabs={LANES.map((entry) => ({
              key: entry.key,
              label: entry.title(t),
              href: `/admin/compliance?tab=${entry.key}`,
              on: entry.key === lane.key,
            }))}
          />
          <p className="nf-caption mt-inline">{fill(c.item, { item: lane.items.join(", ") })}</p>
          <section className="mt-group">
            <lane.Lane t={t} locale={locale} params={params} />
          </section>
        </>
      ) : (
        <ui.QueueEmpty title={c.noLanes} body={c.lede} everHadRows={false} />
      )}
    </div>
  );
}
