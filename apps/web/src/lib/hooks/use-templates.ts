"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LayoutConfig } from "@lumora/contracts";
import { apiClient } from "../api";

export interface BorderItem {
  id: string;
  name: string;
  scope: "GLOBAL" | "ORGANIZATION" | "EVENT";
  eventId: string | null;
  width: number;
  height: number;
  isActive: boolean;
  imageUrl: string;
}

export interface LayoutItem {
  id: string;
  name: string;
  mode: "GRID" | "STRIP";
  photoCount: number;
  config: LayoutConfig;
  scope: "GLOBAL" | "ORGANIZATION" | "EVENT";
  eventId: string | null;
  isActive: boolean;
}

export interface FilterItem {
  id: string;
  name: string;
  kind: string;
  params: Record<string, unknown>;
  scope: "GLOBAL" | "ORGANIZATION";
}

export function useBorders(eventId?: string) {
  const qs = eventId ? `?eventId=${eventId}` : "";
  return useQuery({
    queryKey: ["borders", eventId ?? "all"],
    queryFn: () => apiClient.get<{ borders: BorderItem[] }>(`/api/templates/borders${qs}`),
  });
}

export function useUploadBorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; name: string; eventId?: string }) => {
      const fd = new FormData();
      fd.set("file", input.file);
      fd.set("name", input.name);
      if (input.eventId) fd.set("eventId", input.eventId);
      return apiClient.postForm<{ border: BorderItem }>("/api/templates/borders", fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["borders"] }),
  });
}

export function useDeleteBorder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/borders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["borders"] }),
  });
}

export function useLayouts(eventId?: string) {
  const qs = eventId ? `?eventId=${eventId}` : "";
  return useQuery({
    queryKey: ["layouts", eventId ?? "all"],
    queryFn: () => apiClient.get<{ layouts: LayoutItem[] }>(`/api/templates/layouts${qs}`),
  });
}

export function useCreateLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; eventId?: string | null; config: LayoutConfig }) =>
      apiClient.post("/api/templates/layouts", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layouts"] }),
  });
}

export function useDeleteLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/layouts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["layouts"] }),
  });
}

export function useFilters() {
  return useQuery({
    queryKey: ["filters"],
    queryFn: () => apiClient.get<{ filters: FilterItem[] }>("/api/templates/filters"),
  });
}
