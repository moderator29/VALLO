import type { ReactNode } from "react";
import { PersonTier } from "./PersonTier";
import type { PersonTier as PersonTierValue } from "@/lib/admin/reads/shapes";
import { getDictionary, type Locale } from "@vallo/i18n";
import { intlTag } from "@vallo/i18n/core";
import { CountUp, CountUpMoney } from "@/components/motion/CountUp";
import Link from "next/link";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Sparkline, type SparkTone } from "@/components/agent/charts/Sparkline";
import { NavIcon, type AdminIcon } from "./AdminGlyph";
import type { Delta } from "./metrics";
import { Panel as UiPanel, panelClass } from "@/components/ui/Panel";
import { IconPlate as UiIconPlate, ICON_PLATE_GLYPH } from "@/components/ui/IconPlate";

/**
 * The console's shared furniture, drawn from the four admin renders: the lit
 * glass panel (the platform's shared Panel since 23 September), the page head with its blue sub-line, the KPI strip and the
 * KPI card with a sparkline, the icon plate, the status badge, the tab row,
 * the data table, and the two honest states every panel can be in when it has
 * nothing true to draw (empty, or not wired yet).
 *
 * Every desk imports these rather than drawing its own, so the console reads
 * as one object. Server-safe: nothing here holds state.
 */

/**
 * THE ONE CONSOLE HEADER (AD-01, Grade 1). Every admin page draws its title
 * here: the money desks' and the review desks' `DeskHead`s are thin wrappers
 * over it, and the pages that drew a raw `<h1>` moved onto it. One title size,
 * one sub-line, the actions at the end. `lead` goes before the title (a back
 * link on a detail page), `trail` after it on the same line (a status chip).
 */
