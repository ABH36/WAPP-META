import { CalendarView } from "../../../../features/crm/calendar-view";

export default function CalendarPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Calendar</h2>
      <CalendarView />
    </div>
  );
}
