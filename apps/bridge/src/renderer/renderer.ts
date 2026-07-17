import type { BridgeRendererApi, BridgeState, LogLine } from "../shared/ipc-contract";

declare global {
  interface Window {
    lumoraBridge: BridgeRendererApi;
  }
}

const api = window.lumoraBridge;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const pairView = $("pair-view");
const dashView = $("dash-view");
const connPill = $("conn-pill");
const eventPill = $("event-pill");

let watcherActive = false;

function render(state: BridgeState): void {
  pairView.style.display = state.paired ? "none" : "block";
  dashView.style.display = state.paired ? "flex" : "none";

  connPill.textContent = state.online ? "connected" : "offline";
  connPill.className = `pill ${state.online ? "ok" : "bad"}`;

  if (state.eventName) {
    eventPill.style.display = "inline-block";
    eventPill.textContent = state.eventName;
  } else {
    eventPill.style.display = "none";
  }

  if (!state.paired) return;

  watcherActive = state.watcherActive;
  $("stat-watcher").textContent = state.watcherActive ? "watching" : "stopped";
  $("stat-queue").textContent = String(state.queueDepth);
  $("stat-uploaded").textContent = String(state.uploadedCount);
  $("stat-session").textContent = state.activeSessionId ? state.activeSessionId.slice(0, 8) : "—";
  $("folder-path").textContent = state.watchFolder ?? "No tether folder selected";
  $("version-hint").textContent = `LUMORA Bridge v${state.appVersion}`;

  const watchBtn = $<HTMLButtonElement>("watch-btn");
  watchBtn.textContent = state.watcherActive ? "Stop watching" : "Start watching";
  watchBtn.disabled = !state.watchFolder;
}

function appendLog(line: LogLine): void {
  const logs = $("logs");
  const div = document.createElement("div");
  div.className = line.level;
  const date = new Date(line.ts);
  const time = date.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  div.textContent = `${time}  ${line.message}`;
  logs.appendChild(div);
  while (logs.childElementCount > 400) logs.firstElementChild?.remove();
  logs.scrollTop = logs.scrollHeight;
}

// ── Wire events ────────────────────────────────────────────────────────────

$("pair-btn").addEventListener("click", async () => {
  const btn = $<HTMLButtonElement>("pair-btn");
  const errorEl = $("pair-error");
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Pairing…";
  try {
    const result = await api.pair({
      apiUrl: $<HTMLInputElement>("pair-api").value.trim(),
      code: $<HTMLInputElement>("pair-code").value.trim(),
      deviceName: $<HTMLInputElement>("pair-name").value.trim(),
    });
    if (!result.ok) errorEl.textContent = result.error ?? "Pairing failed";
  } finally {
    btn.disabled = false;
    btn.textContent = "Pair device";
    render(await api.getState());
  }
});

$("folder-btn").addEventListener("click", async () => {
  await api.selectFolder();
  render(await api.getState());
});

$("watch-btn").addEventListener("click", async () => {
  await api.setWatcher(!watcherActive);
  render(await api.getState());
});

$("unpair-btn").addEventListener("click", async () => {
  await api.unpair();
  render(await api.getState());
});

api.onStateChanged(render);
api.onLog(appendLog);

void api.getState().then(render);
