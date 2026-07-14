import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { customAlphabet } from "nanoid";

/** Opaque secret token (delivery tokens, refresh tokens, invites). */
export function generateSecretToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Tokens are stored hashed — a DB leak must not leak live links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const pairingAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

/** Human-typable bridge pairing code (no ambiguous chars). */
export function generatePairingCode(): string {
  return pairingAlphabet();
}

export function hmacSign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function hmacVerify(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSign(payload, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
