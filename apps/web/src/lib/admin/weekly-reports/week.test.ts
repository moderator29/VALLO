import { describe, expect, it } from "vitest";

import { addDays, dateLabel, formIsOpen, inWeek, isLateAt, isWeekStart, weekInfo, weekLabel, weekWindow } from "./week";

/**
 * THE WEEK, ON LAGOS TIME. Lagos is UTC+1 all year, so a Lagos wall clock of
 * 00:00 is 23:00 UTC the evening before. 9 November 2026 is a Monday.
 */
const at = (iso: string) => weekWindow(new Date(iso));

describe("weekWindow", () => {
  it("on a Friday reports the week that just ended, overdue, with the next one opening Saturday", () => {
    const w = at("2026-11-13T11:00:00Z"); // Friday 12:00 Lagos
    expect(w.weekStart).toBe("2026-11-02");
    expect(w.phase).toBe("overdue");
    expect(w.nextWeekStart).toBe("2026-11-09");
    expect(w.nextOpensAt).toBe("2026-11-13T23:00:00.000Z");
    expect(w.calendarWeekStart).toBe("2026-11-09");
  });

  it("opens exactly at Saturday 00:00 Lagos and not a millisecond before", () => {
    expect(at("2026-11-13T22:59:59.999Z").weekStart).toBe("2026-11-02");
    const open = at("2026-11-13T23:00:00.000Z");
    expect(open.weekStart).toBe("2026-11-09");
    expect(open.phase).toBe("open");
    expect(open.opensAt).toBe("2026-11-13T23:00:00.000Z");
    expect(open.nextWeekStart).toBe("2026-11-16");
  });

  it("stays on the same week through Sunday night", () => {
    const w = at("2026-11-15T22:59:59Z"); // Sunday 23:59:59 Lagos
    expect(w.weekStart).toBe("2026-11-09");
    expect(w.phase).toBe("open");
    expect(w.weekEnd).toBe("2026-11-15");
  });

  it("is open on Monday 11:59 and 12:00 sharp, and overdue from 12:01", () => {
    expect(at("2026-11-16T10:59:00Z").phase).toBe("open"); // 11:59 Lagos
    expect(at("2026-11-16T11:00:00Z").phase).toBe("open"); // 12:00 Lagos
    const late = at("2026-11-16T11:01:00Z"); // 12:01 Lagos
    expect(late.weekStart).toBe("2026-11-09");
    expect(late.phase).toBe("overdue");
    expect(late.dueAt).toBe("2026-11-16T11:00:00.000Z");
  });

  it("reads the Lagos day, not the UTC day, when the two disagree", () => {
    // Sunday 23:30 UTC is already Monday 00:30 in Lagos.
    const w = at("2026-11-15T23:30:00Z");
    expect(w.calendarWeekStart).toBe("2026-11-16");
    expect(w.weekStart).toBe("2026-11-09");
    expect(w.phase).toBe("open");
  });

  it("crosses the year boundary", () => {
    const w = at("2027-01-03T10:00:00Z"); // Sunday 3 January 2027
    expect(w.weekStart).toBe("2026-12-28");
    expect(w.weekEnd).toBe("2027-01-03");
    expect(w.dueAt).toBe("2027-01-04T11:00:00.000Z");
    expect(w.nextWeekStart).toBe("2027-01-04");
    // New Year's Day is a Friday: still the previous full week, overdue.
    const friday = at("2027-01-01T12:00:00Z");
    expect(friday.weekStart).toBe("2026-12-21");
    expect(friday.calendarWeekStart).toBe("2026-12-28");
    // 23:30 UTC on 31 December is already New Year in Lagos.
    expect(at("2026-12-31T23:30:00Z").weekStart).toBe("2026-12-21");
  });

  it("rejects an invalid date", () => {
    expect(() => weekWindow(new Date("nope"))).toThrow();
  });
});

describe("week helpers", () => {
  it("accepts only real Mondays", () => {
    expect(isWeekStart("2026-11-09")).toBe(true);
    expect(isWeekStart("2026-11-10")).toBe(false);
    expect(isWeekStart("2026-02-30")).toBe(false);
    expect(isWeekStart("not a date")).toBe(false);
    expect(isWeekStart(20261109)).toBe(false);
    expect(() => weekInfo("2026-11-10")).toThrow();
  });

  it("knows when the form is open and when a filing is late", () => {
    expect(formIsOpen("2026-11-09", new Date("2026-11-13T22:59:59Z"))).toBe(false);
    expect(formIsOpen("2026-11-09", new Date("2026-11-13T23:00:00Z"))).toBe(true);
    expect(formIsOpen("2026-11-09", new Date("2026-12-01T00:00:00Z"))).toBe(true);
    expect(isLateAt("2026-11-09", new Date("2026-11-16T11:00:00Z"))).toBe(false);
    expect(isLateAt("2026-11-09", new Date("2026-11-16T11:00:01Z"))).toBe(true);
  });

  it("holds an instant inside a week by Lagos time", () => {
    expect(inWeek("2026-11-09", "2026-11-08T23:00:00Z")).toBe(true); // Monday 00:00 Lagos
    expect(inWeek("2026-11-09", "2026-11-08T22:59:59Z")).toBe(false);
    expect(inWeek("2026-11-09", "2026-11-15T22:59:59Z")).toBe(true);
    expect(inWeek("2026-11-09", "2026-11-15T23:00:00Z")).toBe(false);
    expect(inWeek("2026-11-09", null)).toBe(false);
    expect(inWeek("2026-11-09", "garbage")).toBe(false);
  });

  it("prints dates the same way everywhere", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(dateLabel("2026-11-14")).toBe("Sat 14 Nov 2026");
    expect(weekLabel("2026-11-09")).toBe("9 Nov to 15 Nov 2026");
  });
});
