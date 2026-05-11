import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { applyFacturaEstadoById } from "@/lib/factura-estado-server";
import { findFacturaById } from "@/lib/facturas-supabase";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json(
      { error: "Solo el administrador puede reabrir facturas" },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    if (!ids.length) {
      return NextResponse.json({ error: "Faltan ids" }, { status: 400 });
    }

    const results = await Promise.all(
      ids.map(async (id) => {
        const row = await findFacturaById(id);
        if (!row) return { id, ok: false, reason: "not_found" as const };
        const estado = String(
          getCellCaseInsensitive(row, "Estado", "Legalizado", "Verificado") || ""
        ).toLowerCase();
        if (estado !== "completada") {
          return { id, ok: false, reason: "not_completada" as const, estado };
        }
        const r = await applyFacturaEstadoById(id, "Aprobada", "");
        return r.ok
          ? { id, ok: true as const }
          : { id, ok: false as const, reason: "update_failed" as const };
      })
    );

    const reabiertas = results.filter((r) => r.ok).length;
    const omitidas = results.filter((r) => !r.ok);
    return NextResponse.json({ ok: true, reabiertas, omitidas });
  } catch (e) {
    console.error("facturas/reabrir POST:", e);
    return NextResponse.json({ error: "Error al reabrir facturas" }, { status: 500 });
  }
}
