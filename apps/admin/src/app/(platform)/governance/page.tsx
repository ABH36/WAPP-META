import { GovernanceView } from "../../../features/platform/governance-view";

export default function GovernancePage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">
        Governance & Compliance
      </h1>
      <GovernanceView />
    </div>
  );
}
