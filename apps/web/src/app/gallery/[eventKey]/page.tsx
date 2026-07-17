"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Aperture, Download, LockKeyhole, Image as ImageIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { GuestEventInfo, GuestGalleryListPayload } from "@lumora/contracts";
import { Button, Card, CardContent, Input, Label, LoadingState } from "@lumora/ui";
import { api, ApiClientError } from "@/lib/api";

export default function GuestEventGalleryPage() {
  const { eventKey } = useParams<{ eventKey: string }>();
  const [pin, setPin] = React.useState("");
  const queryClient = useQueryClient();

  const { data: eventInfo, isLoading: loadingEvent, error: eventError } = useQuery({
    queryKey: ["guestEvent", eventKey],
    queryFn: () => api<GuestEventInfo>(`/api/guest/events/${eventKey}`, { retryOn401: false }),
    retry: false,
    staleTime: Infinity,
  });

  const {
    data: photosData,
    isLoading: loadingPhotos,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error: photosError,
  } = useInfiniteQuery({
    queryKey: ["guestPhotos", eventKey],
    queryFn: async ({ pageParam = 1 }) => {
      return api<GuestGalleryListPayload>(`/api/guest/events/${eventKey}/photos?page=${pageParam}&pageSize=20`, { retryOn401: false });
    },
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
    enabled: !!eventInfo && (!eventInfo.requiresPin || (!!eventInfo.requiresPin && !eventError)), 
    retry: false,
    refetchInterval: 15000, // Live updates every 15s
  });

  const verifyPin = useMutation({
    mutationFn: (pinCode: string) =>
      api(`/api/guest/events/${eventKey}/pin`, {
        method: "POST",
        body: JSON.stringify({ pin: pinCode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guestPhotos", eventKey] });
    },
  });

  const needsPin =
    eventInfo?.requiresPin && photosError instanceof ApiClientError && photosError.status === 403;

  if (loadingEvent) {
    return <LoadingState label="Loading event gallery…" />;
  }

  if (eventError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-medium">Event not found</p>
            <p className="text-sm text-muted-foreground">The link you followed might be incorrect or has expired.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!eventInfo) return null;

  return (
    <main className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-col items-center justify-center border-b bg-background/80 px-4 py-6 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <Aperture className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-widest uppercase">LUMORA</span>
        </div>
        <h1 className="text-center text-2xl md:text-3xl font-serif font-medium tracking-tight">
          {eventInfo.eventName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hosted by {eventInfo.organizationName}
        </p>
        {eventInfo.isLive && (
          <div className="mt-4 flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-500 border border-green-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            LIVE
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        {needsPin ? (
          <Card className="mx-auto mt-10 w-full max-w-sm border border-border/50 shadow-sm">
            <CardContent className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyPin.mutate(pin);
                }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center text-center space-y-2 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <LockKeyhole className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-medium">Private Event</h2>
                  <p className="text-sm text-muted-foreground">
                    Please enter the event PIN to view the gallery.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN Code</Label>
                  <Input
                    id="pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter PIN"
                    required
                  />
                  {verifyPin.error && (
                    <p className="text-sm text-destructive">
                      {verifyPin.error instanceof ApiClientError ? verifyPin.error.message : "Invalid PIN"}
                    </p>
                  )}
                </div>
                
                <Button className="w-full" type="submit" disabled={verifyPin.isPending}>
                  {verifyPin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enter Gallery
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {loadingPhotos && !photosData ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : photosData?.pages[0].items.length === 0 ? (
              <div className="flex flex-col items-center justify-center space-y-3 rounded-lg border border-dashed py-20 text-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No photos yet. Start capturing!</p>
              </div>
            ) : (
              <>
                <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4">
                  {photosData?.pages.flatMap((page) => page.items).map((photo) => (
                    <div key={photo.sessionId} className="group relative break-inside-avoid overflow-hidden rounded-xl bg-muted border border-border/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={photo.composedUrl} 
                        alt="Event Photo" 
                        loading="lazy"
                        className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
                        <Button size="sm" variant="secondary" className="gap-2 shadow-lg" asChild>
                          <a href={photo.composedUrl} download={`lumora-${photo.sessionId}.jpg`} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4" /> Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {hasNextPage && (
                  <div className="flex justify-center pt-8">
                    <Button 
                      variant="outline" 
                      onClick={() => fetchNextPage()} 
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading more...</>
                      ) : (
                        "Load More Photos"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
