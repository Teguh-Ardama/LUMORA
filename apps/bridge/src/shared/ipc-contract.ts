/** Typed IPC surface between the Bridge main process and its renderer. */

export interface BridgeConfig {
  apiUrl: string | null;
  deviceToken: string | null;
  deviceId: string | null;
  eventId: string | null;
  eventName: string | null;
  watchFolder: string | null;
}

export interface BridgeState {
  paired: boolean;
  eventName: string | null;
  watchFolder: string | null;
  watcherActive: boolean;
  online: boolean;
  queueDepth: number;
  activeSessionId: string | null;
  uploadedCount: number;
  lastUploadAt: string | null;
  appVersion: string;
}

export interface LogLine {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
}

export const IpcChannel = {
  GET_STATE: "bridge:get-state",
  PAIR: "bridge:pair",
  UNPAIR: "bridge:unpair",
  SELECT_FOLDER: "bridge:select-folder",
  SET_WATCHER: "bridge:set-watcher",
  STATE_CHANGED: "bridge:state-changed",
  LOG: "bridge:log",
} as const;

export interface PairRequest {
  apiUrl: string;
  code: string;
  deviceName: string;
}

export interface BridgeRendererApi {
  getState(): Promise<BridgeState>;
  pair(req: PairRequest): Promise<{ ok: boolean; error?: string }>;
  unpair(): Promise<void>;
  selectFolder(): Promise<string | null>;
  setWatcher(active: boolean): Promise<void>;
  onStateChanged(cb: (state: BridgeState) => void): void;
  onLog(cb: (line: LogLine) => void): void;
}
