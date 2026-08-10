import { ChangePasswordForm } from "../../../../features/auth/change-password-form";

export default function ProfileSecurityPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
