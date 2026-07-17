import {
  ALLOWED_PHOTO_MIME,
  ApiError,
  ApiErrorCode,
  PHOTO_UPLOAD_MAX_BYTES,
  eventChannel,
  type BridgeHeartbeatInput,
  type BridgePresignInput,
  type BridgeConfirmInput,
  type PairBridgeInput,
  type PairBridgeResult,
  type SessionUser,
} from "@lumora/contracts";
import {
  generatePairingCode,
  getEnv,
  getRedis,
  getStorage,
  hashToken,
  publishRealtime,
  signBridgeToken,
  storageKeys,
} from "@lumora/core";
import { auditRepo, bridgeDeviceRepo, photoRepo, prisma, sessionRepo, type BridgeDevice } from "@lumora/db";

const PAIRING_TTL_SECONDS = 10 * 60;

function pairingKey(code: string): string {
  return `bridge:pairing:${code}`;
}

export const bridgeService = {
  /** Dashboard side: mint a short-lived pairing code for an event. */
  async createPairingCode(user: SessionUser, eventId: string) {
    const code = generatePairingCode();
    await getRedis().set(
      pairingKey(code),
      JSON.stringify({ eventId, organizationId: user.organizationId, createdBy: user.id }),
      "EX",
      PAIRING_TTL_SECONDS,
    );
    return { code, expiresInSeconds: PAIRING_TTL_SECONDS };
  },

  /** Bridge side: exchange the code for a long-lived device token. */
  async pair(input: PairBridgeInput): Promise<PairBridgeResult> {
    const raw = await getRedis().getdel(pairingKey(input.code));
    if (!raw) throw new ApiError(ApiErrorCode.GONE, "Pairing code invalid or expired", 410);
    const { eventId, organizationId } = JSON.parse(raw) as { eventId: string; organizationId: string };

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!event) throw new ApiError(ApiErrorCode.NOT_FOUND, "Event no longer exists", 404);

    const device = await bridgeDeviceRepo.create({
      organizationId,
      eventId,
      name: input.deviceName,
      platform: input.platform,
      appVersion: input.appVersion,
      tokenHash: "pending",
      lastSeenAt: new Date(),
    });
    const deviceToken = await signBridgeToken({ sub: device.id, org: organizationId, event: eventId });
    await prisma.bridgeDevice.update({
      where: { id: device.id },
      data: { tokenHash: hashToken(deviceToken) },
    });

    await publishRealtime(eventChannel(eventId), {
      type: "bridge.status",
      deviceId: device.id,
      deviceName: device.name,
      status: "ONLINE",
    });
    await auditRepo.write({
      organizationId,
      actorType: "BRIDGE",
      actorId: device.id,
      actorName: device.name,
      action: "PAIR",
      entityType: "bridge_device",
      entityId: device.id,
      metadata: { eventId, platform: input.platform },
    });

    return {
      deviceId: device.id,
      deviceToken,
      eventId,
      eventName: event.name,
      organizationId,
      apiUrl: getEnv().APP_URL,
    };
  },

  async heartbeat(device: BridgeDevice, input: BridgeHeartbeatInput) {
    await bridgeDeviceRepo.heartbeat(device.id, {
      queueDepth: input.queueDepth,
      watchedFolder: input.watchedFolder,
    });
    await publishRealtime(eventChannel(device.eventId), {
      type: "bridge.status",
      deviceId: device.id,
      deviceName: device.name,
      status: "ONLINE",
      queueDepth: input.queueDepth,
    });
    const session = await sessionRepo.findActiveForEvent(device.eventId);
    return {
      activeSession:
        session && session.status === "CAPTURING" && session.captureSource === "BRIDGE"
          ? { id: session.id, photoCount: session.photos.length, framesPerSession: session.event.framesPerSession }
          : null,
    };
  },

  /**
   * Phase 1: Bridge asks for a presigned upload URL.
   * If an idempotency key matches an already uploaded/quarantined photo, we return the existing URL (or just skip).
   */
  async presignPhoto(device: BridgeDevice, input: BridgePresignInput) {
    const duplicate = await photoRepo.findByIdempotencyKey(device.eventId, input.idempotencyKey);
    if (duplicate) {
      // Already processed. Return early.
      return { uploadUrl: "", photoId: duplicate.id, idempotencyKey: input.idempotencyKey };
    }

    const photoId = crypto.randomUUID();
    const key = storageKeys.rawPhoto(device.organizationId, device.eventId, photoId);
    
    // Generate a 1-hour presigned PUT URL
    const uploadUrl = await getStorage().getSignedUploadUrl(key, "image/jpeg");

    return { uploadUrl, photoId, idempotencyKey: input.idempotencyKey };
  },

  /**
   * Phase 2: Bridge confirms the file was successfully uploaded to the S3 bucket.
   * We now create the database record and trigger the SSE realtime events.
   */
  async confirmPhoto(device: BridgeDevice, input: BridgeConfirmInput) {
    const duplicate = await photoRepo.findByIdempotencyKey(device.eventId, input.idempotencyKey);
    if (duplicate) return { photoId: duplicate.id, quarantined: duplicate.status === "QUARANTINED" };

    let sessionId: string | null = null;
    let sequence = input.sequence ?? 0;
    
    if (input.sessionId) {
      const session = await sessionRepo.findById(input.sessionId);
      if (
        session &&
        session.eventId === device.eventId &&
        session.status === "CAPTURING" &&
        session.captureSource === "BRIDGE"
      ) {
        sessionId = session.id;
        if (input.sequence === undefined) sequence = session.photos.length;
      }
    }

    const key = storageKeys.rawPhoto(device.organizationId, device.eventId, input.photoId);

    const photo = await photoRepo.create({
      id: input.photoId,
      organizationId: device.organizationId,
      eventId: device.eventId,
      sessionId,
      sequence,
      source: "BRIDGE",
      status: sessionId ? "UPLOADED" : "QUARANTINED",
      storageKey: key,
      width: input.width,
      height: input.height,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename,
      idempotencyKey: input.idempotencyKey,
      capturedAt: input.capturedAt,
    });

    if (sessionId) {
      await publishRealtime(eventChannel(device.eventId), {
        type: "session.photo",
        sessionId,
        photoId: photo.id,
        sequence: photo.sequence,
        source: "BRIDGE",
      });
    } else {
      await publishRealtime(eventChannel(device.eventId), {
        type: "photo.quarantined",
        photoId: photo.id,
        originalFilename: photo.originalFilename,
      });
    }

    return { photoId: photo.id, quarantined: !sessionId };
  },

  async revoke(user: SessionUser, deviceId: string) {
    const device = await bridgeDeviceRepo.findById(deviceId);
    if (!device || device.organizationId !== user.organizationId) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, "Device not found", 404);
    }
    await bridgeDeviceRepo.revoke(deviceId);
    await publishRealtime(eventChannel(device.eventId), {
      type: "bridge.status",
      deviceId,
      deviceName: device.name,
      status: "REVOKED",
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "REVOKE",
      entityType: "bridge_device",
      entityId: deviceId,
    });
  },
};
