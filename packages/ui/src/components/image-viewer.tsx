"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download, X, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Button } from "./button";
import { cn } from "../lib/cn";

export interface ViewerImage {
  src: string;
  alt: string;
  downloadUrl?: string;
  caption?: string;
}

export interface ImageViewerProps {
  images: ViewerImage[];
  openIndex: number | null;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

/** Full-screen lightbox with keyboard navigation and optional download. */
export function ImageViewer({ images, openIndex, onClose, onNavigate }: ImageViewerProps) {
  const index = openIndex ?? 0;
  const image = openIndex !== null ? images[index] : undefined;

  const go = React.useCallback(
    (delta: number) => {
      if (openIndex === null || images.length === 0) return;
      const next = (index + delta + images.length) % images.length;
      onNavigate?.(next);
    },
    [openIndex, index, images.length, onNavigate],
  );

  React.useEffect(() => {
    if (openIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openIndex, go]);

  return (
    <Dialog open={openIndex !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl border-none bg-black/95 p-2 sm:p-4 [&>button]:hidden">
        <DialogTitle className="sr-only">{image?.alt ?? "Image preview"}</DialogTitle>
        {image ? (
          <div className="relative flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[78vh] w-auto max-w-full rounded-md object-contain"
            />
            <div className="flex w-full items-center justify-between px-1 text-white/80">
              <span className="truncate text-sm">{image.caption ?? image.alt}</span>
              <div className="flex items-center gap-1">
                {images.length > 1 ? (
                  <>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(-1)} aria-label="Previous image">
                      <ChevronLeft />
                    </Button>
                    <span className="min-w-14 text-center text-xs tabular-nums">
                      {index + 1} / {images.length}
                    </span>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={() => go(1)} aria-label="Next image">
                      <ChevronRight />
                    </Button>
                  </>
                ) : null}
                {image.downloadUrl ? (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" asChild>
                    <a href={image.downloadUrl} download aria-label="Download image">
                      <Download />
                    </a>
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close viewer">
                  <X />
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export interface GalleryGridProps {
  images: ViewerImage[];
  className?: string;
  onOpen?: (index: number) => void;
}

/** Responsive thumbnail grid that pairs with ImageViewer. */
export function GalleryGrid({ images, className, onOpen }: GalleryGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {images.map((img, i) => (
        <button
          key={`${img.src}-${i}`}
          type="button"
          onClick={() => onOpen?.(i)}
          className="group relative aspect-[3/2] overflow-hidden rounded-lg border bg-muted shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
            <ZoomIn className="h-5 w-5 text-white" />
          </span>
        </button>
      ))}
    </div>
  );
}
