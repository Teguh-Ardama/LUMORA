import { contextBridge, ipcRenderer } from "electron";
import {
  IpcChannel,
  type BridgeRendererApi,
  type BridgeState,
  type LogLine,
  type PairRequest,
} from "../shared/ipc-contract";

const api: BridgeRendererApi = {
  getState: () => ipcRenderer.invoke(IpcChannel.GET_STATE) as Promise<BridgeState>,
  pair: (req: PairRequest) => ipcRenderer.invoke(IpcChannel.PAIR, req) as Promise<{ ok: boolean; error?: string }>,
  unpair: () => ipcRenderer.invoke(IpcChannel.UNPAIR) as Promise<void>,
  selectFolder: () => ipcRenderer.invoke(IpcChannel.SELECT_FOLDER) as Promise<string | null>,
  selectOutputFolder: () => ipcRenderer.invoke(IpcChannel.SELECT_OUTPUT_FOLDER) as Promise<string | null>,
  setWatcher: (active: boolean) => ipcRenderer.invoke(IpcChannel.SET_WATCHER, active) as Promise<void>,
  onStateChanged: (cb: (state: BridgeState) => void) => {
    ipcRenderer.on(IpcChannel.STATE_CHANGED, (_e, state: BridgeState) => cb(state));
  },
  onLog: (cb: (line: LogLine) => void) => {
    ipcRenderer.on(IpcChannel.LOG, (_e, line: LogLine) => cb(line));
  },
};

contextBridge.exposeInMainWorld("lumoraBridge", api);
