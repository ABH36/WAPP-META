/**
 * Placeholder Login page — Phase 1 Foundation / FRD-001 Volume-1 only.
 * Verifies the guest-route shell and middleware redirect target resolve
 * end to end. The real Login form (react-hook-form + zod, calling
 * services/auth.service.ts's login()) is built with the Authentication &
 * Identity UI module (FRD-001 Volume-2), per the approved Module
 * Development Order.
 */
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="text-center">
      <h1 className="text-h2 text-neutral-900 dark:text-neutral-50">Log in</h1>
      <p className="text-body mt-2 text-neutral-600 dark:text-neutral-400">
        Login form ships with the Authentication &amp; Identity UI module.
      </p>
    </div>
  );
}
