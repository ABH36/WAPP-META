/**
 * FRD-001 Volume-1 §8 — deliberately isolated from lib/api.ts (which pulls
 * in axios + the zustand auth store) so middleware.ts, which runs on the
 * Edge runtime, only imports this one dependency-free constant rather than
 * the whole API client chain.
 */
export const REFRESH_TOKEN_COOKIE = "wapp_web_rt";
