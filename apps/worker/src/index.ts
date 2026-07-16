/**
 * LUMORA worker process — consumes the compose, delivery, notification,
 * and cleanup queues. Run alongside the web app:  pnpm dev:worker
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });
loadEnv();

import { createLogger } from "@lumora/core";
import { startComposeWorker } from "./workers/compose.worker";
import { startDeliveryWorker } from "./workers/delivery.worker";
import { startNotificationWorker } from "./workers/notification.worker";
import { startCleanupWorker } from "./workers/cleanup.worker";
import { startRetentionWorker } from "./workers/retention.worker";

const log = createLogger("worker");

async function main() {
  const workers = [
    startComposeWorker(),
    startDeliveryWorker(),
    startNotificationWorker(),
    await startCleanupWorker(),
    await startRetentionWorker(),
  ];
  log.info("workers online", { queues: workers.map((w) => w.name) });

  const shutdown = async (signal: string) => {
    log.info(`received ${signal}, draining workers…`);
    await Promise.allSettled(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  log.error("fatal boot error", { err: String(err) });
  process.exit(1);
});
