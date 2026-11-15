import { describe, expect, it } from "vitest";

import { ageFinding, ageOn, expiryFinding, mrzAgreementFindings, nameFindings, type NamesOnRecord } from "./consistency";
import { parseMrz, type MrzFields } from "./mrz";

const NOW = new Date("2026-11-15T12:00:00Z");

const NONE: NamesOnRecord = { onId: null, account: null, application: null, bank: null, business: null };

function zone(line1: string, line2: string): MrzFields {
  const result = parseMrz(line1, line2, NOW);
  if (result.state !== "parsed") throw new Error("not parsed");
  return result.fields;
}

const ICAO = zone("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10");

describe("age from a date of birth", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("2008-11-15", NOW)).toBe(18);
    expect(ageOn("2008-11-16", NOW)).toBe(17);
    expect(ageOn("1974-08-12", NOW)).toBe(52);
    expect(ageOn("not a date", NOW)).toBeNull();
    expect(ageOn("1974-08-12", new Date("nonsense"))).toBeNull();
  });

  it("passes an adult, stops a minor, and doubts an impossible date", () => {
    expect(ageFinding("2008-11-15", NOW)).toMatchObject({ key: "age", level: "ok", title: "The date of birth gives an age of 18" });
    expect(ageFinding("2008-11-16", NOW)).toMatchObject({ level: "stop", title: "The date of birth gives an age of 17" });
    expect(ageFinding("1890-01-01", NOW)).toMatchObject({ level: "look", title: "The date of birth cannot be right" });
    expect(ageFinding("2030-01-01", NOW)).toMatchObject({ level: "look" });
    expect(ageFinding(null, NOW)).toBeNull();
    expect(ageFinding("12/08/1974", NOW)).toBeNull();
  });
});

describe("expiry", () => {
  it("says nothing when no expiry is known, as on a NIN slip", () => {
    expect(expiryFinding(null, NOW)).toBeNull();
    expect(expiryFinding("soon", NOW)).toBeNull();
  });

  it("is in date on its last day, and expired the day after", () => {
    expect(expiryFinding("2026-11-15", NOW)).toMatchObject({ key: "expiry", level: "ok", title: "The ID is in date until 15 November 2026" });
    expect(expiryFinding("2026-11-14", NOW)).toMatchObject({ level: "look", title: "The ID expired on 14 November 2026" });
    expect(expiryFinding("2012-04-15", NOW)!.level).toBe("look");
  });
});

describe("the names on record, side by side", () => {
  it("compares nothing when a side is missing", () => {
    expect(nameFindings(NONE)).toEqual([]);
    expect(nameFindings({ ...NONE, onId: "OKEKE CHIDI" })).toEqual([]);
    expect(nameFindings({ ...NONE, account: "Chidi Okeke", bank: "   " })).toEqual([]);
  });

  it("matches the ID with the account across order, a middle name and a title", () => {
    const items = nameFindings({ ...NONE, onId: "OKEKE CHIDI EMMANUEL", account: "Dr Chidi Okeke" });
    expect(items).toEqual([expect.objectContaining({ key: "names.id_account", level: "ok", title: "The name on the ID matches the account name" })]);
  });

  it("flags a different person's ID", () => {
    const [item] = nameFindings({ ...NONE, onId: "ADAOBI NWOSU", account: "Chidi Okeke" });
    expect(item).toMatchObject({ key: "names.id_account", level: "look", title: "The name on the ID differs from the account name" });
  });

  it("flags an account name and an application name that disagree, and is quiet when they agree", () => {
    expect(nameFindings({ ...NONE, account: "Chidi Okeke", application: "Okeke Chidi" })).toEqual([]);
    const [item] = nameFindings({ ...NONE, account: "Chidi Okeke", application: "Tolu Bello" });
    expect(item).toMatchObject({ key: "names.account_application", level: "look" });
  });

  it("compares the bank name with the ID first, then with the name on record", () => {
    const withId = nameFindings({ ...NONE, onId: "OKEKE CHIDI EMMANUEL", account: "Chidi Okeke", bank: "CHIDI E OKEKE" });
    expect(withId.find((f) => f.key === "names.bank")).toMatchObject({ level: "ok", title: "The bank account name matches the ID" });
    const noId = nameFindings({ ...NONE, account: "Chidi Okeke", bank: "OKEKE CHIDI" });
    expect(noId.find((f) => f.key === "names.bank")).toMatchObject({ level: "ok", title: "The bank account name matches the name on record" });
  });

  it("flags a bank account in another person's name", () => {
    const items = nameFindings({ ...NONE, onId: "OKEKE CHIDI", account: "Chidi Okeke", bank: "BELLO TOLU" });
    expect(items.find((f) => f.key === "names.bank")).toMatchObject({ level: "look", title: "The bank account name differs from the ID" });
  });

  it("accepts a business account in the registered business name", () => {
    const items = nameFindings({ ...NONE, onId: "OKEKE CHIDI", bank: "ACME PROPERTIES NIG LTD", business: "Acme Properties Limited" });
    expect(items.find((f) => f.key === "names.bank")).toMatchObject({ level: "ok", title: "The bank account is in the registered business name" });
    const other = nameFindings({ ...NONE, bank: "OTHER HOMES LTD", business: "Acme Properties Limited" });
    expect(other.find((f) => f.key === "names.bank")).toMatchObject({ level: "look" });
  });

  it("never repeats a name in its words", () => {
    const items = nameFindings({ onId: "OKEKE CHIDI", account: "Chidi Okeke", application: "Tolu Bello", bank: "BELLO TOLU", business: null });
    const words = items.map((f) => `${f.title} ${f.detail}`).join(" ");
    for (const name of ["OKEKE", "Chidi", "Bello", "TOLU"]) expect(words).not.toContain(name);
  });
});

