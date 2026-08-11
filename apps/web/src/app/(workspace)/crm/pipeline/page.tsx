import { PipelineBoard } from "../../../../features/crm/pipeline-board";

export default function PipelinePage(): React.JSX.Element {
  return (
    <div>
      <h2 className="text-h3 mb-4 text-neutral-900 dark:text-neutral-50">Pipeline</h2>
      <PipelineBoard />
    </div>
  );
}
