export type CalendarViewMode = "day" | "week" | "month";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * FRD-001 Volume-5 §4.9 — Calendar shows only Tasks (`dueDate`) and
 * Follow-ups (`followUpDate`) per the approved scope decision (Meetings/
 * Calls/Emails excluded, filed as Tech Debt). Month view returns a range
 * padded out to full weeks (so the rendered grid has no partial row),
 * which also means the fetch range is intentionally a little wider than
 * the calendar month itself.
 */
export function getCalendarRange(
  viewMode: CalendarViewMode,
  anchor: Date,
): { start: Date; end: Date } {
  if (viewMode === "day") {
    const start = startOfDay(anchor);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (viewMode === "week") {
    return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
  }
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) };
}

export function getCalendarDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Builds the string from local date parts (never `toISOString()`, which shifts across the UTC boundary in timezones ahead of UTC). */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
