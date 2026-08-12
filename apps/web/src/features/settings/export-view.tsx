"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, EmptyState, ExportJobCard, Select } from "@wapp/ui";
import { exportService } from "../../services/export.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { ExportEntityType, ExportJobStatus, SettingsExportFormat } from "../../types/settings";

const ENTITY_OPTIONS = Object.values(ExportEntityType);
const LAST_JOB_STORAGE_KEY = "wapp-web-last-export-job-id";

/**
 * FRD-001 Volume-7 §4.11 — `EDIT_WORKSPACE`. `DataManagementController`
 * only has `POST /settings/export` (create) and `GET /settings/export/:id`
 * (status) — no list-all-jobs route exists, so there's no real "Job List"
 * to page through, only the single most-recently-created job (the backend
 * itself enforces max one active job per workspace anyway). The last
 * job id is remembered in localStorage so status/download survives a page
 * reload, and polled via `refetchInterval` while still PENDING/PROCESSING.
 */
export function ExportView(): React.JSX.Element {
  const canView = useHasPermission(Permission.EDIT_WORKSPACE);
  const canCreate = useHasFullPermission(Permission.EDIT_WORKSPACE);
  const [entityType, setEntityType] = React.useState<ExportEntityType>(ExportEntityType.CUSTOMERS);
  const [format, setFormat] = React.useState<SettingsExportFormat>(SettingsExportFormat.CSV);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setJobId(window.localStorage.getItem(LAST_JOB_STORAGE_KEY));
  }, []);

  const jobQuery = useQuery({
    queryKey: ["settings", "export", jobId],
    queryFn: () => exportService.getStatus(jobId!),
    enabled: canView && !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === ExportJobStatus.PENDING || status === ExportJobStatus.PROCESSING
        ? 3000
        : false;
    },
  });

  const handleRequestExport = async () => {
    setError(null);
    setBusy(true);
    try {
      const job = await exportService.create({ entityType, format });
      window.localStorage.setItem(LAST_JOB_STORAGE_KEY, job.id);
      setJobId(job.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request export.");
    } finally {
      setBusy(false);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Data Export.</Alert>;
  }

  const activeJobPending =
    jobQuery.data?.status === ExportJobStatus.PENDING ||
    jobQuery.data?.status === ExportJobStatus.PROCESSING;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {canCreate ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select
            aria-label="Entity type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as ExportEntityType)}
          >
            {ENTITY_OPTIONS.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Format"
            value={format}
            onChange={(e) => setFormat(e.target.value as SettingsExportFormat)}
          >
            <option value={SettingsExportFormat.CSV}>CSV</option>
            <option value={SettingsExportFormat.EXCEL}>Excel</option>
            <option value={SettingsExportFormat.JSON}>JSON</option>
          </Select>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={activeJobPending}
            onClick={() => void handleRequestExport()}
          >
            Request Export
          </Button>
        </div>
      ) : null}

      {!jobId ? (
        <EmptyState
          title="No export requested yet"
          description="Request an export above to see its status here."
        />
      ) : jobQuery.data ? (
        <ExportJobCard
          entityType={jobQuery.data.entityType}
          format={jobQuery.data.format}
          status={jobQuery.data.status}
          createdAt={jobQuery.data.createdAt}
          resultUrl={jobQuery.data.resultUrl}
          error={jobQuery.data.error}
        />
      ) : null}
    </div>
  );
}
