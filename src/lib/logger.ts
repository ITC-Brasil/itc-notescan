import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[ERROR]", payload);
    Sentry.captureMessage(message, { level: "error", extra: context });
  } else if (level === "warn") {
    console.warn("[WARN]", payload);
    Sentry.captureMessage(message, { level: "warning", extra: context });
  } else {
    console.log("[INFO]", payload);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
  captureException: (error: unknown, context?: LogContext) => {
    console.error("[EXCEPTION]", error, context);
    Sentry.captureException(error, { extra: context });
  },
};
