import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { getConfigStore } from "./config-store";
import { blog } from "./logger";
import { app } from "electron";
import { broadcastState } from "./index";

let downloadedCount = 0;
export function getDownloadedCount() {
  return downloadedCount;
}

export async function downloadComposedPhoto(url: string, sessionId: string): Promise<void> {
  const { outputFolder } = getConfigStore().get();
  if (!outputFolder) {
    blog.warn(`Output folder not set. Skipping download for session ${sessionId.slice(0, 8)}`);
    return;
  }

  // Ensure output folder exists
  try {
    await fs.mkdir(outputFolder, { recursive: true });
  } catch (err) {
    throw new Error(`Cannot access output folder: ${outputFolder}`);
  }

  const fileName = `LUMORA_${sessionId.slice(0, 8)}.jpg`;
  const destPath = path.join(outputFolder, fileName);

  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch photo, status code: ${res.statusCode}`));
      }

      const fileStream = require("node:fs").createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        downloadedCount++;
        blog.info(`Downloaded masterpiece: ${fileName}`);
        broadcastState();
        resolve();
      });

      fileStream.on("error", (err: Error) => {
        require("node:fs").unlink(destPath, () => {}); // delete partial file
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}
