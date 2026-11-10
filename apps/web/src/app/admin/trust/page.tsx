import type { Metadata } from "next";
import Link from "next/link";

import { CATEGORY_LABEL, MODULE_LABEL, type CaseCategory, type CaseModule } from "@/lib/admin/cases/model";
import { readTrustOverview } from "@/lib/admin/cases/queries";

import { KpiGrid, KpiStrip, PageHead, Panel, TabRow, type KpiItem } from "../_components/panels";
import { DeskRefusal } from "../cases/DeskRefusal";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { trustContext } from "@/lib/admin/copilot/contexts/trust";

export const metadata: Metadata = { title: "Trust overview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

/**
 * /admin/trust: WHAT NEEDS THE TEAM NOW, and whether moderation is keeping up.
 * Every figure answers a decision: the strip is the work waiting (open,
 * overdue, escalated, unassigned); the throughput says whether the team keeps
 * pace; the module and category lists say where trouble is coming from; the
 * Roommates and Circle figures say where activity is growing. Each tile opens
 * the list behind it. Read-only analysts see this page and nothing else.
 */
export default async function TrustPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const days = RANGES.find((d) => String(d) === params.days) ?? 30;
  const read = await readTrustOverview(days);
  if (read.state !== "ok") return <DeskRefusal title="Trust overview" state={read.state} />;
  const o = read.data;
  const n = (v: number | null | undefined) => (v === null || v === undefined ? null : v.toLocaleString("en-NG"));

  const strip: KpiItem[] = [
    { key: "open", label: "Open cases", value: n(o.cases.open), count: o.cases.open, href: "/admin/cases" },
    { key: "overdue", label: "Overdue", value: n(o.cases.overdue), count: o.cases.overdue, href: "/admin/cases?overdue=1", caption: "Past their deadline" },
    { key: "escalated", label: "Escalated", value: n(o.cases.escalated), count: o.cases.escalated, href: "/admin/cases?status=escalated" },
    { key: "unassigned", label: "Not assigned", value: n(o.cases.unassigned), count: o.cases.unassigned, href: "/admin/cases?assigned=none" },
  ];
  const pace: KpiItem[] = [
    { key: "opened", label: `Cases opened, ${days} days`, value: n(o.cases.openedInPeriod), count: o.cases.openedInPeriod },
    { key: "resolved", label: `Cases resolved, ${days} days`, value: n(o.cases.resolvedInPeriod), count: o.cases.resolvedInPeriod },
    {
      key: "median",
      label: "Median time to resolve",
      value: o.cases.medianHoursToResolve === null ? null : `${o.cases.medianHoursToResolve} h`,
      missingWord: "No cases resolved",
    },
    { key: "critical", label: "Critical, open", value: n(o.cases.critical), count: o.cases.critical, href: "/admin/cases?severity=critical" },
    { key: "restrictions", label: "Members restricted now", value: n(o.restrictions.active), count: o.restrictions.active },
    { key: "appeals", label: "Appeals waiting", value: n(o.restrictions.appealsOpen), count: o.restrictions.appealsOpen, href: "/admin/appeals" },
  ];
  const rm = o.roommates;
  const roommates: KpiItem[] = [
    { key: "rm-active", label: "Live roommate profiles", value: n(rm.profiles.active), count: rm.profiles.active, href: "/admin/roommates" },
    { key: "rm-new", label: `New profiles, ${days} days`, value: n(rm.profiles.newInPeriod), count: rm.profiles.newInPeriod },
    {
      key: "rm-accept",
      label: `Interests accepted, ${days} days`,
      value: rm.interests.sent ? `${rm.interests.accepted} of ${rm.interests.sent}` : null,
      missingWord: "No interests yet",
    },
    { key: "rm-live", label: "Live room posts", value: n(rm.listings.live), count: rm.listings.live },
    { key: "rm-unverified", label: "Live rooms not checked", value: n(rm.listings.unverifiedLive), count: rm.listings.unverifiedLive, href: "/admin/roommates?tab=posts&unverified=1" },
    { key: "rm-verify", label: "Verifications waiting", value: n(rm.verificationsWaiting), count: rm.verificationsWaiting, href: "/admin/roommates?tab=verification" },
    { key: "rm-groups", label: "Active groups", value: n(rm.groups.active), count: rm.groups.active },
    { key: "rm-held", label: "Profiles held", value: n(rm.profiles.held), count: rm.profiles.held },
  ];
  const circle: KpiItem[] = [
    { key: "c-live", label: "Live communities", value: n(o.circle.communities.live), count: o.circle.communities.live, href: "/admin/circle" },
    { key: "c-posts", label: `Circle posts, ${days} days`, value: n(o.circle.posts.inPeriod), count: o.circle.posts.inPeriod },
    { key: "c-held", label: "Circle posts held", value: n(o.circle.posts.held), count: o.circle.posts.held, href: "/admin/queue" },
    { key: "c-paused", label: "Communities paused", value: n(o.circle.communities.paused), count: o.circle.communities.paused },
  ];
  const modules = Object.entries(o.cases.byModule).sort((a, b) => b[1] - a[1]);
  const categories = Object.entries(o.cases.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const recent = o.cases.daily.slice(-14);
  const peak = Math.max(1, ...recent.map((d) => Math.max(d.opened, d.resolved)));

  return (
    <div className="nf-console flex flex-col gap-xl" data-testid="admin-trust">
      <PageHead title="Trust overview" lede="What needs the team now, and whether moderation is keeping pace." />
      <TabRow label="Period" items={RANGES.map((d) => ({ key: String(d), href: `/admin/trust?days=${d}`, label: `${d} days`, active: d === days }))} />
      <KpiStrip items={strip} label="Work waiting" />
      <KpiGrid items={pace} label="Pace" />

      <div className="grid gap-lg lg:grid-cols-2">
        <Panel title="Open cases by module">
          {modules.length === 0 ? (
            <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">No open cases.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {modules.map(([m, count]) => (
                <li key={m} className="flex items-center justify-between text-[length:var(--nf-text-body-sm)]">
                  <Link className="nf-link" href={`/admin/cases?module=${m}`}>
                    {MODULE_LABEL[m as CaseModule] ?? m}
                  </Link>
                  <span className="nf-numeric font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`What people report, ${days} days`}>
          {categories.length === 0 ? (
            <p className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">No reports in this period.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {categories.map(([cat, count]) => (
                <li key={cat} className="flex items-center justify-between text-[length:var(--nf-text-body-sm)]">
                  <span>{CATEGORY_LABEL[cat as CaseCategory] ?? cat}</span>
                  <span className="nf-numeric font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Opened and resolved, last 14 days">
        <ul className="flex flex-col gap-2xs" aria-label="Cases opened and resolved per day">
          {recent.map((d) => (
            <li key={d.day} className="grid grid-cols-[6rem_1fr_3rem_3rem] items-center gap-sm text-[length:var(--nf-text-caption)]">
              <span className="nf-numeric text-[var(--nf-content-muted)]">{d.day.slice(5)}</span>
              <span className="flex h-[0.5rem] overflow-hidden rounded-xs bg-[var(--nf-surface-inset)]" aria-hidden="true">
                <span className="bg-[var(--nf-brand-primary)]" style={{ width: `${(d.opened / peak) * 100}%` }} />
              </span>
              <span className="nf-numeric">{d.opened} in</span>
              <span className="nf-numeric">{d.resolved} out</span>
            </li>
          ))}
        </ul>
      </Panel>

      <KpiGrid items={roommates} label="Vallo Roommates" />
      <KpiGrid items={circle} label="Vallo Circle" />
      <DeskCopilot
        scope="analyst"
        deskName="Trust overview"
        context={trustContext({
          days,
          open: o.cases.open,
          overdue: o.cases.overdue,
          escalated: o.cases.escalated,
          unassigned: o.cases.unassigned,
          critical: o.cases.critical,
          openedInPeriod: o.cases.openedInPeriod,
          resolvedInPeriod: o.cases.resolvedInPeriod,
          medianHoursToResolve: o.cases.medianHoursToResolve,
          restrictedNow: o.restrictions.active,
          appealsOpen: o.restrictions.appealsOpen,
        })}
      />
    </div>
  );
}
