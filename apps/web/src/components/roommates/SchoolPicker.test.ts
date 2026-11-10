import { describe, expect, it } from "vitest";
import type { InstitutionRef } from "@/lib/features/roommates/model";
import { filterSchools, groupSchoolsByState } from "./SchoolPicker";

const s = (id: string, name: string, shortName: string | null, stateCode: string | null, city: string | null): InstitutionRef => ({ id, slug: id, name, shortName, kind: "university", stateCode, city });
const list = [s("a", "University of Lagos", "UNILAG", "LA", "Akoka"), s("b", "University of Ibadan", "UI", "OY", "Ibadan"), s("c", "Lagos State University", "LASU", "LA", "Ojo"), s("d", "Open School", null, null, null)];

describe("the school picker's list", () => {
  it("finds by short name and by city", () => {
    expect(filterSchools(list, "lasu").map((x) => x.id)).toEqual(["c"]);
    expect(filterSchools(list, "ibadan").map((x) => x.id)).toEqual(["b"]);
    expect(filterSchools(list, "zzz")).toEqual([]);
  });
  it("groups by state, schools A to Z inside, unplaced last", () => {
    const groups = groupSchoolsByState(list);
    expect(groups.at(-1)?.state).toBeNull();
    const lagos = groups.find((g) => g.items.some((x) => x.id === "a"));
    expect(lagos?.items.map((x) => x.id)).toEqual(["c", "a"]);
  });
});
