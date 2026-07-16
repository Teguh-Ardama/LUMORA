import { getEnv } from "../env";
import { LocalStorageService, verifyLocalSignature } from "./local";
import { SupabaseStorageService } from "./supabase";
import type { StorageService } from "./types";

let instance: StorageService | null = null;

export function getStorage(): StorageService {
  if (!instance) {
    instance =
      getEnv().STORAGE_DRIVER === "supabase"
        ? new SupabaseStorageService()
        : new LocalStorageService();
  }
  return instance;
}

export { verifyLocalSignature };
export * from "./types";
