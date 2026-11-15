import { describe, expect, it } from "vitest";

import { MRZ_LINE_LENGTH, mrzCheckDigit, mrzDate, mrzFindings, normaliseMrzLine, parseMrz, plainDay, type MrzResult } from "./mrz";

const NOW = new Date("2026-11-15T12:00:00Z");

/* Published specimens. The first is the worked example in ICAO Doc 9303. */
const ICAO = ["P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10"] as const;
const UK = ["P<GBRUK<SPECIMEN<<ANGELA<ZOE".padEnd(44, "<"), "9250764733GBR8809117F2007162<<<<<<<<<<<<<<08"] as const;
const GERMAN = ["P<D<<MUSTERMANN<<ERIKA".padEnd(44, "<"), "C01X00T478D<<6408125F2702283<<<<<<<<<<<<<<<4"] as const;

/** An independent working of the digit, so the tests do not lean on the code under test. */
function digit(data: string): string {
  let total = 0;
  [...data].forEach((char, i) => {
    const value = char === "<" ? 0 : /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 55;
    total += value * [7, 3, 1][i % 3]!;
  });
  return String(total % 10);
}

/** A consistent zone built from parts, for a Nigerian passport that never existed. */
function build(parts: { number: string; birth: string; expiry: string; optional?: string; name?: string; state?: string; sex?: string }): [string, string] {
  const state = parts.state ?? "NGA";
  /* A name too long for its space is cut off, as a real passport does it. */
  const line1 = `P<${state}${parts.name ?? "OKEKE<<CHIDI<EMMANUEL"}`.padEnd(44, "<").slice(0, 44);
  const optional = (parts.optional ?? "").padEnd(14, "<");
  const number = parts.number.padEnd(9, "<");
  const head = `${number}${digit(number)}${state}${parts.birth}${digit(parts.birth)}${parts.sex ?? "M"}${parts.expiry}${digit(parts.expiry)}${optional}${digit(optional)}`;
  const composite = digit(head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 43));
  return [line1, head + composite];
}

function parsed(result: MrzResult) {
  if (result.state !== "parsed") throw new Error(`expected a parsed zone, got ${result.state}`);
  return result;
}

function swap(line: string, at: number, char: string): string {
  return line.slice(0, at) + char + line.slice(at + 1);
}

describe("the check digit", () => {
  it("works the published examples", () => {
    expect(mrzCheckDigit("L898902C3")).toBe(6);
    expect(mrzCheckDigit("740812")).toBe(2);
    expect(mrzCheckDigit("120415")).toBe(9);
    expect(mrzCheckDigit("ZE184226B<<<<<")).toBe(1);
    expect(mrzCheckDigit("<<<<<<<<<<<<<<")).toBe(0);
    expect(mrzCheckDigit("")).toBe(0);
  });

  it("refuses a character the zone never uses", () => {
    expect(mrzCheckDigit("12-45")).toBeNull();
    expect(mrzCheckDigit("abc")).toBeNull();
  });
});

describe("reading a passport's bottom lines", () => {
  it.each([
    ["the ICAO specimen", ICAO],
    ["the United Kingdom specimen", UK],
    ["the German specimen", GERMAN],
  ])("passes all five digits of %s", (_name, [line1, line2]) => {
    expect(line1).toHaveLength(MRZ_LINE_LENGTH);
    expect(line2).toHaveLength(MRZ_LINE_LENGTH);
    const result = parsed(parseMrz(line1, line2, NOW));
    expect(result.checks.map((c) => c.key)).toEqual(["document_number", "date_of_birth", "expiry", "optional_data", "composite"]);
    expect(result.checks.every((c) => c.pass)).toBe(true);
    expect(result.failed).toBe(0);
    expect(result.problems).toEqual([]);
  });

  it("reads out the name, the number, the nationality, the dates and the sex", () => {
    const { fields } = parsed(parseMrz(ICAO[0], ICAO[1], NOW));
    expect(fields).toEqual({
      documentType: "P",
      issuingState: "UTO",
      surname: "ERIKSSON",
      givenNames: "ANNA MARIA",
      nameTruncated: false,
      documentNumber: "L898902C3",
      nationality: "UTO",
      dateOfBirth: { raw: "740812", iso: "1974-08-12" },
      sex: "F",
      expiry: { raw: "120415", iso: "2012-04-15" },
      optionalData: "ZE184226B",
    });
    const german = parsed(parseMrz(GERMAN[0], GERMAN[1], NOW)).fields;
    expect(german.issuingState).toBe("D");
    expect(german.surname).toBe("MUSTERMANN");
    expect(german.givenNames).toBe("ERIKA");
    expect(german.optionalData).toBe("");
    const uk = parsed(parseMrz(UK[0], UK[1], NOW)).fields;
    expect(uk.surname).toBe("UK SPECIMEN");
    expect(uk.givenNames).toBe("ANGELA ZOE");
    expect(uk.dateOfBirth.iso).toBe("1988-09-11");
  });

  it("accepts a chevron in place of the optional data's digit only when that field is empty", () => {
    const empty = parsed(parseMrz(GERMAN[0], GERMAN[1], NOW));
    expect(empty.checks.find((c) => c.key === "optional_data")).toMatchObject({ found: "<", expected: "0", pass: true });
    /* The ICAO specimen's optional data is not empty, so a chevron there fails. */
    const bad = parsed(parseMrz(ICAO[0], swap(ICAO[1], 42, "<"), NOW));
    expect(bad.checks.find((c) => c.key === "optional_data")!.pass).toBe(false);
  });

  it("forgives the way people type: lower case, spaces, and other marks for a chevron", () => {
    const typed1 = "p<utoeriksson<<anna<maria" + " <".repeat(19);
    const typed2 = "L898902C3 6UTO 7408122 F 1204159 ZE184226B«««««10";
    expect(normaliseMrzLine(typed2)).toBe(ICAO[1]);
    expect(parsed(parseMrz(typed1, typed2, NOW)).failed).toBe(0);
  });

  it("judges nothing while a line is still being typed", () => {
    expect(parseMrz("", "", NOW)).toEqual({ state: "incomplete", line1Length: 0, line2Length: 0 });
    expect(parseMrz(ICAO[0], ICAO[1].slice(0, 30), NOW)).toEqual({ state: "incomplete", line1Length: 44, line2Length: 30 });
    expect(parseMrz(ICAO[0] + "<", ICAO[1], NOW).state).toBe("incomplete");
    expect(mrzFindings(parseMrz(ICAO[0], "", NOW))).toEqual([]);
  });

  it("says when two full lines are not a passport's zone at all", () => {
    const notPassport = parseMrz("I" + ICAO[0].slice(1), ICAO[1], NOW);
    expect(notPassport).toMatchObject({ state: "invalid" });
    const odd = parseMrz(swap(ICAO[0], 10, "*"), swap(ICAO[1], 30, "!"), NOW);
    expect(odd.state === "invalid" && odd.problems).toHaveLength(2);
    const [item] = mrzFindings(notPassport);
    expect(item).toMatchObject({ key: "mrz.digits", level: "look", title: "These are not a passport's bottom lines" });
  });
});

