import { Worker, type Job } from "bullmq";
import { orgChannel } from "@lumora/contracts";
import {
  QueueName,
  createLogger,
  getRedis,
  publishRealtime,
  type NotificationJobData,
} from "@lumora/core";
import { notificationRepo } from "@lumora/db";

const log = createLogger("notification");

/** Fans a notification out to org members and pushes it over SSE. */
export function startNotificationWorker(): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    QueueName.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      const { organizationId, kind, title, body, meta, userIds } = job.data;
      const recipients = await notificationRepo.fanOut({ organizationId, kind, title, body, meta, userIds });
      await publishRealtime(orgChannel(organizationId), {
        type: "notification",
        id: job.id ?? "",
        kind,
        title,
        body,
      });
      log.info("fanned out", { kind, recipients: recipients.length });
    },
    { connection: getRedis(), concurrency: 5 },
  );
}
