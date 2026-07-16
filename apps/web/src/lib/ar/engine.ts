"use client";

import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { getArStyle, type ArStyle } from "./styles";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Canonical FaceMesh landmark indices.
const RIGHT_EYE_OUTER = 33; // subject's right (image left)
const LEFT_EYE_OUTER = 263;
const NOSE_TIP = 1;
const UPPER_LIP_CENTER = 164;
const HEAD_TOP = 10;

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
export class FaceArEngine {
  private landmarker: FaceLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private style: ArStyle | null = null;
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
        numFaces: 4,
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
    if (!this.style) this.clearOverlay();
  }

  get activeStyleId(): string | null {
    return this.style?.id ?? null;
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
    if (!this.style || !this.lastResult) return;

    for (const landmarks of this.lastResult.faceLandmarks) {
      const right = landmarks[RIGHT_EYE_OUTER];
      const left = landmarks[LEFT_EYE_OUTER];
      if (!right || !left) continue;

      const rx = right.x * overlay.width;
      const ry = right.y * overlay.height;
      const lx = left.x * overlay.width;
      const ly = left.y * overlay.height;

      const eyeDistance = Math.hypot(lx - rx, ly - ry);
      if (eyeDistance < 12) continue; // face too small / spurious detection

      const angle = Math.atan2(ly - ry, lx - rx);
      
      let anchorX = (rx + lx) / 2;
      let anchorY = (ry + ly) / 2;
      
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

      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.rotate(angle);
      this.style.draw(ctx, eyeDistance);
      ctx.restore();
    }
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
