"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { formatDate, type Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { SettingsGroup } from "@/components/app/account/rows";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import type { MyReports as MyReportsList } from "@/lib/reports/my-reports";
import { withdrawMyReport } from "@/lib/reports/withdraw-action";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * YOUR REPORTS. V-89, and A1-035 (the reporter could not see the outcome).
 *
 * Every report this person made, where it stands, and the one line a
 * moderator chose to send them. Anything still open or being reviewed can be
 * taken back, with the tap-again grammar the rest of settings uses, because
 * a report nobody can take back discourages people from reporting when they
 * are unsure. The status is words and a pill shape, never colour alone.
 */
const TONE: Record<string, StatusTone> = {
  open: "warning",
  reviewing: "info",
  resolved: "success",
  dismissed: "neutral",
  withdrawn: "neutral",
};

export function MyReports({ list, locale }: { list: MyReportsList; locale: Locale }) {
  const copy = useScopedCopy("myReports");
  const router = useRouter();
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();

  if (list.state === "signed-out") return null;

  const withdraw = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    send(id);
  };

  const send = (id: string) =>
    start(async () => {
      try {
        const result = await withdrawMyReport({ id });
        /* The outcome goes to the one banner (Grade 1). */
        if (result.state === "ok") {
          banner.success(copy.withdrawn);
          router.refresh();
        } else if (result.state === "closed") {
          banner.info(copy.withdrawClosed);
        } else {
          banner.error(copy.withdrawFailed, { retry: () => send(id) });
        }
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const note = list.state === "unreadable" ? copy.failed : list.rows.length === 0 ? copy.empty : copy.lede;

  return (
    <SettingsGroup label={copy.title} note={<span>{note}</span>}>
      {list.state === "ok" &&
        list.rows.map((report) => {
          const open = report.status === "open" || report.status === "reviewing";
          const target = (copy.target as Record<string, string>)[report.targetType] ?? copy.targetOther;
          const status = (copy.status as Record<string, string>)[report.status] ?? report.status;
          return (
            <div key={report.id} className="nf-srow" data-testid="my-report">
              <span className="nf-srow__body">
                <span className="nf-srow__label">{target}</span>
                <span className="nf-srow__sub">
                  {copy.reportedOn.replace(
                    "{date}",
                    formatDate(new Date(report.createdAt), locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }),
                  )}
                </span>
                {report.note && <span className="nf-srow__sub">{copy.note.replace("{note}", report.note)}</span>}
              </span>
              <span className="nf-srow__value flex flex-col items-end gap-3xs">
                <StatusPill tone={TONE[report.status] ?? "neutral"} size="xs">
                  {status}
                </StatusPill>
                {open && (
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={pending}
                    onClick={() => withdraw(report.id)}
                    data-testid="my-report-withdraw"
                  >
                    {armed === report.id ? copy.withdrawConfirm : copy.withdraw}
                  </Button>
                )}
              </span>
            </div>
          );
        })}
    </SettingsGroup>
  );
}
