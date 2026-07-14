"use client";

import * as React from "react";
import { Images } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  GalleryGrid,
  ImageViewer,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Toolbar,
} from "@lumora/ui";
import { useGallery } from "@/lib/hooks/use-admin";
import { useEvents } from "@/lib/hooks/use-events";

export default function GalleryPage() {
  const [page, setPage] = React.useState(1);
  const [eventId, setEventId] = React.useState<string | undefined>(undefined);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const { data: events } = useEvents({ page: 1 });
  const { data, isLoading, isError, refetch } = useGallery({ page, eventId });

  const images =
    data?.items.map((item) => ({
      src: item.url,
      alt: `${item.eventName} — ${item.guestName ?? "guest"}`,
      downloadUrl: item.url,
      caption: `${item.eventName} · ${item.layoutName} · ${item.filterName}`,
    })) ?? [];

  return (
    <div>
      <Toolbar
        title="Gallery"
        description="Composed results across all sessions."
        actions={
          <Select
            value={eventId ?? "all"}
            onValueChange={(v) => {
              setEventId(v === "all" ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {(events?.items ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
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
        <EmptyState
          icon={Images}
          title="No composed photos yet"
          description="Composed session results will appear here as your operators run the booth."
        />
      ) : (
        <>
          <GalleryGrid images={images} onOpen={setOpenIndex} />
          {data && data.totalPages > 1 ? (
            <TablePagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          ) : null}
        </>
      )}

      <ImageViewer images={images} openIndex={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
    </div>
  );
}
