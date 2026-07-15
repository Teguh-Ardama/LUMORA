import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, q: PaginationQuery): Paginated<T> {
  return {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/**
 * E.164-ish WhatsApp number. Accepts local Indonesian input (leading 0,
 * spaces/dashes, optional +) and normalizes to bare digits with country
 * code (e.g. "0812-345-678" -> "62812345678") so downstream wa.me links
 * and provider APIs always receive a dialable number.
 */
export const waNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .transform((v) => (v.startsWith("0") ? `62${v.slice(1)}` : v.replace(/^\+/, "")))
  .refine((v) => /^[1-9]\d{7,14}$/.test(v), "Invalid WhatsApp number");

export const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const idempotencyKeySchema = z.string().min(8).max(128);
