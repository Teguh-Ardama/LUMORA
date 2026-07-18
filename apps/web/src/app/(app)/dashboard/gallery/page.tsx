"use client";

import * as React from "react";
import { Images, Trash2 } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Toolbar,
  cn,
  toast,
} from "@lumora/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api";
import { useGallery } from "@/lib/hooks/use-admin";
import { useEvents } from "@/lib/hooks/use-events";

export default function GalleryPage() {
  const qc = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [eventId, setEventId] = React.useState<string | undefined>(undefined);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const { data: events } = useEvents({ page: 1 });
  const { data, isLoading, isError, refetch } = useGallery({ page, eventId });
  const images = data?.items ?? [];

  const deletePhoto = useMutation({
    mutationFn: (sessionId: string) => apiClient.delete(`/api/sessions/${sessionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gallery"] });
      toast.success("Photo deleted");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Delete failed"),
  });

  return (
    <div>
      <Toolbar
        title="Gallery"
        description="Composed results across all sessions."
        actions={
          <Select value={eventId ?? "all"} onValueChange={(v) => { setEventId(v === "all" ? undefined : v); setPage(1); }}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {(events?.items ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingState />
      ) : images.length === 0 ? (
        <EmptyState icon={Images} title="No composed photos yet"
          description="Composed session results will appear here as your operators run the booth." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((item, i) => (
              <div key={item.sessionId} className="group relative overflow-hidden rounded-xl border bg-card">
                <button onClick={() => setOpenIndex(i)} className="block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={`${item.eventName} — ${item.guestName ?? "guest"}`}
                    className="aspect-[3/2] w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="min-w-0 text-white text-xs">
                    <p className="truncate font-medium">{item.eventName}</p>
                    <p className="truncate opacity-80">{item.layoutName} · {item.filterName}</p>
                  </div>
                  <button onClick={() => deletePhoto.mutate(item.sessionId)}
                    className="shrink-0 rounded-full bg-destructive/80 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {data && data.totalPages > 1 && (
            <TablePagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          )}
        </>
      )}

      {/* Lightbox */}
      {openIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setOpenIndex(null)}>
          <button className="absolute right-4 top-4 text-white/70 hover:text-white text-2xl" onClick={() => setOpenIndex(null)}>✕</button>
          <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl" onClick={(e) => { e.stopPropagation(); setOpenIndex(Math.max(0, openIndex - 1)); }} disabled={openIndex === 0}>‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[openIndex]?.url} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl" onClick={(e) => { e.stopPropagation(); setOpenIndex(Math.min(images.length - 1, openIndex + 1)); }} disabled={openIndex === images.length - 1}>›</button>
        </div>
      )}
    </div>
  );
}