describe("a corrupted zone", () => {
  it("fails the date of birth digit and the composite when the birth year is changed", () => {
    /* 1974 made into 1994: the edit a person makes to look younger. */
    const result = parsed(parseMrz(ICAO[0], swap(ICAO[1], 13, "9"), NOW));
    expect(result.checks.filter((c) => !c.pass).map((c) => c.key)).toEqual(["date_of_birth", "composite"]);
    expect(result.failed).toBe(2);
  });

  it("fails the number digit when one character of the passport number is changed", () => {
    const result = parsed(parseMrz(ICAO[0], swap(ICAO[1], 3, "7"), NOW));
    expect(result.checks.filter((c) => !c.pass).map((c) => c.key)).toEqual(["document_number", "composite"]);
  });

  it("fails the expiry digit when the expiry year is pushed out", () => {
    const result = parsed(parseMrz(ICAO[0], swap(ICAO[1], 22, "9"), NOW));
    expect(result.checks.filter((c) => !c.pass).map((c) => c.key)).toEqual(["expiry", "composite"]);
  });

  it("fails only the composite when just the last digit is wrong", () => {
    const result = parsed(parseMrz(ICAO[0], swap(ICAO[1], 43, "7"), NOW));
    expect(result.checks.filter((c) => !c.pass).map((c) => c.key)).toEqual(["composite"]);
    expect(result.checks.find((c) => c.key === "composite")).toMatchObject({ expected: "0", found: "7" });
  });

  it("catches two neighbouring characters typed the wrong way round", () => {
    const line2 = ICAO[1].slice(0, 4) + ICAO[1][5] + ICAO[1][4] + ICAO[1].slice(6);
    expect(parsed(parseMrz(ICAO[0], line2, NOW)).failed).toBeGreaterThan(0);
  });

  it("catches every single-character change to the checked part of the specimen's second line", () => {
    /* Nationality (10 to 12) and sex (20) are under no digit. Each character
       is moved to the next one in value, which the 7-3-1 weights always catch. */
    const next = (char: string) => (char === "<" ? "1" : char === "9" ? "0" : char === "Z" ? "Y" : String.fromCharCode(char.charCodeAt(0) + 1));
    const covered = [...Array(44).keys()].filter((i) => !(i >= 10 && i <= 12) && i !== 20);
    for (const at of covered) {
      const result = parsed(parseMrz(ICAO[0], swap(ICAO[1], at, next(ICAO[1][at]!)), NOW));
      expect(result.failed, `position ${at}`).toBeGreaterThan(0);
    }
  });

  it("is not a perfect net: a change worth a multiple of ten slips through, which is why a pass is never proof", () => {
    /* Z is 35 and 5 is 5: thirty apart, so every weight gives the same last figure. */
    expect(ICAO[1][28]).toBe("Z");
    expect(parsed(parseMrz(ICAO[0], swap(ICAO[1], 28, "5"), NOW)).failed).toBe(0);
  });

  it("does not notice a changed name, which no digit covers: the name is compared by other means", () => {
    const result = parsed(parseMrz("P<UTOERIKSSON<<ANNA<MARTA".padEnd(44, "<"), ICAO[1], NOW));
    expect(result.failed).toBe(0);
    expect(result.fields.givenNames).toBe("ANNA MARTA");
  });

  it("reports a date that is not a date, and a sex that is not one, apart from the digits", () => {
    const [line1, line2] = build({ number: "A12345678", birth: "991340", expiry: "300230", sex: "Q" });
    const result = parsed(parseMrz(line1, line2, NOW));
    expect(result.failed).toBe(0);
    expect(result.fields.dateOfBirth.iso).toBeNull();
    expect(result.fields.expiry.iso).toBeNull();
    expect(result.problems).toEqual([
      "The date of birth in the zone is not a real date.",
      "The expiry date in the zone is not a real date.",
      "The sex character in the zone is not M, F or a chevron.",
    ]);
  });
});

