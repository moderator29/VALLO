"use client";

import { useMemo, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { POPULAR_COUNTRIES } from "./kyc";
import { COUNTRY_CODES, countryName, flagOf, matchesCountry } from "./countries";

/**
 * "WHICH COUNTRY ISSUED YOUR ID?" (Grade 1, P0.3; reference R36). A search
 * field, POPULAR (Nigeria, then Ghana) and ALL COUNTRIES, each row a flag, the
 * name and the code, the chosen one ticked. One tap chooses; Continue moves on.
 */
export function CountryPicker({
  value,
  onChange,
  words,
}: {
  value: string | null;
  onChange: (code: string) => void;
  words: { search: string; popular: string; all: string; none: string };
}) {
  const [query, setQuery] = useState("");
  const all = useMemo(
    () => [...COUNTRY_CODES].sort((a, b) => countryName(a).localeCompare(countryName(b))),
    [],
  );
  const searching = query.trim().length > 0;
  const shown = all.filter((code) => matchesCountry(code, query));

  const row = (code: string) => (
    <li key={code}>
      <button
        type="button"
        className="nf-g1-country"
        aria-pressed={value === code}
        onClick={() => onChange(code)}
        data-testid={`country-${code}`}
      >
        <span className="nf-g1-country__flag" aria-hidden="true">
          {flagOf(code)}
        </span>
        <span className="nf-g1-country__name">{countryName(code)}</span>
        {value === code ? (
          <span className="nf-g1-country__tick" aria-hidden="true">
            <UiIcon name="check" size={14} />
          </span>
        ) : (
          <span className="nf-g1-country__code">{code}</span>
        )}
      </button>
    </li>
  );

  return (
    <div className="nf-g1-countries">
      <label className="nf-g1-search">
        <UiIcon name="search" size={20} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={words.search}
          aria-label={words.search}
          enterKeyHint="search"
          autoComplete="off"
        />
      </label>
      <div className="nf-g1-countries__list">
        {!searching ? (
          <>
            <p className="nf-g1-countries__group">{words.popular}</p>
            <ul>{POPULAR_COUNTRIES.map(row)}</ul>
            <p className="nf-g1-countries__group">{words.all}</p>
          </>
        ) : null}
        <ul>{(searching ? shown : all).map(row)}</ul>
        {searching && shown.length === 0 ? <p className="nf-g1-countries__none">{words.none}</p> : null}
      </div>
    </div>
  );
}
