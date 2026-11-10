import { describe, expect, it } from "vitest";

import { foldText, queryWords, searchSchools, type SearchableSchool } from "./school-search";

const S = (name: string, shortName: string | null, kind: string, stateCode: string, city: string | null, aliases: string[] = []): SearchableSchool => ({ name, shortName, kind, stateCode, city, aliases });

const SCHOOLS: SearchableSchool[] = [
  S("Obafemi Awolowo University", "OAU", "university", "OS", "Ile-Ife", ["OAU Ife", "Ife"]),
  S("Federal University of Technology, Akure", "FUTA", "university", "ON", "Akure", ["FUTA Akure"]),
  S("The Polytechnic, Ibadan", "Poly Ibadan", "polytechnic", "OY", "Ibadan", ["Ibadan Poly"]),
  S("University of Ibadan", "UI", "university", "OY", "Ibadan", ["Ibadan"]),
  S("University of Lagos", "UNILAG", "university", "LA", "Akoka, Yaba", ["Unilag Akoka"]),
  S("Lagos State University", "LASU", "university", "LA", "Ojo"),
  S("Yaba College of Technology", "YABATECH", "polytechnic", "LA", "Yaba"),
  S("Adeniran Ogunsanya College of Education", "AOCOED", "college", "LA", "Otto-Ijanikin"),
  S("Université Test Ibadan", null, "other", "OY", null),
];

const names = (r: SearchableSchool[]) => r.map((s) => s.name);

describe("foldText and queryWords", () => {
  it("ignores case, hyphens and accents", () => {
    expect(foldText("Ile-Ife")).toBe("ile ife");
    expect(foldText("  Université  ")).toBe("universite");
    expect(queryWords("OAU   Ife, ")).toEqual(["oau", "ife"]);
    expect(queryWords("")).toEqual([]);
    expect(queryWords(null)).toEqual([]);
  });
});

describe("searchSchools", () => {
  it("needs every word to match somewhere", () => {
    expect(names(searchSchools(SCHOOLS, { q: "OAU Ife" }))).toEqual(["Obafemi Awolowo University"]);
    expect(names(searchSchools(SCHOOLS, { q: "FUTA Akure" }))).toEqual(["Federal University of Technology, Akure"]);
    expect(names(searchSchools(SCHOOLS, { q: "oau akure" }))).toEqual([]);
  });

  it("matches the city and the town inside a hyphenated name", () => {
    expect(names(searchSchools(SCHOOLS, { q: "ile-ife" }))).toEqual(["Obafemi Awolowo University"]);
    expect(names(searchSchools(SCHOOLS, { q: "yaba" }))).toContain("Yaba College of Technology");
    expect(names(searchSchools(SCHOOLS, { q: "yaba" }))).toContain("University of Lagos");
  });

  it("matches an alias nobody wrote in the name", () => {
    expect(names(searchSchools(SCHOOLS, { q: "unilag akoka" }))).toEqual(["University of Lagos"]);
    expect(names(searchSchools(SCHOOLS, { q: "ibadan poly" }))[0]).toBe("The Polytechnic, Ibadan");
  });

  it("is accent insensitive", () => {
    expect(names(searchSchools(SCHOOLS, { q: "universite" }))).toEqual(["Université Test Ibadan"]);
    expect(names(searchSchools(SCHOOLS, { q: "Université" }))).toEqual(["Université Test Ibadan"]);
  });

  it("puts an exact short name first, then acronym prefixes, then the rest", () => {
    const r = names(searchSchools(SCHOOLS, { q: "ui" }));
    expect(r[0]).toBe("University of Ibadan");
    const lasu = names(searchSchools(SCHOOLS, { q: "las" }));
    expect(lasu[0]).toBe("Lagos State University");
    // 'ibadan' is an exact alias of University of Ibadan, so it leads the Ibadan schools.
    expect(names(searchSchools(SCHOOLS, { q: "ibadan" }))[0]).toBe("University of Ibadan");
  });

  it("ranks an acronym match above a name match for the same letters", () => {
    const list = [S("Faculty of Oauwa Studies", null, "university", "LA", null), S("Obafemi Awolowo University", "OAU", "university", "OS", "Ile-Ife")];
    expect(names(searchSchools(list, { q: "oau" }))[0]).toBe("Obafemi Awolowo University");
  });

  it("filters by state", () => {
    expect(searchSchools(SCHOOLS, { stateCode: "OY" }).every((s) => s.stateCode === "OY")).toBe(true);
    expect(names(searchSchools(SCHOOLS, { q: "ibadan", stateCode: "LA" }))).toEqual([]);
  });

  it("with no search text orders by kind then name, and caps", () => {
    const all = searchSchools(SCHOOLS, {});
    expect(all[0]!.kind).toBe("university");
    expect(all.map((s) => s.kind)).toEqual(["university", "university", "university", "university", "university", "polytechnic", "polytechnic", "college", "other"]);
    expect(names(all).slice(0, 5)).toEqual(["Federal University of Technology, Akure", "Lagos State University", "Obafemi Awolowo University", "University of Ibadan", "University of Lagos"]);
    expect(searchSchools(SCHOOLS, { limit: 3 })).toHaveLength(3);
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchSchools(SCHOOLS, { q: "zzzz" })).toEqual([]);
  });
});
