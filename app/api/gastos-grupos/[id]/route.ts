export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { TABLES } from "@/lib/db-tables";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.pdfUrl !== undefined) update.pdf_url = String(body.pdfUrl ?? "") || null;
    if (body.firma !== undefined) update.firma = String(body.firma ?? "") || null;
    if (body.estado !== undefined) update.estado = String(body.estado ?? "") || null;
    if (body.total !== undefined) {
      const n = Number(String(body.total ?? "").replace(/[^\d.-]/g, ""));
      update.monto = Number.isFinite(n) ? n : null;
    }
    if (body.gastosIds !== undefined) {
      update.gastos_ids = JSON.stringify(body.gastosIds || []);
    }
    if (body.motivo !== undefined) update.motivo = String(body.motivo ?? "") || null;

    const { data, error } = await getSupabase()
      .from(TABLES.expenseGroups)
      .update(update)
      .eq("id_gasto", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[gastos-grupos/:id PATCH]", error);
    return NextResponse.json({ error: "Error actualizando grupo" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data, error } = await getSupabase()
      .from(TABLES.expenseGroups)
      .delete()
      .eq("id_gasto", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[gastos-grupos/:id DELETE]", error);
    return NextResponse.json({ error: "Error eliminando grupo" }, { status: 500 });
  }
}
