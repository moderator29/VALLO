"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { formatMoney, plural } from "@vallo/i18n/core";
import { postToGroup } from "@/lib/features/roommates/actions";
import { ROOMMATES_ROUTES, splitCosts, type Period, type SplitLine } from "@/lib/features/roommates/model";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { feedback } from "@/lib/ui/feedback";

import { Empty, fill } from "../groups/_parts/kit";
import { displayOf, koboOf, nairaDisplay } from "../groups/_parts/money";
import { useRun } from "../groups/_parts/use-run";

const LINES = ["rent", "deposit", "agency", "legal", "service", "electricity", "water", "internet", "other"] as const;
type LineKey = (typeof LINES)[number];
/** How each cost recurs. Rent takes the period the member picks; the rest are fixed by what they are. */
const PERIOD_OF: Record<Exclude<LineKey, "rent">, SplitLine["period"]> = {
  deposit: "once",
  agency: "once",
  legal: "once",
  service: "year",
  electricity: "month",
  water: "month",
  internet: "month",
  other: "once",
};

/**
 * THE COST SPLITTER'S ISLAND (FE-B): the lines, the people, equal or by room
 * size, and what each person pays to move in and every month. The result is
 * `splitCosts` from the model, so the shares always add up to the total.
 */
export function SplitCalculator({ initial, groups }: { initial: { rentMinor: number | null; period: Period; people: number }; groups: { id: string; name: string }[] }) {
  const R = useScopedCopy("roommates");
  const S = R.splitX;
  const locale = useClientLocale();
  const [values, setValues] = useState<Record<LineKey, string>>(() => ({
    rent: displayOf(initial.rentMinor),
    deposit: "",
    agency: "",
    legal: "",
    service: "",
    electricity: "",
    water: "",
    internet: "",
    other: "",
  }));
  const [rentPeriod, setRentPeriod] = useState<Period>(initial.period);
  const [people, setPeople] = useState(initial.people);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [weights, setWeights] = useState<number[]>(() => Array.from({ length: 8 }, () => 2));
  const [sharing, setSharing] = useState(false);
  const { pending, run } = useRun();

  const lines: SplitLine[] = useMemo(
    () =>
      LINES.map((key) => ({
        key,
        label: S.lineLabels[key],
        amountMinor: koboOf(values[key]) ?? 0,
        period: key === "rent" ? rentPeriod : PERIOD_OF[key],
      })).filter((l) => l.amountMinor > 0),
    [values, rentPeriod, S.lineLabels],
  );
  const used = mode === "equal" ? Array.from({ length: people }, () => 1) : weights.slice(0, people);
  const result = splitCosts(lines, used);
  const money = (minor: number) => formatMoney(minor, locale);
  const periodWord = (p: SplitLine["period"]) => (p === "once" ? S.once : p === "month" ? S.perMonth : S.perYear);
  const first = result.shares[0];
  const summary = fill(S.shareSummary, {
    people: plural(people, S.peopleCount, locale),
    upfront: money(first?.upfrontMinor ?? 0),
    monthly: money(first?.monthlyMinor ?? 0),
  });

  return (
    <div className="nf-rmb nf-rmg-split" data-testid="roommates-split">
      <div className="nf-rmb">
        <section className="nf-rmb-section" aria-labelledby="rm-split-lines">
          <h2 id="rm-split-lines" className="nf-rmb-section__title">
            {S.lines}
          </h2>
          <div className="nf-rmb-card grid gap-md">
            {LINES.map((key) => (
              <div key={key} className="nf-rms-line">
                <div className="nf-rmb-field">
                  <label htmlFor={`rm-split-${key}`}>{S.lineLabels[key]}</label>
                  <input
                    id={`rm-split-${key}`}
                    inputMode="numeric"
                    placeholder="0"
                    value={values[key]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: nairaDisplay(e.target.value) }))}
                  />
                </div>
                {key === "rent" ? (
                  <div className="nf-rmb-field">
                    <label htmlFor="rm-split-rent-period" className="sr-only">
                      {S.lineLabels.rent}
                    </label>
                    <select id="rm-split-rent-period" value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value === "month" ? "month" : "year")}>
                      <option value="year">{S.perYear}</option>
                      <option value="month">{S.perMonth}</option>
                    </select>
                  </div>
                ) : (
                  <span className="nf-rmb-field__hint pb-sm">{periodWord(PERIOD_OF[key])}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="nf-rmb-section" aria-labelledby="rm-split-people">
          <h2 id="rm-split-people" className="nf-rmb-section__title">
            {S.people}
          </h2>
          <div role="radiogroup" aria-labelledby="rm-split-people" className="nf-rms-people">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={people === n}
                className="nf-rmb-chip"
                onClick={() => {
                  feedback("select");
                  setPeople(n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <Segmented
            options={[
              { value: "equal", label: R.split.equal },
              { value: "custom", label: R.split.custom },
            ]}
            value={mode}
            onChange={setMode}
            semantics="radio"
            label={S.weight}
          />
          {mode === "custom" ? (
            <div className="nf-rmb-card grid gap-sm" data-testid="rm-split-weights">
              <p className="nf-rmb-field__hint">{S.weightHint}</p>
              {Array.from({ length: people }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-sm">
                  <span className="nf-rmb-row__title">{fill(S.person, { n: i + 1 })}</span>
                  <div className="nf-rms-stepper" role="group" aria-label={`${fill(S.person, { n: i + 1 })}, ${S.weight}`}>
                    <button
                      type="button"
                      className="nf-rmb-chip"
                      aria-label={S.less}
                      disabled={(weights[i] ?? 2) <= 1}
                      onClick={() => setWeights((w) => w.map((x, j) => (j === i ? Math.max(1, x - 1) : x)))}
                    >
                      -
                    </button>
                    <span className="nf-rms-stepper__value" aria-live="polite">
                      {weights[i] ?? 2}
                    </span>
                    <button
                      type="button"
                      className="nf-rmb-chip"
                      aria-label={S.more}
                      disabled={(weights[i] ?? 2) >= 5}
                      onClick={() => setWeights((w) => w.map((x, j) => (j === i ? Math.min(5, x + 1) : x)))}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="nf-rmb-section nf-rms-results" aria-labelledby="rm-split-results">
        <h2 id="rm-split-results" className="nf-rmb-section__title">
          {S.results}
        </h2>
        <dl className="nf-rmg-tiles">
          <div className="nf-rmg-tile">
            <dt>{S.upfront}</dt>
            <dd>{money(first?.upfrontMinor ?? 0)}</dd>
          </div>
          <div className="nf-rmg-tile">
            <dt>{S.monthly}</dt>
            <dd>{money(first?.monthlyMinor ?? 0)}</dd>
          </div>
        </dl>
        <ul className="nf-rmb-rows" data-testid="rm-split-shares">
          {result.shares.map((s) => (
            <li key={s.index} className="nf-rmb-row">
              <span className="nf-rmb-plate" aria-hidden="true">
                {s.index + 1}
              </span>
              <div className="nf-rmb-row__text">
                <p className="nf-rmb-row__title">{fill(S.person, { n: s.index + 1 })}</p>
                <p className="nf-rmb-row__line">{`${S.monthly}: ${money(s.monthlyMinor)}`}</p>
              </div>
              <span className="nf-rmb-row__amount">{money(s.upfrontMinor)}</span>
            </li>
          ))}
        </ul>
        <p className="nf-rmb-row__line">{`${S.total}: ${S.upfront} ${money(result.upfrontTotalMinor)} · ${S.monthly} ${money(result.monthlyTotalMinor)}`}</p>
        <p className="nf-rmb-note">{S.estimate}</p>
        <div className="nf-rmb-actions">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              setValues({ rent: "", deposit: "", agency: "", legal: "", service: "", electricity: "", water: "", internet: "", other: "" });
              setMode("equal");
            }}
          >
            {S.reset}
          </Button>
          <Button variant="primary" size="sm" leadingIcon="share" disabled={lines.length === 0} onClick={() => setSharing(true)} data-testid="rm-split-share">
            {S.share}
          </Button>
        </div>
      </section>

      <Sheet open={sharing} onOpenChange={setSharing} title={S.shareTitle} detents={[0.7]} testId="rm-split-share-sheet">
        <div className="grid gap-sm">
          <p className="nf-rmh-invite__note">{summary}</p>
          {groups.length === 0 ? (
            <Empty href={ROOMMATES_ROUTES.groups} label={R.groupsX.start}>
              {S.noGroups}
            </Empty>
          ) : (
            <ul className="nf-rmb-rows">
              {groups.map((g) => (
                <li key={g.id} className="nf-rmb-row">
                  <span />
                  <p className="nf-rmb-row__title">{g.name}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={pending}
                    onClick={() =>
                      run(() => postToGroup({ groupId: g.id, body: summary }), {
                        success: fill(S.shared, { group: g.name }),
                        refresh: false,
                        onOk: () => setSharing(false),
                      })
                    }
                  >
                    {S.shareSend}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  );
}
