import { Worker } from "bullmq";
import {
  QueueName,
  createLogger,
  getQueue,
  getRedis,
  type CleanupJobData,
} from "@lumora/core";
import { bridgeDeviceRepo, deliveryTokenRepo, topupRepo } from "@lumora/db";

const log = createLogger("cleanup");

const BRIDGE_STALE_MS = 3 * 60 * 1000;

/**
 * Housekeeping every 5 minutes:
 *  - delete delivery tokens expired for >7 days (privacy hygiene)
 *  - flip bridge devices silent for >3 minutes to OFFLINE
 */
export async function startCleanupWorker(): Promise<Worker<CleanupJobData>> {
  await getQueue(QueueName.CLEANUP).upsertJobScheduler("cleanup-tick", { every: 5 * 60 * 1000 });

  return new Worker<CleanupJobData>(
    QueueName.CLEANUP,
    async () => {
      const [tokens, stale, topups] = await Promise.all([
        deliveryTokenRepo.deleteExpired(),
        bridgeDeviceRepo.markStale(BRIDGE_STALE_MS),
        topupRepo.expireStale(),
      ]);
      if (tokens.count > 0 || stale.count > 0 || topups.count > 0) {
        log.info("cleanup pass", {
          expiredTokens: tokens.count,
          staleBridges: stale.count,
          expiredTopups: topups.count,
        });
      }
    },
    { connection: getRedis(), concurrency: 1 },
  );
}
