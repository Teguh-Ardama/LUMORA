"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalyticsSummary } from "@lumora/contracts";
import { apiClient } from "../api";

interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ── Organization & members ────────────────────────────────────────────────

export interface MemberItem {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "OPERATOR";
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface InviteItem {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export function useOrganization() {
  return useQuery({
    queryKey: ["org"],
    queryFn: () =>
      apiClient.get<{ organization: { id: string; name: string; slug: string; supportEmail: string | null; brandColor: string | null } }>(
        "/api/org",
      ),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiClient.patch("/api/org", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org"] }),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => apiClient.get<{ members: MemberItem[]; invites: InviteItem[] }>("/api/org/members"),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      apiClient.post<{ inviteId: string; inviteUrl: string }>("/api/org/members/invite", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: { userId: string; role?: string; isActive?: boolean }) =>
      apiClient.patch(`/api/org/members/${userId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/api/org/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => apiClient.delete(`/api/org/members/invites/${inviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────

export function useAnalytics(eventId?: string) {
  const qs = eventId ? `?eventId=${eventId}` : "";
  return useQuery({
    queryKey: ["analytics", eventId ?? "all"],
    queryFn: () => apiClient.get<{ summary: AnalyticsSummary }>(`/api/analytics/summary${qs}`),
    staleTime: 60_000,
  });
}

// ── Audit logs ────────────────────────────────────────────────────────────

export interface AuditItem {
  id: string;
  actorType: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export function useAuditLogs(params: { page: number; action?: string; entityType?: string }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: "25" });
  if (params.action) qs.set("action", params.action);
  if (params.entityType) qs.set("entityType", params.entityType);
  return useQuery({
    queryKey: ["audit", params],
    queryFn: () => apiClient.get<Paged<AuditItem>>(`/api/audit-logs?${qs}`),
  });
}

// ── Gallery / downloads ───────────────────────────────────────────────────

export interface GalleryItem {
  sessionId: string;
  eventId: string;
  eventName: string;
  guestName: string | null;
  filterName: string;
  layoutName: string;
  composedAt: string;
  url: string;
}

export function useGallery(params: { page: number; eventId?: string }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: "24" });
  if (params.eventId) qs.set("eventId", params.eventId);
  return useQuery({
    queryKey: ["gallery", params],
    queryFn: () => apiClient.get<Paged<GalleryItem>>(`/api/gallery?${qs}`),
  });
}

// ── Deliveries & print jobs ───────────────────────────────────────────────

export interface DeliveryItem {
  id: string;
  eventName: string;
  sessionId: string;
  channel: string;
  recipient: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function useDeliveries(params: { page: number; eventId?: string }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: "25" });
  if (params.eventId) qs.set("eventId", params.eventId);
  return useQuery({
    queryKey: ["deliveries", params],
    queryFn: () => apiClient.get<Paged<DeliveryItem>>(`/api/deliveries?${qs}`),
  });
}

export interface PrintJobItem {
  id: string;
  eventName: string;
  sessionId: string;
  guestName: string | null;
  copies: number;
  status: string;
  failureReason: string | null;
  composedUrl: string | null;
  createdAt: string;
  printedAt: string | null;
}

export function usePrintJobs(params: { page: number; eventId?: string }) {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: "25" });
  if (params.eventId) qs.set("eventId", params.eventId);
  return useQuery({
    queryKey: ["print-jobs", params],
    queryFn: () => apiClient.get<Paged<PrintJobItem>>(`/api/print-jobs?${qs}`),
  });
}

export function useUpdatePrintJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "PRINTING" | "PRINTED" | "FAILED" | "CANCELLED"; failureReason?: string }) =>
      apiClient.patch(`/api/print-jobs/${input.id}`, {
        status: input.status,
        failureReason: input.failureReason,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-jobs"] }),
  });
}

// ── Notifications ─────────────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications(page = 1) {
  return useQuery({
    queryKey: ["notifications", page],
    queryFn: () =>
      apiClient.get<Paged<NotificationItem> & { unreadCount: number }>(`/api/notifications?page=${page}&pageSize=20`),
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/api/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
