import { ForecastView } from "../../../../features/crm/forecast-view";

export default function ForecastPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Forecast</h2>
      <ForecastView />
    </div>
  );
}
