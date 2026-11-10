"use client";

import { useId, useState } from "react";
import { formatMoney } from "@vallo/i18n/core";
import { parseNairaToKobo } from "@/lib/money/amount";
import {
  FEE_CALC,
  FEE_CALC_PROCESSING_SIGNED_OUT,
  FEE_CALC_RECEIVE_BEFORE_PROCESSING,
  FEE_CALC_RESTAURANT_NOTE,
  FEE_CALC_UNREADABLE,
  FEE_NEEDS_FIGURE,
  FEE_UNREADABLE_TITLE,
  LISTER_FIGURE_LABEL,
  PAYMENT_GATE_SENTENCE,
  PROCESSOR_FEE_LABEL,
  PROCESSOR_FEE_WHEN,
  listerBearsFeesSentence,
  renterSeesSentence,
  upToText,
  valloFeeLabel,
} from "@/lib/money/copy";
import { DocTable, type DocTableRow } from "@/components/docs/DocTable";
import { DocCallout } from "@/components/docs/DocArticle";
import { restaurantBill, stayResult, type FeeCalcConfig } from "./model";

type Kind = keyof typeof FEE_CALC.kinds;

const COLUMNS = [
  { key: "line", label: FEE_CALC.columns.line },
  { key: "amount", label: FEE_CALC.columns.amount, numeric: true },
  { key: "who", label: FEE_CALC.columns.who },
];

/**
 * THE FEE CALCULATOR (DOCS_AND_PRESENCE_UPGRADE.md 4.6; R98): the worked
 * example as a table the reader fills in. Line, amount, who receives it,
 * computed in `model.ts` from the rates the server read, so every figure is
 * the one the lister's fee screen and the payment split produce.
 *
 * Plain controls: three choice buttons, a naira field and a count, with the
 * table under them updating as the reader types (announced politely, once a
 * figure settles). Every word about money is a `lib/money/copy.ts` constant.
 */
export function FeeCalculator({ config }: { config: FeeCalcConfig }) {
  const id = useId();
  const [kind, setKind] = useState<Kind>("stay");
  const [price, setPrice] = useState("");
  const [nights, setNights] = useState("1");
  const [tables, setTables] = useState("10");

  const rates = kind === "stay" ? config.stay : kind === "hotel" ? config.hotel : null;
  const nightly = parseNairaToKobo(price);
  const nightsN = Number(nights);
  const tablesN = Number(tables);

  let body: React.ReactNode;
  if (kind === "restaurant") {
    const fee = config.restaurant?.seatedFeeMinor;
    const bill = fee === undefined ? null : restaurantBill(fee, tablesN);
    body =
      fee === undefined ? (
        <Unreadable />
      ) : (
        <>
          <Field id={`${id}-tables`} label={FEE_CALC.tables}>
            <input
              id={`${id}-tables`}
              className="nf-field"
              inputMode="numeric"
              value={tables}
              onChange={(e) => setTables(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            />
          </Field>
          {bill === null ? (
            <Needs text={FEE_NEEDS_FIGURE} />
          ) : (
            <Result
              caption={FEE_CALC.title}
              rows={[
                { id: "diner", cells: { line: FEE_CALC.dinerPays, amount: FEE_CALC.nothing, who: FEE_CALC.toRestaurant } },
                {
                  id: "bill",
                  cells: { line: `${FEE_CALC.restaurantBill} (${tablesN} × ${formatMoney(fee)})`, amount: formatMoney(bill), who: FEE_CALC.toVallo },
                },
              ]}
              notes={[FEE_CALC_RESTAURANT_NOTE]}
            />
          )}
        </>
      );
  } else if (!rates) {
    body = <Unreadable />;
  } else {
    const result = stayResult(rates, nightly, nightsN);
    body = (
      <>
        <div className="grid gap-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field id={`${id}-price`} label={LISTER_FIGURE_LABEL.stay}>
            <input
              id={`${id}-price`}
              className="nf-field"
              inputMode="decimal"
              placeholder="₦"
              value={price}
              onChange={(e) => setPrice(e.target.value.slice(0, 16))}
            />
          </Field>
          <Field id={`${id}-nights`} label={FEE_CALC.nights}>
            <input
              id={`${id}-nights`}
              className="nf-field"
              inputMode="numeric"
              value={nights}
              onChange={(e) => setNights(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            />
          </Field>
        </div>
        {result === null ? (
          <Needs text={FEE_NEEDS_FIGURE} />
        ) : (
          <Result
            caption={FEE_CALC.title}
            lead={`${FEE_CALC.guestPays}: ${formatMoney(result.totalMinor)}`}
            rows={[
              {
                id: "vallo",
                cells: {
                  line: valloFeeLabel(result.valloPercentText, result.valloCapped),
                  amount: formatMoney(result.valloMinor),
                  who: FEE_CALC.toVallo,
                },
              },
              ...(result.processorUpToMinor !== null
                ? [
                    {
                      id: "processor",
                      cells: {
                        line: `${PROCESSOR_FEE_LABEL}, ${PROCESSOR_FEE_WHEN}`,
                        amount: upToText(formatMoney(result.processorUpToMinor)),
                        who: FEE_CALC.toProcessor,
                      },
                    },
                  ]
                : []),
              {
                id: "host",
                cells: {
                  line: <strong>{result.processorUpToMinor !== null ? FEE_CALC.youReceive : FEE_CALC_RECEIVE_BEFORE_PROCESSING}</strong>,
                  amount: <strong>{formatMoney(result.receiveMinor)}</strong>,
                  who: FEE_CALC.toHost,
                },
              },
            ]}
            notes={[
              renterSeesSentence(formatMoney(result.totalMinor)),
              rates.processorKnown ? listerBearsFeesSentence(false, true) : FEE_CALC_PROCESSING_SIGNED_OUT,
            ]}
          />
        )}
      </>
    );
  }

  return (
    <section className="grid gap-md rounded-[var(--nf-radius-xl)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] p-md" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="font-[family-name:var(--nf-font-display)] text-[length:var(--nf-text-body-lg)] font-bold text-[var(--nf-content-primary)]">
        {FEE_CALC.title}
      </h3>
      <div role="group" aria-label={FEE_CALC.kindLabel} className="flex flex-wrap gap-xs">
        {(Object.keys(FEE_CALC.kinds) as Kind[]).map((k) => (
          <button key={k} type="button" className="nf-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {FEE_CALC.kinds[k]}
          </button>
        ))}
      </div>
      {body}
      <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">{PAYMENT_GATE_SENTENCE}</p>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2xs">
      <label htmlFor={id} className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Needs({ text }: { text: string }) {
  return (
    <p role="status" className="text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-secondary)]">
      {text}
    </p>
  );
}

function Unreadable() {
  return (
    <DocCallout tone="warning" title={FEE_UNREADABLE_TITLE}>
      {FEE_CALC_UNREADABLE}
    </DocCallout>
  );
}

function Result({ caption, lead, rows, notes }: { caption: string; lead?: string; rows: DocTableRow[]; notes: (string | null)[] }) {
  return (
    <div className="grid gap-sm" aria-live="polite">
      {lead ? <p className="text-[length:var(--nf-text-body)] font-semibold text-[var(--nf-content-primary)]">{lead}</p> : null}
      <DocTable caption={caption} captionHidden columns={COLUMNS} rows={rows} />
      {notes.filter(Boolean).map((note) => (
        <p key={note} className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
          {note}
        </p>
      ))}
    </div>
  );
}
