import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  bridgeHeartbeatSchema,
  bridgePresignSchema,
  bridgeConfirmSchema,
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

  .get("/stream", requireBridge, async (c) => {
    const device = c.get("bridgeDevice");
    if (!device.eventId) throw new ApiError(ApiErrorCode.FORBIDDEN, "Bridge is not paired to any event", 403);
    
    // Import streamSSE here to avoid circular dependencies if any, or import at top
    const { streamSSE } = await import("hono/streaming");
    const { subscribeRealtime } = await import("@lumora/core");
    const { eventChannel } = await import("@lumora/contracts");

    return streamSSE(c, async (stream) => {
      let alive = true;
      const unsubscribe = subscribeRealtime(eventChannel(device.eventId!), (event) => {
        if (!alive) return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        alive = false;
        unsubscribe();
      });
      while (alive) {
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
        await stream.sleep(25_000);
      }
    });
  })

  .post("/heartbeat", requireBridge, zValidator("json", bridgeHeartbeatSchema), async (c) => {
    const device = c.get("bridgeDevice");
    const result = await bridgeService.heartbeat(device, c.req.valid("json"));
    return ok(c, result);
  })

  .post(
    "/photos/presign",
    requireBridge,
    rateLimitBy("bridge-upload-presign", 240, 60, (c) => c.get("bridgeDevice").id),
    zValidator("json", bridgePresignSchema),
    async (c) => {
      const device = c.get("bridgeDevice");
      const input = c.req.valid("json");
      const result = await bridgeService.presignPhoto(device, input);
      return ok(c, result, 201);
    },
  )

  .post(
    "/photos/confirm",
    requireBridge,
    rateLimitBy("bridge-upload-confirm", 240, 60, (c) => c.get("bridgeDevice").id),
    zValidator("json", bridgeConfirmSchema),
    async (c) => {
      const device = c.get("bridgeDevice");
      const input = c.req.valid("json");
      const result = await bridgeService.confirmPhoto(device, input);
      return ok(c, result, 201);
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
