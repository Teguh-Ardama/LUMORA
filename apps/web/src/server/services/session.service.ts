import {
  ALLOWED_PHOTO_MIME,
  ApiError,
  ApiErrorCode,
  DELIVERY_TOKEN_TTL_HOURS,
  PHOTO_UPLOAD_MAX_BYTES,
  eventChannel,
  layoutConfigSchema,
  requiredPhotoCount,
  type RequestDeliveryInput,
  type SessionUser,
  type StartSessionInput,
  type UpdateSessionInput,
} from "@lumora/contracts";
import {
  enqueueCompose,
  enqueueDelivery,
  generateSecretToken,
  getEnv,
  getStorage,
  hashToken,
  publishRealtime,
  storageKeys,
} from "@lumora/core";
import { inspectImage } from "@lumora/image/server";
import {
  auditRepo,
  borderRepo,
  deliveryRepo,
  deliveryTokenRepo,
  filterRepo,
  layoutRepo,
  photoRepo,
  prisma,
  printJobRepo,
  sessionRepo,
  type SessionWithRelations,
} from "@lumora/db";
import { mediaService } from "./media.service";
import { billingService } from "./billing.service";

function badRequest(message: string): ApiError {
  return new ApiError(ApiErrorCode.VALIDATION, message, 422);
}

async function validateSessionConfig(
  organizationId: string,
  eventId: string,
  ids: { borderId?: string | null; layoutId?: string; filterId?: string },
) {
  if (ids.layoutId) {
    const layout = await layoutRepo.findById(ids.layoutId);
    if (!layout || (layout.organizationId && layout.organizationId !== organizationId))
      throw badRequest("Layout not available for this organization");
    if (layout.eventId && layout.eventId !== eventId) throw badRequest("Layout belongs to another event");
    layoutConfigSchema.parse(layout.config);
  }
  if (ids.borderId) {
    const border = await borderRepo.findById(ids.borderId);
    if (!border || (border.organizationId && border.organizationId !== organizationId))
      throw badRequest("Border not available for this organization");
    if (border.eventId && border.eventId !== eventId) throw badRequest("Border belongs to another event");
  }
  if (ids.filterId) {
    const filter = await filterRepo.findById(ids.filterId);
    if (!filter || (filter.organizationId && filter.organizationId !== organizationId))
      throw badRequest("Filter not available for this organization");
  }
}

/** Serialize a session for API responses, with signed media URLs. */
export async function serializeSession(session: SessionWithRelations) {
  const [composedUrl, photoUrls] = await Promise.all([
    mediaService.composedUrl(session),
    Promise.all(session.photos.map((p) => mediaService.photoUrl(p))),
  ]);
  return {
    id: session.id,
    eventId: session.eventId,
    status: session.status,
    captureSource: session.captureSource,
    guestName: session.guestName,
    guestEmail: session.guestEmail,
    border: session.border ? { id: session.border.id, name: session.border.name } : null,
    layout: {
      id: session.layout.id,
      name: session.layout.name,
      mode: session.layout.mode,
      photoCount: session.layout.photoCount,
      config: session.layout.config,
    },
    filter: { id: session.filter.id, name: session.filter.name, kind: session.filter.kind },
    photos: session.photos.map((p, i) => ({
      id: p.id,
      sequence: p.sequence,
      source: p.source,
      width: p.width,
      height: p.height,
      url: photoUrls[i],
    })),
    composedUrl,
    composeError: session.composeError,
    startedAt: session.startedAt.toISOString(),
  };
}

