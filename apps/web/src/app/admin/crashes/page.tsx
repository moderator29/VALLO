import type { Metadata } from "next";
import { formatDate, formatNumber, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { crashSourceFilter, crashStatusFrom, readCrashLog, type CrashRow } from "@/lib/admin/desk-reads/crash-log-read";
import type { CrashSource } from "@/lib/observability/crash-fingerprint";
import { adminUi } from "../_components/ui";
import { fill } from "../_components/copy";
import { Badge, PageHead, Panel, PanelEmpty, PanelUnavailable, TabRow } from "../_components/panels";
import { CrashActions } from "./CrashActions";
import { CRASH_COPY as c } from "./crash-copy";

export const metadata: Metadata = { title: "Crash log", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const SOURCE_ORDER: readonly CrashSource[] = ["ios", "android", "web", "server"];

/**
 * THE CRASH LOG (founder ruling of 7 November 2026: Vallo's own, in the admin
 * panel, no paid service). One row per distinct crash, newest first, with how
 * often it happened, where, on which platform, and the top of its stack.
 * Status and platform live in the URL, so a shared link opens the same view.
 */
export default async function CrashLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.adminCoverage.common;
  const ui = adminUi(t, locale);
  const params = await searchParams;
  const status = crashStatusFrom(params["status"]);
  const source = crashSourceFilter(params["source"]);
  const read = await readCrashLog({ status, source });

  if (read.state === "forbidden") {
    return (
      <div className="nf-admin-stack">
        <PageHead title={c.title} lede={common.noAccessBody} />
        <PanelEmpty title={common.noAccessTitle} body={common.noAccessBody} />
      </div>
    );
  }

  const href = (next: { status?: string; source?: string | null }) => {
    const query = new URLSearchParams();
    const s = next.status ?? status;
    if (s !== "open") query.set("status", s);
    const p = next.source === undefined ? source : next.source;
    if (p) query.set("source", p);
    const text = query.toString();
    return text ? `/admin/crashes?${text}` : "/admin/crashes";
  };
  const when = (iso: string) =>
    formatDate(new Date(iso), locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div className="nf-admin-stack" data-testid="crash-log">
      <PageHead title={c.title} lede={c.lede} />
      {read.state === "missing" ? (
        <Panel>
          <PanelEmpty title={c.missingTitle} body={c.missingBody} />
        </Panel>
      ) : read.state !== "ok" ? (
        <Panel>
          <PanelUnavailable what={c.title} locale={locale} />
        </Panel>
      ) : (
        <>
          <ui.StatRow>
            <ui.Stat label={c.statOpen} value={n(read.open)} tone={read.open > 0 ? "warning" : "neutral"} />
            <ui.Stat label={c.statDay} value={n(read.last24h)} />
            {SOURCE_ORDER.map((key) => (
              <ui.Stat key={key} label={c.source[key]} value={n(read.bySource[key])} />
            ))}
          </ui.StatRow>
          <TabRow
            label={c.filterLabel}
            items={(["open", "resolved", "ignored"] as const).map((key) => ({
              key,
              href: href({ status: key }),
              label: c.statusTabs[key],
              active: status === key,
              ...(key === "open" ? { count: read.open } : {}),
            }))}
          />
          <TabRow
            label={c.filterLabel}
            items={[
              { key: "all", href: href({ source: null }), label: c.sourceAll, active: source === null },
              ...SOURCE_ORDER.map((key) => ({ key, href: href({ source: key }), label: c.source[key], active: source === key })),
            ]}
          />
          {read.rows.length === 0 ? (
            <Panel>
              <PanelEmpty
                title={status === "open" ? c.emptyOpen : c.emptyOther}
                body={status === "open" ? c.emptyOpenBody : c.emptyOtherBody}
              />
            </Panel>
          ) : (
            <ul className="nf-crash-list">
              {read.rows.map((row) => (
                <CrashItem key={row.id} row={row} when={when} n={n} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CrashItem({ row, when, n }: { row: CrashRow; when: (iso: string) => string; n: (value: number) => string }) {
  return (
    <li className="nf-crash" data-testid="crash-row">
      <div className="nf-crash__head">
        <Badge tone={row.source === "server" ? "info" : "error"}>{c.source[row.source]}</Badge>
        <span className="nf-crash__count nf-numeric">
          {row.occurrences > 1 ? fill(c.times, { count: n(row.occurrences) }) : c.once}
        </span>
      </div>
      <p className="nf-crash__title">
        <span className="nf-crash__type">{row.type}</span> {row.message || row.kind}
      </p>
      <p className="nf-crash__meta">
        {[
          fill(c.last, { when: when(row.lastSeenAt) }),
          fill(c.first, { when: when(row.firstSeenAt) }),
          row.area ? fill(c.where, { area: row.area }) : null,
          row.release ? fill(c.release, { release: row.release }) : null,
          row.ref ? fill(c.ref, { ref: row.ref }) : null,
          row.kind,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {row.stackTop ? (
        <details className="nf-crash__stack">
          <summary>{c.stack}</summary>
          <pre>{row.stackTop}</pre>
        </details>
      ) : null}
      <CrashActions crashId={row.id} status={row.status} />
    </li>
  );
}
