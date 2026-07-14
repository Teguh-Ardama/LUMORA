"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LayoutConfig, RealtimeEvent } from "@lumora/contracts";
import { apiClient } from "../api";

// ── Types mirrored from the operator API ─────────────────────────────────

export interface OperatorEvent {
  id: string;
  name: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
}

export interface SessionPayload {
  id: string;
  eventId: string;
  status: "CAPTURING" | "COMPOSING" | "READY" | "FAILED" | "CLOSED";
  captureSource: "WEBCAM" | "BRIDGE";
  guestName: string | null;
  guestEmail: string | null;
  guestWaNumber: string | null;
  border: { id: string; name: string } | null;
  layout: { id: string; name: string; mode: string; photoCount: number; config: LayoutConfig };
  filter: { id: string; name: string; kind: string };
  photos: Array<{ id: string; sequence: number; source: string; width: number; height: number; url: string }>;
  composedUrl: string | null;
  composeError: string | null;
  startedAt: string;
}

export interface OperatorContext {
  event: {
    id: string;
    name: string;
    venue: string | null;
    framesPerSession: number;
    countdownSeconds: number;
    defaultBorderId: string | null;
    defaultLayoutId: string | null;
  };
  borders: Array<{ id: string; name: string; width: number; height: number; imageUrl: string }>;
  layouts: Array<{ id: string; name: string; mode: "GRID" | "STRIP"; photoCount: number; config: LayoutConfig }>;
  filters: Array<{ id: string; name: string; kind: string; params: Record<string, unknown> }>;
  activeSession: SessionPayload | null;
  bridgeDevices: Array<{ id: string; name: string; status: string; queueDepth: number; lastSeenAt: string | null }>;
}

// ── Queries & mutations ───────────────────────────────────────────────────

export function useOperatorEvents() {
  return useQuery({
    queryKey: ["operator-events"],
    queryFn: () => apiClient.get<{ events: OperatorEvent[] }>("/api/operator/events"),
  });
}

export function useOperatorContext(eventId: string) {
  return useQuery({
    queryKey: ["operator-context", eventId],
    queryFn: () => apiClient.get<OperatorContext>(`/api/operator/events/${eventId}/context`),
    enabled: Boolean(eventId),
  });
}

export function useStartSession(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      captureSource: "WEBCAM" | "BRIDGE";
      borderId?: string | null;
      layoutId: string;
      filterId: string;
    }) =>
      apiClient.post<{ session: SessionPayload }>("/api/sessions", {
        eventId,
        ...input,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-context", eventId] }),
  });
}

export function useUpdateSession(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, ...input }: { sessionId: string } & Record<string, unknown>) =>
      apiClient.patch<{ session: SessionPayload }>(`/api/sessions/${sessionId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-context", eventId] }),
  });
}

export function useUploadPhoto() {
  return useMutation({
    mutationFn: (input: { sessionId: string; blob: Blob; sequence: number }) => {
      const fd = new FormData();
      fd.set("file", input.blob, `frame-${input.sequence}.jpg`);
      fd.set("sequence", String(input.sequence));
      fd.set("idempotencyKey", crypto.randomUUID());
      fd.set("capturedAt", new Date().toISOString());
      return apiClient.postForm<{ photoId: string; sequence: number }>(
        `/api/sessions/${input.sessionId}/photos`,
        fd,
      );
    },
  });
}

export function useCompose(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.post<{ session: SessionPayload }>(`/api/sessions/${sessionId}/compose`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operator-context", eventId] }),
  });
}

export function useMintQr() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.post<{ url: string; expiresAt: string }>(`/api/sessions/${sessionId}/qr`),
  });
}

export function useRequestDelivery() {
  return useMutation({
    mutationFn: (input: { sessionId: string; channel: "EMAIL" | "WHATSAPP"; email?: string; waNumber?: string }) =>
      apiClient.post<{ deliveryId: string; status: string; waLink: string | null }>(
        `/api/sessions/${input.sessionId}/deliveries`,
        { channel: input.channel, email: input.email, waNumber: input.waNumber },
      ),
  });
}

export function usePrint() {
  return useMutation({
    mutationFn: (input: { sessionId: string; copies: number }) =>
      apiClient.post<{ job: { id: string; status: string; copies: number; composedUrl: string | null } }>(
        `/api/sessions/${input.sessionId}/print`,
        { copies: input.copies },
      ),
  });
}

export function useQuarantine(eventId: string) {
  return useQuery({
    queryKey: ["quarantine", eventId],
    queryFn: () =>
      apiClient.get<{ photos: Array<{ id: string; originalFilename: string | null; url: string; createdAt: string }> }>(
        `/api/events/${eventId}/quarantine`,
      ),
    enabled: Boolean(eventId),
  });
}

export function useAttachPhoto(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; photoId: string; sequence: number }) =>
      apiClient.post(`/api/sessions/${input.sessionId}/attach-photo`, {
        photoId: input.photoId,
        sequence: input.sequence,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["operator-context", eventId] });
      void qc.invalidateQueries({ queryKey: ["quarantine", eventId] });
    },
  });
}

// ── Realtime (SSE) ────────────────────────────────────────────────────────

/**
 * Subscribes to the per-event SSE stream and invalidates the operator
 * context on any state change; individual events are also handed to the
 * caller for toasts/counters.
 */
export function useEventStream(eventId: string, onEvent?: (e: RealtimeEvent) => void) {
  const qc = useQueryClient();
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    if (!eventId) return;
    const source = new EventSource(`/api/events/${eventId}/stream`);
    const types = [
      "session.status",
      "session.photo",
      "photo.quarantined",
      "bridge.status",
      "print.status",
    ] as const;

    const handler = (msg: MessageEvent) => {
      try {
        const event = JSON.parse(msg.data) as RealtimeEvent;
        onEventRef.current?.(event);
        void qc.invalidateQueries({ queryKey: ["operator-context", eventId] });
        if (event.type === "photo.quarantined") {
          void qc.invalidateQueries({ queryKey: ["quarantine", eventId] });
        }
      } catch {
        // ignore malformed frames
      }
    };
    for (const t of types) source.addEventListener(t, handler);

    return () => source.close();
  }, [eventId, qc]);
}
