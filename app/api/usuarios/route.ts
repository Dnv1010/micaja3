import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { loadUsuariosMerged, patchUsuarioUserActiveByEmail } from "@/lib/usuarios-data";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const usuarios = await loadUsuariosMerged();
  return NextResponse.json({ data: usuarios });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  let body: { email?: string; userActive?: boolean };
  try {
    body = (await req.json()) as { email?: string; userActive?: boolean };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!email || typeof body.userActive !== "boolean") {
    return NextResponse.json({ error: "Faltan email o userActive" }, { status: 400 });
  }

  try {
    const updated = await patchUsuarioUserActiveByEmail(email, body.userActive);
    if (updated === 0) {
      return NextResponse.json({ error: "Usuario no encontrado en hojas Usuarios" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error("usuarios PATCH:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