describe("the passport's bottom lines against the record", () => {
  const names = { onId: null, account: null, application: null };

  it("matches the zone's name with each name the desk holds", () => {
    const items = mrzAgreementFindings({ mrz: ICAO, names: { onId: "ERIKSSON ANNA MARIA", account: "Anna Eriksson", application: null } }, NOW);
    expect(items.filter((f) => f.key.startsWith("mrz.name")).map((f) => [f.level, f.title])).toEqual([
      ["ok", "The name in the bottom lines matches the name typed from the ID"],
      ["ok", "The name in the bottom lines matches the account name"],
    ]);
  });

  it("flags a zone that names somebody else, and requires the zone's surname", () => {
    const other = mrzAgreementFindings({ mrz: ICAO, names: { ...names, account: "Chidi Okeke" } }, NOW);
    expect(other.find((f) => f.key === "mrz.name.1")).toMatchObject({ level: "look", title: "The name in the bottom lines differs from the account name" });
    /* Given names shared, surname not: a relative's passport. */
    const relative = mrzAgreementFindings({ mrz: ICAO, names: { ...names, account: "Anna Maria Svensson" } }, NOW);
    expect(relative.find((f) => f.key === "mrz.name.1")!.level).toBe("look");
  });

  it("explains a cut-short name instead of accusing it", () => {
    const long = zone(
      "P<NGAADEBAYO<OGUNLESI<<OLUWATOBILOBA<EMMANUE",
      "A123456784NGA9002150M3102147<<<<<<<<<<<<<<04",
    );
    expect(long.nameTruncated).toBe(true);
    const items = mrzAgreementFindings({ mrz: long, names: { ...names, account: "Oluwatobiloba Emmanuel Adebayo-Ogunlesi" } }, NOW);
    const name = items.find((f) => f.key === "mrz.name.1")!;
    /* EMMANUE is not EMMANUEL, so the matcher cannot be sure; the words say why. */
    expect(name.level).toBe("look");
    expect(name.detail).toContain("cut short");
  });

  it("gives the age and the expiry the zone itself carries", () => {
    const items = mrzAgreementFindings({ mrz: ICAO, names }, NOW);
    expect(items.map((f) => [f.key, f.level])).toEqual([
      ["age", "ok"],
      ["expiry", "look"],
    ]);
    expect(items[1]!.title).toBe("The ID expired on 15 April 2012");
  });

  it("compares dates and the passport number the desk holds from elsewhere", () => {
    const same = mrzAgreementFindings({ mrz: ICAO, names, dateOfBirth: "1974-08-12", expiry: "2012-04-15", documentNumber: "l898902c3" }, NOW);
    expect(same.filter((f) => ["mrz.birth", "mrz.expiry", "mrz.number"].includes(f.key)).map((f) => f.level)).toEqual(["ok", "ok", "ok"]);
    const differ = mrzAgreementFindings({ mrz: ICAO, names, dateOfBirth: "1994-08-12", expiry: "2032-04-15", documentNumber: "L898902C4" }, NOW);
    expect(differ.filter((f) => ["mrz.birth", "mrz.expiry", "mrz.number"].includes(f.key)).map((f) => [f.key, f.level])).toEqual([
      ["mrz.birth", "stop"],
      ["mrz.expiry", "look"],
      ["mrz.number", "stop"],
    ]);
  });

  it("stops a zone whose date of birth makes a minor", () => {
    const young = { ...ICAO, dateOfBirth: { raw: "100101", iso: "2010-01-01" } };
    expect(mrzAgreementFindings({ mrz: young, names }, NOW).find((f) => f.key === "age")!.level).toBe("stop");
  });
});
