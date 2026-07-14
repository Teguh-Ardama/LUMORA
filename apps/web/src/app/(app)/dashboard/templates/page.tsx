"use client";

import * as React from "react";
import { Images, LayoutGrid, Plus, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { layoutConfigSchema, type LayoutConfig } from "@lumora/contracts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toolbar,
  toast,
} from "@lumora/ui";
import {
  useBorders,
  useCreateLayout,
  useDeleteBorder,
  useDeleteLayout,
  useFilters,
  useLayouts,
  useUploadBorder,
} from "@/lib/hooks/use-templates";
import { useMe } from "@/lib/hooks/use-auth";
import { LayoutPreview } from "@/components/templates/layout-preview";
import { ApiClientError } from "@/lib/api";

const EXAMPLE_LAYOUT = JSON.stringify(
  {
    mode: "GRID",
    canvas: { width: 1800, height: 1200 },
    background: "#ffffff",
    slots: [
      { x: 60, y: 60, w: 825, h: 525, photoIndex: 0, radius: 12 },
      { x: 915, y: 60, w: 825, h: 525, photoIndex: 1, radius: 12 },
      { x: 60, y: 615, w: 825, h: 525, photoIndex: 2, radius: 12 },
      { x: 915, y: 615, w: 825, h: 525, photoIndex: 3, radius: 12 },
    ],
  },
  null,
  2,
);

function UploadBorderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const upload = useUploadBorder();
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  const submit = async () => {
    if (!file || name.trim().length < 2) {
      toast.error("Provide a name and a PNG file");
      return;
    }
    try {
      await upload.mutateAsync({ file, name: name.trim() });
      toast.success("Border uploaded");
      onOpenChange(false);
      setName("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload border</DialogTitle>
          <DialogDescription>
            Transparent PNG overlaid on top of composed photos. Match your layout's canvas (1800×1200 or 1200×1800).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="border-name">Name</Label>
            <Input id="border-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gold Elegant Frame" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="border-file">PNG file</Label>
            <Input id="border-file" type="file" accept="image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={upload.isPending}>
            <Upload /> Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateLayoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateLayout();
  const [name, setName] = React.useState("");
  const [json, setJson] = React.useState(EXAMPLE_LAYOUT);
  const [parsed, setParsed] = React.useState<LayoutConfig | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const result = layoutConfigSchema.safeParse(JSON.parse(json));
      if (result.success) {
        setParsed(result.data);
        setParseError(null);
      } else {
        setParsed(null);
        setParseError(result.error.issues[0]?.message ?? "Invalid layout config");
      }
    } catch {
      setParsed(null);
      setParseError("Invalid JSON");
    }
  }, [json]);

  const submit = async () => {
    if (!parsed || name.trim().length < 2) {
      toast.error("Provide a name and a valid layout config");
      return;
    }
    try {
      await create.mutateAsync({ name: name.trim(), config: parsed });
      toast.success("Layout created");
      onOpenChange(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create layout");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create layout</DialogTitle>
          <DialogDescription>
            JSON slot map (FR-07). STRIP mode describes the left column only — it is mirrored automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="layout-name">Name</Label>
              <Input id="layout-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grid 4 — Custom" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-json">Layout config (JSON)</Label>
              <Textarea
                id="layout-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className="min-h-[260px] font-mono text-xs"
                spellCheck={false}
              />
              {parseError ? <p className="text-xs text-destructive">{parseError}</p> : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-center justify-center rounded-lg border bg-muted/40 p-4">
              {parsed ? (
                <LayoutPreview config={parsed} className="max-h-[300px] w-full" />
              ) : (
                <p className="py-16 text-sm text-muted-foreground">Fix the config to preview</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!parsed}>
            Create layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const { data: me } = useMe();
  const borders = useBorders();
  const layouts = useLayouts();
  const filters = useFilters();
  const deleteBorder = useDeleteBorder();
  const deleteLayout = useDeleteLayout();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [layoutOpen, setLayoutOpen] = React.useState(false);

  const canManage = me?.user.role !== "OPERATOR";

  return (
    <div>
      <Toolbar
        title="Template Library"
        description="Borders, layouts, and filters — global platform templates plus your own."
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setLayoutOpen(true)}>
                <Plus /> New layout
              </Button>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload /> Upload border
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs defaultValue="borders">
        <TabsList>
          <TabsTrigger value="borders">Borders</TabsTrigger>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
        </TabsList>

        <TabsContent value="borders">
          {borders.isError ? (
            <ErrorState onRetry={() => borders.refetch()} />
          ) : borders.isLoading ? (
            <LoadingState />
          ) : (borders.data?.borders.length ?? 0) === 0 ? (
            <EmptyState icon={Images} title="No borders" description="Upload a transparent PNG border to get started." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {borders.data!.borders.map((b) => (
                <Card key={b.id} className="group overflow-hidden">
                  <div className="relative aspect-[3/2] bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,hsl(var(--card))_0%_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.imageUrl} alt={b.name} loading="lazy" className="h-full w-full object-contain" />
                  </div>
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.width}×{b.height}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={b.scope === "GLOBAL" ? "muted" : "secondary"}>{b.scope}</Badge>
                      {canManage && b.scope !== "GLOBAL" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${b.name}`}
                          onClick={() =>
                            deleteBorder.mutate(b.id, {
                              onSuccess: () => toast.success("Border deleted"),
                              onError: () => toast.error("Could not delete border"),
                            })
                          }
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="layouts">
          {layouts.isError ? (
            <ErrorState onRetry={() => layouts.refetch()} />
          ) : layouts.isLoading ? (
            <LoadingState />
          ) : (layouts.data?.layouts.length ?? 0) === 0 ? (
            <EmptyState icon={LayoutGrid} title="No layouts" description="Create a JSON layout to control 4R composition." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {layouts.data!.layouts.map((l) => (
                <Card key={l.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-center rounded-md bg-muted/40 p-3">
                      <LayoutPreview config={l.config} className="max-h-32" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.mode} · {l.photoCount} photo{l.photoCount > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={l.scope === "GLOBAL" ? "muted" : "secondary"}>{l.scope}</Badge>
                        {canManage && l.scope !== "GLOBAL" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${l.name}`}
                            onClick={() =>
                              deleteLayout.mutate(l.id, {
                                onSuccess: () => toast.success("Layout deleted"),
                                onError: () => toast.error("Could not delete layout"),
                              })
                            }
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="filters">
          {filters.isError ? (
            <ErrorState onRetry={() => filters.refetch()} />
          ) : filters.isLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(filters.data?.filters ?? []).map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.kind}</p>
                      </div>
                    </div>
                    <Badge variant={f.scope === "GLOBAL" ? "muted" : "secondary"}>{f.scope}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UploadBorderDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <CreateLayoutDialog open={layoutOpen} onOpenChange={setLayoutOpen} />
    </div>
  );
}
