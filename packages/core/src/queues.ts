import { Queue, type JobsOptions } from "bullmq";
import { getRedis } from "./redis";

export const QueueName = {
  COMPOSE: "lumora-compose",
  DELIVERY: "lumora-delivery",
  NOTIFICATION: "lumora-notification",
  CLEANUP: "lumora-cleanup",
  RETENTION: "lumora-retention",
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export interface ComposeJobData {
  sessionId: string;
  requestedBy: string | null;
  appliedStickers?: Array<{
    id: string;
    stickerId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
}

export interface DeliveryJobData {
  deliveryId: string;
}

export interface NotificationJobData {
  organizationId: string;
  kind: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  userIds?: string[];
}

export type CleanupJobData = Record<string, never>;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getRedis(), defaultJobOptions: DEFAULT_JOB_OPTIONS });
    queues.set(name, q);
  }
  return q;
}

export async function enqueueCompose(data: ComposeJobData): Promise<void> {
  // Job id = session id -> a retried "compose" click can never double-compose.
  await getQueue(QueueName.COMPOSE).add("compose", data, { jobId: `compose-${data.sessionId}` });
}

export async function enqueueDelivery(data: DeliveryJobData): Promise<void> {
  await getQueue(QueueName.DELIVERY).add("delivery", data, { jobId: `delivery-${data.deliveryId}` });
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  await getQueue(QueueName.NOTIFICATION).add("notification", data);
}
