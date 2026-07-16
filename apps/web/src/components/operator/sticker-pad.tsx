"use client";

import * as React from "react";
import { Rnd } from "react-rnd";
import { Trash2 } from "lucide-react";
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
}

export function StickerPad({ session, stickers, onCompose, isComposing }: StickerPadProps) {
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
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-12rem)] min-h-[600px] bg-zinc-950 p-4 rounded-xl border border-zinc-800">
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
            className="absolute inset-0 origin-top-left pointer-events-none"
            style={{ transform: `scale(${scale})` }}
          >
            {session.layout.config.slots.map((slot, index) => {
              const photo = session.photos.find((p) => p.sequence === slot.photoIndex);
              return (
                <div
                  key={index}
                  className="absolute bg-zinc-800"
                  style={{
                    left: slot.x,
                    top: slot.y,
                    width: slot.width,
                    height: slot.height,
                    borderRadius: slot.borderRadius,
                  }}
                >
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt={`Slot ${slot.photoIndex}`}
                      className="h-full w-full object-cover"
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
      <div className="w-full md:w-80 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Stickers</span>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-4 auto-rows-max">
          {stickers.map((st) => (
            <button
              key={st.id}
              onClick={() => addSticker(st)}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-center aspect-square shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={st.url} alt={st.name} className="max-h-full max-w-full object-contain" style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))" }} />
            </button>
          ))}
          {stickers.length === 0 ? (
            <span className="text-sm text-zinc-500 col-span-2 text-center py-8">No stickers available</span>
          ) : null}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <Button size="lg" className="w-full text-base h-12" onClick={() => onCompose(applied)} loading={isComposing}>
            Next &rarr;
          </Button>
        </div>
      </div>
    </div>
  );
}
