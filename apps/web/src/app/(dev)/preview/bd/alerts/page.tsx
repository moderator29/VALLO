import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { QueueFilters, QueuePager } from "@/app/admin/_components/QueueFilters";
import { adminUi } from "@/app/admin/_components/ui";
import { PageHead } from "@/app/admin/_components/panels";
import {
  AlertCard,
  alertStatusFilters,
  DriftCard,
  driftSectionCopy,
} from "@/app/admin/alerts/AlertCards";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { ConsoleFrame } from "../ConsoleFrame";
import { DRIFT_ALERTS, RISK_ALERTS } from "../fixtures";

/**
 * The alerts desk on the console frame (278CC66A at 390px), from fixture
 * rows: inventory drift first with both ids, then the general queue with
 * its resolved tail. The cards are the desk's own, so what is screenshotted
 * is what the desk draws.
 */
export const dynamic = "force-dynamic";

const BASE = "/preview/bd/alerts";

export default async function PreviewAlerts() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.alerts;
  const common = t.admin.common;
  const ui = adminUi(t, locale);
  const open = RISK_ALERTS.filter((alert) => alert.status === "open");
  const resolved = RISK_ALERTS.filter((alert) => alert.status !== "open");

  return (
    <ConsoleFrame t={t}>
      <PageHead title={copy.title} lede={copy.lede} trail={<ui.WaitingBadge count={open.length} />} />

      <ui.Section {...driftSectionCopy(DRIFT_ALERTS.length)}>
        <ul className="nf-queue-list">
          {DRIFT_ALERTS.map((alert) => (
            <DriftCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
          ))}
        </ul>
      </ui.Section>

      <h2 className="nf-admin-section-title mt-xl">All alerts</h2>
      <QueueFilters base={BASE} query={{}} common={common} statuses={alertStatusFilters(ui)} />

      <ul className="nf-queue-list">
        {open.map((alert) => (
          <AlertCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
        ))}
      </ul>

      <section className="mt-xl">
        <h2 className="nf-admin-section-title">{common.recentlyResolved}</h2>
        <ul className="nf-queue-list">
          {resolved.map((alert) => (
            <AlertCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
          ))}
        </ul>
      </section>

      <QueuePager
        base={BASE}
        query={{}}
        pageSize={QUEUE_PAGE_SIZE}
        full={false}
        count={RISK_ALERTS.length}
      />
    </ConsoleFrame>
  );
}
