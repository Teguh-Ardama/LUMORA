"use client";

import React, { useState } from "react";
import { Upload, Image as ImageIcon, Trash2, Sparkles, X, Sliders, LayoutGrid, Edit3 } from "lucide-react";
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
  id: string; name: string; anchorPoint: StickerAnchor;
  defaultScale: number; defaultOffsetX: number; defaultOffsetY: number; url: string;
}
interface BorderItem { id: string; name: string; imageUrl: string; width: number; height: number; }
interface FilterItem { id: string; name: string; kind: string; params: Record<string, unknown>; }
interface LayoutItem {
  id: string; name: string; mode: "GRID" | "STRIP"; photoCount: number;
  config: { mode: string; canvas: { width: number; height: number }; background: string; slots: Array<{ x: number; y: number; w: number; h: number; photoIndex: number; radius: number }> };
}

export default function LibraryDashboardPage() {
  const [activeTab, setActiveTab] = useState<"stickers" | "borders" | "filters" | "layouts">("stickers");
  const qc = useQueryClient();

  const { data: stickersData, isLoading: stickersLoading } = useQuery({
    queryKey: ["stickers"],
    queryFn: () => apiClient.get<{ stickers: StickerItem[] }>("/api/stickers"),
  });
  const { data: bordersData } = useQuery({
    queryKey: ["borders"],
    queryFn: () => apiClient.get<{ borders: BorderItem[] }>("/api/templates/borders"),
  });
  const { data: filtersData } = useQuery({
    queryKey: ["filters"],
    queryFn: () => apiClient.get<{ filters: FilterItem[] }>("/api/templates/filters"),
  });
  const { data: layoutsData } = useQuery({
    queryKey: ["layouts"],
    queryFn: () => apiClient.get<{ layouts: LayoutItem[] }>("/api/templates/layouts"),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Asset Library</h1>
        <p className="text-muted-foreground mt-2">Manage stickers, borders, layouts, and custom filters.</p>
      </div>
      <div className="flex space-x-4 border-b">
        {(["stickers", "borders", "layouts", "filters"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{tab}</button>
        ))}
      </div>
      {activeTab === "stickers" && <StickerTab data={stickersData?.stickers ?? []} loading={stickersLoading} />}
      {activeTab === "borders" && <BorderTab data={bordersData?.borders ?? []} />}
      {activeTab === "layouts" && <LayoutTab data={layoutsData?.layouts ?? []} />}
      {activeTab === "filters" && <FilterTab data={filtersData?.filters ?? []} />}
    </div>
  );
}

// ── Sticker Tab (sama kaya sebelumnya) ────────────────────────────────────
function StickerTab({ data, loading }: { data: StickerItem[]; loading: boolean }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<string>("FOREHEAD");
  const [defaultScale, setDefaultScale] = useState(1.0); const [offsetX, setOffsetX] = useState(0); const [offsetY, setOffsetY] = useState(0);

  const uploadSticker = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const fd = new FormData(); fd.set("file", file); fd.set("name", name || file.name.replace(/\.[^/.]+$/, ""));
      fd.set("anchorPoint", anchorPoint); fd.set("defaultScale", String(defaultScale));
      fd.set("defaultOffsetX", String(offsetX)); fd.set("defaultOffsetY", String(offsetY));
      return apiClient.post<{ sticker: StickerItem }>("/api/stickers", fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["stickers"] }); setUploadOpen(false); setName(""); setFile(null); toast.success("Sticker uploaded"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Upload failed"),
  });
  const deleteSticker = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/stickers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stickers"] }),
  });
  if (loading) return <p className="text-muted-foreground py-8">Loading stickers…</p>;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Sticker Collection</h2>
        <Button onClick={() => setUploadOpen(true)}><Upload /> Upload Sticker</Button>
      </div>
      {uploadOpen && (
        <Modal onClose={() => setUploadOpen(false)} title="Upload New Sticker">
          <div className="space-y-4">
            <Label>PNG File</Label><Input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Topi Hitam" />
            <Label>Face Anchor Point</Label>
            <Select value={anchorPoint} onValueChange={setAnchorPoint}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ANCHOR_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Scale</Label><Input type="number" step={0.1} min={0.1} max={5} value={defaultScale} onChange={(e) => setDefaultScale(Number(e.target.value))} /></div>
              <div><Label>Offset X</Label><Input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} /></div>
              <div><Label>Offset Y</Label><Input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} /></div>
            </div>
            {file && <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-32 mx-auto object-contain" />}
            <Button className="w-full" onClick={() => uploadSticker.mutate()} loading={uploadSticker.isPending}>Save Sticker</Button>
          </div>
        </Modal>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.map((s) => (
          <div key={s.id} className="relative group bg-card rounded-xl p-4 border flex flex-col items-center justify-center aspect-square">
            <img src={s.url} alt={s.name} className="max-w-full max-h-full object-contain mb-2" />
            <span className="text-sm font-medium truncate w-full text-center">{s.name}</span>
            <span className="text-[10px] text-muted-foreground">{s.anchorPoint}</span>
            <button onClick={() => deleteSticker.mutate(s.id)}
              className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-destructive-foreground rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
          </div>
        ))}
        {data.length === 0 && <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl"><ImageIcon size={48} className="mb-4 opacity-50" /><p>No stickers uploaded yet.</p></div>}
      </div>
    </div>
  );
}

