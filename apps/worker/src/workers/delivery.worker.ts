import { Worker, type Job } from "bullmq";
import {
  DELIVERY_TOKEN_TTL_HOURS,
  eventChannel,
} from "@lumora/contracts";
import {
  QueueName,
  createLogger,
  generateSecretToken,
  getEnv,
  getRedis,
  hashToken,
  publishRealtime,
  type DeliveryJobData,
} from "@lumora/core";
import { deliveryRepo, deliveryTokenRepo } from "@lumora/db";
import { getEmailProvider } from "../providers/email";

const log = createLogger("delivery");

/** Mint a fresh guest link for outbound messages (same TTL as QR). */
async function mintGuestUrl(sessionId: string): Promise<string> {
  const token = generateSecretToken(24);
  await deliveryTokenRepo.create({
    sessionId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + DELIVERY_TOKEN_TTL_HOURS * 3600 * 1000),
  });
  return `${getEnv().APP_URL}/g/${token}`;
}

export function startDeliveryWorker(): Worker<DeliveryJobData> {
  return new Worker<DeliveryJobData>(
    QueueName.DELIVERY,
    async (job: Job<DeliveryJobData>) => {
      const delivery = await deliveryRepo.findById(job.data.deliveryId);
      if (!delivery) throw new Error(`Delivery ${job.data.deliveryId} not found`);
      if (delivery.status === "SENT") return; // idempotent replay

      try {
        if (delivery.channel === "EMAIL") {
          const url = await mintGuestUrl(delivery.sessionId);
          const eventName = delivery.event.name;
          await getEmailProvider().send({
            to: delivery.recipient,
            subject: `Your photos from ${eventName} are ready 📸`,
            text: `Thanks for visiting the photobooth at ${eventName}! Download your photos here: ${url}\n\nThe link expires in ${DELIVERY_TOKEN_TTL_HOURS} hours.`,
            html: `
              <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h2 style="margin:0 0 8px">Your photos are ready 📸</h2>
                <p style="color:#555">Thanks for visiting the photobooth at <strong>${eventName}</strong>.</p>
                <p style="margin:24px 0">
                  <a href="${url}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
                    Download your photos
                  </a>
                </p>
                <p style="color:#999;font-size:12px">This link expires in ${DELIVERY_TOKEN_TTL_HOURS} hours and is private to you.</p>
              </div>`,
          });
        }
        // QR deliveries are recorded synchronously at mint time; nothing to do.

        await deliveryRepo.markSent(delivery.id);
        await publishRealtime(eventChannel(delivery.eventId), {
          type: "notification",
          id: delivery.id,
          kind: "DELIVERY_SENT",
          title: "Delivery sent",
          body: `${delivery.channel} → ${delivery.recipient}`,
        });
        log.info("delivered", { id: delivery.id, channel: delivery.channel });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        if (isLastAttempt) await deliveryRepo.markFailed(delivery.id, message);
        throw err;
      }
    },
    { connection: getRedis(), concurrency: 5 },
  );
}
