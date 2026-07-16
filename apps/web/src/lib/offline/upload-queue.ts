"use client";

/**
 * Offline-first capture queue (venue Wi-Fi is hostile by default).
 *
 * Failed webcam uploads land in IndexedDB with their original idempotency
 * key, then a single background pump retries them — on an interval, on
 * `online`, and on demand. Because the server dedupes by idempotency key,
 * replays are always safe. Photos survive tab reloads and full restarts.
 */

const DB_NAME = "lumora-offline";
const STORE = "pending-uploads";
const DB_VERSION = 1;

export interface PendingUpload {
  id: string;
  sessionId: string;
  eventId: string;
  sequence: number;
  idempotencyKey: string;
  blob: Blob;
  createdAt: number;
  attempts: number;
  filterId?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    });
  } finally {
    db.close();
  }
}

export const offlineUploadStore = {
  async add(item: PendingUpload): Promise<void> {
    await withStore("readwrite", (s) => s.put(item));
  },
  async remove(id: string): Promise<void> {
    await withStore("readwrite", (s) => s.delete(id));
  },
  async update(item: PendingUpload): Promise<void> {
    await withStore("readwrite", (s) => s.put(item));
  },
  async all(): Promise<PendingUpload[]> {
    return withStore("readonly", (s) => s.getAll() as IDBRequest<PendingUpload[]>);
  },
  async count(): Promise<number> {
    return withStore("readonly", (s) => s.count());
  },
};

export type FlushResult = { flushed: number; remaining: number };

/**
 * Try to upload every pending item once (oldest first). 4xx responses
 * (except 408/429) are permanent — the item is dropped rather than
 * poisoning the queue forever.
 */
export async function flushPendingUploads(
  upload: (item: PendingUpload) => Promise<void>,
): Promise<FlushResult> {
  const items = (await offlineUploadStore.all()).sort((a, b) => a.createdAt - b.createdAt);
  let flushed = 0;
  for (const item of items) {
    try {
      await upload(item);
      await offlineUploadStore.remove(item.id);
      flushed += 1;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        await offlineUploadStore.remove(item.id); // permanent rejection
      } else {
        await offlineUploadStore.update({ ...item, attempts: item.attempts + 1 });
        break; // still offline — stop hammering, next pump retries
      }
    }
  }
  return { flushed, remaining: await offlineUploadStore.count() };
}

/** Network-ish failures are queueable; 4xx validation errors are not. */
export function isQueueableUploadError(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (status === undefined) return true; // fetch TypeError → network down
  return status >= 500 || status === 408 || status === 429;
}
