import type { Metadata } from "next";
import { countOf } from "@vallo/i18n/core";

import { CopyButton } from "@/components/docs/CopyButton";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { marketingContext } from "@/lib/admin/copilot/contexts/marketing";
import { deskDoor } from "@/lib/admin/desk-door";
import { nairaFromKobo } from "@/lib/admin/desk-rules";
import {
  APPROVAL_LABEL,
  CAMPAIGN_STATUS_LABEL,
  CHANNEL_LABEL,
  METRIC_LABEL,
  METRICS,
  boardColumn,
  budgetLines,
  buildUtmLink,
  metricTotals,
  spendKobo,
  summarise,
  type Campaign,
  type CampaignResult,
} from "@/lib/admin/marketing/model";
import { buildMonthlyReport, campaignCalendar, channelClashes, currentMonth, type CalendarRow } from "@/lib/admin/marketing/extras";
import { readAcquisition, readCampaigns, readReferralPerformance, readResults, type Acquisition, type ReferralPerformance } from "@/lib/admin/marketing/queries";
import { readEntries, readNames } from "@/lib/admin/desk-entries/queries";
import { countEntries, entryRef } from "@/lib/admin/desk-entries/model";
import { EntryTool } from "../_components/EntryTool";
import { ReportBuilder } from "./ReportBuilder";

import { DeskLink, DeskRefused, DeskTable, Fact, Source, shortDate } from "../_components/desk-parts";
import { Badge, CalmNote, KpiGrid, NotWired, PageHead, Panel, type BadgeTone, type KpiItem } from "../_components/panels";
import { ApproverActions, CampaignForm, MakerActions, ResultForm, UtmBuilder, VoidResult } from "./MarketingControls";

export const metadata: Metadata = { title: "Marketing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["campaigns", "Campaigns"],
  ["calendar", "Calendar"],
  ["links", "Tracked links"],
  ["results", "Results"],
  ["acquisition", "Acquisition"],
  ["referrals", "Referrals"],
  ["briefs", "Briefs and tests"],
  ["audience", "Audience and market"],
  ["report", "Monthly report"],
] as const;
type Tab = (typeof TABS)[number][0];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const STATUS_TONE: Record<Campaign["status"], BadgeTone> = { draft: "info", planned: "info", live: "success", paused: "pending", ended: "info", cancelled: "error" };
const APPROVAL_TONE: Record<Campaign["approval"], BadgeTone> = { none: "info", submitted: "pending", approved: "success", sent_back: "error" };

/**
 * THE MARKETING MANAGER'S DESK (founder, 10 November 2026). Campaigns and
 * their approvals, tracked links, the numbers the manager logs, and the
 * acquisition figures the console already holds. A planning and reporting
 * tool: no ad platform, no email tool and no credential is connected, and
 * a figure that is not recorded says so instead of showing zero.
 */
