import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { HeroBand } from "@/components/ui/HeroBand";
import { KpiTile } from "@/components/ui/KpiTile";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { IconPlate } from "@/components/ui/IconPlate";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { TodayHero } from "@/components/workspace/TodayHero";
import type { HostToday, TodayAttention } from "./today";
import "@/app/css/site.css";

/**
 * THE HOST WORKSPACE HOME, DRAWN (plan item 14, spec 13, reference 38 on a
 * desk and reference 31 on a phone).
 *
 * The navy hero band opens it (the founder's widened Q2): the date, "Today",
 * the one action, and the four KPI tiles sitting on the band. Under it the
 * "Needs attention" group and the reservations gauge side by side from
 * 1024px, stacked on a phone. Every figure is one `hostToday` computed from
 * the host's own rows; a tile whose source could not be read is not drawn,
 * a gauge with nothing to count is left out, and no tile carries a delta
 * chip because no figure here has a measured previous period.
 *
 * REFERENCE 7033, FIGURE HERO PLUS LIST (Session 3, 6 October). The band now
 * leads with one figure, "Needs you today": the sum of the three queue tiles
 * that were read (requests waiting, arriving today, unread), which is
 * `hostToday().needsYou` and nothing else. Under it, the oldest thing still
 * waiting is promoted to the one next action, and it leaves the "Needs
 * attention" list so nothing is listed twice. The four tiles stay where they
 * were (the 2x2 count cards of north star 15.4, each a door into its queue),
 * and so do the list and the gauge: D28, nobody's furniture moves.
 */

const KPI_ICON: Record<string, UiIconName> = {
  arriving: "key",
  staying: "bed",
  requests: "calendar-clock",
  unread: "chat-bubble",
};

const ATTENTION_ICON: Record<TodayAttention["kind"], UiIconName> = {
  request: "bed",
  table: "utensils",
  draft: "file-text",
  stopped: "alert-triangle",
};

export function HostTodayView({
  today,
  t,
  locale,
  sub,
  action,
  figure,
  dashboard,
  children,
}: {
  today: HostToday;
  t: Dictionary;
  locale: Locale;
  /** The line under "Today": how many businesses, or where to start. */
  sub: string;
  /** The one primary action. */
  action: ReactNode;
  /** The figure card (reference 5), drawn under the band. */
  figure?: ReactNode;
  /** The hotel and restaurant dashboards (summary cards, front desk, week), under the band. */
  dashboard?: ReactNode;
  /** The rest of the page: the application in progress, the businesses. */
  children?: ReactNode;
}) {
  const d = t.desk;
  const tag = locale === "en" ? "en-NG" : locale;
  const dateLine = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  }).format(new Date(`${today.day}T12:00:00Z`));

  /* The oldest waiting item becomes the next action; the list carries the
     rest. With one item, the list is left out entirely. */
  const [first, ...rest] = today.attention;
  const shown = rest.slice(0, 5);
  /* No queue was read at all: no figure, rather than a 0 nobody counted. */
  const readQueues = today.kpis.some((k) => k.key === "arriving" || k.key === "requests" || k.key === "unread");

  return (
    <div className="nf-desk-home">
      {/* The moving edge light on the one band that opens the desk (lead,
          29 September); `.nf-edge-lap` settles to a steady rim under reduced
          motion, data saver, Calm and Off. */}
      <HeroBand lap label={dateLine} title={d.today.title} titleAs="h1" sub={sub} action={action}>
        <TodayHero
          caption={d.today.needsYou}
          count={readQueues ? today.needsYou : null}
          busy={d.today.sumLine}
          idle={d.today.nothing}
          tag={tag}
          next={first ? attentionRowProps(first, t, tag) : null}
        />
        {today.kpis.length > 0 ? (
          <div className="nf-desk-kpis">
            {today.kpis.map((kpi) => (
              <KpiTile
                key={kpi.key}
                label={d.host.kpi[kpi.key]}
                icon={KPI_ICON[kpi.key]}
                value={kpi.value}
                href={kpi.href}
                tag={tag}
                className={kpi.key === "unread" && kpi.value > 0 ? "nf-kpi--spark" : undefined}
              />
            ))}
          </div>
        ) : null}
      </HeroBand>

      {dashboard}

      {figure}

      {/* ONE LIST (clean spaces): what needs the host. The reservations by
          status gauge lives on the reservations board, one tap away. */}
      {shown.length > 0 ? (
        <div className="nf-desk-grid">
          {shown.length > 0 ? (
            <ListGroup
              label={d.today.needsAttention}
              labelAs="h2"
              action={
                rest.length > shown.length ? (
                  <Link href="/host/decide" className="nf-link-quiet nf-tap">
                    {d.today.viewAll.replace("{count}", String(today.attention.length))}
                  </Link>
                ) : undefined
              }
            >
              {shown.map((item) => (
                <AttentionRow key={item.key} item={item} t={t} tag={tag} />
              ))}
            </ListGroup>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

/** One waiting item as a row's parts: the list row and the next action share it. */
function attentionRowProps(item: TodayAttention, t: Dictionary, tag: string) {
  const a = t.desk.host.attention;
  let title = item.title;
  let sub = item.sub;
  let badge: ReactNode = null;
  if (item.kind === "request") {
    sub = a.request.replace("{guest}", item.sub);
  } else if (item.kind === "table") {
    const at = new Date(item.sub);
    title = Number.isFinite(at.getTime())
      ? new Intl.DateTimeFormat(tag, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Africa/Lagos",
        }).format(at)
      : item.title;
    sub = a.table.replace("{guest}", item.title);
  } else if (item.kind === "draft") {
    title = `${a.draft} · ${item.title}`;
    sub = a.draftSub.replace("{count}", item.sub);
  } else {
    title = item.title;
    sub = a.stopped;
    badge = (
      <StatusBadge tone={item.tone === "error" ? "error" : "warning"}>
        {t.experienceHost.businessStatus[item.sub as keyof Dictionary["experienceHost"]["businessStatus"]] ?? item.sub}
      </StatusBadge>
    );
  }
  return {
    href: item.href,
    leading: (
      <IconPlate size="sm" shape="round" tone={item.tone === "neutral" ? "neutral" : item.tone}>
        <UiIcon name={ATTENTION_ICON[item.kind]} size={20} />
      </IconPlate>
    ),
    title,
    sub,
    status: badge ?? undefined,
  };
}

function AttentionRow({ item, t, tag }: { item: TodayAttention; t: Dictionary; tag: string }) {
  const row = attentionRowProps(item, t, tag);
  return (
    <ListRow
      href={row.href}
      leading={row.leading}
      title={row.title}
      sub={row.sub}
      status={row.status}
      chevron={row.status === undefined}
    />
  );
}
