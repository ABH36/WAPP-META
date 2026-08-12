import { WorkspaceRegistryView } from "../../../features/platform/workspace-registry-view";

export default function WorkspacesPage(): React.JSX.Element {
  return (
    <div>
      <h1 className="text-h1 mb-4 text-neutral-900 dark:text-neutral-50">Workspace Registry</h1>
      <WorkspaceRegistryView />
    </div>
  );
}
