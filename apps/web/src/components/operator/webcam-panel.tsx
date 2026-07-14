"use client";

import * as React from "react";
import { Camera, RefreshCcw, VideoOff } from "lucide-react";
import { PHOTO_MIN_LONG_EDGE, PHOTO_TARGET_MAX_BYTES } from "@lumora/contracts";
import { captureVideoFrame, compressBitmapToTarget } from "@lumora/image/browser";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  toast,
} from "@lumora/ui";

export interface WebcamPanelProps {
  countdownSeconds: number;
  framesCaptured: number;
  framesTotal: number;
  disabled: boolean;
  /** Called with the compressed frame; resolves when the upload finishes. */
  onFrame: (blob: Blob) => Promise<void>;
}

/**
 * FR-01 Web Capture Engine: WebRTC preview + countdown capture, with
 * FR-03 client-side compression before every upload.
 */
export function WebcamPanel({ countdownSeconds, framesCaptured, framesTotal, disabled, onFrame }: WebcamPanelProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string | undefined>(undefined);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [flash, setFlash] = React.useState(false);

  const startStream = React.useCallback(async (id?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(id ? { deviceId: { exact: id } } : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startStream]);

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
      const bitmap = await captureVideoFrame(video);
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
    <div className="flex h-full flex-col gap-3">
      <div className="relative flex-1 overflow-hidden rounded-lg border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
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
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={deviceId}
          onValueChange={(v) => {
            setDeviceId(v);
            void startStream(v);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Default camera" />
          </SelectTrigger>
          <SelectContent>
            {devices.map((d, i) => (
              <SelectItem key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className={cn("flex-1", framesCaptured >= framesTotal && "opacity-60")}
          size="lg"
          onClick={capture}
          disabled={disabled || Boolean(cameraError) || framesCaptured >= framesTotal}
          loading={uploading || countdown !== null}
        >
          <Camera /> {countdown !== null ? "Get ready…" : uploading ? "Uploading…" : "Capture frame"}
        </Button>
      </div>
    </div>
  );
}
