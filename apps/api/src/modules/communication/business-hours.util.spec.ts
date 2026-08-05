import { isWithinBusinessHours } from "./business-hours.util.js";
import type { BusinessHours } from "../workspace/schemas/workspace.schema.js";

// 2026-08-03 is a Monday, 2026-08-08 is a Saturday (verified via Date.UTC).
const MON_10AM_IST = new Date("2026-08-03T04:30:00.000Z"); // 10:00 IST
const MON_8AM_IST = new Date("2026-08-03T02:30:00.000Z"); // 08:00 IST — before opening
const MON_7PM_IST = new Date("2026-08-03T13:30:00.000Z"); // 19:00 IST — after closing
const SAT_10AM_IST = new Date("2026-08-08T04:30:00.000Z"); // 10:00 IST, Saturday

function businessHours(overrides: Partial<BusinessHours> = {}): BusinessHours {
  const defaults: BusinessHours = {
    timezone: "Asia/Kolkata",
    schedule: [
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "18:00" },
      { dayOfWeek: 5, isOpen: true, openTime: "09:00", closeTime: "18:00" },
    ],
    publicHolidays: [],
  };
  return { ...defaults, ...overrides };
}

describe("isWithinBusinessHours", () => {
  it("is true during an open weekday's configured hours", () => {
    expect(isWithinBusinessHours(businessHours(), MON_10AM_IST)).toBe(true);
  });

  it("is false before the day's opening time", () => {
    expect(isWithinBusinessHours(businessHours(), MON_8AM_IST)).toBe(false);
  });

  it("is false at/after the day's closing time", () => {
    expect(isWithinBusinessHours(businessHours(), MON_7PM_IST)).toBe(false);
  });

  it("is false on a day with no schedule entry (weekend)", () => {
    expect(isWithinBusinessHours(businessHours(), SAT_10AM_IST)).toBe(false);
  });

  it("is false on a day explicitly marked isOpen: false", () => {
    const hours = businessHours({
      schedule: [{ dayOfWeek: 1, isOpen: false, openTime: "09:00", closeTime: "18:00" }],
    });
    expect(isWithinBusinessHours(hours, MON_10AM_IST)).toBe(false);
  });

  it("is false on a configured public holiday, even during otherwise-open hours", () => {
    const hours = businessHours({
      publicHolidays: [{ date: "2026-08-03", name: "Test Holiday" }],
    });
    expect(isWithinBusinessHours(hours, MON_10AM_IST)).toBe(false);
  });
});
