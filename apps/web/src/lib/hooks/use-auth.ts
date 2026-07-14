"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { LoginInput, RegisterInput, SessionUser } from "@lumora/contracts";
import { apiClient } from "../api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.get<{ user: SessionUser }>("/api/auth/me"),
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiClient.post<{ user: SessionUser }>("/api/auth/login", input),
    onSuccess: (data) => qc.setQueryData(["me"], data),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => apiClient.post<{ user: SessionUser }>("/api/auth/register", input),
    onSuccess: (data) => qc.setQueryData(["me"], data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiClient.post("/api/auth/logout"),
    onSuccess: () => {
      qc.clear();
      router.push("/login");
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; name: string; password: string }) =>
      apiClient.post<{ user: SessionUser }>("/api/auth/invite/accept", input),
    onSuccess: (data) => qc.setQueryData(["me"], data),
  });
}
