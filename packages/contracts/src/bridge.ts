import { z } from "zod";
import { uuidSchema } from "./common";

/** Dashboard → API: mint a short-lived pairing code for an event. */
export const createPairingCodeSchema = z.object({
  eventId: uuidSchema,
});

/** Bridge → API: exchange the pairing code for a device token. */
export const pairBridgeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "Pairing code is 8 alphanumeric characters"),
  deviceName: z.string().trim().min(2).max(120),
  platform: z.string().trim().max(60),
  appVersion: z.string().trim().max(30),
});
export type PairBridgeInput = z.infer<typeof pairBridgeSchema>;

export interface PairBridgeResult {
  deviceId: string;
  deviceToken: string; // long-lived JWT, bridge stores it locally
  eventId: string;
  eventName: string;
  organizationId: string;
  apiUrl: string;
}

export const bridgeHeartbeatSchema = z.object({
  queueDepth: z.number().int().min(0),
  watcherActive: z.boolean(),
  watchedFolder: z.string().max(500).nullish(),
  lastUploadAt: z.coerce.date().nullish(),
});
export type BridgeHeartbeatInput = z.infer<typeof bridgeHeartbeatSchema>;

/** Device-token claims (JWT). */
export interface BridgeTokenClaims {
  sub: string; // device id
  org: string;
  event: string;
  type: "bridge";
}

/** Multipart fields for a bridge photo upload. */
export const bridgeUploadFieldsSchema = z.object({
  /** Active session as known by the bridge; empty -> quarantine. */
  sessionId: uuidSchema.optional(),
  sequence: z.coerce.number().int().min(0).max(11).optional(),
  idempotencyKey: z.string().min(8).max(128),
  originalFilename: z.string().max(255),
  capturedAt: z.coerce.date().optional(),
});
export type BridgeUploadFields = z.infer<typeof bridgeUploadFieldsSchema>;
