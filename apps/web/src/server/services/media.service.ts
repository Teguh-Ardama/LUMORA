import { getStorage } from "@lumora/core";
import type { Border, Photo, Session, Sticker } from "@lumora/db";

const SIGNED_URL_TTL = 3600; // 1 hour — plenty for dashboard/operator screens

/** Central place that turns storage keys into signed URLs. */
export const mediaService = {
  photoUrl(photo: Pick<Photo, "storageKey">): Promise<string> {
    return getStorage().getSignedUrl(photo.storageKey, SIGNED_URL_TTL);
  },

  async composedUrl(session: Pick<Session, "composedKey">): Promise<string | null> {
    if (!session.composedKey) return null;
    return getStorage().getSignedUrl(session.composedKey, SIGNED_URL_TTL);
  },

  borderUrl(border: Pick<Border, "storageKey">): Promise<string> {
    return getStorage().getSignedUrl(border.storageKey, SIGNED_URL_TTL);
  },

  stickerUrl(sticker: Pick<Sticker, "storageKey">): Promise<string> {
    return getStorage().getSignedUrl(sticker.storageKey, SIGNED_URL_TTL);
  },

  /** Longer-lived URL used inside guest gallery pages / emails. */
  guestUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    return getStorage().getSignedUrl(storageKey, ttlSeconds);
  },
};
