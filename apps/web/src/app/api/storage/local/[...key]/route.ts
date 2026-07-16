import { NextRequest } from "next/server";
import { getStorage, verifyLocalSignature, getEnv } from "@lumora/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serves objects for the LOCAL storage driver only, gated by the HMAC
 * signature embedded in the signed URL. Mirrors Supabase signed URL
 * semantics for development / single-node deployments.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    if (getEnv().STORAGE_DRIVER !== "local") {
      return new Response("Not found", { status: 404 });
    }
    const { key: segments } = await params;
    const key = segments.map(decodeURIComponent).join("/");
    const exp = Number(req.nextUrl.searchParams.get("exp") ?? 0);
    const sig = req.nextUrl.searchParams.get("sig") ?? "";

    if (!exp || !sig || !verifyLocalSignature(key, exp, sig)) {
      return new Response("Link expired or invalid", { status: 403 });
    }

    const body = await getStorage().getObject(key);
    const hasExtension = key.includes(".");
    const ext = hasExtension ? key.split(".").pop()?.toLowerCase() ?? "" : "";
    let mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      if (key.startsWith("stickers/")) mimeType = "image/png";
      else mimeType = "application/octet-stream";
    }

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(body.length),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (err: any) {
    return new Response(err.message || "Unknown error", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
