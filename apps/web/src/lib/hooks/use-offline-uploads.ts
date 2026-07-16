"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api";
import {
  flushPendingUploads,
  isQueueableUploadError,
  offlineUploadStore,
  type PendingUpload,
} from "../offline/upload-queue";

const FLUSH_INTERVAL_MS = 15_000;

/** Shared low-level upload used by both the live path and the flush pump. */
export async function uploadSessionPhoto(input: {
  sessionId: string;
  blob: Blob;
  sequence: number;
  idempotencyKey: string;
  filterId?: string;
}): Promise<void> {
  const fd = new FormData();
  fd.set("file", input.blob, `frame-${input.sequence}.jpg`);
  fd.set("sequence", String(input.sequence));
  fd.set("idempotencyKey", input.idempotencyKey);
  fd.set("capturedAt", new Date().toISOString());
  if (input.filterId) fd.set("filterId", input.filterId);
  await apiClient.postForm(`/api/sessions/${input.sessionId}/photos`, fd);
}

export interface OfflineUploads {
  pendingCount: number;
  /** Upload now; on a network-class failure, persist to IndexedDB instead. */
  uploadOrQueue: (input: { sessionId: string; blob: Blob; sequence: number }) => Promise<"uploaded" | "queued">;
  flushNow: () => Promise<void>;
}

export function useOfflineUploads(eventId: string): OfflineUploads {
  const qc = useQueryClient();
  const [pendingCount, setPendingCount] = React.useState(0);
  const flushing = React.useRef(false);

  const refreshCount = React.useCallback(async () => {
    try {
      setPendingCount(await offlineUploadStore.count());
    } catch {
      // IndexedDB unavailable (private mode) — feature degrades silently.
    }
  }, []);

  const flushNow = React.useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const result = await flushPendingUploads((item: PendingUpload) =>
        uploadSessionPhoto(item),
      );
      if (result.flushed > 0) {
        void qc.invalidateQueries({ queryKey: ["operator-context", eventId] });
      }
      setPendingCount(result.remaining);
    } catch {
      // next pump retries
    } finally {
      flushing.current = false;
    }
  }, [eventId, qc]);

  React.useEffect(() => {
    void refreshCount();
    const interval = setInterval(() => void flushNow(), FLUSH_INTERVAL_MS);
    const onOnline = () => void flushNow();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [flushNow, refreshCount]);

  const uploadOrQueue = React.useCallback(
    async (input: { sessionId: string; blob: Blob; sequence: number; filterId?: string }) => {
      const idempotencyKey = crypto.randomUUID();
      try {
        await uploadSessionPhoto({ ...input, idempotencyKey });
        void qc.invalidateQueries({ queryKey: ["operator-context", eventId] });
        return "uploaded" as const;
      } catch (err) {
        if (!isQueueableUploadError(err)) throw err;
        await offlineUploadStore.add({
          id: crypto.randomUUID(),
          sessionId: input.sessionId,
          eventId,
          sequence: input.sequence,
          idempotencyKey,
          blob: input.blob,
          createdAt: Date.now(),
          attempts: 0,
          filterId: input.filterId,
        });
        await refreshCount();
        return "queued" as const;
      }
    },
    [eventId, refreshCount],
  );

  return { pendingCount, uploadOrQueue, flushNow };
}
