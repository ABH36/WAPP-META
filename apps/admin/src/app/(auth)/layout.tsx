/** Auth layout — mirrors apps/web's (auth) shell (DS-001 §6's Auth template: centered card, max-width 420px). Only the Platform login screen lives here (no self-registration — Platform Users are provisioned by an existing Super Admin, PRD-007 §4.3). */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
