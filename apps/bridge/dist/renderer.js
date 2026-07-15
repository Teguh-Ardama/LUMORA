"use strict";
(() => {
  // src/renderer/renderer.ts
  var api = window.lumoraBridge;
  var $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el;
  };
  var pairView = $("pair-view");
  var dashView = $("dash-view");
  var connPill = $("conn-pill");
  var eventPill = $("event-pill");
  var watcherActive = false;
  function render(state) {
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
    $("stat-session").textContent = state.activeSessionId ? state.activeSessionId.slice(0, 8) : "\u2014";
    $("folder-path").textContent = state.watchFolder ?? "No tether folder selected";
    $("version-hint").textContent = `LUMORA Bridge v${state.appVersion}`;
    const watchBtn = $("watch-btn");
    watchBtn.textContent = state.watcherActive ? "Stop watching" : "Start watching";
    watchBtn.disabled = !state.watchFolder;
  }
  function appendLog(line) {
    const logs = $("logs");
    const div = document.createElement("div");
    div.className = line.level;
    const time = line.ts.slice(11, 19);
    div.textContent = `${time}  ${line.message}`;
    logs.appendChild(div);
    while (logs.childElementCount > 400) logs.firstElementChild?.remove();
    logs.scrollTop = logs.scrollHeight;
  }
  $("pair-btn").addEventListener("click", async () => {
    const btn = $("pair-btn");
    const errorEl = $("pair-error");
    errorEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Pairing\u2026";
    try {
      const result = await api.pair({
        apiUrl: $("pair-api").value.trim(),
        code: $("pair-code").value.trim(),
        deviceName: $("pair-name").value.trim()
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
})();
