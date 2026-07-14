import { z } from "zod";
import { uuidSchema } from "./common";

export const analyticsQuerySchema = z.object({
  eventId: uuidSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface AnalyticsSummary {
  totalEvents: number;
  totalSessions: number;
  readySessions: number;
  failedSessions: number;
  totalPhotos: number;
  totalDeliveries: number;
  deliveriesByChannel: Record<string, number>;
  totalPrintJobs: number;
  printedJobs: number;
  avgComposeMs: number | null;
  sessionsPerDay: Array<{ date: string; count: number }>;
  filterUsage: Array<{ filterName: string; count: number }>;
  captureSourceSplit: Record<string, number>;
}
