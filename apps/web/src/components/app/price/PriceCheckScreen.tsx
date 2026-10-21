"use client";

import "@/app/css/price-check.css";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, Section, Stack, TYPE } from "@/components/app/Screen";
import { coarsenPoint, withinNigeria } from "@/lib/price-check/address";
import { fetchAreaSuggestions, recordPriceCheckStage, watchThisSpot } from "@/lib/price-check/actions";
import type { PriceCheckResult } from "@/lib/price-check/gate";
import { REFUSALS } from "@/lib/price-check/refusals";
import type {
  AreaAskingRow,
  AreaCensus,
  AreaSuggestion,
  AreaUtilityFacts,
  Comparable,
  ListingIntent,
  PriceCheckPropertyType,
  RentPeriod,
} from "@/lib/price-check/types";
import { AreaReport, NeighbourhoodFacts } from "./AreaPanel";
import { AreaAskingChart, type AreaChartCopy } from "./AreaAskingChart";
import { PinMap } from "./PinMap";
import { ShareAreaButton } from "./ShareAreaButton";
import { NextActions } from "./NextActions";
import { shareAreaCopy } from "./share-copy";
import { AnsweredResult, ComparablesRail, Disclaimer, RefusalPanel, StripPlot } from "./ResultPanel";
import { useSignInHref } from "@/lib/auth/use-sign-in-href";

/**
 * PRICE CHECK, THE WHOLE SCREEN.
 *
 * ---------------------------------------------------------------------------
 * THE ANSWER IS COMPUTED ON THE SERVER AND THE FORM NAVIGATES TO IT.
 *
 * Every fact this screen shows comes down with the page: the verdict, the
 * census, the comparables, the area report, the facts panel. The form's submit
 * writes its state into the URL and the server renders the answer. That buys
 * three things worth more than a client fetch.
 *
 * The refusal is SERVER RENDERED, which matters because the refusal is the
 * product: a screen whose main content arrives after a spinner is a screen
 * that looks broken for the half second in which it is refusing.
 *
 * The state is in the URL, so a person can go back to their own check, and so
 * the whole screen is one server render rather than a waterfall.
 *
 * And THE PIN IN THE ADDRESS BAR IS ALREADY COARSENED to three decimal
 * places, about 110 metres. A URL gets pasted, and a pasted URL carrying a
 * precise point would be an address-bearing artefact by the back door, which
 * is the one thing the share rule exists to prevent. The gate runs on the
 * coarse point too, which costs at most 79 metres against a 750 metre first
 * rung.
 *
 * ---------------------------------------------------------------------------
 * AND THE FREE TEXT HINT NEVER ENTERS THE URL.
 *
 * "Anything else that helps, like the estate name or the nearest landmark" is
 * held in this component's own state and goes nowhere: not into the query
 * string, not into a server action, not into a table. No table in this feature
 * has a column for it.
 */

export type StateOption = { code: string; name: string };
export type LgaOption = { code: string; name: string };

export type PriceCheckScreenProps = {
  locale: Locale;
  t: Dictionary;
  states: StateOption[];
  lgas: LgaOption[];
  /** Everything the URL asked for, resolved on the server. */
  query: {
    stateCode: string;
    lgaCode: string | null;
    area: string | null;
    lat: number | null;
    lng: number | null;
    propertyType: PriceCheckPropertyType;
    intent: ListingIntent;
    rentPeriod: RentPeriod;
    bedrooms: number | null;
    sizeSqm: number | null;
  };
  /** Null until a pin has been dropped and the gate has been asked. */
  result: PriceCheckResult | null;
  comparables: Comparable[];
  areaRows: AreaAskingRow[] | null;
  /**
   * The server's seals over the cards this answer may mint (`share-seal.ts`):
   * one for the answered range, one per area row in `areaRows` order. A share
   * sends only the seal, so no figure on a card comes from this screen. Null
   * where this server could not seal (no service key); minting then fails
   * with its own line rather than a fake card.
   */
  shareSeals?: { answered: string | null; rows: (string | null)[] };
  areaCensus: AreaCensus | null;
  facts: AreaUtilityFacts | null;
  signedIn: boolean;
  /** Minted per page load on the server, so one check is one id. */
  checkId: string;
  /**
   * The area figure and chart's words (Session 3, W2), handed in from the
   * server because they live in `experienceDiscover` and this screen's
   * dictionary is the `priceCheck` slice. Without them the report has no chart.
   */
  chartCopy?: AreaChartCopy;
};

