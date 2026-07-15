"use client";

import React, { useState } from "react";
import { Rnd } from "react-rnd";
import { Trash2, RotateCw } from "lucide-react";
export type PlacedSticker = {
  id: string; // Unique ID for this placed instance
  stickerId: string; // Reference to the actual Sticker asset
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

interface StickerEditorProps {
  photoUrl: string;
  availableStickers: { id: string; name: string; url: string }[];
  onSave: (placedStickers: PlacedSticker[]) => void;
}

export function StickerEditor({ photoUrl, availableStickers, onSave }: StickerEditorProps) {
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addSticker = (sticker: { id: string; url: string }) => {
    const newSticker: PlacedSticker = {
      id: Math.random().toString(36).substring(7),
      stickerId: sticker.id,
      url: sticker.url,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 0,
    };
    setPlacedStickers((prev) => [...prev, newSticker]);
    setSelectedId(newSticker.id);
  };

  const updateSticker = (id: string, updates: Partial<PlacedSticker>) => {
    setPlacedStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeSticker = (id: string) => {
    setPlacedStickers((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Simple rotation logic (increments by 15 degrees per click)
  const rotateSticker = (id: string, currentRotation: number) => {
    updateSticker(id, { rotation: (currentRotation + 15) % 360 });
  };

  return (
    <div className="flex h-[600px] w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      {/* Canvas Area */}
      <div 
        className="relative flex-1 bg-black overflow-hidden flex items-center justify-center"
        onClick={() => setSelectedId(null)}
      >
        <div className="relative" style={{ width: 800, height: 600 }}>
          {/* Base Photo */}
          <img 
            src={photoUrl} 
            alt="Captured session" 
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Draggable Stickers */}
          {placedStickers.map((s) => {
            const isSelected = selectedId === s.id;
            return (
              <Rnd
                key={s.id}
                size={{ width: s.width, height: s.height }}
                position={{ x: s.x, y: s.y }}
                onDragStop={(e, d) => updateSticker(s.id, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateSticker(s.id, {
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    ...position,
                  });
                }}
                bounds="parent"
                className={`group ${isSelected ? "z-50" : "z-10"}`}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedId(s.id);
                }}
                style={{ transform: `rotate(${s.rotation}deg)` }} // Apply rotation to the Rnd container
              >
                <div className={`w-full h-full relative ${isSelected ? 'ring-2 ring-pink-500' : ''}`}>
                  <img
                    src={s.url}
                    alt="sticker"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  {isSelected && (
                    <div className="absolute -top-10 -right-10 flex space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); rotateSticker(s.id, s.rotation); }}
                        className="p-2 bg-slate-800 rounded-full text-white hover:bg-slate-700"
                      >
                        <RotateCw size={16} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSticker(s.id); }}
                        className="p-2 bg-red-600 rounded-full text-white hover:bg-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </Rnd>
            );
          })}
        </div>
      </div>

      {/* Sidebar: Sticker Library */}
      <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 flex flex-col">
        <h3 className="text-white font-semibold mb-4">Sticker Library</h3>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto">
          {availableStickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => addSticker(sticker)}
              className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:border-pink-500 transition-colors flex items-center justify-center aspect-square"
            >
              <img src={sticker.url} alt={sticker.name} className="max-w-full max-h-full object-contain" />
            </button>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <button 
            onClick={() => onSave(placedStickers)}
            className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-lg"
          >
            Simpan Stiker
          </button>
        </div>
      </div>
    </div>
  );
}