export default async function MarketingPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await deskDoor("marketing", { approverMayEnter: true });
  if (door.state !== "ok") return <DeskRefused title="Marketing" state={door.state} who="This desk is for the Marketing Manager." />;

  const params = await searchParams;
  const asked = one(params.tab);
  const tab: Tab = door.viaApprover ? "campaigns" : ((TABS.find(([k]) => k === asked)?.[0] ?? "campaigns") as Tab);

  const month = one(params.month) && /^\d{4}-\d{2}$/.test(one(params.month) ?? "") ? (one(params.month) as string) : currentMonth();
  const [campaignsRead, resultsRead, acquisition, entriesRead, referrals] = await Promise.all([
    readCampaigns(door.db),
    readResults(door.db),
    tab === "acquisition" || tab === "report" ? readAcquisition(door.db) : Promise.resolve(null),
    readEntries(door.db, "marketing"),
    tab === "referrals" ? readReferralPerformance(door.db) : Promise.resolve(null),
  ]);
  const entries = entriesRead.state === "ok" ? entriesRead.data : [];
  const names = Object.fromEntries(await readNames(door.db, entries.flatMap((e) => [e.approvedBy, e.createdBy])));
  const entryCounts = countEntries(entries);
  const notOpen = campaignsRead.state === "not-open";
  const campaigns = campaignsRead.state === "ok" ? campaignsRead.data : [];
  const results = resultsRead.state === "ok" ? resultsRead.data : [];
  const readable = campaignsRead.state === "ok";
  const summary = summarise(campaigns, results);
  const context = readable
    ? marketingContext({
        live: summary.byStatus.live + summary.byStatus.paused,
        planned: summary.byStatus.planned + summary.byStatus.draft,
        waitingApproval: summary.waitingApproval + entryCounts.waitingApproval,
        sentBack: summary.sentBack,
        endingWithinSevenDays: summary.endingWithinSevenDays,
        overBudget: summary.overBudget,
        resultsThisWeek: summary.resultsThisWeek,
      })
    : null;

  return (
    <div className="nf-console nf-admin-stack">
      <PageHead
        title="Marketing"
        lede="Campaigns and promotions, their approvals and budgets, tracked links, and the numbers each campaign brings in. Nothing here connects to an ad platform: you log what the platform's own dashboard shows."
        action={
          <DeskLink href="/admin/social-media">Social media desk</DeskLink>
        }
      />
      {notOpen ? (
        <Panel>
          <NotWired what="The marketing tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." />
        </Panel>
      ) : campaignsRead.state === "error" ? (
        <Panel>
          <CalmNote kind="error" title="The campaigns could not be read" fills="Nothing was changed. Refresh in a moment." />
        </Panel>
      ) : null}
      {entriesRead.state === "not-open" && !notOpen ? (
        <Panel><NotWired what="The notes, briefs and reports tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." /></Panel>
      ) : null}
      {door.viaApprover ? (
        <Panel>
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">You are here to approve. You can read every campaign and approve or send one back; the Marketing Manager makes the changes.</p>
        </Panel>
      ) : (
        <UnderlineTabs label="Marketing desk" active={tab} items={TABS.map(([key, label]) => ({ key, label, href: key === "campaigns" ? "/admin/marketing" : `/admin/marketing?tab=${key}` }))} />
      )}
      {tab === "campaigns" ? <Campaigns campaigns={campaigns} results={results} readable={readable} canApprove={door.canApprove} viaApprover={door.viaApprover} summary={summary} /> : null}
      {tab === "links" ? <Links campaigns={campaigns} /> : null}
      {tab === "results" ? <Results campaigns={campaigns} results={results} readable={readable} /> : null}
      {tab === "calendar" ? <CalendarPanel campaigns={campaigns} month={month} /> : null}
      {tab === "acquisition" && acquisition ? <AcquisitionPanel data={acquisition} /> : null}
      {tab === "referrals" ? <ReferralsPanel data={referrals} /> : null}
      {tab === "briefs" ? (
        <div className="grid gap-lg">
          <Panel title="Creative briefs"><EntryTool kind="creative_brief" entries={entries} canMake={!door.viaApprover} canApprove={false} names={names} readable={entriesRead.state === "ok"} /></Panel>
          <Panel title="A/B test log"><EntryTool kind="ab_test" entries={entries} canMake={!door.viaApprover} canApprove={false} names={names} readable={entriesRead.state === "ok"} /></Panel>
        </div>
      ) : null}
      {tab === "audience" ? (
        <div className="grid gap-lg">
          <Panel title="Audience segments"><EntryTool kind="segment_note" entries={entries} canMake={!door.viaApprover} canApprove={false} names={names} readable={entriesRead.state === "ok"} /></Panel>
          <Panel title="Market notes"><EntryTool kind="market_note" entries={entries} canMake={!door.viaApprover} canApprove={false} names={names} readable={entriesRead.state === "ok"} /></Panel>
        </div>
      ) : null}
      {tab === "report" ? (
        <div className="grid gap-lg">
          <Panel title="Report builder">
            <ReportBuilder month={month} draft={buildMonthlyReport({ month, campaigns, results, signups: acquisition?.signups ? acquisition.signups.reduce((t, n, i) => (acquisition.weeks[i]!.startsWith(month) ? t + n : t), 0) : null })} />
          </Panel>
          <Panel title="Monthly reports"><EntryTool kind="monthly_report" entries={entries} canMake={!door.viaApprover} canApprove={door.canApprove} names={names} readable={entriesRead.state === "ok"} /></Panel>
        </div>
      ) : null}
      <DeskCopilot scope="marketing" deskName="Marketing" context={context} />
    </div>
  );
}

