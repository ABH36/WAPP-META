import { describe, it, expect } from "vitest";
import { getCalendarDays, getCalendarRange, isSameDay, toDateInputValue } from "./calendar-range";

describe("getCalendarRange", () => {
  it("returns the same single day for day view", () => {
    const anchor = new Date(2026, 7, 12); // Wed 12 Aug 2026
    const { start, end } = getCalendarRange("day", anchor);
    expect(isSameDay(start, anchor)).toBe(true);
    expect(isSameDay(end, anchor)).toBe(true);
  });

  it("returns Sun-Sat for week view", () => {
    const anchor = new Date(2026, 7, 12); // Wednesday
    const { start, end } = getCalendarRange("week", anchor);
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(start.getDate()).toBe(9); // Sunday 9 Aug 2026
    expect(end.getDate()).toBe(15); // Saturday 15 Aug 2026
  });

  it("pads month view out to full weeks", () => {
    const anchor = new Date(2026, 7, 12); // August 2026
    const { start, end } = getCalendarRange("month", anchor);
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(start.getTime()).toBeLessThanOrEqual(new Date(2026, 7, 1).getTime());
    expect(end.getTime()).toBeGreaterThanOrEqual(new Date(2026, 7, 31).getTime());
  });
});

describe("getCalendarDays", () => {
  it("enumerates every day inclusive of start and end", () => {
    const start = new Date(2026, 7, 9);
    const end = new Date(2026, 7, 15);
    const days = getCalendarDays(start, end);
    expect(days).toHaveLength(7);
    expect(isSameDay(days[0]!, start)).toBe(true);
    expect(isSameDay(days[6]!, end)).toBe(true);
  });
});

describe("isSameDay", () => {
  it("ignores time-of-day", () => {
    expect(isSameDay(new Date(2026, 7, 12, 1, 0), new Date(2026, 7, 12, 23, 0))).toBe(true);
  });

  it("distinguishes different days", () => {
    expect(isSameDay(new Date(2026, 7, 12), new Date(2026, 7, 13))).toBe(false);
  });
});

describe("toDateInputValue", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
