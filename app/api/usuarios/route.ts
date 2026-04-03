import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  loadUsuariosMerged,
  patchUsuarioUserActiveByEmail,
} from "@/lib/usuarios-data";
import { usuarioSheetEmail } from "@/lib/usuario-sheet-fields";
import {
  appendUsuarioMicaja,
  deleteUsuarioMicajaByEmail,
  patchUsuarioMicaja,
} from "@/lib/usuarios-micaja-crud";
import { invalidarCacheUsuarios } from "@/lib/usuarios-sheet";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const usuarios = await loadUsuariosMerged();
  return NextResponse.json({ data: usuarios });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const responsable = String(body.responsable || "").trim();
  const rol = String(body.rol || "user").toLowerCase();
  const sector = String(body.sector || "Bogota").trim();
  const area = String(body.area || "").trim();
  const cargo = String(body.cargo || "").trim();
  const cedula = String(body.cedula || "").trim();
  const telefono = String(body.telefono || "").trim();
  const pin = String(body.pin || "1234").trim();
  const userActive = body.userActive !== false && body.userActive !== "FALSE";

  if (!email || !responsable) {
    return NextResponse.json({ error: "Correo y nombre son obligatorios" }, { status: 400 });
  }

  try {
    const existing = await loadUsuariosMerged();
    const dup = existing.some((u) => usuarioSheetEmail(u as unknown as Record<string, unknown>) === email);
    if (dup) {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
    }

    const telegramChatId = String(body.telegramChatId || "").trim();

    await appendUsuarioMicaja({
      responsable,
      email,
      telefono,
      rol: rol === "admin" || rol === "coordinador" ? rol : "user",
      userActive,
      area,
      sector,
      cargo,
      cedula,
      pin,
      telegramChatId: telegramChatId || undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("usuarios POST:", e);
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!email) {
    return NextResponse.json({ error: "Falta email" }, { status: 400 });
  }

  const keys = Object.keys(body).filter((k) => k !== "email");
  const onlyActiveToggle =
    keys.length === 1 && keys[0] === "userActive" && typeof body.userActive === "boolean";

  try {
    if (onlyActiveToggle) {
      const updated = await patchUsuarioUserActiveByEmail(email, body.userActive as boolean);
      if (updated === 0) {
        return NextResponse.json({ error: "Usuario no encontrado en hojas Usuarios" }, { status: 404 });
      }
      invalidarCacheUsuarios();
      return NextResponse.json({ ok: true, updated });
    }

    const patch: Parameters<typeof patchUsuarioMicaja>[0] = { email };
    if (typeof body.userActive === "boolean") patch.userActive = body.userActive;
    if (body.responsable != null) patch.responsable = String(body.responsable).trim();
    if (body.correos != null) patch.correos = String(body.correos).trim().toLowerCase();
    if (body.telefono != null) patch.telefono = String(body.telefono).trim();
    if (body.rol != null) patch.rol = String(body.rol).trim();
    if (body.area != null) patch.area = String(body.area).trim();
    if (body.sector != null) patch.sector = String(body.sector).trim();
    if (body.cargo != null) patch.cargo = String(body.cargo).trim();
    if (body.cedula != null) patch.cedula = String(body.cedula).trim();
    if (body.pin != null) patch.pin = String(body.pin).trim();
    if (body.telegramChatId != null) patch.telegramChatId = String(body.telegramChatId).trim();

    const n = await patchUsuarioMicaja(patch);
    if (n === 0) {
      return NextResponse.json({ error: "Usuario no encontrado en MiCaja (Usuarios)" }, { status: 404 });
    }
    invalidarCacheUsuarios();
    return NextResponse.json({ ok: true, updated: n });
  } catch (e) {
    console.error("usuarios PATCH:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ error: "Falta email" }, { status: 400 });
  }

  try {
    const ok = await deleteUsuarioMicajaByEmail(email);
    if (!ok) {
      return NextResponse.json({ error: "Usuario no encontrado en MiCaja" }, { status: 404 });
    }
    invalidarCacheUsuarios();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("usuarios DELETE:", e);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }
}
