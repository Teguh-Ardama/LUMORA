import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@lumora/core";

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await getStorage().putObject({
      key,
      body: buffer,
      contentType: req.headers.get("content-type") || "application/octet-stream",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