describe("a Nigerian passport's zone", () => {
  it("reads a consistent one, and marks a very long name as cut short", () => {
    const [line1, line2] = build({ number: "A12345678", birth: "900215", expiry: "310214" });
    const result = parsed(parseMrz(line1, line2, NOW));
    expect(result.failed).toBe(0);
    expect(result.fields).toMatchObject({
      issuingState: "NGA",
      nationality: "NGA",
      surname: "OKEKE",
      givenNames: "CHIDI EMMANUEL",
      documentNumber: "A12345678",
      sex: "M",
      dateOfBirth: { iso: "1990-02-15" },
      expiry: { iso: "2031-02-14" },
      nameTruncated: false,
    });
    const long = build({ number: "A12345678", birth: "900215", expiry: "310214", name: "ADEBAYO<OGUNLESI<<OLUWATOBILOBA<EMMANUEL" });
    expect(long[0]).toHaveLength(44);
    expect(parsed(parseMrz(long[0], long[1], NOW)).fields.nameTruncated).toBe(true);
  });

  it("reads a sex left unstated as X", () => {
    const [line1, line2] = build({ number: "B00000001", birth: "850101", expiry: "290101", sex: "<" });
    expect(parsed(parseMrz(line1, line2, NOW)).fields.sex).toBe("X");
  });
});

describe("dates in the zone", () => {
  it("puts a birth year later than this year in the 1900s, and an expiry always in the 2000s", () => {
    expect(mrzDate("740812", "birth", NOW).iso).toBe("1974-08-12");
    expect(mrzDate("050301", "birth", NOW).iso).toBe("2005-03-01");
    expect(mrzDate("261115", "birth", NOW).iso).toBe("2026-11-15");
    expect(mrzDate("261116", "birth", NOW).iso).toBe("1926-11-16");
    expect(mrzDate("740812", "expiry", NOW).iso).toBe("2074-08-12");
  });

  it("knows the length of each month, leap years included", () => {
    expect(mrzDate("240229", "expiry", NOW).iso).toBe("2024-02-29");
    expect(mrzDate("250229", "expiry", NOW).iso).toBeNull();
    expect(mrzDate("250431", "expiry", NOW).iso).toBeNull();
    expect(mrzDate("251301", "expiry", NOW).iso).toBeNull();
    expect(mrzDate("250100", "expiry", NOW).iso).toBeNull();
    expect(mrzDate("2501<1", "expiry", NOW).iso).toBeNull();
  });

  it("writes a day in plain words", () => {
    expect(plainDay("1974-08-12")).toBe("12 August 1974");
    expect(plainDay("2031-02-04")).toBe("4 February 2031");
  });
});

describe("the zone's findings", () => {
  it("says all five pass, and that a pass is not proof", () => {
    const [item, ...rest] = mrzFindings(parseMrz(ICAO[0], ICAO[1], NOW));
    expect(rest).toEqual([]);
    expect(item).toMatchObject({ key: "mrz.digits", level: "ok", title: "Passport check digits: all 5 pass" });
    expect(item!.detail).toContain("not proof");
  });

  it("says how many fail, names them, and asks for a retype before an escalation", () => {
    const one = mrzFindings(parseMrz(ICAO[0], swap(ICAO[1], 43, "7"), NOW))[0]!;
    expect(one).toMatchObject({ level: "stop", title: "Passport check digits: 1 of 5 fails" });
    expect(one.detail).toContain("the whole second line");
    expect(one.detail).toContain("Type both lines again");
    const two = mrzFindings(parseMrz(ICAO[0], swap(ICAO[1], 13, "9"), NOW))[0]!;
    expect(two.title).toBe("Passport check digits: 2 of 5 fail");
    expect(two.detail).toContain("date of birth, the whole second line");
  });

  it("adds a second finding when something in the zone cannot be right", () => {
    const [line1, line2] = build({ number: "A12345678", birth: "991340", expiry: "310214" });
    const items = mrzFindings(parseMrz(line1, line2, NOW));
    expect(items.map((f) => [f.key, f.level])).toEqual([
      ["mrz.digits", "ok"],
      ["mrz.shape", "look"],
    ]);
  });
});
