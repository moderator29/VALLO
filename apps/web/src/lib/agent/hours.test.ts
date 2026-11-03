import { describe, expect, it } from "vitest";
import { hoursLine, readSchedule } from "./hours";

describe("agent hours", () => {
  it("joins consecutive days with the same hours into one run", () => {
    const week = { open: "09:00", close: "18:00" };
    const line = hoursLine({ mon: week, tue: week, wed: week, thu: week, fri: week, sat: { open: "10:00", close: "14:00" } });
    expect(line).toBe("Mon to Fri, 9:00 to 18:00. Sat, 10:00 to 14:00.");
  });

  it("draws nothing for an empty week and drops a bad day", () => {
    expect(hoursLine({})).toBeNull();
    expect(readSchedule({ mon: { open: "18:00", close: "09:00" }, tue: { open: "9am", close: "5pm" }, wed: null })).toEqual({});
    expect(readSchedule("nope")).toEqual({});
  });

  it("keeps a day apart when the days between are off", () => {
    const h = { open: "08:00", close: "12:00" };
    expect(hoursLine({ mon: h, wed: h })).toBe("Mon, 8:00 to 12:00. Wed, 8:00 to 12:00.");
  });
});
