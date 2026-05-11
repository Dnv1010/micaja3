import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createSignedUploadUrlForPath, publicUrlForPath } from "@/lib/storage-supabase";

const VALID_SECTORS = new Set(["Bogota", "Costa Caribe"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json(
      { error: "Solo el administrador puede generar la URL de subida" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      sector?: unknown;
      responsable?: unknown;
    };
    let sector = String(body.sector ?? "").trim();
    const responsable = String(body.responsable ?? "").trim() || "admin";

    const sessionSector = String(session.user.sector || "").trim();
    if (!VALID_SECTORS.has(sector)) {
      sector = sessionSector && VALID_SECTORS.has(sessionSector) ? sessionSector : "Bogota";
    }

    const now = new Date();
    const stamp =
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(
        now.getMinutes()
      ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const safeName = responsable.replace(/\s+/g, "_").slice(0, 120) || "admin";
    const fileName = `${stamp}_${safeName}.pdf`;
    const path = `reportes/${sector}/${fileName}`;

    const { signedUrl, token } = await createSignedUploadUrlForPath(path);
    const publicUrl = publicUrlForPath(path);

    return NextResponse.json({ signedUrl, token, path, publicUrl, fileName });
  } catch (e) {
    console.error("upload-reporte-url POST:", e);
    return NextResponse.json(
      { error: "Error generando URL de subida" },
      { status: 500 }
    );
  }
}
