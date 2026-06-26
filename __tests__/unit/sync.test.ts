import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted ensures these mocks are available when vi.mock factory runs (it's hoisted before imports).
const {
  mockSortBy,
  mockBelowOrEqual,
  mockWhere,
  mockDelete,
  mockUpdate,
  mockAdd,
  mockCount,
} = vi.hoisted(() => ({
  mockSortBy: vi.fn(),
  mockBelowOrEqual: vi.fn(),
  mockWhere: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
  mockAdd: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => ({
  db: {
    conferencesOutbox: {
      where: mockWhere,
      delete: mockDelete,
      update: mockUpdate,
      add: mockAdd,
      count: mockCount,
    },
  },
}));

import { processOutbox, saveToOutbox, getOutboxCount } from "@/lib/offline/sync";

const NOW = 1_000_000;

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);

  // Reset all mock implementations
  mockWhere.mockReturnValue({ belowOrEqual: mockBelowOrEqual });
  mockBelowOrEqual.mockReturnValue({ sortBy: mockSortBy });
  mockSortBy.mockResolvedValue([]);
  mockDelete.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockAdd.mockResolvedValue(1);
  mockCount.mockResolvedValue(0);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("saveToOutbox", () => {
  it("adds item to outbox with retryCount 0 and nextRetry 0", async () => {
    const data = { umId: "um1", status: "CONCLUIDO_OK" };
    await saveToOutbox(data);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ data, retryCount: 0, nextRetry: 0 }),
    );
  });

  it("stamps item with current timestamp", async () => {
    await saveToOutbox({});
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: NOW }),
    );
  });
});

describe("getOutboxCount", () => {
  it("returns count from the database", async () => {
    mockCount.mockResolvedValue(7);
    expect(await getOutboxCount()).toBe(7);
  });

  it("returns 0 when outbox is empty", async () => {
    mockCount.mockResolvedValue(0);
    expect(await getOutboxCount()).toBe(0);
  });
});

describe("processOutbox", () => {
  it("queries items with nextRetry <= now", async () => {
    await processOutbox();
    expect(mockWhere).toHaveBeenCalledWith("nextRetry");
    expect(mockBelowOrEqual).toHaveBeenCalledWith(NOW);
    expect(mockSortBy).toHaveBeenCalledWith("timestamp");
  });

  it("does not call fetch when outbox is empty", async () => {
    mockSortBy.mockResolvedValue([]);
    await processOutbox();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch for each due item", async () => {
    mockSortBy.mockResolvedValue([
      { id: 1, data: { a: 1 }, timestamp: 0, retryCount: 0, nextRetry: 0 },
      { id: 2, data: { b: 2 }, timestamp: 1, retryCount: 0, nextRetry: 0 },
    ]);
    mockFetch.mockResolvedValue({ ok: true });

    await processOutbox();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("deletes item from outbox on successful fetch", async () => {
    const item = { id: 42, data: { x: 1 }, timestamp: 0, retryCount: 0, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockResolvedValue({ ok: true });

    await processOutbox();

    expect(mockDelete).toHaveBeenCalledWith(42);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sends correct payload to /api/conferences", async () => {
    const data = { umId: "um1", status: "CONCLUIDO_OK" };
    mockSortBy.mockResolvedValue([
      { id: 1, data, timestamp: 0, retryCount: 0, nextRetry: 0 },
    ]);
    mockFetch.mockResolvedValue({ ok: true });

    await processOutbox();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/conferences",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(data),
      }),
    );
  });

  it("increments retryCount on HTTP error response", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 0, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ retryCount: 1 }),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("increments retryCount on network error", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 0, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockRejectedValue(new Error("Network Error"));

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ retryCount: 1 }),
    );
  });

  it("sets nextRetry to now + 60000ms on first failure (retryCount 0)", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 0, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockRejectedValue(new Error("fail"));

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nextRetry: NOW + 60_000 }),
    );
  });

  it("sets nextRetry to now + 300000ms on second failure (retryCount 1)", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 1, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockRejectedValue(new Error("fail"));

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nextRetry: NOW + 300_000 }),
    );
  });

  it("sets nextRetry to now + 900000ms on third failure (retryCount 2)", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 2, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockRejectedValue(new Error("fail"));

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nextRetry: NOW + 900_000 }),
    );
  });

  it("caps delay at 900000ms for retryCount >= 3", async () => {
    const item = { id: 1, data: {}, timestamp: 0, retryCount: 3, nextRetry: 0 };
    mockSortBy.mockResolvedValue([item]);
    mockFetch.mockRejectedValue(new Error("fail"));

    await processOutbox();

    expect(mockUpdate).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ nextRetry: NOW + 900_000 }),
    );
  });

  it("processes all items even if one fails", async () => {
    const items = [
      { id: 1, data: { x: 1 }, timestamp: 0, retryCount: 0, nextRetry: 0 },
      { id: 2, data: { x: 2 }, timestamp: 1, retryCount: 0, nextRetry: 0 },
    ];
    mockSortBy.mockResolvedValue(items);
    mockFetch
      .mockRejectedValueOnce(new Error("fail for item 1"))
      .mockResolvedValueOnce({ ok: true });

    await processOutbox();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ retryCount: 1 }));
    expect(mockDelete).toHaveBeenCalledWith(2);
  });

  it("processes items in the order returned by sortBy (timestamp order)", async () => {
    const callOrder: number[] = [];
    const items = [
      { id: 10, data: {}, timestamp: 100, retryCount: 0, nextRetry: 0 },
      { id: 20, data: {}, timestamp: 200, retryCount: 0, nextRetry: 0 },
    ];
    mockSortBy.mockResolvedValue(items);
    mockDelete.mockImplementation(async (id: number) => {
      callOrder.push(id);
    });
    mockFetch.mockResolvedValue({ ok: true });

    await processOutbox();

    expect(callOrder).toEqual([10, 20]);
  });
});
