/** PRD-006 Volume-3 §4.7 — shared across every integration type's own status field, so Integration Health can report a uniform value regardless of source. */
export enum IntegrationConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
  EXPIRED = "EXPIRED",
}
