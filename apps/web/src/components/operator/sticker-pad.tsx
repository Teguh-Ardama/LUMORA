"use client";

import * as React from "react";
import { Rnd } from "react-rnd";
import { Trash2, Sparkles } from "lucide-react";
import { Button } from "@lumora/ui";
import type { SessionPayload } from "@/lib/hooks/use-operator";
import type { Sticker } from "@lumora/contracts";

export interface AppliedSticker {
  id: string; // unique instance ID
  stickerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  url: string; // for rendering only
}

export interface StickerPadProps {
  session: SessionPayload;
  stickers: Sticker[];
  onCompose: (appliedStickers: AppliedSticker[]) => void;
  isComposing: boolean;
  previewCssFilter?: string;
}

export function StickerPad({ session, stickers, onCompose, isComposing, previewCssFilter = "none" }: StickerPadProps) {
  const [applied, setApplied] = React.useState<AppliedSticker[]>([]);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  const canvasW = session.layout.config.canvas.width;
  const canvasH = session.layout.config.canvas.height;

  // Calculate scaling factor to fit the preview container
  React.useEffect(() => {
    const updateScale = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const padding = 32;
      const scaleX = (rect.width - padding) / canvasW;
      const scaleY = (rect.height - padding) / canvasH;
      setScale(Math.min(scaleX, scaleY));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [canvasW, canvasH]);

  const addSticker = (sticker: Sticker) => {
    const sw = canvasW * 0.3 * sticker.defaultScale;
    const sh = sw; // Assuming squareish stickers for initial drag box
    setApplied((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        stickerId: sticker.id,
        x: canvasW / 2 - sw / 2 + sticker.defaultOffsetX,
        y: canvasH / 2 - sh / 2 + sticker.defaultOffsetY,
        width: sw,
        height: sh,
        rotation: 0,
        url: sticker.url,
      },
    ]);
  };

  const removeSticker = (id: string) => {
    setApplied((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSticker = (id: string, patch: Partial<AppliedSticker>) => {
    setApplied((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full min-h-0 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
      {/* Canvas Area */}
      <div 
        ref={wrapperRef}
        className="flex-1 flex justify-center items-center bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 relative"
      >
        <div
          className="relative shadow-2xl overflow-hidden"
          style={{
            width: canvasW * scale,
            height: canvasH * scale,
            backgroundColor: session.layout.config.canvas.backgroundColor,
          }}
        >
          {/* Base Layout Rendering */}
          <div
            className="absolute top-0 left-0 origin-top-left pointer-events-none"
            style={{ width: canvasW, height: canvasH, transform: `scale(${scale})` }}
          >
            {session.layout.config.slots.map((slot, index) => {
              const photo = session.photos.find((p) => p.sequence === slot.photoIndex);
              return (
                <div
                  key={index}
                  className="absolute bg-zinc-800 overflow-hidden"
                  style={{
                    left: slot.x,
                    top: slot.y,
                    width: slot.w,
                    height: slot.h,
                    borderRadius: slot.radius,
                  }}
                >
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={`Slot ${slot.photoIndex}`}
                      className="h-full w-full object-cover"
                      style={{ filter: previewCssFilter }}
                    />
                  )}

                </div>
              );
            })}
          </div>

          {/* RND Overlays */}
          {applied.map((st) => (
            <Rnd
              key={st.id}
              size={{ width: st.width * scale, height: st.height * scale }}
              position={{ x: st.x * scale, y: st.y * scale }}
              onDragStop={(e, d) => updateSticker(st.id, { x: d.x / scale, y: d.y / scale })}
              onResizeStop={(e, dir, ref, delta, pos) => {
                updateSticker(st.id, {
                  width: parseFloat(ref.style.width) / scale,
                  height: parseFloat(ref.style.height) / scale,
                  x: pos.x / scale,
                  y: pos.y / scale,
                });
              }}
              bounds="parent"
              lockAspectRatio
              className="group"
            >
              <div className="relative h-full w-full border-2 border-transparent group-hover:border-primary/50 group-active:border-primary border-dashed">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={st.url} alt="Sticker" className="h-full w-full object-contain pointer-events-none drop-shadow-md" />
                <button
                  onClick={() => removeSticker(st.id)}
                  className="absolute -right-3 -top-3 hidden rounded-full bg-destructive p-1.5 text-white shadow-sm group-hover:block z-10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Rnd>
          ))}
        </div>
      </div>

      {/* Sidebar Tool tray */}
      <div className="w-full md:w-[340px] flex flex-col bg-background/80 backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b bg-muted/30">
          <h3 className="font-semibold text-sm tracking-wide">Decorate</h3>
          <p className="text-xs text-muted-foreground mt-1">Tap stickers to add them to your photo</p>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-3 auto-rows-max">
          {stickers.map((st) => (
            <button
              key={st.id}
              onClick={() => addSticker(st)}
              className="group relative rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md flex items-center justify-center aspect-square"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={st.url} alt={st.name} className="relative z-10 max-h-full max-w-full object-contain transition-transform group-hover:scale-110" style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.3))" }} />
            </button>
          ))}
          {stickers.length === 0 ? (
            <span className="text-sm text-muted-foreground col-span-2 text-center py-8">No stickers available</span>
          ) : null}
        </div>
        
        <div className="p-5 border-t bg-muted/30">
          <Button size="lg" className="w-full rounded-full h-12 shadow-lg" onClick={() => onCompose(applied)} loading={isComposing}>
            <Sparkles className="mr-2 h-4 w-4" /> Next Step
          </Button>
        </div>
      </div>
    </div>
  );
}
