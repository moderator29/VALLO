import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary, type Locale } from "@vallo/i18n";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CalmNote, type CalmNoteProps } from "../../_components/panels";
import { fill } from "../../_components/copy";
import { pagerItems } from "@/lib/admin/reads/money-derive";
import { NumberedSlidePager } from "../../_components/NumberedSlidePager";

/** The money desks' furniture words. English when a caller (the bookings desk) passes no locale. */
function deskWords(locale: Locale | undefined) {
  return getDictionary(locale ?? "en").admin.money.desk;
}

/**
 * The money desks' furniture, shared by money, escrow, supply, bookings and
 * payments. Area-local on purpose: the console's shared primitives are
 * admin-shell's (`app/admin/_components`), and these are the pieces the three
 * money renders draw that the shared set does not.
 */

/** The console's one header (`PageHead`, AD-01), kept under this name for the money desks. */
export function DeskHead({ title, lede, aside }: { title: string; lede: string; aside?: ReactNode }) {
  return <PageHead title={title} lede={lede} action={aside ? <div className="nf-md-head__aside">{aside}</div> : undefined} />;
}

export function Panel({
  title,
  hint,
  aside,
  foot,
  className,
  children,
  labelledBy,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  foot?: ReactNode;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const id = labelledBy ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className={`nf-panel nf-md-card nf-md-panel ${className ?? ""}`} aria-labelledby={id}>
      <div className="nf-md-panel__head">
        <h2 id={id} className="nf-md-panel__title">
          {title}
        </h2>
        {aside ?? (hint ? <span className="nf-md-panel__hint">{hint}</span> : null)}
      </div>
      {children}
      {foot ? <p className="nf-md-panel__foot">{foot}</p> : null}
    </section>
  );
}

/**
 * THE CALM NOTE is the console's shared one (`CalmNote` in
 * `app/admin/_components/panels.tsx`, GLOW_IDENTITY section 7), so an empty panel on a
 * money desk is the same object as an empty panel anywhere in the console.
 * A read that did not answer is drawn in it too, as an error.
 */
export { CalmNote, EmptyChart, type CalmNoteProps } from "../../_components/panels";

export function Waiting({ title, body }: { title: string; body: string }) {
  return <CalmNote kind="error" title={title} fills={body} />;
}

/** A table's own note row: the head stays drawn, the note spans the body. */
export function TableNote({ columns, note }: { columns: number; note: CalmNoteProps }) {
  return (
    <tr className="nf-md-table__note">
      <td colSpan={columns} data-label="">
        <CalmNote {...note} />
      </td>
    </tr>
  );
}

