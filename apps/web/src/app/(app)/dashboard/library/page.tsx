"use client";

import React, { useState } from "react";
import { Upload, Image as ImageIcon, Trash2, Sparkles, X, Sliders } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lumora/ui";
import type { StickerAnchor } from "@lumora/contracts";

const ANCHOR_OPTIONS: { value: StickerAnchor; label: string }[] = [
  { value: "FOREHEAD", label: "Forehead" },
  { value: "LEFT_EYE", label: "Left Eye" },
  { value: "RIGHT_EYE", label: "Right Eye" },
  { value: "NOSE", label: "Nose" },
  { value: "MOUTH", label: "Mouth" },
  { value: "CHIN", label: "Chin" },
  { value: "LEFT_EAR", label: "Left Ear" },
  { value: "RIGHT_EAR", label: "Right Ear" },
  { value: "FULL_FACE", label: "Full Face" },
];

interface StickerItem {
  id: string;
  name: string;
  storageKey: string;
  imageUrl: string;
  anchorPoint: StickerAnchor;
  defaultScale: number;
  defaultOffsetX: number;
  defaultOffsetY: number;
  isActive: boolean;
}

interface BorderItem {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  isActive: boolean;
}

interface FilterItem {
  id: string;
  name: string;
  kind: string;
  params: Record<string, unknown>;
}

