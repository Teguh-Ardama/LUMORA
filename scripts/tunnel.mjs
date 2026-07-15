#!/usr/bin/env node
/**
 * Opens a public Cloudflare quick tunnel to the local web app (localhost:3000)
 * and rewrites .env's APP_URL to it, so guest links sent over WhatsApp/email/QR
 * are reachable from phones outside this machine's network.
 *
 * Requires the dev server (`pnpm dev` / `pnpm dev:web`) to be restarted after
 * this script updates .env, since APP_URL is cached at process start. Once
 * restarted, use the printed URL (not localhost) to open the operator
 * dashboard too — the CSRF check rejects requests whose Origin doesn't match
 * APP_URL.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, ".env");
const localUrl = process.argv[2] ?? "http://localhost:3000";
const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function updateAppUrl(publicUrl) {
  let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (/^APP_URL=.*$/m.test(contents)) {
    contents = contents.replace(/^APP_URL=.*$/m, `APP_URL=${publicUrl}`);
  } else {
    contents += `${contents.endsWith("\n") || contents === "" ? "" : "\n"}APP_URL=${publicUrl}\n`;
  }
  writeFileSync(envPath, contents);
}

console.log(`Starting Cloudflare quick tunnel -> ${localUrl}`);

const child = spawn("npx", ["--yes", "cloudflared", "tunnel", "--url", localUrl], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});

let announced = false;

function handleChunk(chunk) {
  const text = chunk.toString();
  process.stderr.write(text);
  if (announced) return;
  const match = text.match(urlPattern);
  if (!match) return;
  announced = true;
  const publicUrl = match[0];
  updateAppUrl(publicUrl);
  console.log("\n============================================================");
  console.log(`Public URL:  ${publicUrl}`);
  console.log(`.env APP_URL updated.`);
  console.log("Restart the dev server, then use this URL (not localhost)");
  console.log("for both the operator dashboard and guest links.");
  console.log("============================================================\n");
}

child.stdout.on("data", handleChunk);
child.stderr.on("data", handleChunk);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
