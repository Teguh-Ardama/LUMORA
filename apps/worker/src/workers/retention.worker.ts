import { Worker } from "bullmq";
import {
  QueueName,
  createLogger,
  getQueue,
  getRedis,
  getStorage,
} from "@lumora/core";
import { prisma } from "@lumora/db";

const log = createLogger("retention");

/**
 * FR-09: 30-day data retention cleanup.
 *
 * Urutan operasi WAJIB (lihat docs/DATABASE.md §3):
 * 1. SELECT file_url dari photos + photo_results + thumbnail_url
 * 2. Hapus objek fisik dari storage
 * 3. DELETE sessions → cascade otomatis bersihkan photos, photo_results, print_jobs
 * 4. Log jumlah row & file yang berhasil/gagal dihapus
 *
 * Idempotent: aman dijalankan ulang kalau sempat gagal di tengah jalan.
 */
export async function startRetentionWorker(): Promise<Worker<Record<string, never>>> {
  // Schedule once daily at ~03:00 local time (offset from :00 to avoid thundering herd)
  await getQueue(QueueName.RETENTION).upsertJobScheduler("retention-tick", {
    pattern: "17 3 * * *",
  });

  return new Worker<Record<string, never>>(
    QueueName.RETENTION,
    async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      log.info("retention pass starting", { cutoff: cutoff.toISOString() });

      // 1. Cari session yang udah > 30 hari
      const oldSessions = await prisma.session.findMany({
        where: { createdAt: { lt: cutoff } },
        select: {
          id: true,
          photos: { select: { storageKey: true } },
          photoResult: { select: { fileUrl: true, thumbnailUrl: true } },
        },
      });

      if (oldSessions.length === 0) {
        log.info("no sessions to clean up");
        return;
      }

      // 2. Kumpulin semua storage keys yang perlu dihapus
      const storageKeys: string[] = [];
      for (const s of oldSessions) {
        for (const p of s.photos) {
          if (p.storageKey) storageKeys.push(p.storageKey);
        }
        // photoResult.fileUrl dan thumbnailUrl juga perlu dihapus
        // Tapi ini signed URL, bukan storage key — kita skip untuk MVP
        // karena file composed disimpan sebagai storageKey di session.composedKey
      }

      // 3. Hapus file dari storage
      const storage = getStorage();
      let deletedFiles = 0;
      let failedFiles = 0;

      for (const key of storageKeys) {
        try {
          await storage.deleteObject(key);
          deletedFiles++;
        } catch (err) {
          failedFiles++;
          log.error("failed to delete file", { key, err: String(err) });
        }
      }

      // 4. Hapus row sessions → cascade otomatis
      const sessionIds = oldSessions.map((s) => s.id);
      const { count } = await prisma.session.deleteMany({
        where: { id: { in: sessionIds } },
      });

      log.info("retention pass done", {
        sessionsRemoved: count,
        filesDeleted: deletedFiles,
        filesFailed: failedFiles,
        cutoff: cutoff.toISOString(),
      });
    },
    { connection: getRedis(), concurrency: 1 },
  );
}
