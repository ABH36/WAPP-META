/** FRD-001 Volume-4 §4.4 — counts distinct `{{1}}`, `{{2}}`, ... placeholders in a WhatsApp template's BODY component text, so the Composer/Broadcast/Campaign forms know how many `bodyParameters` inputs to render. */
export function countBodyPlaceholders(body: string | undefined): number {
  if (!body) return 0;
  const matches = body.match(/\{\{\d+\}\}/g);
  return matches ? new Set(matches).size : 0;
}
