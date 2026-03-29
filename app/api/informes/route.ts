import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { drive, assertSheetsConfigured } from "@/lib/google-sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rol = (session.user.rol || "").toLowerCase();
  if (!["admin", "coordinador", "verificador"].includes(rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    assertSheetsConfigured();
    const folderId = process.env.GOOGLE_DRIVE_INFORMES_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json({ data: [], warning: "Sin carpeta de informes" });
    }

    const res = await drive!.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,createdTime,webViewLink)",
      orderBy: "createdTime desc",
      pageSize: 100,
    });

    const files =
      res.data.files?.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        createdTime: f.createdTime,
        webViewLink: f.webViewLink,
      })) ?? [];

    return NextResponse.json({ data: files });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
