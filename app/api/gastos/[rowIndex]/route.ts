export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";

/** Mapeo de campos de UI (Sheet-style) → columnas Supabase. */
const FIELD_MAP: Record<string, string> = {
  Ciudad: "ciudad",
  Motivo: "motivo",
  FechaInicio: "fecha_inicio",
  FechaFin: "fecha_fin",
  Concepto: "concepto",
  CentroCostos: "centro_costos",
  NIT: "nit",
  FechaFactura: "fecha_factura",
  Valor: "monto",
  Estado: "estado",
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ rowIndex: string }> }
) {
  const { rowIndex } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const [uiField, dbCol] of Object.entries(FIELD_MAP)) {
    if (body[uiField] !== undefined) {
      const raw = body[uiField];
      if (dbCol === "monto") {
        const clean = String(raw ?? "").replace(/[^\d.-]/g, "");
        update.monto = clean ? Number(clean) : null;
      } else if (dbCol.startsWith("fecha")) {
        const v = String(raw ?? "").trim();
        update[dbCol] = v || null;
      } else {
        update[dbCol] = String(raw ?? "") || null;
      }
    }
  }

  try {
    const { error } = await getSupabase()
      .from("gastos_generales")
      .update(update)
      .eq("id", rowIndex);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos/:rowIndex PATCH]", e);
    return NextResponse.json({ error: "Error actualizando gasto" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ rowIndex: string }> }
) {
  const { rowIndex } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { error } = await getSupabase()
      .from("gastos_generales")
      .delete()
      .eq("id", rowIndex);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos/:rowIndex DELETE]", e);
    return NextResponse.json({ error: "Error eliminando gasto" }, { status: 500 });
  }
}
