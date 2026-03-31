import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { drive, assertSheetsConfigured } from "@/lib/google-sheets";
import { getDriveFacturasRootFolderId } from "@/lib/drive-env";
import { resolveFacturaUploadFolder } from "@/lib/drive-folders";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["application/pdf", "pdf"],
]);

const MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 30_000;

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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout al subir a Drive (30s)")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "user" && rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    assertSheetsConfigured();
  } catch {
    return NextResponse.json(
      { error: "Servicio de almacenamiento no disponible. Contacta al administrador." },
      { status: 503 }
    );
  }

  console.log("[upload] ENV CHECK:", {
    hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasKey: !!process.env.GOOGLE_PRIVATE_KEY,
    keyLength: process.env.GOOGLE_PRIVATE_KEY?.length,
    keyHasRealNewlines: process.env.GOOGLE_PRIVATE_KEY?.includes("\n"),
  });

  try {
    const rootFolderId = getDriveFacturasRootFolderId();
    if (!rootFolderId) {
      return NextResponse.json(
        { error: "Falta GOOGLE_DRIVE_FOLDER_ID (o GOOGLE_DRIVE_FACTURAS_FOLDER_ID)" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo (campo file)" }, { status: 400 });
    }

    const sector = String(formData.get("sector") || "").trim();
    if (!VALID_SECTORS.has(sector)) {
      return NextResponse.json({ error: 'sector debe ser "Bogota" o "Costa Caribe"' }, { status: 400 });
    }

    const sessionSector = String(session.user.sector || "").trim();
    if (rol === "user" || rol === "coordinador") {
      if (sessionSector && sector !== sessionSector) {
        return NextResponse.json({ error: "El sector no coincide con su cuenta" }, { status: 403 });
      }
    }

    const responsable = String(
      formData.get("responsable") || session.user.responsable || session.user.name || ""
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
    const yyyyMm = folderYearMonth(fecha || null);
    const parentId = await resolveFacturaUploadFolder(drive!, rootFolderId, sector, yyyyMm);

    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const stamp = `${y}${mo}${d}_${hh}${mm}${ss}`;
    const safeName = responsable.replace(/\s+/g, "_").slice(0, 120) || "usuario";
    const driveFileName = `${stamp}_${safeName}.${ext}`;

    const uploadOp = (async () => {
      const driveResponse = await drive!.files.create({
        requestBody: {
          name: driveFileName,
          parents: [parentId],
        },
        media: {
          mimeType: mime || "application/octet-stream",
          body: Readable.from(buffer),
        },
        fields: "id",
      });

      const fileId = driveResponse.data.id;
      if (!fileId) throw new Error("Drive no devolvió id de archivo");

      await drive!.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });

      return { fileId, driveFileName };
    })();

    const { fileId, driveFileName: finalName } = await withTimeout(uploadOp, UPLOAD_TIMEOUT_MS);

    const isPdf = mime === "application/pdf";
    const url = isPdf
      ? `https://drive.google.com/file/d/${fileId}/view`
      : `https://drive.google.com/uc?id=${fileId}`;

    return NextResponse.json({
      fileId,
      url,
      fileName: finalName,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al subir";
    console.error("facturas/upload:", e);
    return NextResponse.json(
      { error: message.includes("Timeout") ? message : "Error al subir imagen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
