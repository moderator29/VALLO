import { formatDate, type Locale } from "@vallo/i18n";
import { CHART_CONTEXT, CHART_INK, CHART_SERIES } from "./palette";

/**
 * One series over days. The console's change-over-time chart.
 *
 * NO CHARTING DEPENDENCY, and the reasoning is measured rather than
 * nostalgic. Every console page is a server component today; every popular
 * charting library's chart is a client component, so adopting one turns each
 * charted desk into a client boundary and ships the desk's data twice, once
 * as HTML and once as the RSC payload for hydration. Our palette lives in CSS
 * custom properties and an SVG `stroke="var(--nf-brand-primary)"` follows a
 * retune of one with no JavaScript, while a canvas library has to resolve the
 * property in JS on the client, which is a flash of the wrong colour. (This
 * used to say "change under `[data-theme="light"]`" and cite a theme listener
 * per chart; light mode was removed on 23 September 2026, so the argument is
 * now about a token moving rather than a theme switching, and it is the same
 * argument.) And every one of
 * them ships a categorical default containing the four banned hues. This is
 * about 2KB and has none of those properties.
 *
 * ONE Y AXIS, EVER. There is no second series parameter and there is not
 * going to be one: two measures of different scale are two charts. That is
 * the single most common charting mistake and the cheapest way to not make it
 * is to build a component that cannot express it.
 *
 * NO LEGEND, and that is correct rather than an omission: identity is never
 * colour alone, and with one series the title names it. A legend box for one
 * series is furniture.
 *
 * THE CLEAN UNIFIED STYLE (29 September 2026, spec section 13): a 1.5px
 * brand line with no area fill, a dashed muted target line only where the
 * product keeps a promise, 4px points and a brand-tint band only on hover,
 * a dark tooltip in both themes, 11px muted axis labels, and no gridlines
 * but the baseline. Material: `.nf-ts` in `app/css/controls.css`.
 *
 * DETERMINISTIC GEOMETRY. Every number below is computed from the data, so
 * the server render and the client render are byte-identical and React has
 * nothing to reconcile.
 */

export type TimePoint = {
  /** An ISO day, `YYYY-MM-DD`. Read as a Lagos day and written as one ("18 Sept"). */
  day: string;
  count: number;
};

/*
 * THE DAY IS WRITTEN AS A DATE, NOT AS A KEY. The axis used to print the ISO
 * key itself, `2026-09-18`, which no other date on the console looks like and
 * which broke at its hyphen on a phone ("2026-09-" over "18"). Noon in Lagos,
 * so the day never moves across midnight in any time zone.
 */
function dayLabel(day: string, locale: Locale | undefined): string {
  const date = new Date(`${day}T12:00:00+01:00`);
  return Number.isNaN(date.getTime()) ? day : formatDate(date, locale, { day: "numeric", month: "short" });
}

