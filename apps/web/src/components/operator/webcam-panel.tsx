"use client";

import * as React from "react";
import { Camera, RefreshCcw, Sparkles, VideoOff } from "lucide-react";
import { PHOTO_MIN_LONG_EDGE, PHOTO_TARGET_MAX_BYTES } from "@lumora/contracts";
import { captureVideoFrame, compressBitmapToTarget } from "@lumora/image/browser";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  cn,
  toast,
} from "@lumora/ui";
import { FaceArEngine, type ArEngineStatus } from "@/lib/ar/engine";
import { AR_STYLES } from "@/lib/ar/styles";
import { apiClient } from "@/lib/api";

export interface WebcamPanelProps {
  countdownSeconds: number;
  framesCaptured: number;
  framesTotal: number;
  disabled: boolean;
  /** Live LUT preview (CSS filter chain); "none" disables. */
  previewCssFilter?: string;
  /** Transparent border PNG stretched over the feed as a look preview. */
  borderOverlayUrl?: string | null;
  /** Called with the compressed frame; resolves when the upload finishes. */
  onFrame: (blob: Blob) => Promise<void>;
}

/**
 * FR-01 Web Capture Engine: WebRTC preview + countdown capture, FR-03
 * client-side compression, live LUT/border preview layers, and optional
 * MediaPipe face-AR accessories composited into the captured frame.
 */
export function WebcamPanel({
  countdownSeconds,
  framesCaptured,
  framesTotal,
  disabled,
  previewCssFilter = "none",
  borderOverlayUrl = null,
  onFrame,
}: WebcamPanelProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const engineRef = React.useRef<FaceArEngine | null>(null);

  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [flash, setFlash] = React.useState(false);
  const [arStyleId, setArStyleId] = React.useState<string | null>(null);
  const [arStatus, setArStatus] = React.useState<ArEngineStatus>("idle");
  const [libraryStickers, setLibraryStickers] = React.useState<Array<{id: string; name: string; url: string; anchorPoint: string; defaultScale: number; defaultOffsetX: number; defaultOffsetY: number}>>([]);

  React.useEffect(() => {
    apiClient.get<{stickers: typeof libraryStickers}>("/api/templates/stickers").then((res) => {
      setLibraryStickers(res.stickers);
    }).catch(() => {});
  }, []);

  const startStream = React.useCallback(async (id?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraError(null);
    try {
      // Coba preferred orientation — higher height favor portrait crop
      // Webcam fisik emang landscape, tapi hasil final di-compose ke layout portrait
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(id ? { deviceId: { exact: id } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "videoinput"));
    } catch {
      setCameraError("Camera unavailable. Check permissions and connections, then retry.");
    }
  }, []);

  React.useEffect(() => {
    void startStream();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [startStream]);

  /** Lazy AR boot: the model only downloads when a style is first picked. */
  const selectArStyle = async (styleId: string | null) => {
    setArStyleId(styleId);
    if (!styleId) {
      engineRef.current?.setStyle(null);
      engineRef.current?.stop();
      return;
    }
    try {
      if (!engineRef.current) engineRef.current = new FaceArEngine(setArStatus);
      if (videoRef.current && overlayRef.current) {
        await engineRef.current.init(videoRef.current, overlayRef.current);
      }
      // Check if it's a library sticker (id starts with "stk-")
      if (styleId.startsWith("stk-")) {
        const sticker = libraryStickers.find((s) => s.id === styleId.replace("stk-", ""));
        if (sticker) {
          await engineRef.current.setSticker(sticker.url, sticker.anchorPoint, sticker.defaultScale, sticker.defaultOffsetX, sticker.defaultOffsetY);
          engineRef.current.start();
        }
      } else {
        engineRef.current.setStyle(styleId);
        engineRef.current.start();
      }
    } catch {
      setArStyleId(null);
      toast.error("AR filter could not load — check the internet connection and retry");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || countdown !== null || uploading) return;

    for (let i = countdownSeconds; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    setUploading(true);
    try {
      const arActive = Boolean(arStyleId && engineRef.current?.activeStyleId);
      const bitmap = arActive
        ? await engineRef.current!.captureComposite()
        : await captureVideoFrame(video);
      const { blob } = await compressBitmapToTarget(bitmap, {
        targetBytes: PHOTO_TARGET_MAX_BYTES,
        minLongEdge: PHOTO_MIN_LONG_EDGE,
      });
      bitmap.close();
      await onFrame(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-lg border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-contain"
          style={{ filter: previewCssFilter, transform: "scaleX(-1)" }}
        />
        {/* AR overlay — native video resolution, object-contain keeps it
            pixel-aligned with the letterboxed video underneath. */}
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          style={{ transform: "scaleX(-1)" }}
        />
        {/* Border look-preview (hanya saat capture sudah selesai, bukan pas live preview) */}
        {framesCaptured > 0 && borderOverlayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={borderOverlayUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
          />
        ) : null}
        {flash ? <div className="absolute inset-0 bg-white" /> : null}
        {countdown !== null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-8xl font-bold text-white drop-shadow-lg">{countdown}</span>
          </div>
        ) : null}
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
            <VideoOff className="h-8 w-8 text-white/70" />
            <p className="text-sm text-white/80">{cameraError}</p>
            <Button variant="secondary" size="sm" onClick={() => startStream(deviceId)}>
              <RefreshCcw /> Retry camera
            </Button>
          </div>
        ) : null}
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          Frame {Math.min(framesCaptured + 1, framesTotal)} of {framesTotal}
        </div>
        {arStatus === "loading" ? (
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            <Spinner className="h-3 w-3 text-white" /> Loading AR…
          </div>
        ) : null}
      </div>

      {/* AR accessory picker */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <span className="sticky left-0 z-10 flex shrink-0 items-center justify-center rounded-full bg-background/80 pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AR
        </span>
        <button
          type="button"
          onClick={() => void selectArStyle(null)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
            arStyleId === null ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-accent/50",
          )}
        >
          None
        </button>
        {AR_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => void selectArStyle(style.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
              arStyleId === style.id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-accent/50",
            )}
          >
            {style.name}
          </button>
        ))}
        {libraryStickers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void selectArStyle(`stk-${s.id}`)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
              arStyleId === `stk-${s.id}` ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground hover:bg-accent/50",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex w-1/3 justify-start">
          <Select
            value={deviceId}
            onValueChange={(v) => {
              setDeviceId(v);
              void startStream(v);
            }}
          >
            <SelectTrigger className="w-[140px] border-none bg-accent/50 text-xs hover:bg-accent focus:ring-0">
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d, i) => (
                <SelectItem key={d.deviceId || i} value={d.deviceId} className="text-xs">
                  {d.label || `Camera ${i + 1}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-1/3 justify-center">
          <button
            type="button"
            className={cn(
              "relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100",
              countdown !== null || uploading ? "border-muted" : "border-primary/30 hover:border-primary/50",
              framesCaptured >= framesTotal && "opacity-60"
            )}
            onClick={capture}
            disabled={disabled || Boolean(cameraError) || framesCaptured >= framesTotal}
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                countdown !== null || uploading
                  ? "bg-muted"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {countdown !== null ? (
                <span className="text-lg font-bold text-foreground">{countdown}</span>
              ) : uploading ? (
                <Spinner className="h-5 w-5 text-foreground" />
              ) : (
                <Camera className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
          </button>
        </div>

        <div className="flex w-1/3 justify-end">
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {framesCaptured >= framesTotal ? "Done" : "Capture"}
            </div>
            <div className="text-sm font-medium">
              {Math.min(framesCaptured + 1, framesTotal)} / {framesTotal}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
