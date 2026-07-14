import {
  ALLOWED_PHOTO_MIME,
  ApiError,
  ApiErrorCode,
  PHOTO_UPLOAD_MAX_BYTES,
  eventChannel,
  type BridgeHeartbeatInput,
  type BridgeUploadFields,
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
import { inspectImage } from "@lumora/image/server";
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
   * DSLR photo intake. Photos that arrive without a CAPTURING bridge
   * session are QUARANTINED, not dropped — cameras fire when they fire.
   */
  async uploadPhoto(
    device: BridgeDevice,
    file: { buffer: Buffer; mime: string },
    fields: BridgeUploadFields,
  ) {
    if (file.buffer.length > PHOTO_UPLOAD_MAX_BYTES) {
      throw new ApiError(ApiErrorCode.PAYLOAD_TOO_LARGE, "Photo exceeds the maximum upload size", 413);
    }
    if (!ALLOWED_PHOTO_MIME.includes(file.mime as (typeof ALLOWED_PHOTO_MIME)[number])) {
      throw new ApiError(ApiErrorCode.VALIDATION, "Unsupported content type", 422);
    }

    const duplicate = await photoRepo.findByIdempotencyKey(device.eventId, fields.idempotencyKey);
    if (duplicate) return { photo: duplicate, quarantined: duplicate.status === "QUARANTINED" };

    const info = await inspectImage(file.buffer).catch(() => {
      throw new ApiError(ApiErrorCode.VALIDATION, "File is not a valid image", 422);
    });

    let sessionId: string | null = null;
    let sequence = fields.sequence ?? 0;
    if (fields.sessionId) {
      const session = await sessionRepo.findById(fields.sessionId);
      if (
        session &&
        session.eventId === device.eventId &&
        session.status === "CAPTURING" &&
        session.captureSource === "BRIDGE"
      ) {
        sessionId = session.id;
        if (fields.sequence === undefined) sequence = session.photos.length;
      }
    }

    const photoId = crypto.randomUUID();
    const key = storageKeys.rawPhoto(device.organizationId, device.eventId, photoId);
    await getStorage().putObject({ key, body: file.buffer, contentType: "image/jpeg" });

    const photo = await photoRepo.create({
      id: photoId,
      organizationId: device.organizationId,
      eventId: device.eventId,
      sessionId,
      sequence,
      source: "BRIDGE",
      status: sessionId ? "UPLOADED" : "QUARANTINED",
      storageKey: key,
      width: info.width,
      height: info.height,
      sizeBytes: info.sizeBytes,
      originalFilename: fields.originalFilename,
      idempotencyKey: fields.idempotencyKey,
      capturedAt: fields.capturedAt,
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

    return { photo, quarantined: !sessionId };
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
