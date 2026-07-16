import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../env";
import type { PutObjectInput, StorageService } from "./types";

/** Supabase Storage driver — private bucket, service-role key, signed URLs. */
export class SupabaseStorageService implements StorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    this.bucket = env.SUPABASE_STORAGE_BUCKET;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(input.key, input.body, {
      contentType: input.contentType,
      cacheControl: input.cacheControl ?? "3600",
      upsert: true,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  }

  async getObject(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error(`Supabase download failed: ${error?.message ?? "no data"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);
    if (error || !data) throw new Error(`Supabase signed URL failed: ${error?.message ?? "no data"}`);
    return data.signedUrl;
  }
}
