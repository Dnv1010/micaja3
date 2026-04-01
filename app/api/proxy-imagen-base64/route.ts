import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Falta url" }, { status: 400 });

  if (!url.includes("drive.google.com") && !url.includes("googleusercontent.com")) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 403 });
  }

  try {
    const fetchUrl = url.includes("uc?id=") ? url.replace("uc?id=", "uc?export=download&id=") : url;
    const res = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return NextResponse.json({ error: "No se pudo cargar" }, { status: 404 });

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ base64, contentType, dataUrl });
  } catch {
    return NextResponse.json({ error: "Error al cargar" }, { status: 500 });
  }
}
