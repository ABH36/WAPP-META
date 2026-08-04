/**
 * Auth layout — DS-001 §6 ("centered single-column card, max-width 420px, no
 * sidebar/nav chrome — minimizes distraction on the highest-drop-off screens").
 * Screens (Register, Login, Verify Email, Forgot Password, ...) are built with
 * the Identity module (SDP-001 §6, Module Development Order step 1).
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
