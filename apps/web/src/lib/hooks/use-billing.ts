"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingSummary, CreditTransactionItem, TopupItem } from "@lumora/contracts";
import { apiClient } from "../api";

interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ["billing", "summary"],
    queryFn: () => apiClient.get<{ summary: BillingSummary }>("/api/billing/summary"),
    staleTime: 15_000,
  });
}

export function useCreditTransactions(page = 1) {
  return useQuery({
    queryKey: ["billing", "transactions", page],
    queryFn: () =>
      apiClient.get<Paged<CreditTransactionItem>>(`/api/billing/transactions?page=${page}&pageSize=20`),
  });
}

export function useTopups(page = 1) {
  return useQuery({
    queryKey: ["billing", "topups", page],
    queryFn: () => apiClient.get<Paged<TopupItem>>(`/api/billing/topups?page=${page}&pageSize=10`),
  });
}

export function useCreateTopup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiClient.post<{ topup: { id: string; amount: number; status: string; paymentUrl: string | null } }>(
        "/api/billing/topups",
        { amount },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });
}

export function useSimulateTopupPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topupId: string) =>
      apiClient.post<{ settled: boolean }>(`/api/billing/topups/${topupId}/simulate-paid`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing"] }),
  });
}
