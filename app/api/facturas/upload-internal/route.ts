import { NextRequest, NextResponse } from "next/server";
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
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (campo file)" }, { status: 400 });
    }

    const sector = String(formData.get("sector") || "").trim();
    if (!VALID_SECTORS.has(sector)) {
      return NextResponse.json(
        { error: 'sector debe ser "Bogota" o "Costa Caribe"' },
        { status: 400 }
      );
    }

    const responsable = String(formData.get("responsable") || "").trim();
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
    const storagePath = `facturas/${sector}/${yyyyMm}/${fileName}`;

    const { path, publicUrl } = await uploadToStorage(storagePath, buffer, mime);

    return NextResponse.json({
      fileId: path,
      url: publicUrl,
      fileName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al subir";
    console.error("facturas/upload-internal:", e);
    return NextResponse.json(
      { error: message || "Error al subir imagen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
