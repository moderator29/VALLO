"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { ARRIVAL_KEYS, ARRIVAL_UNITS, type ArrivalCharges, type ArrivalKey, type ArrivalUnit } from "@/lib/stays/arrival-charges";
import { declareArrivalCharges } from "@/lib/stays/arrival-actions";
import { koboToNairaInput } from "@/lib/agent/listings-model";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

type Copy = Dictionary["afterTheGate"]["arrival"];
type Row = { mode: "none" | "amount" | null; naira: string; per: ArrivalUnit };
export type ArrivalRows = Record<ArrivalKey, Row>;

export function initialRows(existing: ArrivalCharges | null): ArrivalRows {
  return Object.fromEntries(
    ARRIVAL_KEYS.map((key) => {
      const answer = existing?.[key];
      if (!answer) return [key, { mode: null, naira: "", per: "stay" }];
      if ("none" in answer) return [key, { mode: "none", naira: "", per: "stay" }];
      return [key, { mode: "amount", naira: koboToNairaInput(answer.minor), per: answer.per }];
    }),
  ) as Record<ArrivalKey, Row>;
}

/**
 * V-57. Every charge a guest could be asked for at the door, answered one by
 * one: an amount with its unit, or none. The save is refused until all five
 * are answered, and so is publishing.
 */
export function ArrivalChargesForm({
  target,
  existing,
  copy,
}: {
  target: { listingId?: string; accommodationId?: string };
  existing: ArrivalCharges | null;
  copy: Copy;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() => initialRows(existing));
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = openKeys(rows);

  return (
    <form
      className="grid gap-md"
      data-testid="arrival-charges"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setNote(null);
        const answers = answersFrom(rows);
        start(async () => {
          try {
            const result = await declareArrivalCharges({
              listingId: target.listingId ?? null,
              accommodationId: target.accommodationId ?? null,
              answers,
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setNote(copy.saved);
            router.refresh();
          } catch (error) {
            if (!tapFailedOffline(error)) throw error;
          }
        });
      }}
    >
      <ArrivalChargesFields rows={rows} onRows={setRows} copy={copy} />
      {error && (
        <p className="nf-caption text-[var(--nf-state-error)]" role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className="nf-caption text-[var(--nf-state-success)]" role="status">
          {note}
        </p>
      )}
      <Button type="submit" variant="primary" full loading={pending} disabled={pending || open.length > 0}>
        {copy.save}
      </Button>
    </form>
  );
}

/** The keys still unanswered: no choice made, or an amount chosen and left blank. */
export function openKeys(rows: ArrivalRows): ArrivalKey[] {
  return ARRIVAL_KEYS.filter((key) => rows[key].mode === null || (rows[key].mode === "amount" && !rows[key].naira.trim()));
}

/** The rows as `declareArrivalCharges` takes them. */
export function answersFrom(rows: ArrivalRows): Record<string, unknown> {
  return Object.fromEntries(
    ARRIVAL_KEYS.map((key) => [key, rows[key].mode === "none" ? { none: true } : { naira: rows[key].naira, per: rows[key].per }]),
  );
}

/**
 * The five questions, controlled. Shared by the standalone form on
 * `/host/arrival` and the wizard's Extra charges step, which holds the rows in
 * the wizard so Back does not lose them.
 */
export function ArrivalChargesFields({
  rows,
  onRows,
  copy,
}: {
  rows: ArrivalRows;
  onRows: (update: (now: ArrivalRows) => ArrivalRows) => void;
  copy: Copy;
}) {
  const set = (key: ArrivalKey, patch: Partial<Row>) => onRows((now) => ({ ...now, [key]: { ...now[key], ...patch } }));
  const open = openKeys(rows);
  return (
    <>
      {ARRIVAL_KEYS.map((key) => (
        <fieldset key={key} className="nf-panel nf-panel--card grid gap-sm p-md">
          {/* Floated, so the legend is an ordinary row inside the card. A rendered
              legend sits ON the fieldset's border, and with the card's edge as that
              border the line ran straight through "Caution deposit". */}
          <legend className="float-left w-full nf-body-sm font-semibold">{copy.keys[key]}</legend>
          <div className="flex flex-wrap gap-sm">
            <label className="flex min-h-[44px] items-center gap-xs">
              <input type="radio" name={`${key}-mode`} checked={rows[key].mode === "none"} onChange={() => set(key, { mode: "none" })} />
              <span className="nf-body-sm">{copy.none}</span>
            </label>
            <label className="flex min-h-[44px] items-center gap-xs">
              <input type="radio" name={`${key}-mode`} checked={rows[key].mode === "amount"} onChange={() => set(key, { mode: "amount" })} />
              <span className="nf-body-sm">{copy.amount}</span>
            </label>
          </div>
          {rows[key].mode === "amount" && (
            <div className="grid grid-cols-2 gap-sm">
              <label className="grid gap-2xs">
                <span className="nf-caption">{copy.naira}</span>
                <input className="nf-field" inputMode="decimal" value={rows[key].naira} onChange={(e) => set(key, { naira: e.target.value })} />
              </label>
              <label className="grid gap-2xs">
                <span className="nf-caption">{copy.per}</span>
                <select className="nf-field" value={rows[key].per} onChange={(e) => set(key, { per: e.target.value as ArrivalUnit })}>
                  {ARRIVAL_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {copy.units[unit]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>
      ))}
      {open.length > 0 && (
        <p className="nf-caption">{copy.stillOpen.replace("{keys}", open.map((key) => copy.keys[key].toLowerCase()).join(", "))}</p>
      )}
    </>
  );
}