// ── Border Tab ──────────────────────────────────────────────────────────
function BorderTab({ data }: { data: BorderItem[] }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false); const [name, setName] = useState(""); const [file, setFile] = useState<File | null>(null);
  const uploadBorder = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file");
      const fd = new FormData(); fd.set("file", file); fd.set("name", name || file.name.replace(/\.[^/.]+$/, ""));
      return apiClient.postForm<{ border: BorderItem }>("/api/templates/borders", fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["borders"] }); setUploadOpen(false); setName(""); setFile(null); toast.success("Border uploaded"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Upload failed"),
  });
  const deleteBorder = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/borders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["borders"] }); toast.success("Border deleted"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Delete failed"),
  });
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Border Collection</h2>
        <Button onClick={() => setUploadOpen(true)}><Upload /> Upload Border</Button>
      </div>
      {uploadOpen && (
        <Modal onClose={() => setUploadOpen(false)} title="Upload New Border">
          <div className="space-y-4">
            <Input type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Border name" />
            {file && <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-32 mx-auto object-contain" />}
            <Button className="w-full" onClick={() => uploadBorder.mutate()} loading={uploadBorder.isPending}>Save Border</Button>
          </div>
        </Modal>
      )}
      {data.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl"><ImageIcon size={48} className="mx-auto mb-4 opacity-50" /><p>No borders yet.</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.map((b) => (
            <div key={b.id} className="group bg-card rounded-xl border overflow-hidden">
              <img src={b.imageUrl} alt={b.name} className="w-full aspect-[3/2] object-cover" />
              <div className="p-2 flex items-center justify-between">
                <span className="text-sm font-medium truncate">{b.name}</span>
                <button onClick={() => deleteBorder.mutate(b.id)} className="p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Layout Tab (Grid Builder) ───────────────────────────────────────────
function LayoutTab({ data }: { data: LayoutItem[] }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [mode, setMode] = useState<"GRID" | "STRIP">("GRID");
  const [rows, setRows] = useState(2); const [cols, setCols] = useState(2);
  const [radius, setRadius] = useState(12);

  const canvas = orientation === "landscape" ? { width: 1800, height: 1200 } : { width: 1200, height: 1800 };
  const slotW = Math.floor((canvas.width - 120) / cols);
  const slotH = Math.floor((canvas.height - 120) / rows);

  function buildSlots() {
    const slots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        slots.push({ x: 60 + c * (slotW + 60), y: 60 + r * (slotH + 60), w: slotW, h: slotH, photoIndex: slots.length, radius });
      }
    }
    return slots;
  }

  const saveLayout = useMutation({
    mutationFn: () => apiClient[editId ? "patch" : "post"](
      editId ? `/api/templates/layouts/${editId}` : "/api/templates/layouts",
      editId ? { name, config: { mode, canvas, background: "#ffffff", slots: buildSlots() } }
             : { name, config: { mode, canvas, background: "#ffffff", slots: buildSlots() } }
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layouts"] }); setCreateOpen(false); setEditId(null); setName(""); toast.success(editId ? "Layout updated" : "Layout created");
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Failed"),
  });

  const deleteLayout = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/layouts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["layouts"] }); toast.success("Layout deleted"); },
  });

  function startEdit(l: LayoutItem) {
    setEditId(l.id); setName(l.name);
    setMode(l.config.mode as "GRID" | "STRIP");
    setOrientation(l.config.canvas.width > l.config.canvas.height ? "landscape" : "portrait");
    const s = l.config.slots; const total = s.length;
    if (total === 2) { setRows(1); setCols(2); }
    else if (total === 3) { setRows(1); setCols(3); }
    else if (total === 4) { setRows(2); setCols(2); }
    else if (total === 6) { setRows(2); setCols(3); }
    else if (total === 8) { setRows(2); setCols(4); }
    else { setRows(2); setCols(2); }
    setCreateOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Layout Collection</h2>
        <Button onClick={() => { setEditId(null); setName(""); setCreateOpen(true); }}><LayoutGrid /> Create Layout</Button>
      </div>
      {createOpen && (
        <Modal onClose={() => { setCreateOpen(false); setEditId(null); }} title={editId ? "Edit Layout" : "Create Layout"}>
          <div className="space-y-4">
            <Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grid 4 Portrait" />

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Orientation</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v as "landscape" | "portrait")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="landscape">Landscape (1800×1200)</SelectItem><SelectItem value="portrait">Portrait (1200×1800)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "GRID" | "STRIP")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="GRID">Grid</SelectItem><SelectItem value="STRIP">Photo Strip</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label>Rows</Label><Input type="number" min={1} max={4} value={rows} onChange={(e) => setRows(Number(e.target.value))} /></div>
              <div><Label>Columns</Label><Input type="number" min={1} max={4} value={cols} onChange={(e) => setCols(Number(e.target.value))} /></div>
              <div><Label>Corner Radius</Label><Input type="number" min={0} max={40} value={radius} onChange={(e) => setRadius(Number(e.target.value))} /></div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground mb-2">Preview: {canvas.width}×{canvas.height}, {rows*cols} photos</p>
              <div className="bg-white rounded" style={{ width: "100%", aspectRatio: `${canvas.width}/${canvas.height}` }}>
                <svg viewBox={`0 0 ${canvas.width} ${canvas.height}`} className="w-full h-full">
                  <rect width={canvas.width} height={canvas.height} fill="#f8fafc" />
                  {buildSlots().map((s, i) => (
                    <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={radius} ry={radius} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={2} />
                  ))}
                </svg>
              </div>
            </div>

            <Button className="w-full" onClick={() => saveLayout.mutate()} loading={saveLayout.isPending} disabled={!name}>
              {editId ? "Update Layout" : "Create Layout"}
            </Button>
          </div>
        </Modal>
      )}
      {data.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl"><ImageIcon size={48} className="mx-auto mb-4 opacity-50" /><p>No layouts yet.</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.map((l) => (
            <div key={l.id} className="group bg-card rounded-xl border overflow-hidden">
              <div className="bg-muted/30 p-3"><svg viewBox={`0 0 ${l.config.canvas.width} ${l.config.canvas.height}`} className="w-full h-auto">
                <rect width={l.config.canvas.width} height={l.config.canvas.height} fill="#f8fafc" />
                {l.config.slots.map((s, i) => (<rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={2} />))}
              </svg></div>
              <div className="p-2 flex items-center justify-between">
                <div><p className="text-sm font-medium truncate">{l.name}</p><p className="text-xs text-muted-foreground">{l.mode} · {l.photoCount} photos</p></div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(l)} className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><Edit3 size={14} /></button>
                  <button onClick={() => deleteLayout.mutate(l.id)} className="p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filter Tab ──────────────────────────────────────────────────────────
