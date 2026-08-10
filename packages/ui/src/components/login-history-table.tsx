import * as React from "react";
import { Badge } from "./badge";
import { EmptyState } from "./empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

/**
 * FRD-001 Volume-2 §4.6 — Login History, read-only. `formatReason` is
 * required, not optional — the backend's raw `reason` values
 * (`INVALID_CREDENTIALS`, `PLATFORM_MAINTENANCE_MODE`, etc.) are internal
 * strings, never shown verbatim; the caller owns the friendly-copy mapping
 * (app-specific business copy, not this component's concern).
 */
export interface LoginHistoryEntryView {
  id: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  device: string;
  browser: string;
  occurredAt: string;
}

export interface LoginHistoryTableProps {
  entries: LoginHistoryEntryView[];
  formatReason: (reason: string | null, success: boolean) => string;
}

export function LoginHistoryTable({
  entries,
  formatReason,
}: LoginHistoryTableProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No login activity yet"
        description="Your login history will appear here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>
              <Badge variant={entry.success ? "success" : "danger"}>
                {formatReason(entry.reason, entry.success)}
              </Badge>
            </TableCell>
            <TableCell>
              {entry.device} · {entry.browser}
            </TableCell>
            <TableCell>{entry.ipAddress ?? "Unknown"}</TableCell>
            <TableCell>{entry.occurredAt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
