import { Suspense } from "react";
import { ResetPasswordForm } from "../../../features/auth/reset-password-form";

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h2 mb-6 text-center text-neutral-900 dark:text-neutral-50">
        Reset password
      </h1>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
