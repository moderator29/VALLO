import type { InstitutionRef } from "@/lib/features/roommates/model";

import { stateName } from "./states";

/** Rows for the list: searched on the name, short name, city, state and aliases. */
export function filterSchools(schools: InstitutionRef[], q: string): InstitutionRef[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return schools;
  return schools.filter((s) =>
    [s.name, s.shortName ?? "", s.city ?? "", stateName(s.stateCode) ?? "", ...(s.aliases ?? [])].some((part) => part.toLowerCase().includes(needle)),
  );
}

/** Grouped by state (named, A to Z), schools A to Z inside each; schools with no state last. */
export function groupSchoolsByState(schools: InstitutionRef[]): { state: string | null; items: InstitutionRef[] }[] {
  const by = new Map<string | null, InstitutionRef[]>();
  for (const s of schools) {
    const key = stateName(s.stateCode) ?? null;
    by.set(key, [...(by.get(key) ?? []), s]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([state, items]) => ({ state, items: [...items].sort((x, y) => x.name.localeCompare(y.name)) }));
}

