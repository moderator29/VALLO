"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js/mobile";
import { maskNational, readPhone, type PhoneReading } from "@/lib/phone";
import {
  DEFAULT_COUNTRY,
  allCountries,
  callingCode,
  countryName,
  flagOf,
  formatInternational,
  isCountryCode,
  maskInternational,
  readInternational,
  splitInternational,
  type IntlReading,
} from "@/lib/phone-intl";
import { countOf, type Locale } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";

/**
 * A MOBILE NUMBER FIELD, NIGERIA FIRST AND EVERY COUNTRY AFTER IT
 * (2 November 2026).
 *
 * The shape every large product uses (WhatsApp, Airbnb, Revolut): one field,
 * with the country as a button at its start showing the flag and the calling
 * code, and the number beside it. Nigeria is the default. Tapping the country
 * opens a searchable list (the platform `Sheet`, a page on a phone and a panel
 * on a wide screen), Nigeria and the countries Vallo's people live in first.
 *
 * NIGERIA BEHAVES AS IT ALWAYS DID: the number groups as `803 123 4567` and
 * an unknown network range is still accepted (`lib/phone.ts` argues that out).
 * A good number gets no remark under it; only the hint, or a problem. Every other country groups in its
 * own style and is checked against Google's mobile ranges (`lib/phone-intl.ts`).
 *
 * A PASTE OR AN AUTOFILL OF `+44 7911 123456` switches the country to the
 * United Kingdom and keeps the number, instead of mangling it.
 *
 * THE VALUE. For Nigeria the value is the grouped national number, `803 123
 * 4567`, exactly as before, and the visible box carries `name`. For every
 * other country the value is the international form, `+44 7911 123456`: the
 * box shows only the national part and a hidden input carries `name` with the
 * full value. So every server path that already runs `normalisePhone(value)`
 * reads a foreign number correctly with no change, because a number written
 * with a plus is read by its own country. `<name>Country` is posted too.
 */

export type PhoneFieldProps = {
  /** Field name the FORM posts. `<name>Country` is posted beside it. */
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Controlled country; when omitted the field keeps its own, Nigeria first. */
  country?: string;
  onCountryChange?: (next: CountryCode) => void;
  /** A message from the server that outranks anything worked out here. */
  error?: string | undefined;
  /** Sentence under the field explaining what the number is used for. */
  hint?: string | undefined;
  required?: boolean;
  autoComplete?: string;
  id?: string;
  disabled?: boolean;
};

type Note = { tone: "muted" | "error"; text: string } | null;

function nigerianAdvice(reading: PhoneReading, locale: Locale): Note {
  switch (reading.state) {
    case "empty":
      return null;
    case "incomplete":
      /* Counting DOWN rather than up: "three more digits" is an instruction. */
      return { tone: "muted", text: countOf(10 - reading.digits, "digitsToGo", locale) };
    case "invalid":
      return { tone: "error", text: reading.reason };
    case "valid":
      /* A good number needs no remark: the hint stays (the founder, 2 November 2026). */
      return null;
  }
}

function foreignAdvice(reading: IntlReading, country: CountryCode): Note {
  const name = countryName(country);
  switch (reading.state) {
    case "empty":
      return null;
    case "incomplete":
      return { tone: "muted", text: `Keep going: a full mobile number in ${name}.` };
    case "invalid":
      return { tone: "error", text: `That is not a mobile number in ${name}. Check the digits, or change the country.` };
    case "valid":
      return null;
  }
}

