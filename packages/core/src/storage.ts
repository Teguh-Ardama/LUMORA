import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
import { createLogger } from "./logger";

const log = createLogger("storage");

export interface StorageDriver {
  putObject(args: { key: string; body: Buffer; contentType?: string }): Promise<void>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(getEnv().LOCAL_STORAGE_DIR);
  }

  private getPath(key: string): string {
    // Prevent directory traversal attacks
    const safeKey = key.replace(/\.\./g, "");
    return path.join(this.baseDir, safeKey);
  }

  async putObject({ key, body }: { key: string; body: Buffer }): Promise<void> {
    const fullPath = this.getPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
    log.debug("putObject (local)", { key });
  }

  async getSignedUrl(key: string, _ttlSeconds: number): Promise<string> {
    // For local dev, return a route served by the Next.js API handler
    return `/api/gallery/files?key=${encodeURIComponent(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    const fullPath = this.getPath(key);
    await fs.rm(fullPath, { force: true });
    log.debug("deleteObject (local)", { key });
  }
}

class SupabaseStorageDriver implements StorageDriver {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const env = getEnv();
    this.client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
    this.bucket = env.SUPABASE_STORAGE_BUCKET;
  }

  async putObject({ key, body, contentType }: { key: string; body: Buffer; contentType?: string }): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, body, {
        contentType,
        upsert: true,
      });

    if (error) {
      log.error("Supabase upload error", { error, key });
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, ttlSeconds);

    if (error) {
      log.error("Supabase signed URL error", { error, key });
      throw new Error(`Storage signed URL failed: ${error.message}`);
    }

    return data.signedUrl;
  }

  async deleteObject(key: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      log.error("Supabase delete error", { error, key });
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }
}

let driverInstance: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driverInstance) return driverInstance;

  const driver = getEnv().STORAGE_DRIVER;
  if (driver === "supabase") {
    driverInstance = new SupabaseStorageDriver();
  } else {
    driverInstance = new LocalStorageDriver();
  }

  return driverInstance;
}

export const storageKeys = {
  border(scope: "global" | string, borderId: string) {
    return `borders/${scope}/${borderId}.png`;
  },
  sticker(scope: "global" | string, stickerId: string) {
    return `stickers/${scope}/${stickerId}.png`;
  },
  rawPhoto(orgId: string, eventId: string, photoId: string) {
    return `raw-photos/${orgId}/${eventId}/${photoId}.jpg`;
  },
  composed(orgId: string, eventId: string, sessionId: string) {
    return `composed/${orgId}/${eventId}/${sessionId}.jpg`;
  },
};
