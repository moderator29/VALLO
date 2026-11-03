"use client";

import { useId, useSyncExternalStore } from "react";
import { intlTag, type Dictionary, type Locale } from "@vallo/i18n/core";
import { NairaField } from "@/components/ui/NairaField";
import { affordability, incomeMinorFromNaira, type RentPeriodLike } from "@/lib/listings/affordability";

export type AffordabilityCopy = Dictionary["catalogue"]["affordability"];

/**
 * THE INCOME LINE on a tenancy listing (backlog row 26): the reader types
 * their monthly income and the page says what the rent and the move-in total
 * are against it, as two plain numbers and no verdict
 * (`lib/listings/affordability.ts`).
 *
 * The income is the reader's own and stays on this device (one local key, read
 * through a tiny external store so the server render and the first client
 * render agree); nothing is sent to Vallo. It draws nothing at all for a
 * listing with no rent to compare.
 */

const KEY = "vallo.income.v1";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value: string): void {
  try {
    if (value === "") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    /* Storage blocked: the figure lasts only until the page closes. */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function AffordabilityLine({
  rentMinor,
  period,
  moveInMinor,
  copy,
  locale,
}: {
  rentMinor: number;
  period: RentPeriodLike;
  moveInMinor: number | null;
  copy: AffordabilityCopy;
  locale: Locale;
}) {
  const typed = useSyncExternalStore(subscribe, read, () => "");
  const noteId = useId();
  if (!(rentMinor > 0)) return null;
  const result = affordability({ rentMinor, period, moveInMinor, incomeMinor: incomeMinorFromNaira(typed) });
  const tag = intlTag[locale];
  const share = result ? new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 }).format(result.rentShare) : null;
  const months =
    result && result.moveInMonths !== null
      ? new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(result.moveInMonths)
      : null;

  return (
    <section className="mt-md rounded-[var(--nf-radius-card)] border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] p-md" aria-labelledby={`${noteId}-t`} data-testid="detail-affordability">
      <h3 id={`${noteId}-t`} className="nf-h4">
        {copy.title}
      </h3>
      <NairaField
        label={copy.label}
        hint={copy.hint}
        value={typed.replace(/[^\d]/g, "")}
        onValueChange={(next) => write(next.replace(/[^\d]/g, ""))}
        data-testid="affordability-income"
      />
      {result && share ? (
        <ul className="mt-sm grid gap-2xs text-[length:var(--nf-text-body-sm)]" aria-describedby={noteId} data-testid="affordability-result">
          <li>{copy.rentShare.replace("{share}", share)}</li>
          {months ? <li>{copy.moveInMonths.replace("{months}", months)}</li> : null}
        </ul>
      ) : null}
      <p id={noteId} className="mt-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
        {copy.note}
      </p>
    </section>
  );
}
