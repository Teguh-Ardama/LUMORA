import type { BridgeDeviceStatus, SessionStatus } from "./enums";

/**
 * Realtime events pushed over the per-event SSE stream
 * (`GET /api/events/:id/stream`). Producers publish via Redis pub/sub;
 * the web tier fans out to connected operator screens.
 */
export type RealtimeEvent =
  | {
      type: "session.status";
      sessionId: string;
      status: SessionStatus;
      composedUrl?: string;
    }
  | {
      type: "session.photo";
      sessionId: string;
      photoId: string;
      sequence: number;
      thumbnailUrl?: string;
      source: "WEBCAM" | "BRIDGE";
    }
  | {
      type: "photo.quarantined";
      photoId: string;
      originalFilename: string | null;
    }
  | {
      type: "bridge.status";
      deviceId: string;
      deviceName: string;
      status: BridgeDeviceStatus;
      queueDepth?: number;
    }
  | {
      type: "print.status";
      printJobId: string;
      sessionId: string;
      status: string;
    }
  | {
      type: "notification";
      id: string;
      kind: string;
      title: string;
      body: string;
    };

export function eventChannel(eventId: string): string {
  return `lumora:event:${eventId}`;
}

export function orgChannel(organizationId: string): string {
  return `lumora:org:${organizationId}`;
}
