import { CountedText } from "@/components/ui/HeroFigure";
import Link from "next/link";
import type { ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { toneForStatus, type StatusTone } from "@/components/ui/StatusPill";
import { Sparkline } from "@/components/agent/charts/Sparkline";
import { CalmNote } from "../_components/panels";
import { donutArcs, pagerPages, share } from "./metrics";

/**
 * The review desks' furniture, server-safe and data-free.
 *
 * Every part takes plain props and reads nothing, so the same markup renders
 * on a live desk and in a fixture harness for the proof shots. Charts are
 * inline SVG (no charting dependency); they draw only the series they are
 * handed and draw nothing, with a sentence, when handed nothing.
 *
 * The sparkline is admin-shell's shared `Sparkline`. The donut stays local and
 * is the only one left: the agent console's four-hue `DonutChart` was deleted
 * by Session 3 as the refused pattern (north star 9), and the chart system in
 * `components/ui/charts` draws a share of a whole as a bar instead.
 */

/* ---------------------------------------------------------------- head */

export function DeskHead({
  title,
  sub,
  lead,
  trail,
}: {
  title: string;
  sub?: string;
  lead?: ReactNode;
  trail?: ReactNode;
}) {
  /* The console's one header (`PageHead`, AD-01), kept under this name for the review desks. */
  return <PageHead title={title} lede={sub} lead={lead} trail={trail} />;
}

/* ---------------------------------------------------------- section list */

export type SectionLink = {
  key: string;
  href: string;
  title: string;
  /** One calm line saying what is inside, so nobody opens a page to find out. */
  summary?: string | null;
  icon: UiIconName;
  /** A small trailing word, such as "2 need a look". */
  flag?: string | null;
};

/**
 * A review's sections, one per row, each opening on its own page. A review
 * desk used to lay every panel out on one long screen; this is the list that
 * replaced it, so the page leads with the decision and the evidence is one tap
 * away, with a way back on every page it opens.
 */
export function SectionList({ items, label }: { items: readonly SectionLink[]; label: string }) {
  return (
    <ul className="nf-rv-hub" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <Link href={item.href} className="nf-rv-hub__row">
            <span className="nf-rv-hub__icon" aria-hidden="true">
              <UiIcon name={item.icon} size={20} />
            </span>
            <span className="nf-rv-hub__text">
              <span className="nf-rv-hub__title">{item.title}</span>
              {item.summary ? <span className="nf-rv-hub__summary">{item.summary}</span> : null}
            </span>
            {item.flag ? <span className="nf-rv-hub__flag">{item.flag}</span> : null}
            <UiIcon name="chevron-right" size={16} className="nf-rv-hub__chev" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- tabs */

export type TabItem = {
  key: string;
  label: string;
  href: string;
  on: boolean;
  /** A real count, or null when no read returns one yet. Never a guess. */
  count?: number | null;
};

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="nf-rv-tabs" role="list">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="nf-rv-tab"
              aria-current={item.on ? "page" : undefined}
              prefetch={false}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span className="nf-rv-tab__count">{item.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------------- panel */

export function Panel({
  title,
  note,
  action,
  flush = false,
  className,
  children,
  labelledBy,
}: {
  title?: string;
  note?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      className={["nf-panel nf-rv-panel", flush ? "nf-rv-panel--flush" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={labelledBy}
    >
      {title || action ? (
        <div className="nf-rv-panel__head">
          {title ? (
            <h2 className="nf-rv-panel__title" id={labelledBy}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {note ? <p className="nf-rv-panel__note">{note}</p> : null}
      {children}
    </section>
  );
}

/**
 * The calm explanatory line the register puts on almost every screen: a small
 * round glyph and a sentence. Used for a read that failed (so nothing is drawn
 * rather than a guess) and for a panel that explains what will fill it.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="nf-rv-unwired" role="note">
      <UiIcon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}

/** A read that failed, in the shared calm anatomy. */
export function ReadFailed({ what }: { what: string }) {
  return (
    <CalmNote
      kind="error"
      title="This did not load"
      fills={`${what} could not be read just now. Nothing is drawn rather than a number nobody measured.`}
      creates="Nothing has changed. Reload to try again."
    />
  );
}

export const READ_FAILED =
  "This could not be read just now. Nothing is drawn rather than a number nobody measured.";

/**
 * THE EMPTY STATE IS THE DESIGNED STATE. On 22 September the platform had 64
 * listings, every one an example, and nothing in any review queue, so this is
 * what an operator sees first. It is admin-shell's shared `CalmNote` (the calm
 * info panel of GLOW_IDENTITY section 7), so the console's empty state is the
 * same everywhere; this wrapper only keeps the panel's height.
 */
export function Empty({
  title,
  body,
  cause,
  link,
  kind = "info",
}: {
  title: string;
  body: string;
  cause?: string;
  link?: { href: string; label: string };
  kind?: "info" | "clear" | "error";
}) {
  return (
    <div className="nf-rv-empty">
      <CalmNote
        title={title}
        fills={body}
        {...(cause ? { creates: cause } : {})}
        {...(link ? { action: link } : {})}
        kind={kind}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- badges */

export function Badge({
  tone,
  status,
  children,
}: {
  tone?: StatusTone;
  /** A machine status, toned through the platform's single map. */
  status?: string;
  children: ReactNode;
}) {
  const resolved = tone ?? toneForStatus(status ?? "");
  return <span className={`nf-rv-badge nf-rv-badge--${resolved}`}>{children}</span>;
}

export function RoleTag({ children }: { children: ReactNode }) {
  return <span className="nf-rv-role">{children}</span>;
}

/* ---------------------------------------------------------------- KPI */

export type Delta = {
  /** Whole per cent, or null when there is no prior period to compare with. */
  pct: number | null;
  /** True when a rise is good news (passed today); false when it is not (backlog). */
  upIsGood: boolean;
  vs: string;
};

export function DeltaLine({ delta }: { delta: Delta }) {
  if (delta.pct === null) return null;
  const up = delta.pct > 0;
  const flat = delta.pct === 0;
  const good = flat ? null : up === delta.upIsGood;
  const cls = flat ? "flat" : good ? "good" : "bad";
  return (
    <span>
      <span className={`nf-rv-delta nf-rv-delta--${cls}`}>
        {flat ? null : <UiIcon name={up ? "arrow-up" : "arrow-down"} size={16} />}
        {Math.abs(delta.pct)}%
        <span className="sr-only">{up ? " up" : flat ? " unchanged" : " down"}</span>
      </span>
      <span className="nf-rv-delta__vs">{delta.vs}</span>
    </span>
  );
}

export function Kpi({
  label,
  icon,
  figure,
  delta,
  spark,
  hint,
}: {
  label: string;
  icon?: UiIconName;
  /** The number as the console prints it, or null when its read failed. */
  figure: string | null;
  delta?: Delta | null;
  spark?: readonly number[] | null;
  hint?: string;
}) {
  return (
    <div className="nf-panel nf-rv-panel nf-rv-kpi">
      <p className="nf-rv-kpi__label">
        {icon ? <UiIcon name={icon} size={16} /> : null}
        {label}
      </p>
      <div className="nf-rv-kpi__row">
        <div>
          {figure === null ? (
            <p className="nf-rv-kpi__figure nf-rv-kpi__figure--quiet">Could not be read</p>
          ) : (
            <p className="nf-rv-kpi__figure">
              {/* Counts up once on first view when the printed figure is a
                  plain whole number (the founder's count-up ruling); any
                  other figure (a rate, a compact money) prints as it is. */}
              <CountedText text={figure} value={wholeIn(figure)} tag="en-NG" />
            </p>
          )}
          {delta ? <DeltaLine delta={delta} /> : null}
        </div>
        {spark && spark.length > 1 ? <Spark values={spark} label={`${label}, daily`} /> : null}
      </div>
      {hint ? <p className="nf-rv-panel__note">{hint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- charts */

/** The KPI sparkline: admin-shell's shared primitive, never a local copy. */
export function Spark({ values, label }: { values: readonly number[]; label: string }) {
  return (
    <Sparkline
      id={`rv-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      values={values}
      label={label}
      width={112}
      height={40}
      className="nf-rv-spark"
    />
  );
}

export type Segment = {
  key: string;
  label: string;
  value: number;
  /** One of the `nf-rv-ink-*` names: brand, quiet, pending, success, danger, muted, ramp1..4. */
  ink: string;
};

/**
 * A donut, drawn only from real segments. A total of zero draws the empty
 * track and says so in the middle rather than drawing a full ring.
 */
export function Donut({
  segments,
  caption,
  label,
}: {
  segments: Segment[];
  caption: string;
  label: string;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const arcs = donutArcs(segments);
  const inkOf = new Map(segments.map((s) => [s.key, s.ink]));
  const GAP = arcs.length > 1 ? 3 : 0;
  return (
    <div className="nf-rv-donut">
      <svg viewBox="-64 -64 128 128" role="img" aria-label={`${label}: ${total} in all`}>
        <circle className="nf-rv-donut__track" r={R} strokeWidth={12} />
        {arcs.map((arc) => {
          const length = Math.max(0, (arc.end - arc.start) * C - GAP);
          return (
            <circle
              key={arc.key}
              className={`nf-rv-donut__arc nf-rv-ink-${inkOf.get(arc.key) ?? "brand"}`}
              r={R}
              stroke="currentColor"
              strokeWidth={12}
              strokeLinecap="butt"
              strokeDasharray={`${length} ${C - length}`}
              strokeDashoffset={-arc.start * C}
              transform="rotate(-90)"
            />
          );
        })}
        <text className="nf-rv-donut__total" textAnchor="middle" dy="4">
          {total}
        </text>
        <text className="nf-rv-donut__caption" textAnchor="middle" dy="22">
          {caption}
        </text>
      </svg>
      <Legend segments={segments} total={total} />
    </div>
  );
}

export function Legend({
  segments,
  total,
  percent = false,
}: {
  segments: Segment[];
  total?: number;
  percent?: boolean;
}) {
  const sum = total ?? segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  return (
    <ul className="nf-rv-legend">
      {segments.map((s) => (
        <li key={s.key}>
          <span className={`nf-rv-dot nf-rv-ink-${s.ink}`} aria-hidden="true" />
          <span>{s.label}</span>
          <strong>{percent ? `${share(s.value, sum) ?? 0}%` : s.value}</strong>
        </li>
      ))}
    </ul>
  );
}

/**
 * One stacked status bar with a word on every segment (the legend beneath
 * carries the words and the counts, so colour is never the only signal).
 */
export function StatusBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <div style={{ display: "grid", gap: "var(--nf-space-sm)" }}>
      <div className="nf-rv-statusbar" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        {total > 0
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <span key={s.key} className={`nf-rv-ink-${s.ink}`} style={{ flexGrow: s.value, flexBasis: 0 }} />
              ))
          : null}
      </div>
      <Legend segments={segments} total={total} />
    </div>
  );
}

/** Horizontal magnitude bars on the blue ramp, direct-labelled. */
export function Bars({
  rows,
}: {
  rows: { key: string; label: string; parts: { value: number; ink: string; word: string }[] }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((sum, p) => sum + p.value, 0)));
  return (
    <ul className="nf-rv-bars">
      {rows.map((row) => {
        return (
          <li key={row.key}>
            <span>{row.label}</span>
            <strong>
              {row.parts
                .filter((p) => p.value > 0)
                .map((p) => `${p.value} ${p.word}`)
                .join(", ") || "none"}
            </strong>
            <span className="nf-rv-bars__track" aria-hidden="true">
              {row.parts
                .filter((p) => p.value > 0)
                .map((p) => (
                  <span
                    key={p.word}
                    className={`nf-rv-ink-${p.ink}`}
                    style={{ width: `${(p.value / max) * 100}%` }}
                  />
                ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- pager */

/**
 * A pager that only ever offers pages it has evidence for.
 *
 * The admin reads are cursor reads: they say whether ANOTHER page exists, not
 * how many there are. So the pager numbers every page up to the current one
 * and the next one when `hasNext` is true, and no further. When a total
 * arrives (`lastPage`), it numbers them all with gaps.
 */
export function Pager({
  page,
  hasNext,
  lastPage,
  hrefFor,
  label = "Pages",
}: {
  page: number;
  hasNext: boolean;
  lastPage?: number | null;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const last = lastPage ?? (hasNext ? page + 1 : page);
  if (last <= 1 && page <= 1) return null;
  const pages = pagerPages(page, last);
  return (
    <nav aria-label={label} className="nf-rv-pager">
      {page > 1 ? (
        <Link className="nf-rv-pager__item" href={hrefFor(page - 1)} aria-label="Previous page" prefetch={false}>
          <UiIcon name="arrow-left" size={16} />
        </Link>
      ) : (
        <span className="nf-rv-pager__item" aria-disabled="true">
          <UiIcon name="arrow-left" size={16} />
        </span>
      )}
      {pages.map((p, index) =>
        p === "gap" ? (
          <span key={`gap-${index}`} className="nf-rv-pager__gap">
            ...
          </span>
        ) : (
          <Link
            key={p}
            className="nf-rv-pager__item"
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            prefetch={false}
          >
            {p}
          </Link>
        ),
      )}
      {page < last ? (
        <Link className="nf-rv-pager__item" href={hrefFor(page + 1)} aria-label="Next page" prefetch={false}>
          <UiIcon name="arrow-right" size={16} />
        </Link>
      ) : (
        <span className="nf-rv-pager__item" aria-disabled="true">
          <UiIcon name="arrow-right" size={16} />
        </span>
      )}
    </nav>
  );
}

/* ---------------------------------------------------------------- people */

export function Avatar({
  name,
  src,
  small = false,
}: {
  name: string | null;
  src?: string | null;
  small?: boolean;
}) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase() || "V";
  const cls = `nf-rv-avatar${small ? " nf-rv-avatar--sm" : ""}`;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={cls} src={src} alt="" />;
  }
  return (
    <span className={cls} aria-hidden="true">
      {initial}
    </span>
  );
}

/** The whole number a printed console figure holds ("1,204", "₦12,000"), or -1. */
function wholeIn(text: string): number {
  const m = /^[^\d.-]*(\d{1,3}(?:,\d{3})*|\d+)(?![\d.])[^\d]*$/.exec(text);
  return m ? Number(m[1]!.replace(/,/g, "")) : -1;
}
