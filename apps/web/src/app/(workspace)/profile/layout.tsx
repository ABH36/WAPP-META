import Link from "next/link";

const TABS = [
  { href: "/profile", label: "Overview" },
  { href: "/profile/security", label: "Security" },
  { href: "/profile/sessions", label: "Sessions" },
  { href: "/profile/login-history", label: "Login History" },
];

/** FRD-001 Volume-2 §5 — the 4 Profile sub-routes share one sub-nav shell. */
export default function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Profile</h1>
      <nav className="mb-6 flex gap-4 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-body-sm pb-2 font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