export function PageHead({
  title,
  lede,
  action,
  lead,
  trail,
}: {
  title: string;
  lede?: string | undefined;
  action?: ReactNode;
  lead?: ReactNode;
  trail?: ReactNode;
}) {
  return (
    <header className="nf-admin-page-head">
      <div className="min-w-0">
        {lead}
        <div className="flex min-w-0 flex-wrap items-center gap-x-sm gap-y-2xs">
          <h1 className="nf-admin-page-head__title [overflow-wrap:anywhere]">{title}</h1>
          {trail}
        </div>
        {lede ? <p className="nf-admin-page-head__lede">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  id,
  flush = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  /** No inner padding under the head, for a table that runs edge to edge. */
  flush?: boolean;
}) {
  return (
    <UiPanel
      flush={flush}
      className={`nf-admin-panel${className ? ` ${className}` : ""}`}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      id={id}
    >
      {(title || action) && (
        <div className="nf-admin-panel__head">
          {title && (
            <h2 className="nf-admin-panel__title" id={id ? `${id}-title` : undefined}>
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </UiPanel>
  );
}

/**
 * A desk that only reads says so once, in a quiet line, instead of leaving a
 * table that looks as if it should carry a control. It states what the desk
 * does (reads and reports), never what is currently in it, and it draws no
 * dead button.
 */
export function ReadOnlyNote({ locale }: { locale: Locale }) {
  return (
    <p className="nf-admin-readonly" data-testid="desk-readonly">
      <UiIcon name="info" size={16} />
      <span>{getDictionary(locale).experienceAdmin.readOnly.line}</span>
    </p>
  );
}

/** "View all ->", the renders' quiet panel link. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="nf-admin-panel__link">
      {children}
      <UiIcon name="arrow-right" size={16} />
    </Link>
  );
}

/** The console's plate: the shared IconPlate carrying one of the console's line glyphs. */
export function IconPlate({ icon, tone = "brand", size = "md" }: { icon: AdminIcon; tone?: BadgeTone | "brand"; size?: "sm" | "md" }) {
  return (
    <UiIconPlate tone={tone} size={size}>
      <NavIcon icon={icon} size={ICON_PLATE_GLYPH[size]} />
    </UiIconPlate>
  );
}

export type BadgeTone = "success" | "pending" | "error" | "info";

/** A status badge: a rounded rectangle carrying its word, per the shape law. */
export function Badge({ tone, solid = false, children }: { tone: BadgeTone; solid?: boolean; children: ReactNode }) {
  return <span className={`nf-admin-badge nf-admin-badge--${tone}${solid ? " nf-admin-badge--solid" : ""}`}>{children}</span>;
}

/** The change against the previous period, with its arrow and its words. */
export function DeltaLine({ delta, caption }: { delta: Delta | null; caption?: string }) {
  if (!delta) return caption ? <span className="nf-admin-kpi__caption">{caption}</span> : null;
  const tone = delta.direction === "flat" ? "flat" : delta.good ? "good" : "bad";
  return (
    <span className="nf-admin-kpi__delta-wrap">
      <span className={`nf-admin-delta nf-admin-delta--${tone}`}>
        {delta.direction !== "flat" && (
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d={delta.direction === "up" ? "M5 1.5 9 8.5H1Z" : "M5 8.5 1 1.5h8Z"} fill="currentColor" />
          </svg>
        )}
        {delta.text}
      </span>
      {caption && <span className="nf-admin-kpi__caption">{caption}</span>}
    </span>
  );
}

export type KpiSpark = { id: string; values: readonly number[]; label: string; tone?: SparkTone };

/** A sparkline is drawn only when something happened: fourteen zeros is not a line. */
function drawable(spark: KpiSpark | null | undefined): spark is KpiSpark {
  return Boolean(spark && spark.values.some((v) => v !== 0));
}

export type KpiItem = {
  key: string;
  /** The plate. Left out where the render draws the card without one (Operations). */
  icon?: AdminIcon;
  label: string;
  /** Null when the figure has no source yet; the tile says so instead of a number. */
  value: string | null;
  delta?: Delta | null;
  caption?: string;
  spark?: KpiSpark | null;
  href?: string;
  /** Why there is no figure: the read failed, or the platform records nothing to read. */
  pending?: string;
  /** The word in place of the figure: "Unavailable" by default, "Not recorded" for a metric with no source. */
  missingWord?: string;
  /**
   * The figure's real number, so it can count up on arrival (D4, 620ms, once).
   * `value` is still what the server prints and what a screen reader hears;
   * this only says what the digits count to. A COUNT of things, whole. Never
   * passed for a percentage or anything that is not a plain count, and never
   * a number the read did not return.
   */
  count?: number;
  /** The same, for naira: minor units, counted in whole naira and handed back to `value`. */
  minor?: number;
  /** The reader's language, for the digits while they run. */
  locale?: Locale;
};

function Figure({ item, big }: { item: KpiItem; big: boolean }) {
  if (item.value === null) {
    return (
      <span className="nf-admin-kpi__unwired">
        <span className={big ? "nf-admin-kpi__value nf-admin-kpi__value--none" : "nf-admin-kpi__value nf-admin-kpi__value--none nf-admin-kpi__value--sm"}>
          {item.missingWord ?? "Unavailable"}
        </span>
        {item.pending && <span className="nf-admin-kpi__caption">{item.pending}</span>}
      </span>
    );
  }
  const klass = `nf-admin-kpi__value${big ? "" : " nf-admin-kpi__value--sm"} nf-numeric`;
  /* The count-up is a figure ARRIVING. A figure that is not a plain count or an
     amount (a percentage, a share) is printed as it is. */
  if (item.count !== undefined && item.count > 0) {
    return <CountUp value={item.count} tag={intlTag[item.locale ?? "en"]} eager className={klass} />;
  }
  if (item.minor !== undefined && item.minor > 0 && item.locale) {
    return (
      <CountUpMoney minorUnits={item.minor} locale={item.locale} eager frameClassName={klass}>
        <span className={klass}>{item.value}</span>
      </CountUpMoney>
    );
  }
  return <span className={klass}>{item.value}</span>;
}

/** The renders' top strip: four figures in one lit pane, split by hairlines. */
export function KpiStrip({ items, label }: { items: readonly KpiItem[]; label: string }) {
  return (
    <section className={panelClass({ variant: "card", className: "nf-admin-strip" })} aria-label={label}>
      {items.map((item) => (
        <div key={item.key} className="nf-admin-strip__cell">
          {item.icon && <IconPlate icon={item.icon} />}
          <div className="nf-admin-strip__body">
            <span className="nf-admin-kpi__label">{item.label}</span>
            <span className="nf-admin-strip__line">
              <Figure item={item} big={false} />
              {item.value !== null && item.delta && <DeltaLine delta={item.delta} />}
            </span>
            {item.value !== null && item.caption && (
              <span className="nf-admin-kpi__caption">{item.caption}</span>
            )}
          </div>
          {item.value !== null && drawable(item.spark) && (
            <Sparkline {...item.spark} width={72} height={30} className="nf-admin-strip__spark" />
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * One KPI card, as 5EAA44CB draws it: the plate top left, the title beside
 * it, the big figure under the title, the change and "vs last week" under
 * that, the sparkline anchored bottom right.
 */
export function KpiCard({ item }: { item: KpiItem }) {
  const body = (
    <>
      {item.icon && <IconPlate icon={item.icon} />}
      <div className="nf-admin-kpi__body">
        <span className="nf-admin-kpi__label nf-admin-kpi__label--card">{item.label}</span>
        <Figure item={item} big />
        {item.value !== null && <DeltaLine delta={item.delta ?? null} caption={item.caption} />}
      </div>
      {item.value !== null && drawable(item.spark) && (
        <Sparkline {...item.spark} width={96} height={44} className="nf-admin-kpi__spark" />
      )}
    </>
  );
  return item.href ? (
    <Link href={item.href} className={panelClass({ variant: "card", className: `nf-admin-kpi${item.icon ? "" : " nf-admin-kpi--bare"}` })}>
      {body}
    </Link>
  ) : (
    <div className={panelClass({ variant: "card", className: `nf-admin-kpi${item.icon ? "" : " nf-admin-kpi--bare"}` })}>{body}</div>
  );
}

export function KpiGrid({ items, label }: { items: readonly KpiItem[]; label: string }) {
  return (
    <section className="nf-admin-kpis" aria-label={label}>
      {items.map((item) => (
        <KpiCard key={item.key} item={item} />
      ))}
    </section>
  );
}

/**
 * THE CALM NOTE (GLOW_IDENTITY section 7): the console's empty state, and
 * on 22 September its most common state, so it is designed rather than a
 * grey sentence. A flat calm panel with a round glyph disc, one line on what
 * fills this panel, one on what creates that data, and a link to the desk
 * or flow that produces it where one exists. `kind` picks the glyph: "info"
 * for an honest empty read, "unwired" for data the platform does not record
 * yet (the line names the request).
 */
export type CalmNoteProps = {
  title: string;
  /** What fills this panel. */
  fills: string;
  /** What creates that data. */
  creates?: string;
  action?: { href: string; label: string };
  kind?: "info" | "unwired" | "clear" | "error";
};

export function CalmNote({ title, fills, creates, action, kind = "info" }: CalmNoteProps) {
  return (
    <div className={`nf-admin-calm nf-admin-calm--${kind}`} role={kind === "error" ? "alert" : "note"}>
      <span className="nf-admin-calm__disc" aria-hidden="true">
        {kind === "unwired" ? (
          <UiIcon name="link" size={16} />
        ) : kind === "error" ? (
          <UiIcon name="close" size={16} />
        ) : kind === "clear" ? (
          <AdminGlyphInline name="check" />
        ) : (
          <AdminGlyphInline name="i" />
        )}
      </span>
      <span className="nf-admin-calm__text">
        <span className="nf-admin-calm__title">{title}</span>
        <span className="nf-admin-calm__line">{fills}</span>
        {creates && <span className="nf-admin-calm__line">{creates}</span>}
        {action && (
          <Link href={action.href} className="nf-admin-calm__link">
            {action.label}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        )}
      </span>
    </div>
  );
}

/** The disc's two drawn glyphs: a bold "i" and a tick, in the disc's ink. */
function AdminGlyphInline({ name }: { name: "i" | "check" }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {name === "i" ? <path d="M8 7v5M8 4.2v.1" /> : <path d="m4.5 8.3 2.3 2.3 4.7-5" />}
    </svg>
  );
}

/**
 * An empty chart that keeps its real height and its frame: the y axis, the
 * grid, the bucket labels and the legend, and no data mark at all (never a
 * flat line), with the calm note centred on the plot.
 */
export function EmptyChart({
  height = 200,
  yLabels,
  xLabels,
  legend,
  note,
}: {
  height?: number;
  yLabels: readonly string[];
  xLabels: readonly string[];
  legend?: readonly string[];
  note: CalmNoteProps;
}) {
  return (
    <figure className="nf-chart nf-chart--empty">
      {legend && legend.length > 0 && (
        <ul className="nf-chart__legend" aria-label="Series">
          {legend.map((label, i) => (
            <li key={label}>
              <span className={`nf-chart__swatch nf-chart__bar--s${Math.min(i, 2)}`} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}
      <div className="nf-chart__frame">
        <div className="nf-chart__yaxis" aria-hidden="true" style={{ minHeight: height }}>
          {yLabels.map((label, i) => (
            <span key={`${label}-${i}`} style={{ bottom: `${(i / Math.max(1, yLabels.length - 1)) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
        <div className="nf-chart__plot" style={{ minHeight: height }}>
          {yLabels.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="nf-chart__grid"
              style={{ bottom: `${(i / Math.max(1, yLabels.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <div className="nf-chart__empty-note">
            <CalmNote {...note} />
          </div>
        </div>
      </div>
      <div className="nf-chart__xaxis nf-chart__xaxis--bars" aria-hidden="true">
        {xLabels.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
    </figure>
  );
}

/** Kept for callers that pass a title and a body: the calm note, info kind. */
export function PanelEmpty({ title, body }: { title: string; body: string; icon?: "info" | "verified" | "history" }) {
  return <CalmNote title={title} fills={body} />;
}

/** Data the platform does not record yet: the calm note, naming the request. */
export function NotWired({ what, request, title = "Not recorded yet" }: { what: string; request: string; title?: string }) {
  return <CalmNote kind="unwired" title={title} fills={what} creates={request} />;
}

/** The panel state for a read that failed. Pass `locale` for the reader's language. */
export function PanelUnavailable({ what, locale }: { what: string; locale?: Locale }) {
  const c = getDictionary(locale ?? "en").admin.shell.states;
  return (
    <CalmNote
      kind="error"
      title={c.unavailableTitle}
      fills={c.unavailableBody.replace("{what}", what)}
      creates={c.unavailableRetry}
    />
  );
}

/** A row of tabs that are links, so a tab is a URL and survives a reload. */
export function TabRow({
  items,
  label,
}: {
  items: readonly { key: string; href: string; label: string; active: boolean; count?: number }[];
  label: string;
}) {
  return (
    <nav className="nf-admin-seg" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
          className={`nf-admin-seg__item${item.active ? " nf-admin-seg__item--on" : ""}`}
        >
          {item.label}
          {typeof item.count === "number" && item.count > 0 && (
            <span className="nf-admin-seg__count nf-numeric">{item.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** The alert list rows the overview and operations share. */
export type AlertRow = {
  id: string;
  title: string;
  sub: string;
  when: string;
  tone: BadgeTone;
  word: string;
  icon: AdminIcon;
  href?: string;
  /** The published badge tier of the person the row names, if any (B-BADGE). */
  tier?: PersonTierValue | null;
};

export function AlertList({ rows }: { rows: readonly AlertRow[] }) {
  return (
    <ul className="nf-admin-alerts">
      {rows.map((row) => {
        const inner = (
          <>
            <IconPlate icon={row.icon} tone={row.tone} size="sm" />
            <span className="nf-admin-alerts__text">
              <span className="nf-admin-alerts__title">
                {row.title}
                <PersonTier tier={row.tier} size="sm" />
              </span>
              <span className="nf-admin-alerts__sub">{row.sub}</span>
            </span>
            <span className="nf-admin-alerts__when nf-numeric">{row.when}</span>
            <Badge tone={row.tone}>{row.word}</Badge>
          </>
        );
        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className="nf-admin-alerts__row">
                {inner}
              </Link>
            ) : (
              <div className="nf-admin-alerts__row">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
