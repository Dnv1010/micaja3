export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { TABLES } from "@/lib/db-tables";

/** Mapeo de campos de UI (Sheet-style) → columnas Supabase. */
const FIELD_MAP: Record<string, string> = {
  Ciudad: "city",
  Motivo: "reason",
  FechaInicio: "start_date",
  FechaFin: "end_date",
  Concepto: "concept",
  CentroCostos: "cost_center",
  NIT: "nit",
  FechaFactura: "invoice_date",
  Valor: "amount",
  Estado: "status",
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
      if (dbCol === "amount") {
        const clean = String(raw ?? "").replace(/[^\d.-]/g, "");
        update.amount = clean ? Number(clean) : null;
      } else if (dbCol.endsWith("_date") || dbCol === "start_date" || dbCol === "end_date") {
        const v = String(raw ?? "").trim();
        update[dbCol] = v || null;
      } else {
        update[dbCol] = String(raw ?? "") || null;
      }
    }
  }

  try {
    const { error } = await getSupabase()
      .from(TABLES.expenses)
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
      .from(TABLES.expenses)
      .delete()
      .eq("id", rowIndex);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos/:rowIndex DELETE]", e);
    return NextResponse.json({ error: "Error eliminando gasto" }, { status: 500 });
  }
}
