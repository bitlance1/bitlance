import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "file";

  if (!url) return new Response("No URL", { status: 400 });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.redirect(url);
    }

    const data = await response.arrayBuffer();
    const asciiName = name.replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "");
    const encodedName = encodeURIComponent(name).replace(/['()]/g, escape);
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${asciiName || "file"}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": data.byteLength.toString(),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[Download Proxy] Error:", error);
    return NextResponse.redirect(url);
  }
}
