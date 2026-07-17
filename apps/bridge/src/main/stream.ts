import { app } from "electron";
import { getConfigStore } from "./config-store";
import { blog } from "./logger";
import { downloadComposedPhoto } from "./downloader";

let abortController: AbortController | null = null;
let retryTimeout: NodeJS.Timeout | null = null;
let isConnected = false;

/**
 * Connects to the LUMORA SSE stream to listen for realtime events
 * (e.g., session.status == READY).
 */
export function startRealtimeStream() {
  if (abortController) return;

  const cfg = getConfigStore().get();
  const { apiUrl, deviceToken, eventId } = cfg;
  if (!apiUrl || !deviceToken || !eventId) return; // not paired

  abortController = new AbortController();
  const url = `${apiUrl}/api/bridge/stream`;

  blog.info("Connecting to realtime stream...");

  fetch(url, {
    headers: { Authorization: `Bearer ${deviceToken}` },
    signal: abortController.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Stream rejected with status ${res.status}`);
      }
      
      if (!isConnected) {
        isConnected = true;
        blog.info("Realtime stream connected");
      }

      if (!res.body) throw new Error("No body in response");

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE lines
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? ""; // keep incomplete chunk

        for (const block of lines) {
          let eventType = "message";
          let data = "";

          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
          }

          if (eventType === "session.status" && data) {
            try {
              const payload = JSON.parse(data);
              if (payload.status === "READY" && payload.composedUrl) {
                blog.info(`Session ${payload.sessionId.slice(0,8)} is READY. Downloading...`);
                // Download the photo asynchronously
                downloadComposedPhoto(payload.composedUrl, payload.sessionId)
                  .catch(err => blog.error(`Download failed: ${err.message}`));
              }
            } catch (err) {
              blog.warn("Failed to parse session.status event");
            }
          }
        }
      }
      throw new Error("Stream ended unexpectedly");
    })
    .catch((err) => {
      if (err.name === "AbortError") {
        blog.info("Realtime stream closed");
        return;
      }
      blog.warn(`Realtime stream error: ${err.message}. Retrying in 5s...`);
      isConnected = false;
      abortController = null;
      retryTimeout = setTimeout(() => startRealtimeStream(), 5000);
    });
}

export function stopRealtimeStream() {
  if (retryTimeout) clearTimeout(retryTimeout);
  retryTimeout = null;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isConnected = false;
}
