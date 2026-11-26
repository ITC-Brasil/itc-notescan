import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    apiToken: { updateMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import { generateToken, hashToken, issueApiToken } from "@/lib/auth/token";

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.apiToken.create.mockImplementation(({ data }) => Promise.resolve({ id: "t1", ...data }));
});

describe("generateToken", () => {
  it("formato nsk_ + 43 chars base64url, prefixo de 12, hash sha256 ≠ token", () => {
    const { token, prefix, tokenHash } = generateToken();
    expect(token).toMatch(/^nsk_[A-Za-z0-9_-]{43}$/);
    expect(prefix).toBe(token.slice(0, 12));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("tokens são únicos", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe("issueApiToken", () => {
  it("revoga o ativo anterior e grava só o hash, com 365 dias", async () => {
    const before = Date.now();
    const res = await issueApiToken("ag1", ["read:catalog"]);
    expect(db.apiToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "ag1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const data = db.apiToken.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(res.token));
    expect(data).not.toHaveProperty("token");
    const days = (data.expiresAt.getTime() - before) / 86_400_000;
    expect(Math.round(days)).toBe(365);
  });
});
