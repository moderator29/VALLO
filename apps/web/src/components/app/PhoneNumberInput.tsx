"use client";

import { useId, useMemo } from "react";
import type { CountryCode } from "libphonenumber-js/mobile";
import { allCountries, callingCode, flagOf, maskInternational } from "@/lib/phone-intl";
import { TextField } from "@/components/ui/Field";

/**
 * A MOBILE NUMBER FROM ANY COUNTRY (2 November 2026).
 *
 * A country chooser and the number beside it. The chooser is the platform's
 * own native `<select>` (a phone shows its own wheel, a desktop its list, a
 * screen reader reads it as it reads any select), listing Nigeria and the
 * countries Vallo's people live in first, then the rest. The number groups as
 * it is typed in the chosen country's own style, a number pasted with a `+` is
 * read as written whatever country is chosen, and the server decides what is
 * valid (`lib/phone-intl.ts`, `lib/phone-otp/actions.ts`).
 *
 * This is the field for CONFIRMING a number. The Nigerian-only `PhoneField`
 * stays where the number is a Nigerian contact (a booking, an agent's line).
 */
export type PhoneNumberInputProps = {
  label: string;
  countryLabel: string;
  hint?: string;
  error?: string | null;
  country: CountryCode;
  onCountryChange: (next: CountryCode) => void;
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
};

export function PhoneNumberInput({
  label,
  countryLabel,
  hint,
  error,
  country,
  onCountryChange,
  value,
  onValueChange,
  disabled,
}: PhoneNumberInputProps) {
  const selectId = useId();
  const options = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      names = null;
    }
    return allCountries().map((code) => ({
      code,
      label: `${flagOf(code)} ${names?.of(code) ?? code} (+${callingCode(code)})`,
    }));
  }, []);

  return (
    <div className="grid gap-sm" data-testid="phone-number-input">
      <div>
        <label htmlFor={selectId} className="nf-label">
          {countryLabel}
        </label>
        <select
          id={selectId}
          className="nf-field mt-2xs w-full"
          value={country}
          disabled={disabled}
          onChange={(event) => onCountryChange(event.target.value as CountryCode)}
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <TextField
        label={label}
        hint={error ? undefined : hint}
        error={error ?? undefined}
        inputMode="tel"
        type="tel"
        autoComplete="tel-national"
        value={maskInternational(value, country)}
        onChange={(event) => onValueChange(event.target.value)}
        leadingIcon="phone"
        disabled={disabled}
      />
    </div>
  );
}
