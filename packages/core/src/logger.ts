/** Minimal structured logger — JSON in production, pretty in dev. */
type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, scope, message, ...meta };
  const line =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(entry)
      : `[${entry.ts}] ${level.toUpperCase()} (${scope}) ${message}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", scope, msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", scope, msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", scope, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", scope, msg, meta),
  };
}
export type Logger = ReturnType<typeof createLogger>;