const FILTER_PARAMS_DEFAULT = { brightness: 1.0, saturation: 1.0, contrast: 1.0, hue: 0, grayscale: false, grain: 0 };
type FilterParams = typeof FILTER_PARAMS_DEFAULT;

function FilterTab({ data }: { data: FilterItem[] }) {
  const qc = useQueryClient();
  const [customMode, setCustomMode] = useState(false);
  const [params, setParams] = useState<FilterParams>(FILTER_PARAMS_DEFAULT);
  const [filterName, setFilterName] = useState("");
  const [lutFile, setLutFile] = useState<File | null>(null);

  const saveFilter = useMutation({
    mutationFn: () => apiClient.post("/api/templates/filters", { name: filterName, kind: "CUSTOM", params }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["filters"] }); setFilterName(""); toast.success("Filter saved"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Save failed"),
  });

  const uploadLut = useMutation({
    mutationFn: async () => {
      if (!lutFile) throw new Error("Select a .cube file");
      const fd = new FormData(); fd.set("file", lutFile);
      fd.set("name", filterName || lutFile.name.replace(/\.[^/.]+$/, ""));
      return apiClient.postForm("/api/templates/filters/lut", fd);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["filters"] }); setLutFile(null); setFilterName(""); toast.success("LUT filter uploaded"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Upload failed"),
  });

  const deleteFilter = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/templates/filters/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["filters"] }); toast.success("Filter deleted"); },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Delete failed"),
  });

  const set = (key: keyof FilterParams, value: number | boolean) => setParams((p) => ({ ...p, [key]: value }));
  const cssFilter = `brightness(${params.brightness}) saturate(${params.saturation}) contrast(${params.contrast}) hue-rotate(${params.hue}deg)${params.grayscale ? " grayscale(1)" : ""}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Filter Presets</h2>

      {/* LUT Upload */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">Upload LUT Filter</h3>
        <div className="flex gap-2">
          <Input type="file" accept=".cube,.png" onChange={(e) => setLutFile(e.target.files?.[0] ?? null)} />
          <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filter name" className="max-w-xs" />
          <Button onClick={() => uploadLut.mutate()} loading={uploadLut.isPending} disabled={!lutFile}>Upload LUT</Button>
        </div>
      </div>

      {/* Filter List */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((f) => (
          <div key={f.id} className="group bg-card rounded-lg border p-3 flex items-center justify-between">
            <span className="text-sm font-medium">{f.name}</span>
            <button onClick={() => deleteFilter.mutate(f.id)} className="p-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {/* Custom Filter Tuner */}
      <div className="border-t pt-6">
        <button onClick={() => setCustomMode(!customMode)} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sliders size={16} /> {customMode ? "Close" : "Open"} Custom Filter Tuner
        </button>
        {customMode && (
          <div className="mt-4 space-y-4 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-center rounded-lg bg-muted/30 h-24" style={{ filter: cssFilter }}><Sparkles className="h-8 w-8 text-muted-foreground" /></div>
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
            <div className="flex gap-2 pt-2 border-t">
              <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="My Custom Filter" />
              <Button onClick={() => saveFilter.mutate()} loading={saveFilter.isPending} disabled={!filterName}>Save as Filter</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────
function SliderField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="font-mono text-muted-foreground">{value.toFixed(2)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary" />
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
