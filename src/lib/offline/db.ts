import Dexie, { type Table } from "dexie";

export interface ConferenceOutbox {
  id?: number;
  data: object;
  timestamp: number;
  retryCount: number;
  nextRetry: number;
}

class NoteScanDB extends Dexie {
  conferencesOutbox!: Table<ConferenceOutbox>;

  constructor() {
    super("NoteScanDB");
    this.version(1).stores({
      conferencesOutbox: "++id, timestamp, retryCount, nextRetry",
    });
  }
}

export const db = new NoteScanDB();
