import { BrowserWindow, app, dialog, ipcMain } from "electron";
import os from "node:os";
import path from "node:path";
import { IpcChannel, type BridgeState, type PairRequest } from "../shared/ipc-contract";
import { bridgeApi, BridgeApiError } from "./api-client";
import { getConfigStore } from "./config-store";
import { attachLogWindow, blog } from "./logger";
import { OfflineQueue } from "./offline-queue";
import { TetherWatcher } from "./watcher";
import { startRealtimeStream, stopRealtimeStream } from "./stream";
import { getDownloadedCount } from "./downloader";

const HEARTBEAT_INTERVAL_MS = 15_000;

let win: BrowserWindow | null = null;
let queue: OfflineQueue;
let watcher: TetherWatcher;
let heartbeatTimer: NodeJS.Timeout | null = null;

// Session state fed by heartbeats — stamped onto every enqueued photo.
let online = false;
let watcherActive = false;
let activeSession: { id: string; photoCount: number; framesPerSession: number } | null = null;
let localSequence = 0;
let lastSessionId: string | null = null;

function currentState(): BridgeState {
  const cfg = getConfigStore().get();
  return {
    paired: Boolean(cfg.deviceToken),
    eventName: cfg.eventName,
    watchFolder: cfg.watchFolder,
    outputFolder: cfg.outputFolder,
    watcherActive,
    online,
    queueDepth: queue?.depth ?? 0,
    activeSessionId: activeSession?.id ?? null,
    uploadedCount: queue?.uploadedCount ?? 0,
    downloadedCount: getDownloadedCount(),
    lastUploadAt: queue?.lastUploadAt ?? null,
    appVersion: app.getVersion(),
  };
}

export function broadcastState(): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IpcChannel.STATE_CHANGED, currentState());
  }
}

async function heartbeat(): Promise<void> {
  const cfg = getConfigStore().get();
  if (!cfg.deviceToken) return;
  try {
    const result = await bridgeApi.heartbeat({
      queueDepth: queue.depth,
      watcherActive,
      watchedFolder: cfg.watchFolder,
    });
    if (!online) blog.info("Connected to LUMORA");
    online = true;
    // New session? reset the local frame counter.
    if (result.activeSession?.id !== lastSessionId) {
      lastSessionId = result.activeSession?.id ?? null;
      localSequence = result.activeSession?.photoCount ?? 0;
      if (result.activeSession) blog.info(`Active bridge session: ${result.activeSession.id}`);
    }
    activeSession = result.activeSession;
    // Connectivity is back — kick the queue.
    void queue.pump();
  } catch (err) {
    if (online) {
      blog.warn(
        `Lost connection: ${err instanceof Error ? err.message : String(err)} — uploads will queue offline`,
      );
    }
    online = false;
    if (err instanceof BridgeApiError && err.status === 401) {
      blog.error("Device token rejected — re-pair this bridge from the dashboard");
    }
  }
  broadcastState();
}

function startHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
  void heartbeat();
}

function wireIpc(): void {
  ipcMain.handle(IpcChannel.GET_STATE, () => currentState());

  ipcMain.handle(IpcChannel.PAIR, async (_e, req: PairRequest) => {
    try {
      const result = await bridgeApi.pair(req.apiUrl, {
        code: req.code.trim().toUpperCase(),
        deviceName: req.deviceName.trim() || os.hostname(),
        platform: `${os.platform()} ${os.release()}`,
        appVersion: app.getVersion(),
      });
      getConfigStore().set({
        apiUrl: result.apiUrl.replace(/\/$/, ""),
        deviceToken: result.deviceToken,
        deviceId: result.deviceId,
        eventId: result.eventId,
        eventName: result.eventName,
      });
      startHeartbeat();
      startRealtimeStream();
      blog.info(`Paired with event "${result.eventName}"`);
      broadcastState();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pairing failed";
      blog.error(`Pairing failed: ${message}`);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(IpcChannel.UNPAIR, () => {
    watcher.stop();
    watcherActive = false;
    getConfigStore().clear();
    online = false;
    activeSession = null;
    stopRealtimeStream();
    blog.info("Unpaired — configuration cleared");
    broadcastState();
  });

  ipcMain.handle(IpcChannel.SELECT_FOLDER, async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Select the DSLR tethering folder",
      properties: ["openDirectory"],
    });
    const folder = result.filePaths[0] ?? null;
    if (folder) {
      getConfigStore().set({ watchFolder: folder });
      blog.info(`Tether folder set: ${folder}`);
      if (watcherActive) watcher.start(folder);
      broadcastState();
    }
    return folder;
  });

  ipcMain.handle(IpcChannel.SELECT_OUTPUT_FOLDER, async () => {
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Select Output Folder for Prints",
      properties: ["openDirectory"],
    });
    const folder = result.filePaths[0] ?? null;
    if (folder) {
      getConfigStore().set({ outputFolder: folder });
      blog.info(`Output folder set: ${folder}`);
      broadcastState();
    }
    return folder;
  });

  ipcMain.handle(IpcChannel.SET_WATCHER, (_e, active: boolean) => {
    const cfg = getConfigStore().get();
    if (active) {
      if (!cfg.watchFolder) {
        blog.warn("Select a tether folder before starting the watcher");
        return;
      }
      watcher.start(cfg.watchFolder);
    } else {
      watcher.stop();
    }
    broadcastState();
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 860,
    height: 640,
    minWidth: 720,
    minHeight: 520,
    title: "LUMORA Bridge",
    backgroundColor: "#101014",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  void win.loadFile(path.join(__dirname, "..", "static", "index.html"));
  attachLogWindow(win);
  win.on("closed", () => {
    win = null;
  });
}

void app.whenReady().then(() => {
  queue = new OfflineQueue();
  queue.onChange(broadcastState);

  watcher = new TetherWatcher({
    onPhoto: (filePath) => {
      // Stamp with the live session when it's a CAPTURING bridge session;
      // otherwise the server quarantines it for the operator to rescue.
      const sessionId = activeSession?.id ?? null;
      const sequence = sessionId ? localSequence++ : null;
      queue.enqueue(filePath, sessionId, sequence);
    },
    onStatus: (active) => {
      watcherActive = active;
      broadcastState();
    },
  });

  wireIpc();
  createWindow();

  if (getConfigStore().get().deviceToken) {
    startHeartbeat();
    startRealtimeStream();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Background service semantics: keep uploading even with the window
  // closed on Windows; quit on explicit request only via tray-less model.
  if (process.platform !== "darwin") {
    // Keep the process alive while a queue is draining.
    if (queue?.depth > 0) {
      blog.info(`Window closed with ${queue.depth} upload(s) pending — finishing in background`);
      const check = setInterval(() => {
        if (queue.depth === 0) {
          clearInterval(check);
          app.quit();
        }
      }, 2000);
    } else {
      app.quit();
    }
  }
});
