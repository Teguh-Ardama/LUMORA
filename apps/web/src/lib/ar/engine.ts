"use client";

import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { getArStyle, type ArStyle } from "./styles";

const WASM_BASE = "/ar";
const MODEL_URL = "/ar/face_landmarker.task";

// Canonical FaceMesh landmark indices (468 points). Right = subject's right (image left).
const RIGHT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 263;
const LEFT_EYE_INNER = 362;
const NOSE_TIP = 1;
const NOSE_BRIDGE = 6;
const MOUTH_CENTER = 13;
const UPPER_LIP_CENTER = 164;
const CHIN_TIP = 152;
const HEAD_TOP = 10;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;

/**
 * MediaPipe's WASM runtime prints informational messages (e.g. "INFO:
 * Created TensorFlow Lite XNNPACK delegate for CPU.") through
 * console.error, which the Next.js dev overlay renders as a full-screen
 * error. Demote that noise to console.info — real errors pass through.
 */
let logFilterInstalled = false;
function installMediapipeLogFilter(): void {
  if (logFilterInstalled) return;
  logFilterInstalled = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.startsWith("INFO:") || first.includes("TensorFlow Lite XNNPACK"))
    ) {
      console.info(first, ...args.slice(1));
      return;
    }
    original(...args);
  };
}

export type ArEngineStatus = "idle" | "loading" | "running" | "error" | "unsupported";

/**
 * Face-AR engine: MediaPipe Face Landmarker (WASM, GPU-delegated) feeding a
 * transparent overlay canvas above the live <video>.
 *
 * Performance model: detection runs per *video frame* via
 * requestVideoFrameCallback (falls back to rAF), typically 2–5 ms per frame
 * with the GPU delegate — comfortably 60 FPS. Rendering is plain 2D vector
 * work in overlay pixel space; React is never involved in the hot path.
 */
/** Map sticker anchor names to face landmark indices. */
const ANCHOR_LANDMARKS: Record<string, { x: number; y: number } | null> = {
  FOREHEAD: null,  // special: computed from eye midpoint + offset
  LEFT_EYE: null,  // will be computed
  RIGHT_EYE: null,
  NOSE: { x: 1, y: 2 },
  MOUTH: null,
  CHIN: null,
  LEFT_EAR: null,
  RIGHT_EAR: null,
  FULL_FACE: null,
};

/** Sticker overlay data — a loaded PNG image with anchor config. */
export interface StickerOverlay {
  image: HTMLImageElement;
  anchorPoint: string;
  defaultScale: number;
  defaultOffsetX: number;
  defaultOffsetY: number;
}

export class FaceArEngine {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private style: ArStyle | null = null;
  private sticker: StickerOverlay | null = null;
  private running = false;
  private rafHandle = 0;
  private vfcHandle = 0;
  private lastVideoTime = -1;
  private lastResult: FaceLandmarkerResult | null = null;
  private onStatus: (status: ArEngineStatus, message?: string) => void;

  constructor(onStatus?: (status: ArEngineStatus, message?: string) => void) {
    this.onStatus = onStatus ?? (() => undefined);
  }

