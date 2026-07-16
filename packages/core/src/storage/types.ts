export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface StorageService {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  /** Time-limited, signed, publicly fetchable URL for a private object. */
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/** Canonical storage key layout — the only place paths are built. */
export const storageKeys = {
  rawPhoto: (orgId: string, eventId: string, photoId: string, ext = "jpg") =>
    `orgs/${orgId}/events/${eventId}/raw/${photoId}.${ext}`,
  composed: (orgId: string, eventId: string, sessionId: string) =>
    `orgs/${orgId}/events/${eventId}/composed/${sessionId}.jpg`,
  border: (scope: "global" | string, borderId: string) =>
    scope === "global" ? `global/borders/${borderId}.png` : `orgs/${scope}/borders/${borderId}.png`,
  sticker: (scope: "global" | string, stickerId: string) =>
    scope === "global" ? `global/stickers/${stickerId}.png` : `orgs/${scope}/stickers/${stickerId}.png`,
};
