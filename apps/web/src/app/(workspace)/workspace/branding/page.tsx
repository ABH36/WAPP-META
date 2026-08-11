import { BrandingPanel } from "../../../../features/workspace/branding-panel";

export default function WorkspaceBrandingPage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Branding</h2>
      <BrandingPanel />
    </div>
  );
}
