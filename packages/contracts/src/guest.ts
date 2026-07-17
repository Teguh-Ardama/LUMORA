import { z } from "zod";
import { uuidSchema, paginationQuerySchema } from "./common";

/** Public info about an event for the guest gallery. */
export interface GuestEventInfo {
  eventId: string;
  eventName: string;
  organizationName: string;
  requiresPin: boolean;
  startsAt: string;
  endsAt: string;
  isLive: boolean;
}

/** Input for verifying event PIN. */
export const verifyEventPinSchema = z.object({
  pin: z.string().trim().min(1, "PIN is required").max(20),
});
export type VerifyEventPinInput = z.infer<typeof verifyEventPinSchema>;

/** Photo item in the guest gallery grid. */
export interface GuestPhotoItem {
  sessionId: string;
  composedUrl: string;
  createdAt: string;
}

/** Payload for the gallery photo list. */
export interface GuestGalleryListPayload {
  items: GuestPhotoItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
