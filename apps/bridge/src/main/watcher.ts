import chokidar, { type FSWatcher } from "chokidar";
import { blog } from "./logger";

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export interface WatcherCallbacks {
  onPhoto: (filePath: string) => void;
  onStatus: (active: boolean) => void;
}

/**
 * FR-02 folder watcher. `awaitWriteFinish` debounces tether software that
 * streams files in chunks — we only fire once the size is stable, so a
 * half-written RAW-to-JPEG never uploads corrupt.
 */
export class TetherWatcher {
  private watcher: FSWatcher | null = null;
  private startedAt = 0;

  constructor(private readonly callbacks: WatcherCallbacks) {}

  get active(): boolean {
    return this.watcher !== null;
  }

  start(folder: string): void {
    this.stop();
    this.startedAt = Date.now();
    this.watcher = chokidar.watch(folder, {
      ignoreInitial: true, // pre-existing files are not this event's shots
      depth: 2,
      awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 150 },
    });
    this.watcher
      .on("add", (filePath) => {
        const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
        if (!PHOTO_EXTENSIONS.has(ext)) return;
        blog.info(`Detected new photo: ${filePath}`);
        this.callbacks.onPhoto(filePath);
      })
      .on("ready", () => {
        blog.info(`Watching folder: ${folder}`);
        this.callbacks.onStatus(true);
      })
      .on("error", (err) => {
        blog.error(`Watcher error: ${err instanceof Error ? err.message : String(err)}`);
        // Auto-restart after a short delay (drive unplugged, etc.).
        setTimeout(() => {
          if (this.active && Date.now() - this.startedAt > 5000) this.start(folder);
        }, 3000);
      });
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
      this.callbacks.onStatus(false);
      blog.info("Watcher stopped");
    }
  }
}
