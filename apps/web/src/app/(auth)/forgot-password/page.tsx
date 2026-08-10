import { ForgotPasswordForm } from "../../../features/auth/forgot-password-form";

export default function ForgotPasswordPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h2 mb-2 text-center text-neutral-900 dark:text-neutral-50">
        Forgot password
      </h1>
      <p className="text-body-sm mb-6 text-center text-neutral-500 dark:text-neutral-400">
        Enter your email and we&apos;ll send you a reset link.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
