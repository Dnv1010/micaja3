import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { verifyInternalApiKey } from "@/lib/internal-api";
import { uploadToStorage } from "@/lib/storage-supabase";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heic"],
  ["application/pdf", "pdf"],
]);

const MAX_BYTES = 10 * 1024 * 1024;
const VALID_SECTORS = new Set(["Bogota", "Costa Caribe"]);

/** Detecta el tipo real por firma binaria; null si no se reconoce. */
function detectFileKind(buf: Buffer): "jpg" | "png" | "webp" | "pdf" | "heic" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d) return "pdf";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString("ascii").toLowerCase();
    if (
      brand.startsWith("heic") || brand.startsWith("heix") ||
      brand.startsWith("hevc") || brand.startsWith("hevx") ||
      brand.startsWith("mif1") || brand.startsWith("msf1") ||
      brand.startsWith("heim") || brand.startsWith("heis") ||
      brand.startsWith("hevm") || brand.startsWith("hevs")
    ) return "heic";
  }
  return null;
}

const EXT_TO_KIND: Record<string, "jpg" | "png" | "webp" | "pdf" | "heic"> = {
  jpg: "jpg",
  png: "png",
  webp: "webp",
  pdf: "pdf",
  heic: "heic",
};

function folderYearMonth(fecha: string | null): string {
  if (!fecha?.trim()) return new Date().toISOString().slice(0, 7);
  const t = fecha.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(0, 7);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req: NextRequest) {
  const isInternal = req.headers.get("x-telegram-internal") === "true";

  let session: Session | null = null;
  if (!isInternal) {
    session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const rol = String(session.user.rol || "user").toLowerCase();
    if (rol !== "user" && rol !== "coordinador" && rol !== "admin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
  } else if (!verifyInternalApiKey(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (campo file)" }, { status: 400 });
    }

    const destino = String(formData.get("destino") || "").trim();
    const isReportes = destino === "reportes";

    let sector = String(formData.get("sector") || "").trim();
    if (!isReportes && !VALID_SECTORS.has(sector)) {
      return NextResponse.json(
        { error: 'sector debe ser "Bogota" o "Costa Caribe"' },
        { status: 400 }
      );
    }

    const sessionSector = String(session?.user?.sector || "").trim();
    if (isReportes) {
      if (!session || String(session.user.rol || "").toLowerCase() !== "admin") {
        return NextResponse.json(
          { error: "Solo el administrador puede subir PDFs de reportes" },
          { status: 403 }
        );
      }
      sector = sessionSector && VALID_SECTORS.has(sessionSector) ? sessionSector : "Bogota";
    } else if (!isInternal && session) {
      const rol = String(session.user.rol || "user").toLowerCase();
      if (rol === "user" || rol === "coordinador") {
        if (sessionSector && sector !== sessionSector) {
          return NextResponse.json(
            { error: "El sector no coincide con su cuenta" },
            { status: 403 }
          );
        }
      }
    }

    const responsable = String(
      formData.get("responsable") ||
        session?.user?.responsable ||
        session?.user?.name ||
        ""
    ).trim();
    if (!responsable) {
      return NextResponse.json({ error: "Falta responsable" }, { status: 400 });
    }

    const fecha = String(formData.get("fecha") || "").trim();
    const mime = (file.type || "").toLowerCase();
    const ext = ALLOWED.get(mime);
    if (!ext) {
      return NextResponse.json(
        { error: "Tipo no permitido. Use JPG, PNG, WebP o PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo supera 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectFileKind(buffer);
    const expectedKind = EXT_TO_KIND[ext];
    if (!detected || detected !== expectedKind) {
      return NextResponse.json(
        { error: "El contenido del archivo no coincide con su tipo declarado." },
        { status: 400 }
      );
    }

    const yyyyMm = folderYearMonth(fecha || null);
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
      2,
      "0"
    )}${String(now.getSeconds()).padStart(2, "0")}`;
    const safeName = responsable.replace(/\s+/g, "_").slice(0, 120) || "usuario";
    const fileName = `${stamp}_${safeName}.${ext}`;

    const storagePath = isReportes
      ? `reportes/${sector}/${fileName}`
      : `facturas/${sector}/${yyyyMm}/${fileName}`;

    const { path, publicUrl } = await uploadToStorage(storagePath, buffer, mime);

    return NextResponse.json({
      // `fileId` se mantiene como nombre del campo para compat con callers (telegram webhook, etc.)
      fileId: path,
      url: publicUrl,
      fileName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al subir";
    console.error("facturas/upload:", e);
    return NextResponse.json(
      { error: message || "Error al subir imagen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