  async init(video: HTMLVideoElement, overlay: HTMLCanvasElement): Promise<void> {
    this.video = video;
    this.overlay = overlay;
    if (this.landmarker) return;

    if (typeof WebAssembly !== "object") {
      this.onStatus("unsupported", "WebAssembly is not available in this browser");
      throw new Error("WebAssembly unavailable");
    }

    this.onStatus("loading");
    installMediapipeLogFilter();
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      this.onStatus("running");
    } catch (err) {
      this.onStatus("error", err instanceof Error ? err.message : "Failed to load the AR model");
      throw err;
    }
  }

  setStyle(styleId: string | null): void {
    this.style = getArStyle(styleId);
    this.sticker = null;
    if (!this.style) this.clearOverlay();
  }

  async setSticker(url: string, anchor: string, scale: number, offsetX: number, offsetY: number): Promise<void> {
    this.style = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load sticker image"));
      img.src = url;
    });
    this.sticker = { image: img, anchorPoint: anchor, defaultScale: scale, defaultOffsetX: offsetX, defaultOffsetY: offsetY };
  }

  get activeStyleId(): string | null {
    return this.style?.id ?? null;
  }

  clearSticker(): void {
    this.sticker = null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNextFrame();
  }

  stop(): void {
    this.running = false;
    if (this.vfcHandle && this.video && "cancelVideoFrameCallback" in this.video) {
      this.video.cancelVideoFrameCallback(this.vfcHandle);
      this.vfcHandle = 0;
    }
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
    this.clearOverlay();
  }

  dispose(): void {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }

  private scheduleNextFrame(): void {
    if (!this.running || !this.video) return;
    if ("requestVideoFrameCallback" in this.video) {
      this.vfcHandle = this.video.requestVideoFrameCallback(() => this.tick());
    } else {
      this.rafHandle = requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    if (!this.running) return;
    try {
      this.detectAndRender();
    } catch {
      // A single bad frame must never kill the loop.
    }
    this.scheduleNextFrame();
  }

  private detectAndRender(): void {
    const { video, overlay, landmarker } = this;
    if (!video || !overlay || !landmarker || video.readyState < 2) return;

    // Keep overlay native-resolution so capture composites are pixel-exact.
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    }

    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      this.lastResult = landmarker.detectForVideo(video, performance.now());
    }
    this.renderOverlay();
  }

  private clearOverlay(): void {
    const ctx = this.overlay?.getContext("2d");
    if (ctx && this.overlay) ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  private renderOverlay(): void {
    const overlay = this.overlay;
    const ctx = overlay?.getContext("2d");
    if (!overlay || !ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!this.lastResult) return;

    for (const landmarks of this.lastResult.faceLandmarks) {
      const right = landmarks[RIGHT_EYE_OUTER];
      const left = landmarks[LEFT_EYE_OUTER];
      if (!right || !left) continue;

      const rx = right.x * overlay.width;
      const ry = right.y * overlay.height;
      const lx = left.x * overlay.width;
      const ly = left.y * overlay.height;

      const eyeDistance = Math.hypot(lx - rx, ly - ry);
      if (eyeDistance < 12) continue;

      const angle = Math.atan2(ly - ry, lx - rx);
      const cx = (rx + lx) / 2;
      const cy = (ry + ly) / 2;
      
      let anchorX = cx;
      let anchorY = cy;
      
      if (this.style) {
        if (this.style.anchor === "nose") {
          const nose = landmarks[NOSE_TIP];
          if (nose) {
            anchorX = nose.x * overlay.width;
            anchorY = nose.y * overlay.height;
          }
        } else if (this.style.anchor === "mouth") {
          const lip = landmarks[UPPER_LIP_CENTER];
          if (lip) {
            anchorX = lip.x * overlay.width;
            anchorY = lip.y * overlay.height;
          }
        } else if (this.style.anchor === "head") {
          const head = landmarks[HEAD_TOP];
          if (head) {
            anchorX = head.x * overlay.width;
            anchorY = head.y * overlay.height;
          }
        }
      }

      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.rotate(angle);

      if (this.style) {
        this.style.draw(ctx, eyeDistance);
      } else if (this.sticker) {
        this.renderSticker(ctx, landmarks, overlay, eyeDistance);
      }

      ctx.restore();
    }
  }

  /** Render a sticker PNG at the correct face anchor point, relative to eye center. */
  private renderSticker(ctx: CanvasRenderingContext2D, landmarks: typeof this.lastResult.faceLandmarks[0], overlay: HTMLCanvasElement, eyeDistance: number): void {
    const s = this.sticker;
    if (!s) return;

    const ow = overlay.width, oh = overlay.height;
    const lx = landmarks[LEFT_EYE_OUTER].x * ow;
    const ly = landmarks[LEFT_EYE_OUTER].y * oh;
    const rx = landmarks[RIGHT_EYE_OUTER].x * ow;
    const ry = landmarks[RIGHT_EYE_OUTER].y * oh;
    const cx = (lx + rx) / 2;
    const cy = (ly + ry) / 2;

    // Compute anchor absolute position
    let ax: number, ay: number;
    switch (s.anchorPoint) {
      case "FOREHEAD":
        ax = (landmarks[RIGHT_EYE_OUTER].x + landmarks[LEFT_EYE_OUTER].x) / 2 * ow;
        ay = (landmarks[RIGHT_EYE_OUTER].y + landmarks[LEFT_EYE_OUTER].y) / 2 * oh;
        ay -= Math.abs(landmarks[CHIN_TIP].y * oh - ay) * 0.45;
        break;
      case "LEFT_EYE":  ax = lx; ay = ly; break;
      case "RIGHT_EYE": ax = rx; ay = ry; break;
      case "NOSE":      ax = landmarks[NOSE_BRIDGE].x * ow; ay = landmarks[NOSE_BRIDGE].y * oh; break;
      case "MOUTH":     ax = landmarks[MOUTH_CENTER].x * ow; ay = landmarks[MOUTH_CENTER].y * oh; break;
      case "CHIN":      ax = landmarks[CHIN_TIP].x * ow; ay = (landmarks[CHIN_TIP].y + landmarks[MOUTH_CENTER].y) / 2 * oh; break;
      case "LEFT_EAR":  ax = landmarks[LEFT_EAR].x * ow; ay = landmarks[LEFT_EAR].y * oh; break;
      case "RIGHT_EAR": ax = landmarks[RIGHT_EAR].x * ow; ay = landmarks[RIGHT_EAR].y * oh; break;
      default:
        ax = cx; ay = cy;
    }

    // Convert to coordinates relative to eye center (cx, cy) — which is current ctx origin
    const relX = ax - cx + s.defaultOffsetX * (eyeDistance / 100);
    const relY = ay - cy + s.defaultOffsetY * (eyeDistance / 100);
    const scale = (eyeDistance * s.defaultScale) / 100;
    const w = s.image.naturalWidth * scale;
    const h = s.image.naturalHeight * scale;
    ctx.drawImage(s.image, relX - w / 2, relY - h / 2, w, h);
  }

  /**
   * WYSIWYG capture: current video frame + AR overlay merged at native
   * video resolution. Falls back to the raw frame when AR is off.
   */
  async captureComposite(): Promise<ImageBitmap> {
    const video = this.video;
    if (!video) throw new Error("AR engine not initialized");
    if (!this.style || !this.overlay) return createImageBitmap(video);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(video, 0, 0);
    ctx.drawImage(this.overlay, 0, 0, canvas.width, canvas.height);
    return createImageBitmap(canvas);
  }
}
