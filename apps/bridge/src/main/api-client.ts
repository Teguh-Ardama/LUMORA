import { getConfigStore } from "./config-store";
import { blog } from "./logger";

export class BridgeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BridgeApiError";
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function parse<T>(res: Response): Promise<T> {
  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new BridgeApiError(res.status, `Unexpected response (${res.status})`);
  }
  if (!json.ok || json.data === undefined) {
    throw new BridgeApiError(res.status, json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data;
}

/** Authenticated bridge API client (device bearer token). */
export const bridgeApi = {
  async pair(apiUrl: string, body: Record<string, unknown>) {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/bridge/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parse<{
      deviceId: string;
      deviceToken: string;
      eventId: string;
      eventName: string;
      apiUrl: string;
    }>(res);
  },

  async heartbeat(payload: {
    queueDepth: number;
    watcherActive: boolean;
    watchedFolder: string | null;
  }) {
    const cfg = getConfigStore().get();
    if (!cfg.apiUrl || !cfg.deviceToken) throw new BridgeApiError(401, "Not paired");
    const res = await fetch(`${cfg.apiUrl}/api/bridge/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.deviceToken}`,
      },
      body: JSON.stringify(payload),
    });
    return parse<{ activeSession: { id: string; photoCount: number; framesPerSession: number } | null }>(res);
  },

  async presignPhoto(input: {
    filename: string;
    idempotencyKey: string;
  }) {
    const cfg = getConfigStore().get();
    if (!cfg.apiUrl || !cfg.deviceToken) throw new BridgeApiError(401, "Not paired");

    const res = await fetch(`${cfg.apiUrl}/api/bridge/photos/presign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.deviceToken}`,
      },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        originalFilename: input.filename,
      }),
    });
    return parse<{ uploadUrl: string; photoId: string; idempotencyKey: string }>(res);
  },

  async confirmPhoto(input: {
    photoId: string;
    idempotencyKey: string;
    filename: string;
    sessionId: string | null;
    sequence: number | null;
    width: number;
    height: number;
    sizeBytes: number;
  }) {
    const cfg = getConfigStore().get();
    if (!cfg.apiUrl || !cfg.deviceToken) throw new BridgeApiError(401, "Not paired");

    const res = await fetch(`${cfg.apiUrl}/api/bridge/photos/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.deviceToken}`,
      },
      body: JSON.stringify({
        photoId: input.photoId,
        idempotencyKey: input.idempotencyKey,
        originalFilename: input.filename,
        sessionId: input.sessionId ?? undefined,
        sequence: input.sequence ?? undefined,
        capturedAt: new Date().toISOString(),
        width: input.width,
        height: input.height,
        sizeBytes: input.sizeBytes,
      }),
    });
    const data = await parse<{ photoId: string; quarantined: boolean }>(res);
    if (data.quarantined) {
      blog.warn(`Confirmed ${input.filename} but no session was capturing — photo quarantined`);
    }
    return data;
  },
};