export default function LibraryDashboardPage() {
  const [activeTab, setActiveTab] = useState<"stickers" | "borders" | "filters">("stickers");
  const qc = useQueryClient();

  // Stickers
  const { data: stickersData, isLoading: stickersLoading } = useQuery({
    queryKey: ["stickers"],
    queryFn: () => apiClient.get<{ stickers: StickerItem[] }>("/api/templates/stickers"),
  });

  // Borders
  const { data: bordersData } = useQuery({
    queryKey: ["borders"],
    queryFn: () => apiClient.get<{ borders: BorderItem[] }>("/api/templates/borders"),
  });

  // Filters
  const { data: filtersData } = useQuery({
    queryKey: ["filters"],
    queryFn: () => apiClient.get<{ filters: FilterItem[] }>("/api/templates/filters"),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Asset Library</h1>
        <p className="text-muted-foreground mt-2">Manage your global stickers, borders, and custom filters.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        {(["stickers", "borders", "filters"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "stickers" && <StickerTab data={stickersData?.stickers ?? []} loading={stickersLoading} />}
      {activeTab === "borders" && <BorderTab data={bordersData?.borders ?? []} />}
      {activeTab === "filters" && <FilterTab data={filtersData?.filters ?? []} />}
    </div>
  );
}

// ── Sticker Tab ──────────────────────────────────────────────────────────

function StickerTab({ data, loading }: { data: StickerItem[]; loading: boolean }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<string>("FOREHEAD");
  const [defaultScale, setDefaultScale] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const uploadSticker = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name || file.name.replace(/\.[^/.]+$/, ""));
      fd.set("anchorPoint", anchorPoint);
      fd.set("defaultScale", String(defaultScale));
      fd.set("defaultOffsetX", String(offsetX));
      fd.set("defaultOffsetY", String(offsetY));
      return apiClient.post<{ sticker: StickerItem }>("/api/templates/stickers", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
      setUploadOpen(false);
      setName("");
      setFile(null);
      toast.success("Sticker uploaded");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Upload failed"),
  });

  const deleteSticker = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/stickers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stickers"] }),
  });

  if (loading) return <p className="text-muted-foreground py-8">Loading stickers…</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sticker Collection</h2>
        <div>
          <Button onClick={() => setUploadOpen(true)}><Upload /> Upload Sticker</Button>
          {uploadOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setUploadOpen(false)}>
              <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Upload New Sticker</h3>
                  <button onClick={() => setUploadOpen(false)}><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>PNG File</Label>
                    <Input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Topi Hitam" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Face Anchor Point</Label>
                    <Select value={anchorPoint} onValueChange={setAnchorPoint}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANCHOR_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Scale</Label>
                      <Input type="number" step={0.1} min={0.1} max={5} value={defaultScale} onChange={(e) => setDefaultScale(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Offset X</Label>
                      <Input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Offset Y</Label>
                      <Input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} />
                    </div>
                  </div>
                  {file && (
                    <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-4">
                      <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-32 object-contain" />
                    </div>
                  )}
                  <Button className="w-full" onClick={() => uploadSticker.mutate()} loading={uploadSticker.isPending}>
                    Save Sticker
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.map((sticker) => (
          <div key={sticker.id} className="relative group bg-card rounded-xl p-4 border flex flex-col items-center justify-center aspect-square">
            <img src={sticker.imageUrl} alt={sticker.name} className="max-w-full max-h-full object-contain mb-2" />
            <span className="text-sm font-medium truncate w-full text-center">{sticker.name}</span>
            <span className="text-[10px] text-muted-foreground">{sticker.anchorPoint}</span>
            <button onClick={() => deleteSticker.mutate(sticker.id)}
              className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {data.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
            <ImageIcon size={48} className="mb-4 opacity-50" />
            <p>No stickers uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Border Tab ──────────────────────────────────────────────────────────

function BorderTab({ data }: { data: BorderItem[] }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const uploadBorder = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name || file.name.replace(/\.[^/.]+$/, ""));
      return apiClient.postForm<{ border: BorderItem }>("/api/templates/borders", fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borders"] });
      setUploadOpen(false);
      setName("");
      setFile(null);
      toast.success("Border uploaded");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Upload failed"),
  });

  if (data.length === 0) {
    return <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
      <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
      <p>No borders yet.</p>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Border Collection</h2>
        <div>
          <Button onClick={() => setUploadOpen(true)}><Upload /> Upload Border</Button>
          {uploadOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setUploadOpen(false)}>
              <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Upload New Border</h3>
                  <button onClick={() => setUploadOpen(false)}><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-4">
                  <Input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Border name" />
                  {file && <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-32 mx-auto object-contain" />}
                  <Button className="w-full" onClick={() => uploadBorder.mutate()} loading={uploadBorder.isPending}>Save Border</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((b) => (
          <div key={b.id} className="bg-card rounded-xl border overflow-hidden">
            <img src={b.imageUrl} alt={b.name} className="w-full aspect-[3/2] object-cover" />
            <div className="p-2 text-sm font-medium truncate">{b.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Filter Tab (dengan Custom Slider) ───────────────────────────────────

const FILTER_PARAMS_DEFAULT = {
  brightness: 1.0,
  saturation: 1.0,
  contrast: 1.0,
  hue: 0,
  grayscale: false,
  vignette: false,
  grain: 0,
};

type FilterParams = typeof FILTER_PARAMS_DEFAULT;

function FilterTab({ data }: { data: FilterItem[] }) {
  const qc = useQueryClient();
  const [customMode, setCustomMode] = useState(false);
  const [params, setParams] = useState<FilterParams>(FILTER_PARAMS_DEFAULT);
  const [filterName, setFilterName] = useState("");

  const saveFilter = useMutation({
    mutationFn: () =>
      apiClient.post("/api/templates/filters", {
        name: filterName,
        kind: "CUSTOM",
        params,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["filters"] });
      setFilterName("");
      toast.success("Filter saved");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Save failed"),
  });

  const set = (key: keyof FilterParams, value: number | boolean) => setParams((p) => ({ ...p, [key]: value }));

  const cssFilter = `brightness(${params.brightness}) saturate(${params.saturation}) contrast(${params.contrast}) hue-rotate(${params.hue}deg)${params.grayscale ? " grayscale(1)" : ""}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Filter Presets</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((f) => (
          <div key={f.id} className="bg-card rounded-lg border p-3 text-sm font-medium">{f.name}</div>
        ))}
      </div>

      <div className="border-t pt-6">
        <button onClick={() => setCustomMode(!customMode)} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sliders size={16} /> {customMode ? "Close" : "Open"} Custom Filter Tuner
        </button>

        {customMode && (
          <div className="mt-4 space-y-4 rounded-lg border bg-card p-6">
            {/* Preview */}
            <div className="flex items-center justify-center rounded-lg bg-muted/30 h-24" style={{ filter: cssFilter }}>
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-2 gap-4">
              <SliderField label="Brightness" value={params.brightness} min={0} max={2} step={0.05} onChange={(v) => set("brightness", v)} />
              <SliderField label="Contrast" value={params.contrast} min={0} max={2} step={0.05} onChange={(v) => set("contrast", v)} />
              <SliderField label="Saturation" value={params.saturation} min={0} max={2} step={0.05} onChange={(v) => set("saturation", v)} />
              <SliderField label="Hue" value={params.hue} min={0} max={360} step={1} onChange={(v) => set("hue", v)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="grayscale" checked={params.grayscale} onChange={(e) => set("grayscale", e.target.checked)} />
              <Label htmlFor="grayscale">Grayscale</Label>
            </div>
            <SliderField label="Grain" value={params.grain} min={0} max={1} step={0.05} onChange={(v) => set("grain", v)} />

            {/* Save as new filter */}
            <div className="flex gap-2 pt-2 border-t">
              <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="My Custom Filter" />
              <Button onClick={() => saveFilter.mutate()} loading={saveFilter.isPending} disabled={!filterName}>
                Save as Filter
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared slider component
function SliderField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
    </div>
  );
}
