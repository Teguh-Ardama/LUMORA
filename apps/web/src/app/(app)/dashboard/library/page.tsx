"use client";

import React, { useState } from "react";
import { Upload, Image as ImageIcon, Trash2 } from "lucide-react";

// Mock data to demonstrate the UI until API hooks are fully wired
const MOCK_STICKERS = [
  { id: "1", name: "Congrats!", url: "/stickers/congrats.png" },
  { id: "2", name: "Glasses", url: "/stickers/glasses.png" },
];

export default function LibraryDashboardPage() {
  const [activeTab, setActiveTab] = useState<"stickers" | "borders" | "filters">("stickers");
  const [stickers, setStickers] = useState(MOCK_STICKERS);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // In a real implementation, this would POST to /api/templates/stickers
    const file = e.target.files?.[0];
    if (file) {
      const newSticker = {
        id: Math.random().toString(36),
        name: file.name,
        url: URL.createObjectURL(file), // Local preview
      };
      setStickers((prev) => [...prev, newSticker]);
    }
  };

  const handleDelete = (id: string) => {
    setStickers((prev) => prev.filter(s => s.id !== id));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Asset Library</h1>
        <p className="text-slate-500 mt-2">Manage your global stickers, borders, and custom filters.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-800">
        {(["stickers", "borders", "filters"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab 
                ? "border-pink-500 text-pink-500" 
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "stickers" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Sticker Collection</h2>
            <label className="flex items-center space-x-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg cursor-pointer transition-colors">
              <Upload size={18} />
              <span>Upload Sticker</span>
              <input type="file" accept="image/png" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {stickers.map((sticker) => (
              <div key={sticker.id} className="relative group bg-slate-100 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center aspect-square">
                <img src={sticker.url} alt={sticker.name} className="max-w-full max-h-full object-contain mb-2" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center">{sticker.name}</span>
                <button 
                  onClick={() => handleDelete(sticker.id)}
                  className="absolute top-2 right-2 p-2 bg-red-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {stickers.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                <ImageIcon size={48} className="mb-4 opacity-50" />
                <p>No stickers uploaded yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab !== "stickers" && (
        <div className="py-12 text-center text-slate-500">
          Module for {activeTab} is under construction.
        </div>
      )}
    </div>
  );
}
