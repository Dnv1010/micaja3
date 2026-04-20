import { NextRequest, NextResponse } from "next/server";

/** Hosts permitidos para proxy de imágenes. */
function isAllowedUrl(u: string): boolean {
  try {
    const { hostname } = new URL(u);
    return (
      hostname === "drive.google.com" ||
      hostname.endsWith(".googleusercontent.com") ||
      hostname.endsWith(".supabase.co") ||
      hostname.endsWith(".supabase.in")
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Falta url", { status: 400 });

  if (!isAllowedUrl(url)) {
    return new NextResponse("URL no permitida", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return new NextResponse("No se pudo cargar", { status: res.status });

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Error al cargar imagen", { status: 500 });
  }
}
