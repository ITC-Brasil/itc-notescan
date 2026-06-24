import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import { logger, maskSensitive } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";

describe("maskSensitive", () => {
  it("returns undefined when context is undefined", () => {
    expect(maskSensitive(undefined)).toBeUndefined();
  });

  it("masks 'password' field", () => {
    expect(maskSensitive({ password: "secret123" })).toEqual({ password: "[REDACTED]" });
  });

  it("masks 'token' field", () => {
    expect(maskSensitive({ token: "abc123" })).toEqual({ token: "[REDACTED]" });
  });

  it("masks 'secret' field", () => {
    expect(maskSensitive({ secret: "mysecret" })).toEqual({ secret: "[REDACTED]" });
  });

  it("masks 'authorization' field", () => {
    expect(maskSensitive({ authorization: "Bearer xyz" })).toEqual({ authorization: "[REDACTED]" });
  });

  it("does not mask non-sensitive fields", () => {
    const result = maskSensitive({ userId: "u1", action: "login" });
    expect(result).toEqual({ userId: "u1", action: "login" });
  });

  it("masks sensitive and preserves non-sensitive in same context", () => {
    const result = maskSensitive({ userId: "u1", password: "pw", action: "login" });
    expect(result).toEqual({ userId: "u1", password: "[REDACTED]", action: "login" });
  });
});

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info does not throw", () => {
    expect(() => logger.info("hello")).not.toThrow();
  });

  it("warn does not throw", () => {
    expect(() => logger.warn("be careful")).not.toThrow();
  });

  it("error does not throw", () => {
    expect(() => logger.error("something broke")).not.toThrow();
  });

  it("captureException does not throw", () => {
    expect(() => logger.captureException(new Error("oops"))).not.toThrow();
  });

  it("info calls console.log with message", () => {
    logger.info("test message");
    expect(console.log).toHaveBeenCalledWith(
      "[INFO]",
      expect.objectContaining({ message: "test message" }),
    );
  });

  it("warn calls console.warn with message", () => {
    logger.warn("warning message");
    expect(console.warn).toHaveBeenCalledWith(
      "[WARN]",
      expect.objectContaining({ message: "warning message" }),
    );
  });

  it("error calls console.error with message", () => {
    logger.error("error message");
    expect(console.error).toHaveBeenCalledWith(
      "[ERROR]",
      expect.objectContaining({ message: "error message" }),
    );
  });

  it("error sends to Sentry with error level", () => {
    logger.error("sentry error");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "sentry error",
      expect.objectContaining({ level: "error" }),
    );
  });

  it("warn sends to Sentry with warning level", () => {
    logger.warn("sentry warning");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "sentry warning",
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("info does not call Sentry.captureMessage", () => {
    logger.info("info only");
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("masks password before logging", () => {
    logger.info("user action", { password: "super-secret", userId: "u1" });
    expect(console.log).toHaveBeenCalledWith(
      "[INFO]",
      expect.objectContaining({ password: "[REDACTED]", userId: "u1" }),
    );
  });

  it("masks token before logging to Sentry", () => {
    logger.error("auth error", { token: "abc123", userId: "u1" });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "auth error",
      expect.objectContaining({
        extra: expect.objectContaining({ token: "[REDACTED]", userId: "u1" }),
      }),
    );
  });

  it("masks secret in warn context", () => {
    logger.warn("secret warning", { secret: "mysecret" });
    expect(console.warn).toHaveBeenCalledWith(
      "[WARN]",
      expect.objectContaining({ secret: "[REDACTED]" }),
    );
  });

  it("captureException calls Sentry.captureException", () => {
    const err = new Error("boom");
    logger.captureException(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.anything());
  });

  it("captureException masks sensitive fields in context", () => {
    logger.captureException(new Error("oops"), { password: "pw", userId: "u1" });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({ password: "[REDACTED]", userId: "u1" }),
      }),
    );
  });
});
