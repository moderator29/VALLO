"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import type { InstitutionRef } from "@/lib/features/roommates/model";
import { feedback } from "@/lib/ui/feedback";

import { stateName } from "./states";

/** The school list, searched on the device (the page hands over the live list). */
export function SchoolPicker({ schools, value, onChange, allowNone = false }: { schools: InstitutionRef[]; value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  const copy = useScopedCopy("roommates");
  const O = copy.ui.onboarding;
  const [q, setQ] = useState("");
  const chosen = schools.find((s) => s.id === value) ?? null;
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return schools.filter((s) => s.name.toLowerCase().includes(needle) || (s.shortName ?? "").toLowerCase().includes(needle) || (s.city ?? "").toLowerCase().includes(needle)).slice(0, 8);
  }, [q, schools]);
  if (!schools.length) return null;
  return (
    <div className="nf-rmf-school">
      {chosen ? (
        <div className="nf-rmf-school__chosen">
          <span className="nf-rm-plate" aria-hidden="true">
            <UiIcon name="id-card" size={18} />
          </span>
          <span className="nf-rmf-school__name">
            {chosen.name}
            <span className="nf-rmf-school__meta">{[chosen.shortName, chosen.city, stateName(chosen.stateCode)].filter(Boolean).join(" · ")}</span>
          </span>
          <Button variant="quiet" size="sm" onClick={() => onChange(null)}>
            {allowNone ? copy.ui.create.noSchool : copy.ui.onboarding.edit}
          </Button>
        </div>
      ) : null}
      <TextField label={O.schoolSearch} type="search" leadingIcon="search" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      {q.trim() ? (
        matches.length ? (
          <ul className="nf-rmv-picklist">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="nf-rmv-pick"
                  aria-pressed={s.id === value}
                  onClick={() => {
                    feedback("select");
                    onChange(s.id);
                    setQ("");
                  }}
                >
                  <span className="nf-rmv-pick__name">
                    {s.name}
                    <span className="nf-rmf-school__meta">{[s.shortName, s.city].filter(Boolean).join(" · ")}</span>
                  </span>
                  <UiIcon name={s.id === value ? "check" : "plus"} size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="nf-rm-panel__sub">{O.schoolNone}</p>
        )
      ) : null}
    </div>
  );
}