function CampaignCard({ campaign, results, canApprove, viaApprover }: { campaign: Campaign; results: readonly CampaignResult[]; canApprove: boolean; viaApprover: boolean }) {
  const spent = spendKobo(results, campaign.id);
  const link =
    campaign.utmBase && campaign.utmSource && campaign.utmMedium && campaign.utmCampaign
      ? buildUtmLink({ base: campaign.utmBase, source: campaign.utmSource, medium: campaign.utmMedium, campaign: campaign.utmCampaign, content: campaign.utmContent ?? "", term: campaign.utmTerm ?? "" })
      : null;
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="marketing-campaign-card">
      <div className="flex flex-wrap items-center gap-xs">
        <span className="font-semibold text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">{campaign.name}</span>
        <Badge tone={STATUS_TONE[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
        <Badge tone={APPROVAL_TONE[campaign.approval]}>{APPROVAL_LABEL[campaign.approval]}</Badge>
      </div>
      <p className="nf-caption mt-3xs text-[var(--nf-content-secondary)]">
        {CHANNEL_LABEL[campaign.channel]} · {shortDate(campaign.startsOn)} to {shortDate(campaign.endsOn)} · {entryRef("campaign", campaign.id)} <CopyButton text={entryRef("campaign", campaign.id)} label="Reference" />
      </p>
      {campaign.objective ? <p className="nf-body-sm mt-xs whitespace-pre-wrap">{campaign.objective}</p> : null}
      <dl className="mt-sm grid gap-sm sm:grid-cols-2">
        {campaign.audience ? <Fact label="Audience">{campaign.audience}</Fact> : null}
        {campaign.budgetKobo !== null ? (
          <Fact label="Budget and logged spend">
            {nairaFromKobo(campaign.budgetKobo)} budget · {nairaFromKobo(spent)} logged
            {spent > campaign.budgetKobo ? " (over budget)" : ` · ${nairaFromKobo(campaign.budgetKobo - spent)} left`}
          </Fact>
        ) : null}
        {link?.ok ? <Fact label="Tracked link"><span className="[overflow-wrap:anywhere]">{link.url}</span> <CopyButton text={link.url} label="Tracked link" icon="link" /></Fact> : null}
      </dl>
      {campaign.approval === "sent_back" && campaign.approvalNote ? (
        <p className="nf-caption mt-xs" role="note">Sent back: {campaign.approvalNote}</p>
      ) : null}
      {campaign.approval === "approved" && campaign.approvedAt ? (
        <p className="nf-caption mt-xs text-[var(--nf-content-secondary)]">Approved on {shortDate(campaign.approvedAt)}</p>
      ) : null}
      <div className="mt-sm grid gap-sm">
        {canApprove && campaign.approval === "submitted" ? <ApproverActions campaign={campaign} /> : null}
        {!viaApprover ? <MakerActions campaign={campaign} /> : null}
      </div>
    </li>
  );
}

function Campaigns({ campaigns, results, readable, canApprove, viaApprover, summary }: { campaigns: Campaign[]; results: CampaignResult[]; readable: boolean; canApprove: boolean; viaApprover: boolean; summary: ReturnType<typeof summarise> }) {
  const kpis: KpiItem[] = [
    { key: "live", label: "Live now", value: readable ? String(summary.byStatus.live + summary.byStatus.paused) : null, ...(readable ? { count: summary.byStatus.live + summary.byStatus.paused } : {}), caption: readable ? `${countOf(summary.endingWithinSevenDays, "campaigns")} ending within a week` : undefined },
    { key: "planned", label: "Planned or draft", value: readable ? String(summary.byStatus.planned + summary.byStatus.draft) : null, ...(readable ? { count: summary.byStatus.planned + summary.byStatus.draft } : {}) },
    { key: "waiting", label: "Waiting for approval", value: readable ? String(summary.waitingApproval) : null, ...(readable ? { count: summary.waitingApproval } : {}), caption: readable && summary.sentBack > 0 ? `${summary.sentBack} sent back` : undefined },
    { key: "budget", label: "Over budget", value: readable ? String(summary.overBudget) : null, ...(readable ? { count: summary.overBudget } : {}), caption: "Logged spend against the approved budget" },
  ];
  const waiting = campaigns.filter((c) => c.approval === "submitted" && c.status !== "cancelled");
  const columns = [
    ["planned", "Planned and drafts"],
    ["live", "Live and paused"],
    ["ended", "Ended"],
  ] as const;
  return (
    <div className="grid gap-lg">
      <KpiGrid items={kpis} label="Campaign figures" />
      {canApprove && waiting.length > 0 ? (
        <Panel title="Waiting for approval">
          <ul className="grid gap-sm">
            {waiting.map((c) => (
              <CampaignCard key={c.id} campaign={c} results={results} canApprove={canApprove} viaApprover={viaApprover} />
            ))}
          </ul>
        </Panel>
      ) : null}
      {campaigns.length === 0 && readable ? (
        <Panel>
          <CalmNote title="No campaigns yet" fills="Every campaign is planned, approved and tracked here." creates={viaApprover ? undefined : "Create the first one below."} />
        </Panel>
      ) : (
        <div className="grid gap-md lg:grid-cols-3">
          {columns.map(([key, title]) => {
            const items = campaigns.filter((c) => boardColumn(c) === key && !(canApprove && c.approval === "submitted" && c.status !== "cancelled"));
            return (
              <Panel key={key} title={`${title} (${items.length})`}>
                {items.length === 0 ? (
                  <p className="nf-body-sm text-[var(--nf-content-secondary)]">Nothing here.</p>
                ) : (
                  <ul className="grid gap-sm">
                    {items.map((c) => (
                      <CampaignCard key={c.id} campaign={c} results={results} canApprove={canApprove} viaApprover={viaApprover} />
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>
      )}
      {campaigns.some((c) => c.status === "cancelled") ? (
        <Panel title="Cancelled">
          <ul className="grid gap-sm">
            {campaigns.filter((c) => c.status === "cancelled").map((c) => (
              <li key={c.id} className="nf-body-sm">
                {c.name} <Badge tone="error">Cancelled</Badge>
              </li>
            ))}
          </ul>
          <Source>A cancelled campaign can be put back as a draft from the banner right after cancelling it.</Source>
        </Panel>
      ) : null}
      {!viaApprover ? (
        <Panel title="New campaign">
          <CampaignForm />
        </Panel>
      ) : null}
    </div>
  );
}

function Links({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <Panel title="Tracked link builder">
      <UtmBuilder campaigns={campaigns} />
      <Source>The tags are lower case with dashes, so the same campaign always reads the same way in the analytics. Saved tags appear on the campaign card.</Source>
    </Panel>
  );
}

function Results({ campaigns, results, readable }: { campaigns: Campaign[]; results: CampaignResult[]; readable: boolean }) {
  const lines = budgetLines(campaigns, results);
  const live = results.filter((r) => !r.voidedAt);
  const named = new Map(campaigns.map((c) => [c.id, c.name]));
  const rows = campaigns.filter((c) => c.status !== "cancelled" && live.some((r) => r.campaignId === c.id));
  return (
    <div className="grid gap-lg">
      <Panel title="Log a number">
        <ResultForm campaigns={campaigns} />
      </Panel>
      <Panel title="Totals by campaign" flush>
        {!readable || rows.length === 0 ? (
          <div className="p-md">
            <CalmNote title="Nothing logged yet" fills="Totals appear here once you log a number against a campaign." />
          </div>
        ) : (
          <DeskTable
            caption="Logged totals by campaign"
            columns={[
              { key: "campaign", label: "Campaign" },
              { key: "spend", label: "Spend", numeric: true },
              { key: "budget", label: "Budget", numeric: true },
              { key: "clicks", label: "Clicks", numeric: true },
              { key: "signups", label: "Sign-ups", numeric: true },
              { key: "cost", label: "Spend per logged sign-up", numeric: true },
            ]}
            rows={rows.map((c) => {
              const t = metricTotals(results, c.id);
              const line = lines.find((l) => l.campaignId === c.id);
              const spend = t.spend_kobo ?? 0;
              const signups = t.signups ?? 0;
              return {
                key: c.id,
                cells: {
                  campaign: c.name,
                  spend: t.spend_kobo === undefined ? "Not logged" : nairaFromKobo(spend),
                  budget: line ? nairaFromKobo(line.budgetKobo) : "None set",
                  clicks: t.clicks === undefined ? "Not logged" : t.clicks.toLocaleString("en-NG"),
                  signups: t.signups === undefined ? "Not logged" : signups.toLocaleString("en-NG"),
                  cost: signups > 0 && spend > 0 ? nairaFromKobo(Math.round(spend / signups)) : "Not available",
                },
              };
            })}
          />
        )}
      </Panel>
      <Panel title="Recent entries" flush>
        {live.length === 0 ? (
          <div className="p-md">
            <p className="nf-body-sm text-[var(--nf-content-secondary)]">No entries yet.</p>
          </div>
        ) : (
          <DeskTable
            caption="Recent logged numbers"
            columns={[
              { key: "date", label: "Date" },
              { key: "campaign", label: "Campaign" },
              { key: "metric", label: "What" },
              { key: "value", label: "Value", numeric: true },
              { key: "note", label: "Source" },
              { key: "remove", label: "" },
            ]}
            rows={live.slice(0, 30).map((r) => ({
              key: r.id,
              cells: {
                date: shortDate(r.recordedOn),
                campaign: named.get(r.campaignId) ?? "Removed campaign",
                metric: METRIC_LABEL[r.metric],
                value: r.metric === "spend_kobo" ? nairaFromKobo(r.value) : r.value.toLocaleString("en-NG"),
                note: r.note || "No source written",
                remove: <VoidResult id={r.id} />,
              },
            }))}
          />
        )}
      </Panel>
      <Source>Numbers are what you logged from each platform&apos;s own dashboard; the console does not fetch them. Metrics: {METRICS.map((m) => METRIC_LABEL[m]).join(", ")}.</Source>
    </div>
  );
}

function AcquisitionPanel({ data }: { data: Acquisition }) {
  const series: [string, number[] | null, string][] = [
    ["Sign-ups", data.signups, "New accounts, internal and test accounts left out."],
    ["Listings created", data.listingsCreated, "Listings submitted by a lister, example listings left out."],
    ["Referrals", data.referrals, "Referrals attributed to an invite code."],
  ];
  return (
    <div className="grid gap-lg">
      <Panel title="Acquisition, by week" flush>
        <DeskTable
          caption="Weekly acquisition figures, Monday start, Lagos time"
          columns={[{ key: "week", label: "Week starting" }, ...series.map(([label]) => ({ key: label, label, numeric: true }))]}
          rows={data.weeks.map((week, i) => ({
            key: week,
            cells: {
              week: shortDate(week),
              ...Object.fromEntries(series.map(([label, values]) => [label, values === null ? "Not available" : String(values[i] ?? 0)])),
            },
          }))}
        />
      </Panel>
      <Panel title="Where these come from">
        <ul className="grid gap-3xs nf-body-sm">
          {series.map(([label, values, note]) => (
            <li key={label}>
              <strong>{label}.</strong> {values === null ? "Could not be read just now, so no figure is shown." : note}
            </li>
          ))}
        </ul>
        <Source>Counts only, weeks start on Monday in Lagos time. These are the platform&apos;s own records, not an ad platform&apos;s numbers, and they say nothing about which campaign brought a person in: use the tracked links and your logged results for that.</Source>
      </Panel>
    </div>
  );
}

function CalendarPanel({ campaigns, month }: { campaigns: Campaign[]; month: string }) {
  const rows: CalendarRow[] = campaignCalendar(campaigns, month);
  const clashes = channelClashes(campaigns);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const shift = (by: number) => {
    const i = y * 12 + (m - 1) + by;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  };
  return (
    <div className="grid gap-lg">
      <Panel title={`Campaign calendar, ${month}`}>
        <div className="mb-sm flex gap-xs">
          <DeskLink href={`/admin/marketing?tab=calendar&month=${shift(-1)}`}>Earlier month</DeskLink>
          <DeskLink href={`/admin/marketing?tab=calendar&month=${shift(1)}`}>Later month</DeskLink>
        </div>
        <ul className="grid gap-sm">
          {rows.map((row) => (
            <li key={row.start} className="nf-admin-card p-md">
              <p className="nf-caption text-[var(--nf-content-secondary)]">Week {row.label}</p>
              {row.campaigns.length === 0 ? (
                <p className="nf-body-sm">Nothing planned.</p>
              ) : (
                <ul className="nf-body-sm grid gap-3xs">
                  {row.campaigns.map((c) => (
                    <li key={c.id} className="[overflow-wrap:anywhere]">
                      {c.name} · {CHANNEL_LABEL[c.channel]} · {CAMPAIGN_STATUS_LABEL[c.status]} · {shortDate(c.startsOn)} to {shortDate(c.endsOn)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {clashes.length > 0 ? (
        <Panel title="Two campaigns on one channel at once">
          <ul className="nf-body-sm grid gap-3xs">
            {clashes.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`}>{a.name} and {b.name} both use {CHANNEL_LABEL[a.channel]} on overlapping dates.</li>
            ))}
          </ul>
          <Source>Not always a mistake. Check the audiences do not overlap.</Source>
        </Panel>
      ) : null}
    </div>
  );
}

function ReferralsPanel({ data }: { data: ReferralPerformance | null }) {
  if (!data) {
    return (
      <Panel>
        <CalmNote kind="error" title="Referral figures could not be read" fills="Nothing is shown rather than a zero. Refresh in a moment." />
      </Panel>
    );
  }
  return (
    <div className="grid gap-lg">
      <Panel title="Invited people, by week" flush>
        <DeskTable
          caption="People who signed up with a referral code, Monday start, Lagos time"
          columns={[{ key: "week", label: "Week starting" }, { key: "n", label: "Signed up with a code", numeric: true }]}
          rows={data.weeks.map((week, i) => ({ key: week, cells: { week: shortDate(week), n: String(data.attributed[i] ?? 0) } }))}
        />
      </Panel>
      <Panel title="What became of them">
        <ul className="nf-body-sm grid gap-3xs">
          <li>Not earned yet (signed up, or still inside the review window): {data.buckets.pending}</li>
          <li>Earned and past review: {data.buckets.earned}</li>
          <li>Refused or taken back: {data.buckets.reversed}</li>
        </ul>
        <Source>Counts over the last eight weeks. Reward amounts and the Rewards Balance belong to Finance and are not shown here.</Source>
      </Panel>
      <Panel title="Referral campaigns" flush>
        {data.campaigns === null ? (
          <div className="p-md"><p className="nf-body-sm">Could not be read just now.</p></div>
        ) : data.campaigns.length === 0 ? (
          <div className="p-md"><p className="nf-body-sm">No referral campaign has been set up.</p></div>
        ) : (
          <DeskTable
            caption="Referral campaigns"
            columns={[{ key: "title", label: "Campaign" }, { key: "status", label: "Status" }, { key: "dates", label: "Dates" }]}
            rows={data.campaigns.map((c) => ({ key: `${c.title}-${c.startsAt}`, cells: { title: c.title, status: c.status, dates: `${shortDate(c.startsAt)} to ${shortDate(c.endsAt)}` } }))}
          />
        )}
      </Panel>
    </div>
  );
}
