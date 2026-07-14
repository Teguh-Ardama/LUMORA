import { z } from "zod";
import { uuidSchema } from "./common";
import { EventStatus } from "./enums";

export const createEventSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientName: z.string().trim().max(160).optional(),
  venue: z.string().trim().max(200).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  defaultBorderId: uuidSchema.nullish(),
  defaultLayoutId: uuidSchema.nullish(),
  framesPerSession: z.number().int().min(1).max(6).default(4),
  countdownSeconds: z.number().int().min(0).max(10).default(3),
}).refine((v) => v.endsAt > v.startsAt, {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  clientName: z.string().trim().max(160).nullish(),
  venue: z.string().trim().max(200).nullish(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.nativeEnum(EventStatus).optional(),
  defaultBorderId: uuidSchema.nullish(),
  defaultLayoutId: uuidSchema.nullish(),
  framesPerSession: z.number().int().min(1).max(6).optional(),
  countdownSeconds: z.number().int().min(0).max(10).optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const assignOperatorsSchema = z.object({
  userIds: z.array(uuidSchema).max(50),
});
export type AssignOperatorsInput = z.infer<typeof assignOperatorsSchema>;
