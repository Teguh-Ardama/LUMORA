import type { RealtimeEvent } from "@lumora/contracts";
import { getRedis, getRedisSubscriber } from "./redis";

/**
 * Realtime fan-out over Redis pub/sub. Producers (API, worker) publish;
 * the web tier subscribes once per process and multiplexes to SSE clients.
 */
export async function publishRealtime(channel: string, event: RealtimeEvent): Promise<void> {
  try {
    await getRedis().publish(channel, JSON.stringify(event));
  } catch (err) {
    console.error("[realtime] publish failed", err);
  }
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Map<string, Set<Listener>>();
let subscriberWired = false;

function wireSubscriber() {
  if (subscriberWired) return;
  subscriberWired = true;
  const sub = getRedisSubscriber();
  sub.on("pmessage", (_pattern: string, channel: string, message: string) => {
    const set = listeners.get(channel);
    if (!set || set.size === 0) return;
    try {
      const event = JSON.parse(message) as RealtimeEvent;
      for (const fn of set) fn(event);
    } catch {
      // malformed message — drop
    }
  });
  void sub.psubscribe("lumora:*");
}

export function subscribeRealtime(channel: string, listener: Listener): () => void {
  wireSubscriber();
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(channel);
  };
}
