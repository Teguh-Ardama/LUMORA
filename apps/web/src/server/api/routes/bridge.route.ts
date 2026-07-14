import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  bridgeHeartbeatSchema,
  bridgeUploadFieldsSchema,
  pairBridgeSchema,
} from "@lumora/contracts";
import { bridgeService } from "../../services/bridge.service";
import { ok, rateLimitBy, requireAuth, requireBridge, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

/**
 * Desktop Bridge API. `/pair` is code-authenticated; everything else
 * requires the device bearer token minted at pairing time.
 */
export const bridgeRoute = new Hono<ApiEnv>()
  .post("/pair", rateLimitBy("bridge-pair", 10, 60), zValidator("json", pairBridgeSchema), async (c) => {
    const result = await bridgeService.pair(c.req.valid("json"));
    return ok(c, result, 201);
  })

  .post("/heartbeat", requireBridge, zValidator("json", bridgeHeartbeatSchema), async (c) => {
    const device = c.get("bridgeDevice");
    const result = await bridgeService.heartbeat(device, c.req.valid("json"));
    return ok(c, result);
  })

  .post(
    "/photos",
    requireBridge,
    rateLimitBy("bridge-upload", 240, 60, (c) => c.get("bridgeDevice").id),
    async (c) => {
      const device = c.get("bridgeDevice");
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!(file instanceof File)) throw new ApiError(ApiErrorCode.VALIDATION, "Photo file is required", 422);
      const fields = bridgeUploadFieldsSchema.parse({
        sessionId: body["sessionId"] || undefined,
        sequence: body["sequence"] || undefined,
        idempotencyKey: body["idempotencyKey"],
        originalFilename: body["originalFilename"] ?? file.name,
        capturedAt: body["capturedAt"] || undefined,
      });
      const result = await bridgeService.uploadPhoto(
        device,
        { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type || "image/jpeg" },
        fields,
      );
      return ok(c, { photoId: result.photo.id, quarantined: result.quarantined }, 201);
    },
  );

/** Dashboard-side device management. */
export const bridgeAdminRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .delete("/:deviceId", requirePermission(Permission.BRIDGE_MANAGE), async (c) => {
    const user = c.get("user");
    await bridgeService.revoke(user, c.req.param("deviceId"));
    return ok(c, { done: true });
  });
