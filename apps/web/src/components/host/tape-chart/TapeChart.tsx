"use client";

import { useMemo, useState } from "react";
import { countOf, plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Chip } from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/app/Screen";
import { filterGroups, type TapeBar, type TapeCell, type TapeChart as Chart, type TapeFilter } from "@/lib/host/tape-chart";
import "./tape-chart.css";

/**
 * THE TAPE CHART, DRAWN (reference: a front-desk bookings page).
 *
 * Everything on it is a count from `buildTapeChart`; this file only lays it
 * out. A client component for one reason: the filter chips. The chips cut the
 * room types by tonight (vacant, occupied, due out), the only three states the
 * data supports. There is no Dirty or Out of order chip because nothing in the
 * database records either.
 *
 * Phone: the frame scrolls sideways on its own and the room column sticks.
 * Desktop: the 14 days fit.
 */

type Words = Dictionary["hostDash"]["tape"];

const FILTERS: TapeFilter[] = ["all", "vacant", "occupied", "dueOut"];

function tagOf(locale: Locale): string {
  return locale === "en" ? "en-NG" : locale;
}

export function TapeChart({
  chart,
  words,
  locale,
  truncated = 0,
  setupHref = "/host/rooms",
}: {
  chart: Chart;
  words: Words;
  locale: Locale;
  /** How many bookings were read, when the read hit its ceiling; 0 when it did not. */
  truncated?: number;
  setupHref?: string;
}) {
  const [filter, setFilter] = useState<TapeFilter>("all");
  const tag = tagOf(locale);

  const dayName = useMemo(() => new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }), [tag]);
  const dayNum = useMemo(() => new Intl.DateTimeFormat(tag, { day: "numeric", timeZone: "UTC" }), [tag]);
  const dayLong = useMemo(() => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }), [tag]);
  const at = (date: string) => new Date(`${date}T12:00:00Z`);

  if (chart.groups.length === 0) {
    return (
      <EmptyState
        icon="hotel-bed"
        title={words.emptyTitle}
        body={words.emptyBody}
        action={
          <ButtonLink href={setupHref} variant="secondary" size="lg">
            {words.emptyAction}
          </ButtonLink>
        }
      />
    );
  }

  const groups = filterGroups(chart.groups, filter);
  const hotels = new Set(chart.groups.map((g) => g.roomType.hotel));
  const several = hotels.size > 1;

  const barClass = (bar: TapeBar) =>
    [
      "nf-tape__bar",
      bar.status === "PENDING" ? "nf-tape__bar--request" : bar.inHouse && bar.status !== "COMPLETED" ? "nf-tape__bar--in" : "",
      bar.status === "COMPLETED" ? "nf-tape__bar--done" : "",
      bar.clippedStart ? "nf-tape__bar--cut-start" : "",
      bar.clippedEnd ? "nf-tape__bar--cut-end" : "",
    ]
      .filter(Boolean)
      .join(" ");

  const barLabel = (bar: TapeBar) => {
    const base = words.stay
      .replace("{guest}", bar.guestName ?? words.guest)
      .replace("{from}", dayLong.format(at(bar.checkIn)))
      .replace("{to}", dayLong.format(at(bar.checkOut)))
      .replace("{nights}", countOf(bar.nights, "nights", locale));
    return bar.status === "PENDING" ? `${base}, ${words.requestSuffix}` : base;
  };

  const cell = (c: TapeCell, i: number, key: string, total: number) => {
    const day = chart.days[i]!;
    const none = c.available === null;
    const label = none
      ? `${dayLong.format(at(c.date))}: ${words.notOnSale}`
      : `${dayLong.format(at(c.date))}: ${words.available} ${c.available}, ${words.occupancy} ${c.occupancyPct ?? 0}%` +
        ((c.blocked ?? 0) > 0 ? `, ${plural(c.blocked ?? 0, words.offSale, locale)}` : "");
    return (
      <div
        key={key}
        className={[
          "nf-tape__cell",
          day.weekend ? "nf-tape__cell--weekend" : "",
          day.today ? "nf-tape__cell--today" : "",
          !none && (c.blocked ?? 0) > 0 && c.open !== 0 ? "nf-tape__cell--off" : "",
          !none && c.open === 0 && total > 0 ? "nf-tape__cell--closed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* The cell's sentence was built and then never drawn, so a screen
            reader heard a bare number; it now hears the day, what is open
            and the occupancy, and the figures below are for the eye. */}
        <span className="sr-only">{label}</span>
        {none ? (
          <span className="nf-tape__cell-n nf-tape__cell-n--none" title={words.notOnSale} aria-hidden="true">
            {"–"}
          </span>
        ) : (
          <>
            <span className="nf-tape__cell-n" aria-hidden="true">{c.available}</span>
            <span className="nf-tape__cell-pct" aria-hidden="true">({c.occupancyPct ?? 0}%)</span>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="nf-tape" aria-label={words.title} data-testid="tape-chart">
      <div className="nf-tape__head">
        <div className="nf-tape__chips" role="group" aria-label={words.filtersLabel}>
          {FILTERS.map((key) => (
            <Chip
              key={key}
              behaviour="filter"
              size="sm"
              selected={filter === key}
              count={chart.counts[key]}
              disabled={key !== "all" && chart.counts[key] === 0 && filter !== key}
              onSelectedChange={(on) => setFilter(on || key === "all" ? key : "all")}
              data-testid={`tape-filter-${key}`}
            >
              {words.filters[key]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="nf-tape__frame" role="region" aria-label={words.frame} tabIndex={0}>
        <div className="nf-tape__grid">
          {/* The days. */}
          <div className="nf-tape__row nf-tape__row--head">
            <div className="nf-tape__room">
              <span className="nf-tape__room-label">{words.roomType}</span>
            </div>
            <div className="nf-tape__days">
              {chart.days.map((d) => (
                <div
                  key={d.date}
                  className={["nf-tape__day", d.weekend ? "nf-tape__day--weekend" : "", d.today ? "nf-tape__day--today" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="sr-only">{dayLong.format(at(d.date))}</span>
                  <span className="nf-tape__day-name" aria-hidden="true">{d.today ? words.today : dayName.format(at(d.date))}</span>
                  <span className="nf-tape__day-num" aria-hidden="true">{dayNum.format(at(d.date))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* All room types together, when there are several. */}
          {chart.groups.length > 1 && filter === "all" ? (
            <div className="nf-tape__row nf-tape__row--group nf-tape__row--total">
              <div className="nf-tape__room nf-tape__room--group">
                <span className="nf-tape__room-name">{words.allRooms}</span>
                <span className="nf-tape__room-sub">
                  {words.available} ({words.occupancy})
                </span>
              </div>
              <div className="nf-tape__days">
                {chart.totals.map((c, i) => cell(c, i, c.date, chart.tonight.total))}
              </div>
            </div>
          ) : null}

          {groups.length === 0 ? (
            <p className="nf-tape__hint" style={{ padding: "var(--nf-space-md)" }} role="status">
              {words.noMatch}
            </p>
          ) : null}

          {groups.map((group) => {
            const lanes = group.lanes.length > 0 ? group.lanes : [[]];
            return (
              <div key={group.roomType.id} data-testid="tape-group">
                <div className="nf-tape__row nf-tape__row--group">
                  <div className="nf-tape__room nf-tape__room--group">
                    <span className="nf-tape__room-name">{group.roomType.name}</span>
                    <span className="nf-tape__room-sub">
                      {several ? `${group.roomType.hotel} · ` : ""}
                      {countOf(group.roomType.unitsTotal, "rooms", locale)}
                    </span>
                  </div>
                  <div className="nf-tape__days">
                    {group.cells.map((c, i) => cell(c, i, c.date, group.roomType.unitsTotal))}
                  </div>
                </div>
                {lanes.map((lane, laneIndex) => (
                  <div key={laneIndex} className="nf-tape__row nf-tape__lane">
                    <div className="nf-tape__room" aria-hidden="true" />
                    <div className="nf-tape__days">
                      {chart.days.map((d, i) => (
                        <div
                          key={d.date}
                          role="presentation"
                          style={{ gridColumn: `${i * 2 + 1} / span 2` }}
                          className={[
                            "nf-tape__lane-bg",
                            d.weekend ? "nf-tape__lane-bg--weekend" : "",
                            d.today ? "nf-tape__lane-bg--today" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        />
                      ))}
                      {lane.map((bar) => (
                        <a
                          key={bar.id}
                          href={`#booking-${bar.id}`}
                          className={barClass(bar)}
                          style={{ gridColumn: `${bar.startLine} / ${bar.endLine}` }}
                          aria-label={barLabel(bar)}
                          title={barLabel(bar)}
                          data-testid="tape-bar"
                        >
                          <span className="nf-tape__bar-name">{bar.guestName ?? words.guest}</span>
                          {bar.rooms > 1 ? <span className="nf-tape__bar-n">{`×${bar.rooms}`}</span> : null}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="nf-tape__legend" aria-hidden="true">
        <span className="nf-tape__legend-item">
          <span className="nf-tape__swatch nf-tape__swatch--in" />
          {words.legendIn}
        </span>
        <span className="nf-tape__legend-item">
          <span className="nf-tape__swatch" />
          {words.legendStay}
        </span>
        <span className="nf-tape__legend-item">
          <span className="nf-tape__swatch nf-tape__swatch--request" />
          {words.legendRequest}
        </span>
        <span className="nf-tape__legend-item">
          <span className="nf-tape__swatch nf-tape__swatch--off" />
          {words.legendOffSale}
        </span>
      </div>
      <p className="nf-tape__hint">{words.scrollHint}</p>
      {truncated > 0 ? (
        <p className="nf-tape__hint" role="status">
          {plural(truncated, words.truncated, locale)}
        </p>
      ) : null}
    </section>
  );
}
