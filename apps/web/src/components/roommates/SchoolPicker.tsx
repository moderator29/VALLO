"use client";

import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import type { InstitutionRef } from "@/lib/features/roommates/model";
import { feedback } from "@/lib/ui/feedback";

import { InstitutionLogo } from "./InstitutionLogo";
import { filterSchools, groupSchoolsByState } from "./school-list";

/**
 * THE "NEAR A SCHOOL" PICKER. A search field with its action inside the pill
 * (the clear control), the whole list grouped by state when the field is
 * empty, the school's logo and short name on every row, and the chosen school
 * as a chip with a remove control. The list scrolls inside a height that
 * leaves room for a phone keyboard.
 */
export function SchoolPicker({ schools, value, onChange, allowNone = false }: { schools: InstitutionRef[]; value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  const copy = useScopedCopy("roommates");
  const P = copy.area.schoolPicker;
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const chosen = schools.find((s) => s.id === value) ?? null;
  const groups = useMemo(() => groupSchoolsByState(filterSchools(schools, q)), [q, schools]);
  if (!schools.length) return <p className="nf-rm-panel__sub">{P.emptyList}</p>;
  return (
    <div className="nf-rmf-school" data-testid="school-picker">
      {chosen ? (
        <div className="nf-rmsp__chosen" data-testid="school-chosen">
          <InstitutionLogo name={chosen.name} logoUrl={chosen.logoUrl} size={32} />
          <span className="nf-rmsp__chosen-name">
            {chosen.shortName ?? chosen.name}
            <span className="nf-rmf-school__meta"> {[chosen.shortName ? chosen.name : null, chosen.city].filter(Boolean).join(" · ")}</span>
          </span>
          <Button variant="icon" round iconOnly size="sm" aria-label={fillName(P.remove, chosen.shortName ?? chosen.name)} onClick={() => onChange(null)} data-testid="school-remove">
            <UiIcon name="close" size={16} />
          </Button>
        </div>
      ) : null}
      <div className="nf-rmsp__search">
        <UiIcon name="search" size={18} />
        <input
          ref={input}
          className="nf-rmsp__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label={P.search}
          placeholder={P.search}
          value={q}
          maxLength={60}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <Button
            variant="icon"
            round
            iconOnly
            size="sm"
            aria-label={P.clear}
            onClick={() => {
              setQ("");
              input.current?.focus();
            }}
          >
            <UiIcon name="close" size={16} />
          </Button>
        ) : null}
      </div>
      {groups.length ? (
        <ul className="nf-rmsp__list" data-testid="school-list">
          {groups.map((g) => (
            <li key={g.state ?? "none"}>
              {g.state ? <div className="nf-rmsp__group">{fillState(P.stateHeading, g.state)}</div> : null}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {g.items.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="nf-rmsp__row"
                      aria-pressed={s.id === value}
                      onClick={() => {
                        feedback("select");
                        onChange(allowNone && s.id === value ? null : s.id);
                        setQ("");
                      }}
                    >
                      <InstitutionLogo name={s.name} logoUrl={s.logoUrl} size={36} />
                      <span className="nf-rmsp__words">
                        <span className="nf-rmsp__name">{s.shortName ?? s.name}</span>
                        <span className="nf-rmf-school__meta">{[s.shortName ? s.name : null, s.city].filter(Boolean).join(" · ")}</span>
                      </span>
                      <UiIcon name={s.id === value ? "check" : "plus"} size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nf-rm-panel__sub" data-testid="school-none">
          {P.noResults}
        </p>
      )}
    </div>
  );
}

const fillName = (template: string, name: string) => template.replace("{name}", name);
const fillState = (template: string, state: string) => template.replace("{state}", state);
