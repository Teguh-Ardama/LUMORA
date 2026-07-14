"use client";

import type { ApiResponse } from "@lumora/contracts";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let refreshPromise: Promise<boolean> | null = null;

/** Single-flight refresh: many parallel 401s trigger exactly one refresh. */
async function tryRefresh(): Promise<boolean> {
  refreshPromise ??= fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: { "x-lumora-csrf": "1" },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshPromise = null), 100);
    });
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  retryOn401?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal, retryOn401 = true } = opts;

  const res = await fetch(path, {
    method,
    credentials: "include",
    signal,
    headers: {
      "x-lumora-csrf": "1",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 && retryOn401 && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, { ...opts, retryOn401: false });
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("INTERNAL", `Unexpected response (${res.status})`, res.status);
  }

  if (!json.ok) {
    throw new ApiClientError(json.error.code, json.error.message, res.status, json.error.details);
  }
  return json.data;
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body }),
  postForm: <T>(path: string, formData: FormData) => api<T>(path, { method: "POST", formData }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};
