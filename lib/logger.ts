/**
 * Tiny structured logger for server-side flow visibility.
 *
 * Toggle with env: set LOG_LEVEL=debug|info|warn|error|silent (default "info").
 * Logs go to the server console (terminal running `next dev`/`next start`).
 */
type Level = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

function activeLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return (raw in ORDER ? raw : "info") as Level;
}

function ts(): string {
  return new Date().toISOString();
}

function emit(level: Exclude<Level, "silent">, scope: string, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[activeLevel()]) return;
  const prefix = `${ts()} [${level.toUpperCase()}] [${scope}]`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta === undefined) {
    fn(`${prefix} ${msg}`);
  } else {
    fn(`${prefix} ${msg}`, safeMeta(meta));
  }
}

/** Trim large/circular values so logs stay readable. */
function safeMeta(meta: unknown): unknown {
  try {
    const json = JSON.stringify(meta, (_key, value) => {
      if (typeof value === "string" && value.length > 500) {
        return `${value.slice(0, 500)}… (${value.length} chars)`;
      }
      return value;
    });
    return json && json.length > 2000 ? `${json.slice(0, 2000)}… (truncated)` : JSON.parse(json);
  } catch {
    return String(meta);
  }
}

/** Create a logger bound to a scope (e.g. "api/chat"). */
export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit("debug", scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit("info", scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit("warn", scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit("error", scope, msg, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
