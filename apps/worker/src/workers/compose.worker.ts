import { Worker, type Job } from "bullmq";
import {
  QueueName,
  createLogger,
  enqueueNotification,
  getRedis,
  getStorage,
  publishRealtime,
  storageKeys,
  type ComposeJobData,
} from "@lumora/core";
import { eventChannel, filterParamsSchema } from "@lumora/contracts";
import { composeSession } from "@lumora/image/server";
import { auditRepo, billingRepo, getSessionPrice, sessionRepo } from "@lumora/db";
import { getEnv } from "@lumora/core";

const log = createLogger("compose");

/**
 * FR-04 Composer Engine. Pulls the session's raw photos from storage,
 * runs filter → layout → border composition, stores the 4R output, and
 * flips the session to READY (or FAILED with a reason the operator sees).
 */
export function startComposeWorker(): Worker<ComposeJobData> {
  return new Worker<ComposeJobData>(
    QueueName.COMPOSE,
    async (job: Job<ComposeJobData>) => {
      const { sessionId } = job.data;
      const started = Date.now();

      const session = await sessionRepo.findById(sessionId);
      if (!session) throw new Error(`Session ${sessionId} not found`);
      if (session.status === "READY" && session.composedKey) return; // idempotent replay
      if (session.status !== "COMPOSING") {
        log.warn("session not in COMPOSING, skipping", { sessionId, status: session.status });
        return;
      }

      const storage = getStorage();

      try {
        // Parallel fetch: photos + border + stickers
        const [photoBuffers, borderPng, stickerBuffers, filterParams] = await Promise.all([
          Promise.all(session.photos.map((p) => storage.getObject(p.storageKey))),
          session.border ? storage.getObject(session.border.storageKey) : Promise.resolve(null),
          session.sessionStickers?.length
            ? Promise.all(
                session.sessionStickers.map((ss: { sticker: { storageKey: string }; offsetX?: number; offsetY?: number; scale?: number }) =>
                  storage.getObject(ss.sticker.storageKey).then((png: Buffer) => ({
                    png,
                    offsetX: ss.offsetX ?? 0,
                    offsetY: ss.offsetY ?? 0,
                    scale: ss.scale ?? 1.0,
                  })),
                ),
              )
            : Promise.resolve(undefined),
          Promise.resolve(filterParamsSchema.parse(session.filter.params)),
        ]);

        const result = await composeSession({
          photos: photoBuffers,
          layoutConfig: session.layout.config,
          borderPng,
          filterParams,
          stickers: stickerBuffers,
        });

        const composedKey = storageKeys.composed(session.organizationId, session.eventId, session.id);
        await storage.putObject({
          key: composedKey,
          body: result.buffer,
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });

        const composeMs = Date.now() - started;
        await sessionRepo.transition(sessionId, ["COMPOSING"], "READY", {
          composedKey,
          composedAt: new Date(),
          composeMs,
        });

        // Billing: charge exactly once at the moment value is delivered.
        // Idempotent (unique session_id+type); never blocks the session.
        try {
          const env = getEnv();
          const price = await getSessionPrice(session.organizationId, env.PRICE_PER_SESSION_IDR);
          if (price > 0) {
            const newBalance = await billingRepo.chargeSession({
              organizationId: session.organizationId,
              sessionId: session.id,
              amount: price,
              note: `Session in "${session.event.name}"`,
            });
            if (newBalance !== null && newBalance < env.LOW_BALANCE_THRESHOLD_IDR) {
              await enqueueNotification({
                organizationId: session.organizationId,
                kind: "LOW_BALANCE",
                title: "Credit balance is low",
                body: `Balance is Rp${newBalance.toLocaleString("id-ID")} (~${Math.max(0, Math.floor(newBalance / price))} sessions left). Top up to keep the booth running.`,
              });
            }
          }
        } catch (billErr) {
          // Billing failures must never fail a guest's photo.
          log.error("charge failed", { sessionId, err: String(billErr) });
        }

        const composedUrl = await storage.getSignedUrl(composedKey, 3600);
        await publishRealtime(eventChannel(session.eventId), {
          type: "session.status",
          sessionId,
          status: "READY",
          composedUrl,
        });
        await auditRepo.write({
          organizationId: session.organizationId,
          actorType: "SYSTEM",
          action: "COMPOSE",
          entityType: "session",
          entityId: sessionId,
          metadata: { composeMs, width: result.width, height: result.height },
        });
        log.info("composed", { sessionId, composeMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        if (isLastAttempt) {
          await sessionRepo.transition(sessionId, ["COMPOSING"], "FAILED", {
            composeError: message.slice(0, 1000),
          });
          await publishRealtime(eventChannel(session.eventId), {
            type: "session.status",
            sessionId,
            status: "FAILED",
          });
          await enqueueNotification({
            organizationId: session.organizationId,
            kind: "COMPOSE_FAILED",
            title: "Compose failed",
            body: `Session in "${session.event.name}" failed to compose: ${message.slice(0, 120)}`,
            meta: { sessionId },
          });
        }
        throw err; // let BullMQ apply retry/backoff
      }
    },
    { connection: getRedis(), concurrency: 2 },
  );
}