export const sessionService = {
  /**
   * FR-06 heart: starting a session CLOSES every open session for the
   * event and revokes their delivery tokens — the previous guest's QR is
   * dead the instant "New Session" is pressed.
   */
  async start(user: SessionUser, input: StartSessionInput) {
    const existing = await sessionRepo.findByIdempotencyKey(input.eventId, input.idempotencyKey);
    if (existing) return serializeSession(existing);

    // Billing gate: new sessions need credit; the in-flight one always finishes.
    await billingService.assertCanStartSession(user.organizationId);

    await validateSessionConfig(user.organizationId, input.eventId, input);

    const previous = await sessionRepo.findActiveForEvent(input.eventId);
    if (previous) {
      await deliveryTokenRepo.revokeForSession(previous.id);
    }
    await sessionRepo.closeAllForEvent(input.eventId);

    const session = await sessionRepo.create({
      organizationId: user.organizationId,
      eventId: input.eventId,
      borderId: input.borderId ?? null,
      layoutId: input.layoutId,
      filterId: input.filterId,
      captureSource: input.captureSource,
      startedById: user.id,
      idempotencyKey: input.idempotencyKey,
    });

    await publishRealtime(eventChannel(input.eventId), {
      type: "session.status",
      sessionId: session.id,
      status: "CAPTURING",
    });
    if (previous) {
      await publishRealtime(eventChannel(input.eventId), {
        type: "session.status",
        sessionId: previous.id,
        status: "CLOSED",
      });
    }

    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "SESSION_START",
      entityType: "session",
      entityId: session.id,
      metadata: { eventId: input.eventId, captureSource: input.captureSource },
    });

    return serializeSession(session);
  },

  async update(user: SessionUser, sessionId: string, input: UpdateSessionInput) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status !== "CAPTURING" && (input.layoutId || input.borderId !== undefined || input.filterId)) {
      throw badRequest("Layout, border, and filter can only change while capturing");
    }
    await validateSessionConfig(user.organizationId, session.eventId, {
      borderId: input.borderId ?? undefined,
      layoutId: input.layoutId,
      filterId: input.filterId,
    });
    const updated = await sessionRepo.update(sessionId, {
      ...(input.borderId !== undefined ? { borderId: input.borderId } : {}),
      ...(input.layoutId ? { layoutId: input.layoutId } : {}),
      ...(input.filterId ? { filterId: input.filterId } : {}),
      ...(input.guestName !== undefined ? { guestName: input.guestName } : {}),
      ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
    });
    return serializeSession(updated);
  },

  /** Webcam upload path (operator browser). Bridge has its own entry. */
  async uploadPhoto(
    user: SessionUser,
    sessionId: string,
    file: { buffer: Buffer; mime: string },
    fields: { sequence: number; idempotencyKey: string; capturedAt?: Date },
  ) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status !== "CAPTURING") throw badRequest("Session is not capturing");

    const duplicate = await photoRepo.findByIdempotencyKey(session.eventId, fields.idempotencyKey);
    if (duplicate) return duplicate;

    if (file.buffer.length > PHOTO_UPLOAD_MAX_BYTES) {
      throw new ApiError(ApiErrorCode.PAYLOAD_TOO_LARGE, "Photo exceeds the maximum upload size", 413);
    }
    if (!ALLOWED_PHOTO_MIME.includes(file.mime as (typeof ALLOWED_PHOTO_MIME)[number])) {
      throw badRequest("Unsupported content type");
    }
    const info = await inspectImage(file.buffer).catch(() => {
      throw badRequest("File is not a valid image");
    });

    const photoId = crypto.randomUUID();
    const key = storageKeys.rawPhoto(user.organizationId, session.eventId, photoId);
    await getStorage().putObject({ key, body: file.buffer, contentType: "image/jpeg" });

    const photo = await photoRepo.create({
      id: photoId,
      organizationId: user.organizationId,
      eventId: session.eventId,
      sessionId: session.id,
      sequence: fields.sequence,
      source: "WEBCAM",
      storageKey: key,
      width: info.width,
      height: info.height,
      sizeBytes: info.sizeBytes,
      idempotencyKey: fields.idempotencyKey,
      capturedAt: fields.capturedAt,
    });

    await publishRealtime(eventChannel(session.eventId), {
      type: "session.photo",
      sessionId: session.id,
      photoId: photo.id,
      sequence: photo.sequence,
      source: "WEBCAM",
    });
    return photo;
  },

  /** Transition to COMPOSING and enqueue the worker job (FR-04). */
  async requestCompose(user: SessionUser, sessionId: string) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status === "COMPOSING") return serializeSession(session);
    if (session.status !== "CAPTURING" && session.status !== "FAILED") {
      throw badRequest("Session cannot be composed in its current state");
    }

    const layoutConfig = layoutConfigSchema.parse(session.layout.config);
    const needed = requiredPhotoCount(layoutConfig);
    if (session.photos.length < needed) {
      throw badRequest(`Layout "${session.layout.name}" needs ${needed} photos; only ${session.photos.length} captured`);
    }

    const transitioned = await sessionRepo.transition(sessionId, ["CAPTURING", "FAILED"], "COMPOSING", {
      composeError: null,
    });
    if (!transitioned) throw badRequest("Session state changed, try again");

    await enqueueCompose({ sessionId, requestedBy: user.id });
    await publishRealtime(eventChannel(session.eventId), {
      type: "session.status",
      sessionId,
      status: "COMPOSING",
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "COMPOSE",
      entityType: "session",
      entityId: sessionId,
    });
    return serializeSession(transitioned);
  },

  /** Mint (or reuse) the live QR token → guest gallery URL (FR-06). */
  async mintQrToken(user: SessionUser, sessionId: string) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status !== "READY") throw badRequest("Session is not composed yet");

    const token = generateSecretToken(24);
    const expiresAt = new Date(Date.now() + DELIVERY_TOKEN_TTL_HOURS * 3600 * 1000);
    await deliveryTokenRepo.create({ sessionId, tokenHash: hashToken(token), expiresAt });

    // Every mint records a QR delivery for analytics; recipient is the token id surrogate.
    await deliveryRepo.create({
      organizationId: user.organizationId,
      eventId: session.eventId,
      sessionId,
      channel: "QR",
      recipient: "qr-scan",
      status: "SENT",
      sentAt: new Date(),
    });

    return {
      url: `${getEnv().APP_URL}/g/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  },

  async requestDelivery(user: SessionUser, sessionId: string, input: RequestDeliveryInput) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status !== "READY") throw badRequest("Session is not composed yet");
    if (input.channel === "QR") throw badRequest("Use the QR endpoint for QR delivery");

    const recipient = input.email!;

    // Persist guest email on the session for analytics / re-delivery.
    await sessionRepo.update(sessionId, { guestEmail: recipient });

    const delivery = await deliveryRepo.create({
      organizationId: user.organizationId,
      eventId: session.eventId,
      sessionId,
      channel: input.channel,
      recipient,
    });
    await enqueueDelivery({ deliveryId: delivery.id });

    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "DELIVER",
      entityType: "delivery",
      entityId: delivery.id,
      metadata: { channel: input.channel, sessionId },
    });

    return { deliveryId: delivery.id, status: delivery.status };
  },

  async createPrintJob(user: SessionUser, sessionId: string, copies: number) {
    const session = await sessionRepo.findByIdScoped(sessionId, user.organizationId);
    if (!session) throw new ApiError(ApiErrorCode.NOT_FOUND, "Session not found", 404);
    if (session.status !== "READY" || !session.composedKey) throw badRequest("Nothing to print yet");

    const job = await printJobRepo.create({
      organizationId: user.organizationId,
      eventId: session.eventId,
      sessionId,
      copies,
      requestedById: user.id,
    });
    await publishRealtime(eventChannel(session.eventId), {
      type: "print.status",
      printJobId: job.id,
      sessionId,
      status: job.status,
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "PRINT",
      entityType: "print_job",
      entityId: job.id,
      metadata: { sessionId, copies },
    });
    const composedUrl = await mediaService.composedUrl(session);
    return { id: job.id, status: job.status, copies: job.copies, composedUrl };
  },
};
