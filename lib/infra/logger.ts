export type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN =
  /api[-_]?key|authorization|bearer|^text$|^context$|secret|token/i;

const REDACTED = "[REDACTED]";

export function redact(value: unknown): unknown {
  return redactInner(value, new WeakSet());
}

function redactInner(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[CIRCULAR]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactInner(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redactInner(v, seen);
    }
  }
  return out;
}

export function log(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...((redact(data ?? {}) as Record<string, unknown>) ?? {}),
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}
