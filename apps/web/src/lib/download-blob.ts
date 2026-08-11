/** FRD-001 Volume-5 §4.10 — triggers a browser file download for a Blob already fetched through the authenticated API client (`crmService.exportReport`). A temporary object URL + hidden anchor click is the standard way to save an in-memory Blob without a real `<a href>` pointing at an authenticated route. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