export function PriceCheckScreen(props: PriceCheckScreenProps) {
  const { locale, t, states, lgas, query, result, comparables, areaRows, areaCensus, facts } = props;
  const copy = t.priceCheck;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [stateCode, setStateCode] = useState(query.stateCode);
  const [lgaCode, setLgaCode] = useState(query.lgaCode ?? "");
  const [area, setArea] = useState(query.area ?? "");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    query.lat !== null && query.lng !== null ? { lat: query.lat, lng: query.lng } : null,
  );
  const [propertyType, setPropertyType] = useState<PriceCheckPropertyType>(query.propertyType);
  const [intent, setIntent] = useState<ListingIntent>(query.intent);
  const [rentPeriod, setRentPeriod] = useState<RentPeriod>(query.rentPeriod);
  const [bedrooms, setBedrooms] = useState(query.bedrooms === null ? "" : String(query.bedrooms));
  const [sizeSqm, setSizeSqm] = useState(query.sizeSqm === null ? "" : String(query.sizeSqm));
  /* Rung five. This state is the only place it ever exists. */
  const [hint, setHint] = useState("");

  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [watched, setWatched] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  /* -------------------------------------------------- instrumentation */

  /*
   * ONE ROW PER STAGE PER CHECK, AND NEVER TWICE.
   *
   * A refresh re-renders the answer, and a funnel that counted a refresh as a
   * second check would overstate the numerator of every conversion rate this
   * table exists to produce. The ref is keyed on the check id AND the stage,
   * so a back button that returns to the same check records nothing new.
   */
  const recorded = useRef<Set<string>>(new Set());
  const record = useCallback(
    (stage: "start" | "submit" | "outcome" | "supply", extra: Record<string, unknown> = {}) => {
      const key = `${props.checkId}:${stage}`;
      if (recorded.current.has(key)) return;
      recorded.current.add(key);
      void recordPriceCheckStage({
        checkId: props.checkId,
        stage,
        entryPoint: "standalone",
        stateCode: stateCode || undefined,
        lgaCode: lgaCode || undefined,
        /* The action computes the five character cell from this and keeps only
           the cell. The point itself is never written anywhere. */
        lat: point?.lat,
        lng: point?.lng,
        propertyType,
        listingIntent: intent,
        bedrooms: bedrooms === "" ? undefined : Number(bedrooms),
        sizeStated: sizeSqm !== "",
        ...extra,
      });
    },
    [props.checkId, stateCode, lgaCode, point, propertyType, intent, bedrooms, sizeSqm],
  );

  useEffect(() => {
    record("start");
  }, [record]);

  useEffect(() => {
    if (!result) return;
    /* An outage is not a funnel outcome. Recording it as one would put a
       refusal code beside a check nobody actually ran, and the refusal rate is
       the number this table exists to produce. */
    if (result.kind === "unreachable") return;
    if (result.kind === "answered") {
      record("outcome", {
        outcome: "answered",
        comparableCount: result.comparableCount,
        radiusM: result.radiusM,
        dispersion: result.dispersion,
        confidence: result.confidence,
      });
      return;
    }
    record("outcome", {
      outcome: "refused",
      refusalCode: result.code,
      comparableCount: result.comparableCount,
      radiusM: result.radiusM,
    });
    /* THE DEMAND SIGNAL. A refusal in a place we have nothing is the most
       useful row in this table: it says where to go and recruit supply, at a
       five kilometre cell and with no address attached to it. */
    if (REFUSALS[result.code].actions.includes("notifyMe")) {
      record("supply", { outcome: "refused", refusalCode: result.code });
    }
  }, [record, result]);

  /* ------------------------------------------------------ the typeahead */

  useEffect(() => {
    let cancelled = false;
    /* Everything, including the clear, happens inside the timer. A `setState`
       in the body of an effect triggers a cascading render, which
       `react-hooks/set-state-in-effect` exists to catch, and there is no
       reason for the empty-state clear to be the one exception. */
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (stateCode.length === 0) {
        setSuggestions([]);
        return;
      }
      void fetchAreaSuggestions({ stateCode, query: area }).then((answer) => {
        if (!cancelled && answer.ok) setSuggestions(answer.data);
      });
      /* 250 ms, so a person typing "Lekki" asks once rather than five times. */
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [stateCode, area]);

  /* ---------------------------------------------------------- the submit */

  const submit = useCallback(() => {
    record("submit");
    const params = new URLSearchParams();
    if (stateCode) params.set("state", stateCode);
    if (lgaCode) params.set("lga", lgaCode);
    if (area.trim()) params.set("area", area.trim());
    if (point) {
      /* COARSENED BEFORE IT REACHES THE ADDRESS BAR. See the header. */
      const coarse = coarsenPoint(point.lat, point.lng);
      params.set("lat", String(coarse.lat));
      params.set("lng", String(coarse.lng));
    }
    params.set("type", propertyType);
    params.set("intent", intent);
    if (intent === "rent") params.set("period", rentPeriod);
    if (bedrooms !== "") params.set("beds", bedrooms);
    if (sizeSqm !== "") params.set("size", sizeSqm);
    /* The hint is deliberately absent. */
    startTransition(() => router.push(`/price?${params.toString()}`));
  }, [record, stateCode, lgaCode, area, point, propertyType, intent, rentPeriod, bedrooms, sizeSqm, router]);

  const notifyMe = useCallback(() => {
    if (!point) return;
    setWatched("saving");
    void watchThisSpot({
      lat: point.lat,
      lng: point.lng,
      stateCode,
      lgaCode: lgaCode || undefined,
      area: area.trim() || undefined,
      propertyType,
      listingIntent: intent,
      bedrooms: bedrooms === "" ? null : Number(bedrooms),
    }).then((answer) => setWatched(answer.ok ? "saved" : "failed"));
  }, [point, stateCode, lgaCode, area, propertyType, intent, bedrooms]);

  const typeNames = useMemo<Record<string, string>>(
    () => ({
      apartment: copy.subject.apartment,
      home: copy.subject.home,
      shop: copy.subject.shop,
      office: copy.subject.office,
    }),
    [copy.subject],
  );

  const refusalCopy = useMemo(
    () => ({
      no_location: copy.refusals.noLocation,
      no_comparables: copy.refusals.noComparables,
      too_few_comparables: copy.refusals.tooFewComparables,
      too_few_sized: copy.refusals.tooFewSized,
      wide_dispersion: copy.refusals.wideDispersion,
      stale: copy.refusals.stale,
      unsupported_type: copy.refusals.unsupportedType,
      unsupported_period: copy.refusals.unsupportedPeriod,
      demo_only: copy.refusals.demoOnly,
    }),
    [copy.refusals],
  );

  const spec = result?.kind === "refused" ? REFUSALS[result.code] : null;

  const shareCopy = useMemo(() => shareAreaCopy(t), [t]);

  return (
    <Stack>
      {/* ------------------------------------------------- rung 1 to 5 */}
      <Section id="nf-pc-where" title={copy.ladder.heading}>
        <div className="nf-pc-ladder">
          <Rung index={1} done={stateCode.length > 0}>
            <SelectField
              label={copy.ladder.state}
              value={stateCode}
              onChange={(event) => {
                setStateCode(event.target.value);
                setLgaCode("");
              }}
            >
              <option value="">{copy.ladder.statePlaceholder}</option>
              {states.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </SelectField>
          </Rung>

          <Rung index={2} done={lgaCode.length > 0}>
            <SelectField
              label={copy.ladder.lga}
              hint={stateCode ? undefined : copy.ladder.lgaNeedsState}
              disabled={stateCode.length === 0}
              value={lgaCode}
              onChange={(event) => setLgaCode(event.target.value)}
            >
              <option value="">{copy.ladder.lgaPlaceholder}</option>
              {lgas.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </SelectField>
          </Rung>

          <Rung index={3} done={area.trim().length > 0}>
            <div className="nf-pc-suggest">
              <TextField
                label={copy.ladder.area}
                placeholder={copy.ladder.areaPlaceholder}
                hint={copy.ladder.areaHint}
                value={area}
                onChange={(event) => setArea(event.target.value)}
              />
              {suggestions.length > 0 && area.trim().length > 0 && (
                <div className="nf-pc-suggest__list">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.area}
                      type="button"
                      className="nf-pc-suggest__item nf-body-sm"
                      onClick={() => setArea(suggestion.area)}
                    >
                      <span>{suggestion.area}</span>
                      <span className="nf-pc-suggest__count">
                        {copy.ladder.areaSuggestionCount.replace(
                          "{count}",
                          String(suggestion.listingCount),
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Rung>

          <Rung index={4} done={point !== null}>
            <p className={TYPE.label}>{copy.ladder.pin}</p>
            <div className="mt-inline">
              <PinMap
                lat={point?.lat ?? null}
                lng={point?.lng ?? null}
                onMove={setPoint}
                copy={{
                  help: copy.ladder.pinHelp,
                  placed: copy.ladder.pinPlaced,
                  missing: copy.ladder.pinMissing,
                  outsideNigeria: copy.ladder.pinOutsideNigeria,
                  unavailable: copy.ladder.mapUnavailable,
                }}
              />
            </div>
          </Rung>

          <Rung index={5} done={hint.trim().length > 0}>
            <TextField
              label={copy.ladder.hint}
              placeholder={copy.ladder.hintPlaceholder}
              hint={copy.ladder.hintHelp}
              value={hint}
              onChange={(event) => setHint(event.target.value)}
            />
          </Rung>
        </div>
      </Section>

      {/* ---------------------------------------------------- the facts */}
      <Section title={copy.subject.heading}>
        <div className="flex flex-col gap-row">
          <Segmented
            label={copy.subject.type}
            value={propertyType}
            onChange={setPropertyType}
            semantics="radio"
            full
            options={[
              { value: "apartment", label: copy.subject.apartment },
              { value: "home", label: copy.subject.home },
              { value: "shop", label: copy.subject.shop },
              { value: "office", label: copy.subject.office },
            ]}
          />
          <Segmented
            label={copy.subject.intent}
            value={intent}
            onChange={setIntent}
            semantics="radio"
            full
            options={[
              { value: "rent", label: copy.subject.rent },
              { value: "sale", label: copy.subject.sale },
            ]}
          />
          {intent === "rent" && (
            <Segmented
              label={copy.subject.period}
              value={rentPeriod}
              onChange={setRentPeriod}
              semantics="radio"
              full
              options={[
                { value: "year", label: copy.subject.periodYear },
                { value: "quarter", label: copy.subject.periodQuarter },
                { value: "month", label: copy.subject.periodMonth },
              ]}
            />
          )}
          <TextField
            label={copy.subject.bedrooms}
            inputMode="numeric"
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value.replace(/\D/g, ""))}
          />
          <TextField
            label={copy.subject.size}
            hint={copy.subject.sizeHint}
            inputMode="decimal"
            value={sizeSqm}
            onChange={(event) => setSizeSqm(event.target.value.replace(/[^0-9.]/g, ""))}
          />
          <Button
            variant="primary"
            full
            glow
            loading={pending}
            onClick={submit}
            disabled={stateCode.length === 0}
          >
            {pending ? copy.subject.checking : copy.subject.submit}
          </Button>
        </div>
      </Section>

      {/* --------------------------------------------------- the answer */}
      {result !== null && (
        <Section>
          {result.kind === "unreachable" ? (
            /* NOT A REFUSAL. No refusal copy, no refusal icon, no next action
               and no notify me: there is nothing the reader can do about our
               outage and offering them something would be worse than saying
               so plainly. */
            <EmptyState
              icon="home-ring"
              art={false}
              title={copy.result.unreachableTitle}
              body={copy.result.unreachableBody}
              data-testid="nf-pc-unreachable"
            />
          ) : result.kind === "answered" ? (
            <>
              <AnsweredResult
                result={result}
                locale={locale}
                copy={copy.result}
                intent={intent}
              />
              {/*
                THE SHARE CONTROL SITS ON THE ANSWERED BRANCH AND ON NO OTHER.
                An image is a claim and a refusal has nothing to claim, so the
                refused branch below offers no card and the unreachable branch
                offers nothing at all. The discriminated union makes that
                structural rather than remembered: a refused result has no
                figures to hand the button.

                AND THE FIGURES CARRY THEIR OWN COUNT. `comparableCount` is the
                number of listings the range was built from, and the card
                prints it, so a forwarded artefact says what it rests on.
                NOTHING ABOUT THE SUBJECT GOES WITH IT: not the pin, not the
                area typed into rung three beyond its name, not the hint, which
                exists nowhere but this component's own state.
              */}
              {/* Track L: the share control is the third of three next steps
                  now, beside seeing the listings and setting an alert. */}
              <div className="mt-section-tight">
                <NextActions
                  facts={{
                    intent,
                    propertyType,
                    bedrooms: query.bedrooms,
                    area: area.trim() || null,
                    lgaName: lgas.find((option) => option.code === lgaCode)?.name ?? null,
                    stateName: states.find((option) => option.code === stateCode)?.name ?? null,
                  }}
                  copy={copy.next}
                  signedIn={props.signedIn}
                  share={
                    <ShareAreaButton
                      card={{ seal: props.shareSeals?.answered ?? null }}
                      copy={shareCopy}
                    />
                  }
                />
              </div>
              <div className="mt-section-tight">
                <ComparablesRail comparables={comparables} locale={locale} copy={copy.result} />
              </div>
            </>
          ) : (
            <>
              <RefusalPanel
                result={result}
                refusalCopy={refusalCopy}
                actions={
                  <RefusalActions
                    spec={spec}
                    copy={copy}
                    hasPoint={point !== null}
                    signedIn={props.signedIn}
                    watched={watched}
                    onNotify={notifyMe}
                    onAnnualRent={() => setRentPeriod("year")}
                  />
                }
              />
              {spec?.showsStripPlot && (
                <StripPlot
                  comparables={comparables}
                  locale={locale}
                  heading={copy.result.spreadHeading}
                />
              )}
              {spec?.showsComparables && (
                <ComparablesRail comparables={comparables} locale={locale} copy={copy.result} />
              )}
              {/* THE DISCLAIMER TRAVELS WITH THE REFUSAL TOO. A reader who was
                  told we will not give a figure still needs to know what we
                  would have been giving them, and that it is not the regulated
                  act. */}
              <Disclaimer />
            </>
          )}
        </Section>
      )}

      {/* ----------------------------------- what stage one actually is */}
      <div id="nf-pc-area">
        <AreaReport
          rows={areaRows}
          census={areaCensus}
          locale={locale}
          copy={copy.area}
          typeNames={typeNames}
          chart={
            props.chartCopy && areaRows && areaRows.length > 0 ? (
              <AreaAskingChart rows={areaRows} locale={locale} typeNames={typeNames} copy={props.chartCopy} />
            ) : null
          }
          renderShare={(row) => (
            <ShareAreaButton
              /*
               * THE AREA REPORT'S OWN FIGURES, WHICH ARE ITS QUARTILES AND
               * NOT THE GATE'S RANGE. They are a different claim: "the middle
               * half of what we hold here is asking between these two", built
               * from at least three listings rather than five, and the card
               * prints the count so the smaller claim stays the smaller claim.
               * `null` is the honest state where there are no rows at all,
               * which on this platform today is nearly everywhere. The figures
               * travel inside the server's seal for this row, built by
               * `cardFromAreaRow` on the page, never from this screen.
               */
              card={
                row === null
                  ? null
                  : { seal: props.shareSeals?.rows[areaRows?.indexOf(row) ?? -1] ?? null }
              }
              copy={shareCopy}
            />
          )}
        />
      </div>

      <NeighbourhoodFacts facts={facts} copy={copy.facts} />
    </Stack>
  );
}

/**
 * EVERY REFUSAL LEAVES THE READER SOMEWHERE TO GO, AND ONE OF THEM CANNOT YET.
 *
 * Eight of the nine next actions have a real destination on this screen: the
 * map rung, the area report below, the comparables already drawn, the notify
 * me, and the period control. They are anchors and handlers rather than links
 * to new routes, because the whole check is one page.
 *
 * `registeredFirm` IS THE ONE THAT HAS NONE, and it is skipped rather than
 * rendered dead. The next action for land is a hand-off to a registered estate
 * surveyor and valuer, and Vallo has no directory of them: an ESVARBON
 * register lookup is a conversation somebody has to have, not a component.
 * A button that goes nowhere is a dead end dressed as a way forward, which is
 * the exact thing `EmptyActions` was written to stop, so the refusal for land
 * offers the area report and says nothing it cannot keep. The hand-off is
 * recorded as outstanding rather than faked.
 */
function RefusalActions({
  spec,
  copy,
  hasPoint,
  signedIn,
  watched,
  onNotify,
  onAnnualRent,
}: {
  spec: (typeof REFUSALS)[keyof typeof REFUSALS] | null;
  copy: Dictionary["priceCheck"];
  hasPoint: boolean;
  signedIn: boolean;
  watched: "idle" | "saving" | "saved" | "failed";
  onNotify(): void;
  onAnnualRent(): void;
}) {
  const signInHref = useSignInHref();
  if (!spec) return null;

  const rendered: React.ReactNode[] = [];

  for (const action of spec.actions) {
    if (action === "notifyMe") {
      /* A watch needs a point to re-run the gate at. Without one the honest
         thing is to offer nothing rather than to save a watch on nowhere. */
      if (!hasPoint) continue;
      rendered.push(
        signedIn ? (
          <Button
            key="notify"
            variant={rendered.length === 0 ? "primary" : "ghost"}
            full
            onClick={onNotify}
            loading={watched === "saving"}
            disabled={watched === "saved"}
          >
            {watched === "saved" ? copy.notify.saved : copy.actions.notifyMe}
          </Button>
        ) : (
          <ButtonLink key="notify" href={signInHref} variant="ghost" full>
            {copy.actions.notifyMeSignedOut}
          </ButtonLink>
        ),
      );
      continue;
    }

    if (action === "dropPin") {
      rendered.push(
        <ButtonLink key={action} href="#nf-pc-where" variant={rendered.length === 0 ? "primary" : "ghost"} full>
          {copy.actions.dropPin}
        </ButtonLink>,
      );
      continue;
    }

    if (action === "areaReport" || action === "showNearby") {
      rendered.push(
        <ButtonLink
          key={action}
          href="#nf-pc-area"
          variant={rendered.length === 0 ? "primary" : "ghost"}
          full
        >
          {action === "areaReport" ? copy.actions.areaReport : copy.actions.showNearby}
        </ButtonLink>,
      );
      continue;
    }

    if (action === "changePeriod") {
      rendered.push(
        <Button
          key={action}
          variant={rendered.length === 0 ? "primary" : "ghost"}
          full
          onClick={onAnnualRent}
        >
          {copy.actions.changePeriod}
        </Button>,
      );
      continue;
    }

    /* `registeredFirm` falls through on purpose. See the header. */
  }

  if (rendered.length === 0) return null;

  return (
    <div className="flex w-full max-w-sm flex-col gap-row">
      {rendered}
      {watched === "failed" && (
        <p className="nf-body-sm text-[var(--nf-state-error)]">{copy.notify.failed}</p>
      )}
    </div>
  );
}

/** One rung, with its numeral, so a five field column reads as a ladder. */
function Rung({
  index,
  done,
  children,
}: {
  index: number;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`nf-pc-rung${done ? " nf-pc-rung--done" : ""}`}>
      <span className="nf-pc-rung__index nf-body-sm" aria-hidden="true">
        {index}
      </span>
      <div className="nf-pc-rung__body">{children}</div>
    </div>
  );
}

/** Exported for the preview harness, which needs the same bounds check. */
export { withinNigeria };
