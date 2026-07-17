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

/** Input for requesting a presigned upload URL. */
export const bridgePresignSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  originalFilename: z.string().max(255),
});
export type BridgePresignInput = z.infer<typeof bridgePresignSchema>;

export interface BridgePresignResult {
  uploadUrl: string;
  photoId: string;
  idempotencyKey: string;
}

/** Input for confirming a successful upload. */
export const bridgeConfirmSchema = z.object({
  photoId: uuidSchema,
  idempotencyKey: z.string().min(8).max(128),
  originalFilename: z.string().max(255),
  sessionId: uuidSchema.optional(),
  sequence: z.coerce.number().int().min(0).max(11).optional(),
  capturedAt: z.coerce.date().optional(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  sizeBytes: z.number().int().min(1),
});
export type BridgeConfirmInput = z.infer<typeof bridgeConfirmSchema>;
