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

  async uploadPhoto(input: {
    buffer: Buffer;
    filename: string;
    sessionId: string | null;
    sequence: number | null;
    idempotencyKey: string;
  }) {
    const cfg = getConfigStore().get();
    if (!cfg.apiUrl || !cfg.deviceToken) throw new BridgeApiError(401, "Not paired");

    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(input.buffer)], { type: "image/jpeg" }), input.filename);
    if (input.sessionId) form.set("sessionId", input.sessionId);
    if (input.sequence !== null) form.set("sequence", String(input.sequence));
    form.set("idempotencyKey", input.idempotencyKey);
    form.set("originalFilename", input.filename);
    form.set("capturedAt", new Date().toISOString());

    const res = await fetch(`${cfg.apiUrl}/api/bridge/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.deviceToken}` },
      body: form,
    });
    const data = await parse<{ photoId: string; quarantined: boolean }>(res);
    if (data.quarantined) {
      blog.warn(`Uploaded ${input.filename} but no session was capturing — photo quarantined`);
    }
    return data;
  },
};
