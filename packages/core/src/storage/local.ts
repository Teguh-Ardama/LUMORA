import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "../env";
import { hmacSign, hmacVerify } from "../crypto";
import type { PutObjectInput, StorageService } from "./types";

/**
 * A relative LOCAL_STORAGE_DIR must mean the same directory for every
 * process (web, worker, seed) regardless of its CWD inside the monorepo.
 * Anchor it at the workspace root (nearest ancestor with
 * pnpm-workspace.yaml); absolute paths are used as-is.
 */
import { fileURLToPath } from "node:url";

function resolveStorageRoot(configured: string): string {
  if (path.isAbsolute(configured)) return configured;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.resolve(dir, configured);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), configured);
}

/**
 * Local-disk driver for development and single-node self-hosting.
 * Objects live under LOCAL_STORAGE_DIR; "signed URLs" are HMAC-signed
 * links served by the web app's /api/storage/local/* route, so access
 * control semantics match the Supabase driver exactly.
 */
export class LocalStorageService implements StorageService {
  private readonly root: string;

  constructor() {
    this.root = resolveStorageRoot(getEnv().LOCAL_STORAGE_DIR);
  }

  private resolve(key: string): string {
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.resolve(this.root, safe);
    if (!full.startsWith(this.root)) throw new Error("Invalid storage key");
    return full;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const full = this.resolve(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
  }

  async getObject(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const env = getEnv();
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = hmacSign(`${key}:${exp}`, env.SIGNED_URL_SECRET);
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `/api/storage/local/${encodedKey}?exp=${exp}&sig=${sig}`;
  }
}

export function verifyLocalSignature(key: string, exp: number, sig: string): boolean {
  if (exp < Math.floor(Date.now() / 1000)) return false;
  return hmacVerify(`${key}:${exp}`, sig, getEnv().SIGNED_URL_SECRET);
}
