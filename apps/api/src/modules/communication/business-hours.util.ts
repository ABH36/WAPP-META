import type { BusinessHours } from "../workspace/schemas/workspace.schema.js";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface LocalDateParts {
  isoDate: string; // YYYY-MM-DD, in the target timezone
  weekday: number; // 0 = Sunday .. 6 = Saturday, matching BusinessHoursDay.dayOfWeek
  minutesSinceMidnight: number;
}

/**
 * Timezone-aware, holiday-aware evaluator for Workspace.businessHours
 * (Phase-3 schema, PRD-006 ADR-028) — Part 4a's actual job is consuming
 * this existing data, not redefining it. Uses Node's built-in
 * Intl.DateTimeFormat rather than adding a timezone library dependency
 * (same lean-dependency approach as MetaApiClient using the built-in
 * `fetch` instead of an HTTP client package).
 */
export function isWithinBusinessHours(businessHours: BusinessHours, at: Date): boolean {
  const parts = getLocalDateParts(at, businessHours.timezone);

  if (businessHours.publicHolidays.some((holiday) => holiday.date === parts.isoDate)) {
    return false;
  }

  const daySchedule = businessHours.schedule.find((day) => day.dayOfWeek === parts.weekday);
  if (!daySchedule || !daySchedule.isOpen) {
    return false;
  }

  const openMinutes = parseHHMM(daySchedule.openTime);
  const closeMinutes = parseHHMM(daySchedule.closeTime);
  return parts.minutesSinceMidnight >= openMinutes && parts.minutesSinceMidnight < closeMinutes;
}

function getLocalDateParts(at: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) {
    map[part.type] = part.value;
  }

  // Some ICU builds render midnight as "24" rather than "00" with hour12:false.
  const hour = map.hour === "24" ? 0 : Number(map.hour);

  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    weekday: WEEKDAY_INDEX[map.weekday ?? "Sun"] ?? 0,
    minutesSinceMidnight: hour * 60 + Number(map.minute),
  };
}

function parseHHMM(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
