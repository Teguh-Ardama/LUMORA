"use strict";

// src/main/preload.ts
var import_electron = require("electron");

// src/shared/ipc-contract.ts
var IpcChannel = {
  GET_STATE: "bridge:get-state",
  PAIR: "bridge:pair",
  UNPAIR: "bridge:unpair",
  SELECT_FOLDER: "bridge:select-folder",
  SELECT_OUTPUT_FOLDER: "bridge:select-output-folder",
  SET_WATCHER: "bridge:set-watcher",
  STATE_CHANGED: "bridge:state-changed",
  LOG: "bridge:log"
};

// src/main/preload.ts
var api = {
  getState: () => import_electron.ipcRenderer.invoke(IpcChannel.GET_STATE),
  pair: (req) => import_electron.ipcRenderer.invoke(IpcChannel.PAIR, req),
  unpair: () => import_electron.ipcRenderer.invoke(IpcChannel.UNPAIR),
  selectFolder: () => import_electron.ipcRenderer.invoke(IpcChannel.SELECT_FOLDER),
  selectOutputFolder: () => import_electron.ipcRenderer.invoke(IpcChannel.SELECT_OUTPUT_FOLDER),
  setWatcher: (active) => import_electron.ipcRenderer.invoke(IpcChannel.SET_WATCHER, active),
  onStateChanged: (cb) => {
    import_electron.ipcRenderer.on(IpcChannel.STATE_CHANGED, (_e, state) => cb(state));
  },
  onLog: (cb) => {
    import_electron.ipcRenderer.on(IpcChannel.LOG, (_e, line) => cb(line));
  }
};
import_electron.contextBridge.exposeInMainWorld("lumoraBridge", api);