/** The last `count` Lagos months ending with the one `now` is in, `YYYY-MM`, oldest first. */
export function lastMonths(now: number, count: number): string[] {
  const d = new Date(now + 3_600_000);
  return Array.from({ length: count }, (_, i) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (count - 1 - i), 15));
    return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * An empty panel that keeps its frame: the ghosted frame underneath (a
 * chart's grid and axes, a table's head, a bar's track), the calm note over
 * its middle on a wide screen and under it on a phone.
 */
export function Framed({ frame, children }: { frame: ReactNode; children: ReactNode }) {
  return (
    <div className="nf-md-frame">
      <div className="nf-md-frame__ghost" aria-hidden="true">
        {frame}
      </div>
      <div className="nf-md-frame__note">{children}</div>
    </div>
  );
}

export type Delta = {
  /** Whole percentage, or null when there is no real earlier period. */
  percent: number | null;
  /** What it is compared with, e.g. "vs the 7 days before". */
  against: string;
  /** For money leaving (failed charges), an increase is bad. */
  upIsGood?: boolean;
};

function DeltaLine({ delta, fallback, locale }: { delta: Delta | null; fallback?: string; locale?: Locale }) {
  if (!delta || delta.percent === null) {
    return fallback ? <p className="nf-md-delta">{fallback}</p> : null;
  }
  const c = deskWords(locale);
  const { percent, against, upIsGood = true } = delta;
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const good = direction === "flat" ? null : (direction === "up") === upIsGood;
  const tone = good === null ? "flat" : good ? "up" : "down";
  return (
    <p className="nf-md-delta">
      <span className={`nf-md-delta__figure nf-md-delta__figure--${tone}`}>
        {direction !== "flat" && (
          <UiIcon name={direction === "up" ? "arrow-up" : "arrow-down"} size={16} />
        )}
        {Math.abs(percent)}%
        <span className="sr-only">{` ${direction === "up" ? c.up : direction === "down" ? c.down : c.unchanged}`}</span>
      </span>
      <span>{against}</span>
    </p>
  );
}

export function Kpi({
  label,
  value,
  delta = null,
  note,
  href,
  current,
  locale,
}: {
  label: string;
  /** Null draws the quiet not-wired figure. */
  value: string | null;
  delta?: Delta | null;
  /** Said under the figure when there is no delta to draw. */
  note?: string;
  href?: string;
  current?: boolean;
  /** The console's locale; English when omitted. */
  locale?: Locale;
}) {
  const body = (
    <>
      <span className="nf-md-kpi__label">{label}</span>
      {value === null ? (
        <span className="nf-md-kpi__value nf-md-kpi__value--quiet">{deskWords(locale).couldNotBeRead}</span>
      ) : (
        <span className="nf-md-kpi__value nf-numeric">{value}</span>
      )}
      <DeltaLine delta={delta} fallback={note} locale={locale} />
    </>
  );
  if (href) {
    return (
      <Link href={href} className="nf-panel nf-panel--card nf-md-card nf-md-kpi" aria-current={current ? "true" : undefined}>
        {body}
      </Link>
    );
  }
  return <div className="nf-panel nf-panel--card nf-md-card nf-md-kpi">{body}</div>;
}

/**
 * The renders' numbered pager: previous, 1 2 3 4 5 ... 12, next.
 *
 * Every link is a real URL built from the page's own search params, so a
 * page is shareable and the back button works. With a single page it draws
 * only the count, because a pager of one is furniture.
 */
export function NumberedPager({
  base,
  params,
  page,
  total,
  pageSize,
  noun,
  param = "page",
  locale,
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
  noun: string;
  param?: string;
  /** The console's locale; English when omitted. */
  locale?: Locale;
}) {
  const c = deskWords(locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== param) next.set(k, v);
    if (p > 1) next.set(param, String(p));
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const items = pagerItems(page, pages);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  const ui = getDictionary(locale ?? "en").experienceUi;

  return (
    <div className="nf-md-pager-wrap">
      {/* From 768 the sliding indicator (W8); the numbered links below are the
          phone's, where a four-digit page row would not fit. */}
      {pages > 1 && (
        <div className="nf-md-pager--wide">
          <NumberedSlidePager
            base={base}
            params={params}
            param={param}
            page={page}
            pages={pages}
            words={{ label: fill(c.pagerLabel, { noun }), previous: ui.previousPage, next: ui.nextPage, page: ui.page }}
          />
        </div>
      )}
    <nav className={["nf-md-pager", pages > 1 && "nf-md-pager--phone"].filter(Boolean).join(" ")} aria-label={fill(c.pagerLabel, { noun })}>
      {items.length > 0 && (
        <>
          {page > 1 ? (
            <Link href={href(page - 1)} className="nf-md-pager__item" aria-label={c.previousPage}>
              <UiIcon name="arrow-left" size={16} />
            </Link>
          ) : (
            <span className="nf-md-pager__item" aria-disabled="true">
              <UiIcon name="arrow-left" size={16} />
            </span>
          )}
          {items.map((item) =>
            item.kind === "gap" ? (
              <span key={item.key} className="nf-md-pager__gap" aria-hidden="true">
                ...
              </span>
            ) : (
              <Link
                key={item.page}
                href={href(item.page)}
                className="nf-md-pager__item"
                aria-current={item.page === page ? "page" : undefined}
                aria-label={fill(c.page, { page: item.page })}
              >
                {item.page}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={href(page + 1)} className="nf-md-pager__item" aria-label={c.nextPage}>
              <UiIcon name="arrow-right" size={16} />
            </Link>
          ) : (
            <span className="nf-md-pager__item" aria-disabled="true">
              <UiIcon name="arrow-right" size={16} />
            </span>
          )}
        </>
      )}
      <span className="nf-md-pager__count">
        {total === 0 ? fill(c.pagerNone, { noun }) : fill(c.pagerCount, { first, last, total, noun })}
      </span>
    </nav>
    </div>
  );
}

/** Flattens Next's search params into single strings, for building links. */
export function flatParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}
