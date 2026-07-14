import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS, isProduction } from "@lumora/core";

export const ACCESS_COOKIE = "lumora_access";
export const REFRESH_COOKIE = "lumora_refresh";

const base = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
};

export function setAuthCookies(c: Context, accessToken: string, refreshToken: string): void {
  const secure = isProduction();
  setCookie(c, ACCESS_COOKIE, accessToken, { ...base, secure, maxAge: ACCESS_TOKEN_TTL_SECONDS });
  setCookie(c, REFRESH_COOKIE, refreshToken, { ...base, secure, maxAge: REFRESH_TOKEN_TTL_SECONDS });
}

export function clearAuthCookies(c: Context): void {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/" });
}

export function readAccessToken(c: Context): string | undefined {
  return getCookie(c, ACCESS_COOKIE);
}

export function readRefreshToken(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE);
}
