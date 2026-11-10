"use client";

import { useState } from "react";
import { formatMoney, type Dictionary } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { NairaField } from "@/components/ui/NairaField";
import { Segmented } from "@/components/ui/Segmented";
import { ArrivalChargesForm } from "@/components/stays/ArrivalChargesForm";
import { RENT_PERIOD_CHOICES, parseNairaToKobo, type RentPeriod } from "@/lib/agent/listings-model";
import type { ArrivalCharges } from "@/lib/stays/arrival-charges";
import { feedback } from "@/lib/ui/feedback";
import { fill } from "../../_copy";
import { Note, TenantPays } from "./parts";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";
import { RENT_CHARGE_KEYS, SALE_CHARGE_KEYS, percentOf, type ChargeKey } from "./model";

const W = WIZARD_WORDS.charges;

/** The door charges (V-57) as the page read them: undefined when the read failed. */
export type ArrivalState = {
  copy: Dictionary["afterTheGate"]["arrival"];
  existing: ArrivalCharges | null | undefined;
};

type Mode = { percent: boolean; share: string };

/**
 * CHARGES (R18.9, R33), the screen where the real number appears.
 *
 * A TENANCY: each charge a tenant meets at move-in is a CARD (amount, naira
 * or a percentage of the rent, and how often it is paid), and the headline is
 * the live sentence "A tenant pays to move in: N...". Every card fills one
 * column the draft already stores, so nothing new is saved and the breakdown
 * the searcher reads (`moveInLines`, via `TenantPays`) is the same model.
 * A percentage is a way of TYPING the figure: the box stores the naira it
 * comes to, which is what the listing shows.
 *
 * A SALE: the same cards for what a buyer pays on top, and the total to buy.
 *
 * A STAY: the charges at the door (V-57), declared here with the form the
 * listing's own page uses, so a lister meets the publish gate in the flow
 * rather than in a refusal email (LW-04).
 */
