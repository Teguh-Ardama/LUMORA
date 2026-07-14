import type { BrowserWindow } from "electron";
import { IpcChannel, type LogLine } from "../shared/ipc-contract";

/** Ring-buffered logger mirrored to the renderer's log panel. */
const MAX_LINES = 500;
const buffer: LogLine[] = [];
let win: BrowserWindow | null = null;

export function attachLogWindow(window: BrowserWindow): void {
  win = window;
  // Replay history so a re-opened window sees recent activity.
  for (const line of buffer) window.webContents.send(IpcChannel.LOG, line);
}

function push(level: LogLine["level"], message: string): void {
  const line: LogLine = { ts: new Date().toISOString(), level, message };
  buffer.push(line);
  if (buffer.length > MAX_LINES) buffer.shift();
  const prefix = `[bridge:${level}]`;
  if (level === "error") console.error(prefix, message);
  else console.log(prefix, message);
  if (win && !win.isDestroyed()) win.webContents.send(IpcChannel.LOG, line);
}

export const blog = {
  info: (msg: string) => push("info", msg),
  warn: (msg: string) => push("warn", msg),
  error: (msg: string) => push("error", msg),
};
