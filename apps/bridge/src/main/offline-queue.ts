import { app } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { compressToTarget } from "@lumora/image/server";
import { PHOTO_MIN_LONG_EDGE, PHOTO_TARGET_MAX_BYTES } from "@lumora/contracts";
import { bridgeApi, BridgeApiError } from "./api-client";
import { getConfigStore } from "./config-store";
import { blog } from "./logger";

interface QueueItem {
  id: string;
  filePath: string;
  filename: string;
  sessionId: string | null;
  sequence: number | null;
  idempotencyKey: string;
  attempts: number;
  enqueuedAt: string;
}

type QueueListener = () => void;

/**
 * Durable upload queue: survives restarts (JSON journal), compresses
 * with sharp before upload (FR-03), retries with exponential backoff,
 * and never blocks the watcher (single background pump).
 */
export class OfflineQueue {
  private items: QueueItem[] = [];
  private journalPath = path.join(app.getPath("userData"), "upload-queue.json");
  private pumping = false;
  private listeners = new Set<QueueListener>();
  public uploadedCount = 0;
  public lastUploadAt: string | null = null;

  constructor() {
    this.restore();
  }

  private restore(): void {
    try {
      this.items = JSON.parse(readFileSync(this.journalPath, "utf8")) as QueueItem[];
      if (this.items.length > 0) blog.info(`Restored ${this.items.length} queued upload(s) from disk`);
    } catch {
      this.items = [];
    }
  }

  private persist(): void {
    mkdirSync(path.dirname(this.journalPath), { recursive: true });
    writeFileSync(this.journalPath, JSON.stringify(this.items, null, 2));
  }

  get depth(): number {
    return this.items.length;
  }

  onChange(listener: QueueListener): void {
    this.listeners.add(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  enqueue(filePath: string, sessionId: string | null, sequence: number | null): void {
    const filename = path.basename(filePath);
    // Deterministic idempotency key: same file+session can never duplicate.
    const idempotencyKey = createHash("sha256")
      .update(`${filePath}:${sessionId ?? "none"}`)
      .digest("hex")
      .slice(0, 48);
    if (this.items.some((i) => i.idempotencyKey === idempotencyKey)) return;

    this.items.push({
      id: randomUUID(),
      filePath,
      filename,
      sessionId,
      sequence,
      idempotencyKey,
      attempts: 0,
      enqueuedAt: new Date().toISOString(),
    });
    this.persist();
    this.notify();
    blog.info(`Queued ${filename} (depth ${this.items.length})`);
    void this.pump();
  }

  /** Background upload loop; one item at a time, backoff on failure. */
  async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.items.length > 0) {
        const item = this.items[0]!;
        try {
          const raw = await readFile(item.filePath);
          const compressed = await compressToTarget(raw, {
            targetBytes: PHOTO_TARGET_MAX_BYTES,
            minLongEdge: PHOTO_MIN_LONG_EDGE,
            maxLongEdge: 2400,
          });
          // 1. Presign
          const presignRes = await bridgeApi.presignPhoto({
            filename: item.filename,
            idempotencyKey: item.idempotencyKey,
          });

          // 2. Upload to S3/MinIO
          if (presignRes.uploadUrl) {
            const apiUrl = getConfigStore().get().apiUrl?.replace(/\/$/, "") ?? "";
            const finalUrl = presignRes.uploadUrl.startsWith("/")
              ? `${apiUrl}${presignRes.uploadUrl}`
              : presignRes.uploadUrl;

            const uploadRes = await fetch(finalUrl, {
              method: "PUT",
              body: compressed.buffer,
              headers: { "Content-Type": "image/jpeg" },
            });
            if (!uploadRes.ok) {
              throw new Error(`S3 upload failed: ${uploadRes.statusText}`);
            }
          }

          // 3. Confirm to DB
          await bridgeApi.confirmPhoto({
            photoId: presignRes.photoId,
            idempotencyKey: presignRes.idempotencyKey,
            filename: item.filename,
            sessionId: item.sessionId,
            sequence: item.sequence,
            width: compressed.width,
            height: compressed.height,
            sizeBytes: compressed.buffer.length,
          });
          this.items.shift();
          this.uploadedCount += 1;
          this.lastUploadAt = new Date().toISOString();
          this.persist();
          this.notify();
          blog.info(`Uploaded ${item.filename} (${Math.round(compressed.buffer.length / 1024)} KB)`);
        } catch (err) {
          if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
            blog.warn(`File vanished, dropping from queue: ${item.filename}`);
            this.items.shift();
            this.persist();
            this.notify();
            continue;
          }
          if (err instanceof BridgeApiError && [401, 403, 410, 413, 422].includes(err.status)) {
            blog.error(`Permanent upload failure for ${item.filename}: ${err.message} — dropping`);
            this.items.shift();
            this.persist();
            this.notify();
            continue;
          }
          item.attempts += 1;
          this.persist();
          const delay = Math.min(60_000, 2000 * 2 ** Math.min(item.attempts, 5));
          blog.warn(
            `Upload failed for ${item.filename} (attempt ${item.attempts}): ${err instanceof Error ? err.message : String(err)} — retrying in ${Math.round(delay / 1000)}s`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    } finally {
      this.pumping = false;
    }
  }
}