export function ChargesStep({
  ctx,
  listingId,
  arrival,
  agencyHint,
  legalHint,
}: {
  ctx: StepCtx;
  listingId: string | null;
  arrival?: ArrivalState;
  agencyHint?: string | null;
  legalHint?: string | null;
}) {
  const { values, set, copy, errors, mark, money, locale } = ctx;
  const sale = money.forSale;
  const keys: readonly ChargeKey[] = sale ? SALE_CHARGE_KEYS : RENT_CHARGE_KEYS;
  /* The cards the lister opened this visit; a card with a figure is always open. */
  const [opened, setOpened] = useState<ReadonlySet<ChargeKey>>(new Set());
  const [modes, setModes] = useState<Partial<Record<ChargeKey, Mode>>>({});

  if (money.shortStay) {
    if (!arrival) return <Note>{W.stayUnreadable}</Note>;
    if (!listingId) return <Note>{W.stayNeedsDraft}</Note>;
    if (arrival.existing === undefined) return <Note>{W.stayUnreadable}</Note>;
    return (
      <>
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">{arrival.copy.lede}</p>
        <ArrivalChargesForm target={{ listingId }} existing={arrival.existing} copy={arrival.copy} />
      </>
    );
  }

  const baseMinor = sale ? money.saleMinor : money.rentMinor;
  const shown = keys.filter((key) => values[key].trim() !== "" || opened.has(key));
  const closed = keys.filter((key) => !shown.includes(key));
  const hintFor = (key: ChargeKey) =>
    key === "agencyFeeNaira" ? (agencyHint ?? undefined) : key === "legalFeeNaira" ? (legalHint ?? undefined) : undefined;

  /* The live headline: the stated total wins, as on the listing page; else the parts. */
  const headlineMinor = sale
    ? money.purchaseMinor
    : (money.statedTotalMinor ?? money.partsSumMinor);
  const stated = sale ? money.statedPurchaseMinor !== null : money.statedTotalMinor !== null;

  return (
    <>
      {headlineMinor > 0 ? (
        <div className="nf-lw2-total" data-testid="charges-headline" aria-live="polite">
          <span className="nf-lw2-total__glyph" aria-hidden="true">
            <UiIcon name="coins" size={20} />
          </span>
          <span className="min-w-0">
            <span className="nf-lw2-total__figure">
              {fill(sale ? W.buyHeadline : W.moveInHeadline, { amount: formatMoney(headlineMinor, locale) })}
            </span>
            <span className="nf-lw2-total__basis">{stated ? W.moveInStated : sale ? W.buyBasis : W.moveInBasis}</span>
          </span>
        </div>
      ) : null}

      {shown.map((key) => {
        const name = W.names[key];
        const mode = modes[key] ?? { percent: false, share: "" };
        const percentWord = sale ? W.percentPrice : W.percentRent;
        const figure = values[key];
        return (
          <section key={key} className="nf-lw2-charge" data-testid={`charge-${key}`} aria-label={name}>
            <header className="nf-lw2-charge__head">
              <span className="nf-lw2-charge__name">
                {name}
                {mark(key)}
              </span>
              <button
                type="button"
                className="nf-lw2-charge__drop"
                aria-label={fill(W.remove, { name })}
                onClick={() => {
                  set(key, "");
                  setOpened((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                  setModes((prev) => ({ ...prev, [key]: undefined }));
                }}
              >
                <UiIcon name="close" size={16} />
              </button>
            </header>
            {baseMinor > 0 ? (
              <Segmented<"naira" | "percent">
                semantics="radio"
                size="sm"
                full
                label={fill("{name}: {how}", { name, how: W.amount })}
                value={mode.percent ? "percent" : "naira"}
                onChange={(v) => setModes((prev) => ({ ...prev, [key]: { percent: v === "percent", share: mode.share } }))}
                options={[
                  { value: "naira", label: W.naira },
                  { value: "percent", label: percentWord },
                ]}
              />
            ) : null}
            {mode.percent && baseMinor > 0 ? (
              <label className="block">
                <span className="nf-label">{percentWord}</span>
                <span className="nf-lw2-suffixed">
                  <input
                    className="nf-field nf-numeric"
                    inputMode="decimal"
                    value={mode.share}
                    onChange={(e) => {
                      const share = e.target.value.replace(/[^0-9.]/g, "").slice(0, 5);
                      setModes((prev) => ({ ...prev, [key]: { percent: true, share } }));
                      const naira = percentOf(baseMinor, share);
                      set(key, naira ?? "");
                    }}
                    placeholder="10"
                  />
                  <span className="nf-lw2-suffixed__unit" aria-hidden="true">
                    %
                  </span>
                </span>
                {figure.trim() !== "" ? (
                  <span className="nf-lw2-charge__line">{fill(W.percentLine, { amount: formatMoney(parseNairaToKobo(figure) ?? 0, locale) })}</span>
                ) : null}
              </label>
            ) : (
              <NairaField
                label={W.amount}
                value={figure}
                onValueChange={(v) => set(key, v)}
                allowKobo
                error={errors[key]}
                hint={hintFor(key)}
                data-testid={`charge-amount-${key}`}
              />
            )}
            {key === "serviceChargeNaira" ? (
              <div>
                <p className="nf-label mb-inline">{W.cadence}</p>
                <Segmented<RentPeriod>
                  semantics="radio"
                  size="sm"
                  full
                  label={fill("{name}: {how}", { name, how: W.cadence })}
                  value={values.serviceChargePeriod}
                  onChange={(v) => set("serviceChargePeriod", v)}
                  options={RENT_PERIOD_CHOICES.map((c) => ({
                    value: c.value,
                    label: c.value === "year" ? W.yearly : c.value === "quarter" ? W.quarterly : W.monthly,
                  }))}
                />
              </div>
            ) : (
              <p className="nf-lw2-charge__line">
                <span className="nf-lw2-charge__once">{W.once}</span> {sale ? W.onceSale : W.onceBody}
              </p>
            )}
          </section>
        );
      })}

      {closed.length > 0 ? (
        <div>
          <p className="nf-label mb-inline">{shown.length > 0 ? W.add : W.addFirst}</p>
          <div className="flex flex-wrap gap-inline" data-testid="charge-add">
            {closed.map((key) => (
              <button
                key={key}
                type="button"
                className="nf-chip min-h-11"
                onClick={() => {
                  feedback("select");
                  setOpened((prev) => new Set([...prev, key]));
                }}
              >
                <UiIcon name="plus" size={16} />
                {W.names[key]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {sale ? (
        <NairaField
          label={W.statedTotalSale}
          value={values.totalPurchaseNaira}
          onValueChange={(v) => set("totalPurchaseNaira", v)}
          allowKobo
          error={errors.totalPurchaseNaira}
          hint={
            money.statedPurchaseMinor === null
              ? money.purchasePartsMinor > 0
                ? `Leave blank and we show ${formatMoney(money.purchasePartsMinor, locale)}, which is the price plus the costs above.`
                : "The number a buyer has to find. Leave it blank and we add up the price and the costs above."
              : `${formatMoney(money.statedPurchaseMinor, locale)} all in. It has to be at least ${formatMoney(money.purchasePartsMinor, locale)}, which is the price plus the costs above.`
          }
        />
      ) : (
        <>
          <NairaField
            label={W.statedTotalRent}
            value={values.totalMoveInNaira}
            onValueChange={(v) => set("totalMoveInNaira", v)}
            allowKobo
            error={
              errors.totalMoveInNaira ??
              (ctx.remainderCopy && money.moveInRemainderMinor > 0
                ? fill(ctx.remainderCopy.gate, { amount: formatMoney(money.moveInRemainderMinor, locale) })
                : undefined)
            }
            hint={
              money.statedTotalMinor === null
                ? money.partsSumMinor > 0
                  ? `Leave blank and we show ${formatMoney(money.partsSumMinor, locale)}, which is what the rent and the charges come to.`
                  : "The one number people shop on. Leave it blank and we add up the rent and the charges."
                : `${formatMoney(money.statedTotalMinor, locale)} at the door. It has to be at least ${formatMoney(money.partsSumMinor, locale)}, which is what the rent and the charges come to.`
            }
            placeholder={money.partsSumMinor > 0 ? formatMoney(money.partsSumMinor, locale) : undefined}
            data-testid="charges-total"
          />
          {mark("totalMoveInNaira")}
          <div>
            <p className="nf-label">{copy.drawn.tenantPays.title}</p>
            <p className="nf-body-sm mb-row text-[var(--nf-content-secondary)]">{copy.drawn.tenantPays.lede}</p>
            <TenantPays
              facts={money.paysFacts}
              currency="NGN"
              locale={locale}
              copy={copy}
              moveInCopy={ctx.moveInCopy}
              moneyMap={ctx.moneyMapCopy}
            />
          </div>
          {money.statedTotalMinor !== null && money.statedTotalMinor > money.partsSumMinor ? (
            <Note>
              {fill(
                "You have stated {total} as the total to move in, which is {gap} more than the rent and the charges come to. A searcher sees your total, so name what the difference is for.",
                {
                  total: formatMoney(money.statedTotalMinor, locale),
                  gap: formatMoney(money.statedTotalMinor - money.partsSumMinor, locale),
                },
              )}
            </Note>
          ) : null}
        </>
      )}
    </>
  );
}
