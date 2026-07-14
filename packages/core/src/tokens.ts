import { SignJWT, jwtVerify } from "jose";
import type { AccessTokenClaims, BridgeTokenClaims } from "@lumora/contracts";
import { getEnv } from "./env";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 3600;
export const BRIDGE_TOKEN_TTL_SECONDS = 14 * 24 * 3600;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_JWT_SECRET);
}

export async function signAccessToken(claims: Omit<AccessTokenClaims, "type">): Promise<string> {
  return new SignJWT({ ...claims, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("lumora")
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "lumora" });
    if (payload.type !== "access") return null;
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

export async function signBridgeToken(claims: Omit<BridgeTokenClaims, "type">): Promise<string> {
  return new SignJWT({ ...claims, type: "bridge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("lumora")
    .setExpirationTime(`${BRIDGE_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyBridgeToken(token: string): Promise<BridgeTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: "lumora" });
    if (payload.type !== "bridge") return null;
    return payload as unknown as BridgeTokenClaims;
  } catch {
    return null;
  }
}
