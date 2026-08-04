/**
 * Marketing layout shell — DS-001 §5 ("sticky top nav + footer, max-width 1280px
 * content"). The actual Header/Footer components and page content (PRD-008) are
 * built module-by-module per SDP-001's Development Sequence — this establishes
 * the layout boundary only, for Phase 1 Foundation.
 */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <div className="mx-auto max-w-[1280px] px-4">{children}</div>;
}
