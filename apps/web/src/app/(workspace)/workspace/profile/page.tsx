import { BusinessProfileForm } from "../../../../features/workspace/business-profile-form";

export default function WorkspaceBusinessProfilePage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Business profile</h2>
      <BusinessProfileForm />
    </div>
  );
}
