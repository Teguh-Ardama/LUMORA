import { z } from "zod";
import { paginationQuerySchema } from "./common";
import { AuditAction } from "./enums";

export const auditQuerySchema = paginationQuerySchema.extend({
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().max(60).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorType: "USER" | "BRIDGE" | "SYSTEM";
  organizationId: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}
