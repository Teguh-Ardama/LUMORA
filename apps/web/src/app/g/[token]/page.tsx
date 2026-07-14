"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Aperture, Download, TimerOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { GuestGalleryPayload } from "@lumora/contracts";
import { Button, Card, CardContent, LoadingState } from "@lumora/ui";
import { api, ApiClientError } from "@/lib/api";

/**
 * Guest gallery — target of the dynamic QR (FR-06). Public, token-gated;
 * a revoked/expired token renders the "link reset" state, never photos.
 */
export default function GuestGalleryPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["guest", token],
    queryFn: () => api<GuestGalleryPayload>(`/api/guest/${token}`, { retryOn401: false }),
    retry: false,
    staleTime: Infinity,
  });

  return (
    <main className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Aperture className="h-4 w-4" />
        </span>
        <span className="font-semibold tracking-tight">LUMORA</span>
      </div>

      {isLoading ? (
        <LoadingState label="Fetching your photos…" />
      ) : error ? (
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TimerOff className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-medium">
              {error instanceof ApiClientError && error.status === 410
                ? "This link is no longer active"
                : "We couldn't find these photos"}
            </p>
            <p className="text-sm text-muted-foreground">
              {error instanceof ApiClientError && error.status === 410
                ? "The operator started a new session, or the link expired. Ask the booth operator to resend your photos."
                : "Double-check the link, or ask the booth operator for a new QR code."}
            </p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="w-full max-w-lg space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">{data.eventName}</h1>
            <p className="text-sm text-muted-foreground">by {data.organizationName}</p>
          </div>
          <Card className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.composedUrl} alt={`Your photos from ${data.eventName}`} className="w-full" />
          </Card>
          <Button className="w-full" size="lg" asChild>
            <a href={data.downloadUrl} download={`${data.eventName}.jpg`}>
              <Download /> Download photo
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Available until {format(new Date(data.expiresAt), "d MMM yyyy, HH:mm")}. Your photo is private to this link.
          </p>
        </div>
      ) : null}
    </main>
  );
}
