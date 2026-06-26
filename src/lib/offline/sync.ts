import { db } from "@/lib/offline/db";

const RETRY_DELAYS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

export async function saveToOutbox(data: object): Promise<void> {
  await db.conferencesOutbox.add({
    data,
    timestamp: Date.now(),
    retryCount: 0,
    nextRetry: 0,
  });
}

export async function processOutbox(): Promise<void> {
  const now = Date.now();
  const items = await db.conferencesOutbox
    .where("nextRetry")
    .belowOrEqual(now)
    .sortBy("timestamp");

  for (const item of items) {
    try {
      const response = await fetch("/api/conferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await db.conferencesOutbox.delete(item.id!);
    } catch {
      const delay =
        RETRY_DELAYS[Math.min(item.retryCount, RETRY_DELAYS.length - 1)];
      await db.conferencesOutbox.update(item.id!, {
        retryCount: item.retryCount + 1,
        nextRetry: now + delay,
      });
    }
  }
}

export async function getOutboxCount(): Promise<number> {
  return db.conferencesOutbox.count();
}
