"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api";

export interface EventListItem {
  id: string;
  name: string;
  clientName: string | null;
  venue: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  sessionCount: number;
  operators: Array<{ id: string; name: string }>;
}

interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useEvents(params: { page: number; search?: string }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: "20" });
  if (params.search) qs.set("search", params.search);
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => apiClient.get<Paged<EventListItem>>(`/api/events?${qs}`),
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => apiClient.get<{ event: EventDetail }>(`/api/events/${id}`),
    enabled: Boolean(id),
  });
}

export interface EventDetail {
  id: string;
  name: string;
  clientName: string | null;
  venue: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  framesPerSession: number;
  countdownSeconds: number;
  defaultBorderId: string | null;
  defaultLayoutId: string | null;
  operators: Array<{ id: string; name: string; email: string }>;
  bridgeDevices: Array<{
    id: string;
    name: string;
    status: string;
    queueDepth: number;
    lastSeenAt: string | null;
    watchedFolder: string | null;
  }>;
  _count: { sessions: number; photos: number; printJobs: number };
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.post<{ event: { id: string } }>("/api/events", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.patch(`/api/events/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useAssignOperators(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => apiClient.put(`/api/events/${eventId}/operators`, { userIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events", eventId] }),
  });
}

export function useCreatePairingCode(eventId: string) {
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ code: string; expiresInSeconds: number }>(`/api/events/${eventId}/bridge/pairing-code`, {}),
  });
}

export function useRevokeBridgeDevice(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => apiClient.delete(`/api/bridge-devices/${deviceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events", eventId] }),
  });
}
