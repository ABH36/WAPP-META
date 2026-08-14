/**
 * PHD-001 Volume-2 §4.1/Architecture Review (2026-08-13) — Next.js's own
 * server-lifecycle hooks (register/onRequestError), the only two
 * general-purpose points this app's server actually exposes, wired up to
 * the same Pino/structured standard as apps/api. `pino` is dynamically
 * imported and only ever reached on the `NEXT_RUNTIME === "nodejs"` branch:
 * Pino's core depends on Node built-ins the Edge runtime (which Middleware
 * runs on by default) doesn't provide, so a top-level import here would
 * break the Edge bundle. Edge-runtime errors (routeType "middleware") fall
 * back to a structured `console.error` line instead — still JSON, just not
 * through the Pino instance.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./lib/logger");
    logger.info({ event: "server.start" }, "wapp-admin server starting");
  }
}

export async function onRequestError(
  error: unknown,
  errorRequest: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  errorContext: Readonly<{
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
  }>,
): Promise<void> {
  const fields = {
    path: errorRequest.path,
    method: errorRequest.method,
    routePath: errorContext.routePath,
    routeType: errorContext.routeType,
  };

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("./lib/logger");
    logger.error({ ...fields, err: error }, "Unhandled server-side error");
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      service: "wapp-admin",
      ...fields,
      message: error instanceof Error ? error.message : String(error),
      time: new Date().toISOString(),
    }),
  );
}
