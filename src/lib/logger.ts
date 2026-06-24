import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "auth"];

export function maskSensitive(context?: LogContext): LogContext | undefined {
  if (!context) return context;
  return Object.fromEntries(
    Object.entries(context).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? "[REDACTED]" : v,
    ]),
  );
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const safeContext = maskSensitive(context);
  const payload = { message, ...safeContext };

  if (level === "error") {
    console.error("[ERROR]", payload);
    Sentry.captureMessage(message, { level: "error", extra: safeContext });
  } else if (level === "warn") {
    console.warn("[WARN]", payload);
    Sentry.captureMessage(message, { level: "warning", extra: safeContext });
  } else {
    console.log("[INFO]", payload);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  captureException: (error: unknown, context?: LogContext) => {
    const safeContext = maskSensitive(context);
    console.error("[EXCEPTION]", error, safeContext);
    Sentry.captureException(error, { extra: safeContext });
  },
};
