/**
 * FRD-001 Volume-2 §4.5/§4.6 — minimal client-side User-Agent parsing for
 * display purposes only (Architecture Review, 2026-08-10: "Parsing the raw
 * userAgent string into friendly labels is approved as a presentation-layer
 * enhancement only"). The backend stores the raw string verbatim
 * (`SessionSummary.userAgent`/`LoginHistorySummary.userAgent`) and does no
 * parsing of its own — this is deliberately a small hand-rolled parser, not
 * a new dependency (e.g. `ua-parser-js`), since it only needs to cover
 * common cases well enough for a friendly label, not be exhaustive.
 */
export interface ParsedUserAgent {
  browser: string;
  device: string;
}

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) {
    return { browser: "Unknown browser", device: "Unknown device" };
  }

  const browser = detectBrowser(userAgent);
  const device = detectDevice(userAgent);
  return { browser, device };
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown browser";
}

function detectDevice(ua: string): string {
  if (/iPad|Tablet/.test(ua)) return "Tablet";
  if (/iPhone|Android.*Mobile|Mobile/.test(ua)) return "Mobile";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return "Desktop";
}