export function PhoneField({
  name,
  label,
  value,
  onChange,
  country: controlledCountry,
  onCountryChange,
  error,
  hint,
  required,
  autoComplete = "tel",
  id,
  disabled,
}: PhoneFieldProps) {
  const locale = useClientLocale();
  const generated = useId();
  const fieldId = id ?? `${generated}-phone`;
  const noteId = `${fieldId}-note`;
  const [ownCountry, setOwnCountry] = useState<CountryCode>(() => splitInternational(value)?.country ?? DEFAULT_COUNTRY);
  const country: CountryCode = isCountryCode(controlledCountry) ? controlledCountry : ownCountry;
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const nigeria = country === "NG";
  const prefix = `+${callingCode(country)}`;
  /* The national part of a foreign value (`+44 7911 123456` is `7911 123456`). */
  const national = nigeria ? value : value.startsWith(prefix) ? value.slice(prefix.length).trim() : value.replace(/^\+\d*\s*/, "");

  const setCountry = (next: CountryCode) => {
    setOwnCountry(next);
    onCountryChange?.(next);
  };
  const emit = (target: CountryCode, typed: string) => {
    const digits = typed.trim();
    if (target === "NG") {
      onChange(maskNational(digits));
      return;
    }
    if (digits === "") {
      onChange("");
      return;
    }
    /* A complete number is stored in its clean international form (the trunk
       zero people type at home is dropped); a partial one as typed. */
    const reading = readInternational(digits, target);
    onChange(reading.state === "valid" ? formatInternational(reading.e164) : `+${callingCode(target)} ${digits}`);
  };

  const note = nigeria
    ? nigerianAdvice(readPhone(value), locale)
    : foreignAdvice(readInternational(national, country), country);
  /* The server's word beats ours: it has seen things this field has not. */
  const shown: Note = error ? { tone: "error", text: error } : note;
  const invalid = Boolean(error) || note?.tone === "error";

  const options = useMemo(
    () => allCountries().map((code) => ({ code, name: countryName(code), dial: `+${callingCode(code)}` })),
    [],
  );
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q) || o.dial.slice(1).startsWith(q) || o.code.toLowerCase() === q)
    : options;

  function change(raw: string) {
    /* A pasted or autofilled full international number picks its own country. */
    const split = splitInternational(raw);
    if (split && !raw.replace(/\D/g, "").startsWith("234")) {
      setCountry(split.country);
      emit(split.country, split.national);
      return;
    }
    emit(country, raw);
  }

  return (
    <div>
      <label htmlFor={fieldId} className="nf-label">
        {label}
      </label>
      {/* A grid, so the country button takes only its own width and the number
          box the rest, whatever width a screen's own field styles set. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-xs">
        <button
          type="button"
          className="nf-field flex items-center gap-2xs px-sm text-[var(--nf-content-primary)]"
          style={{ width: "auto", minWidth: "6.5rem" }}
          onClick={() => {
            setQuery("");
            setPicking(true);
          }}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-label={`Country: ${countryName(country)}, +${callingCode(country)}. Change the country`}
          data-testid="phone-country"
        >
          <span aria-hidden="true" className="text-[1.15em] leading-none">
            {flagOf(country)}
          </span>
          <span className="nf-numeric text-[var(--nf-content-secondary)]">+{callingCode(country)}</span>
          <UiIcon name="chevron-down" size={14} className="text-[var(--nf-content-muted)]" />
        </button>
        <input
          ref={input}
          id={fieldId}
          name={nigeria ? name : undefined}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          /* No maxLength (UX-12): a browser clips a paste before onChange. */
          value={nigeria ? maskNational(value) : (splitInternational(value)?.national ?? maskInternational(national, country))}
          onChange={(event) => change(event.target.value)}
          placeholder={nigeria ? "803 123 4567" : undefined}
          aria-describedby={noteId}
          aria-invalid={invalid ? true : undefined}
          required={required}
          disabled={disabled}
          className="nf-field min-w-0"
          style={{ width: "100%" }}
        />
        {!nigeria && <input type="hidden" name={name} value={value} />}
        <input type="hidden" name={`${name}Country`} value={country} />
      </div>

      <p
        id={noteId}
        role={shown?.tone === "error" ? "alert" : undefined}
        className={`mt-2xs text-[length:var(--nf-text-overline)] leading-relaxed ${
          shown?.tone === "error" ? "text-[var(--nf-state-error)]" : "text-[var(--nf-content-muted)]"
        }`}
      >
        {shown ? shown.text : (hint ?? "")}
      </p>

      <Sheet
        open={picking}
        onOpenChange={(next) => {
          setPicking(next);
          if (!next) window.setTimeout(() => input.current?.focus(), 0);
        }}
        title="Choose your country"
        closeLabel="Close"
        fullPage
        sideOnWide
        testId="phone-country-picker"
      >
        <div className="sticky top-0 z-20 -mx-gutter flex h-[4rem] items-center border-b border-[var(--nf-border-subtle)] bg-[var(--nf-panel-fill)] px-gutter">
          <TextField
            className="w-full"
            label="Search countries"
            hideLabel
            type="text"
            inputMode="search"
            enterKeyHint="search"
            leadingIcon="search"
            clearable="Clear the search"
            onClear={() => setQuery("")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by country or code"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="py-xl text-center text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            No country matches that. Try its name or its calling code.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--nf-border-subtle)] pt-xs" aria-label="Countries">
            {filtered.map((option) => {
              const active = option.code === country;
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setCountry(option.code);
                      emit(option.code, national);
                      setPicking(false);
                    }}
                    aria-pressed={active}
                    className="flex min-h-11 w-full items-center gap-sm py-sm text-left text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)]"
                  >
                    <span aria-hidden="true" className="text-[1.25em] leading-none">
                      {flagOf(option.code)}
                    </span>
                    <span className="min-w-0 flex-1">{option.name}</span>
                    <span className="nf-numeric text-[var(--nf-content-muted)]">{option.dial}</span>
                    {active && <UiIcon name="verified" size={16} className="shrink-0 text-[var(--nf-state-success)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