export function TimeSeries({
  points,
  label,
  /** Said under the chart when the read behind it is capped. Honest or absent. */
  caveat,
  target,
  targetLabel,
  height = 180,
  className,
  locale,
}: {
  points: TimePoint[];
  /** Names the series. This is the legend. */
  label: string;
  caveat?: string;
  /**
   * A promise the product keeps (a response-time SLA, a review deadline),
   * drawn as a dashed muted line. Only where such a promise exists.
   */
  target?: number;
  /** Names the target line ("Reply within 24 h"). */
  targetLabel?: string;
  height?: number;
  className?: string;
  /** The reader's language, for the day labels. */
  locale?: Locale;
}) {
  /*
   * A CHART OF NOTHING SAYS NOTHING. With no points there is no line to draw
   * and an empty axis frame is a picture of data that does not exist, which
   * is the same defect as an invented trend with the sign reversed. The
   * caller owns the words; this owns the refusal to draw.
   */
  if (points.length === 0) return null;

  const w = 640;
  const h = height;
  const padX = 10;
  const padTop = 12;
  const padBottom = 8;

  const max = Math.max(...points.map((p) => p.count), typeof target === "number" ? target : 0, 1);
  const plotH = h - padTop - padBottom;
  const span = points.length > 1 ? points.length - 1 : 1;
  const xOf = (i: number) => padX + (points.length > 1 ? (i / span) * (w - padX * 2) : (w - padX * 2) / 2);
  const yOf = (v: number) => padTop + plotH - (v / max) * plotH;

  const pts = points.map((p, i) => [xOf(i), yOf(p.count)] as const);
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const floor = padTop + plotH;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const peak = points.reduce((a, b) => (b.count > a.count ? b : a), first);
  const colW = 100 / points.length;
  const say = (day: string) => dayLabel(day, locale);

  return (
    <figure className={["nf-ts", className ?? ""].filter(Boolean).join(" ")}>
      <div className="nf-ts__plot" style={{ maxHeight: h }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${label}. ${describe(points, say)}${typeof target === "number" && targetLabel ? ` ${targetLabel}.` : ""}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: "auto", maxHeight: h, display: "block" }}
        >
          {/* The baseline, the only rule: no gridlines. */}
          <line
            x1={padX}
            y1={floor}
            x2={w - padX}
            y2={floor}
            stroke={CHART_INK.axis}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {typeof target === "number" ? (
            <line
              x1={padX}
              y1={yOf(target)}
              x2={w - padX}
              y2={yOf(target)}
              stroke={CHART_CONTEXT}
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {/* 1.5px, drawn once from the left (plan item 26, `.nf-ts__line`
              in controls.css), there at once under reduced motion. */}
          <path
            d={line}
            fill="none"
            stroke={CHART_SERIES}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="nf-ts__line"
          />
        </svg>
        {/*
          THE HOVER IS CSS, SO THE CHART STAYS A SERVER COMPONENT. One column
          per point: on a fine pointer's hover it shows the brand-tint band,
          the 4px point and the dark tooltip (`--nf-surface-inverse`, 12px
          white, the same in both themes). Hidden from assistive tech: the
          figure's label already says the chart in a sentence. A tip in the
          outer quarter of the plot opens inwards from its column's edge, so
          the newest day's tip never runs off the card or the window.
        */}
        <div className="nf-ts__cols" aria-hidden="true">
          {points.map((p, i) => (
            <span
              key={p.day}
              className={`nf-ts__col${(i + 0.5) * colW < 25 ? " nf-ts__col--start" : (i + 0.5) * colW > 75 ? " nf-ts__col--end" : ""}`}
              style={{ left: `${i * colW}%`, width: `${colW}%` }}
            >
              <span
                className="nf-ts__dot"
                style={{ left: `${(xOf(i) / w) * 100 - i * colW}%`, top: `${(yOf(p.count) / h) * 100}%` }}
              />
              <span className="nf-ts__tip nf-numeric">
                {p.count} · {say(p.day)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/*
        THE LABELS ARE HTML AND NOT SVG TEXT, deliberately: the drawing is
        stretched to the card's width and would stretch its type with it.
        Two labels and a peak, never a number under every point.
      */}
      <figcaption className="nf-ts__axis">
        <span className="nf-numeric whitespace-nowrap">{say(first.day)}</span>
        <span>
          {label}
          {" · "}
          <span className="nf-numeric whitespace-nowrap text-[var(--nf-content-secondary)]">
            {peak.count} on {say(peak.day)}
          </span>
          {typeof target === "number" && targetLabel ? (
            <>
              {" · "}
              <span className="nf-ts__target-key">{targetLabel}</span>
            </>
          ) : null}
        </span>
        <span className="nf-numeric whitespace-nowrap">{say(last.day)}</span>
      </figcaption>

      {caveat ? (
        <p className="mt-2xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          {caveat}
        </p>
      ) : null}
    </figure>
  );
}

/** The chart in a sentence, for a reader who cannot see it. */
function describe(points: TimePoint[], say: (day: string) => string): string {
  const total = points.reduce((sum, p) => sum + p.count, 0);
  const peak = points.reduce((a, b) => (b.count > a.count ? b : a), points[0]!);
  return `${total} in total across ${points.length} days, most on ${say(peak.day)} with ${peak.count}.`;
}
