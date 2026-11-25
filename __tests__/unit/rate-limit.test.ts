import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, rateLimitByActor, rateLimitByIp } from "@/lib/rate-limit";

// Unique keys prevent shared Map state from bleeding between tests.
let keyCounter = 0;
const uniqueKey = (prefix = "ip") => `${prefix}-${++keyCounter}`;

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request within limit", () => {
    const result = rateLimit(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests up to the limit", () => {
    const key = uniqueKey();
    rateLimit(key, 5, 60_000);
    rateLimit(key, 5, 60_000);
    const result = rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks request when limit is exceeded", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);
    const result = rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets counter after window expires", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);
    expect(rateLimit(key, 5, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(rateLimit(key, 5, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 5, 60_000).remaining).toBe(3);
  });

  it("returns correct reset timestamp", () => {
    vi.setSystemTime(1_000);
    const result = rateLimit(uniqueKey(), 5, 60_000);
    expect(result.reset).toBe(61_000);
  });

  it("remaining decrements correctly across multiple requests", () => {
    const key = uniqueKey();
    expect(rateLimit(key, 5, 60_000).remaining).toBe(4);
    expect(rateLimit(key, 5, 60_000).remaining).toBe(3);
    expect(rateLimit(key, 5, 60_000).remaining).toBe(2);
  });

  it("returns remaining 0 when exactly at limit", () => {
    const key = uniqueKey();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000);
    const result = rateLimit(key, 5, 60_000);
    expect(result.remaining).toBe(0);
  });

  it("independent keys do not share state", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    for (let i = 0; i < 5; i++) rateLimit(key1, 5, 60_000);
    expect(rateLimit(key1, 5, 60_000).allowed).toBe(false);
    expect(rateLimit(key2, 5, 60_000).allowed).toBe(true);
  });
});

describe("rateLimitByIp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows request identified by x-forwarded-for header", () => {
    const ip = uniqueKey("192.168.1");
    const req = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
    });
    expect(rateLimitByIp(req, 5, 60_000).allowed).toBe(true);
  });

  it("uses only the first IP from comma-separated x-forwarded-for", () => {
    const ip1 = uniqueKey("10.0.1");
    const ip2 = uniqueKey("10.0.2");
    const makeReq = () =>
      new Request("http://localhost/api", {
        headers: { "x-forwarded-for": `${ip1}, ${ip2}` },
      });
    for (let i = 0; i < 3; i++) rateLimitByIp(makeReq(), 3, 60_000);
    // Exhausted for ip1
    expect(rateLimitByIp(makeReq(), 3, 60_000).allowed).toBe(false);
    // ip2 was never directly used as the key
    const req2 = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": `${ip2}` },
    });
    expect(rateLimitByIp(req2, 3, 60_000).allowed).toBe(true);
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const ip = uniqueKey("172.16");
    const req = new Request("http://localhost/api", {
      headers: { "x-real-ip": ip },
    });
    expect(rateLimitByIp(req, 5, 60_000).allowed).toBe(true);
  });

  it("uses 'unknown' key when no IP headers are present", () => {
    const req = new Request("http://localhost/api");
    // Use high limit so accumulated 'unknown' state from other tests doesn't matter
    expect(rateLimitByIp(req, 10_000, 60_000).allowed).toBe(true);
  });

  it("blocks the same IP after limit exhaustion", () => {
    const ip = uniqueKey("203.0");
    const makeReq = () =>
      new Request("http://localhost/api", {
        headers: { "x-forwarded-for": ip },
      });
    for (let i = 0; i < 2; i++) rateLimitByIp(makeReq(), 2, 60_000);
    expect(rateLimitByIp(makeReq(), 2, 60_000).allowed).toBe(false);
  });
});

describe("rateLimitByActor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  const exhaust = (id: string, kind: "read" | "write") => {
    let n = 0;
    while (rateLimitByActor(id, kind).allowed) n++;
    return n;
  };

  it("leitura 120/min, escrita 30/min, contadores separados por ator e tipo", () => {
    const id = uniqueKey("actor");
    expect(exhaust(id, "write")).toBe(30);
    expect(exhaust(id, "read")).toBe(120);
    expect(rateLimitByActor(uniqueKey("actor"), "write").allowed).toBe(true);
  });

  it("libera após a janela de 1 minuto", () => {
    const id = uniqueKey("actor");
    exhaust(id, "write");
    vi.setSystemTime(60_001);
    expect(rateLimitByActor(id, "write").allowed).toBe(true);
  });
});
