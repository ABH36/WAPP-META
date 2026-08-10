/**
 * FRD-001 Volume-1 §11 — typed access to the env vars this app actually
 * uses (see .env.example). `NEXT_PUBLIC_*` vars are inlined at build time by
 * Next.js — reading them through one module (rather than `process.env.X`
 * scattered across files) means a renamed/missing var is a single-file fix.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiUrl: requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
  appUrl: requireEnv("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
};
