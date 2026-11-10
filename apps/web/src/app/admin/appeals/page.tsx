import type { Metadata } from "next";

import { RESTRICTION_LABEL, caseNumber } from "@/lib/admin/cases/model";
import { readAppeals } from "@/lib/admin/cases/queries";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";

import { PageHead, PanelEmpty, TabRow } from "../_components/panels";
import { adminUi } from "../_components/ui";
import { DeskRefusal } from "../cases/DeskRefusal";
import { AppealDecision } from "./AppealDecision";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { appealsContext } from "@/lib/admin/copilot/contexts/appeals";

export const metadata: Metadata = { title: "Appeals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/appeals: members asking us to look again. Decided by Trust and
 * Safety only, and never by the person who made the original decision (the
 * database refuses it). Oldest first, so nobody waits longest unseen.
 */
export default async function AppealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" && ["open", "upheld", "overturned"].includes(params.status) ? params.status : "open";
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  const read = await readAppeals(status);
  if (read.state !== "ok" || read.data === null) return <DeskRefusal title="Appeals" state={read.state === "ok" ? "forbidden" : read.state} />;
  const rows = read.data;
  return (
    <div className="nf-console flex flex-col gap-xl" data-testid="admin-appeals">
      <PageHead title="Appeals" lede="Members asking us to look again at a restriction. Decided by someone other than the person who made it." />
      <TabRow
        label="Appeal status"
        items={[
          { key: "open", href: "/admin/appeals", label: "Waiting", active: status === "open" },
          { key: "overturned", href: "/admin/appeals?status=overturned", label: "Accepted", active: status === "overturned" },
          { key: "upheld", href: "/admin/appeals?status=upheld", label: "Upheld", active: status === "upheld" },
        ]}
      />
      {rows.length === 0 ? (
        <PanelEmpty title={status === "open" ? "No appeals waiting" : "None yet"} body="Appeals arrive from Settings, Account standing." />
      ) : (
        <ul className="flex flex-col gap-md">
          {rows.map((a) => (
            <li key={a.id} className="nf-panel nf-panel--card nf-admin-card flex flex-col gap-sm p-lg">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <span className="text-[length:var(--nf-text-body)] font-semibold">
                  {a.member.name}
                  {a.restriction ? ` · ${RESTRICTION_LABEL[a.restriction.kind]}` : ""}
                  {a.caseNumber ? ` · ${caseNumber(a.caseNumber)}` : ""}
                </span>
                <span className="nf-caption text-[var(--nf-content-muted)]">{ui.when(a.createdAt)}</span>
              </div>
              {a.restriction ? (
                <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
                  Decision: {a.restriction.reason} {a.restriction.createdBy ? `(by ${a.restriction.createdBy.name})` : ""}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-[length:var(--nf-text-body-sm)]">Their appeal: {a.body}</p>
              {a.status === "open" ? <AppealDecision appealId={a.id} /> : <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">{a.decisionNote}</p>}
            </li>
          ))}
        </ul>
      )}
      <DeskCopilot
        scope="trust_safety"
        deskName="Appeals"
        context={appealsContext(
          {
            statusLabel: status === "open" ? "waiting" : status === "overturned" ? "accepted" : "upheld",
            createdAt: rows.map((a) => a.createdAt),
          },
          requestTime(),
        )}
      />
    </div>
  );
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
