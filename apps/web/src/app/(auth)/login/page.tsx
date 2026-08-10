import { Suspense } from "react";
import { LoginForm } from "../../../features/auth/login-form";

export default function LoginPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h2 mb-6 text-center text-neutral-900 dark:text-neutral-50">Log in</h1>
      {/* useSearchParams() (redirectTo) requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
