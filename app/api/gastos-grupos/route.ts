export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";
import { TABLES } from "@/lib/db-tables";

type GrupoDb = {
  id: string;
  group_id: string | null;
  fecha: string | null;
  submitted_at: string | null;
  assignee: string | null;
  job_title: string | null;
  region: string | null;
  reason: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number | string | null;
  status: string | null;
  expense_ids: string | null;
  pdf_url: string | null;
  signature: string | null;
  cost_center: string | null;
};

function dbToApi(r: GrupoDb): Record<string, string> {
  return {
    _rowIndex: r.id,
    ID_Grupo: r.group_id ?? "",
    FechaCreacion: r.submitted_at ?? r.fecha ?? "",
    Responsable: r.assignee ?? "",
    Cargo: r.job_title ?? "",
    Sector: r.region ?? "",
    Motivo: r.reason ?? "",
    FechaInicio: r.start_date ?? "",
    FechaFin: r.end_date ?? "",
    Total: r.amount != null ? String(r.amount) : "0",
    Estado: r.status ?? "",
    Gastos_IDs: r.expense_ids ?? "",
    PDF_URL: r.pdf_url ?? "",
    Firma: r.signature ?? "",
    CentroCostos: r.cost_center ?? "",
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const rol = String(session.user.rol || "").toLowerCase();
    if (rol !== "admin" && rol !== "coordinador") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { data, error } = await getSupabase()
      .from(TABLES.expenseGroups)
      .select(
        "id, group_id, fecha, submitted_at, assignee, job_title, region, reason, start_date, end_date, amount, status, expense_ids, pdf_url, signature, cost_center, created_at"
      )
      .order("created_at", { ascending: true });
    if (error) throw error;

    let rows = ((data ?? []) as GrupoDb[]).map(dbToApi);

    if (rol === "coordinador") {
      const me = String(session.user.responsable || "").trim().toLowerCase();
      rows = rows.filter((d) => String(d.Responsable || "").trim().toLowerCase() === me);
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json(
      { error: "Error obteniendo grupos", detalle: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await req.json()) as {
      responsable?: string;
      cargo?: string;
      sector?: string;
      motivo?: string;
      fechaInicio?: string;
      fechaFin?: string;
      centroCostos?: string;
      gastosIds?: string[];
      total?: string;
    };

    const id = `GG-${Date.now()}`;
    const sectorCanon =
      normalizeSector(String(body.sector ?? "")) ||
      normalizeSector(String(session.user.sector ?? "")) ||
      "Bogota";
    const totalNum = Number(String(body.total ?? "0").replace(/[^\d.-]/g, "")) || 0;

    const payload = {
      group_id: id,
      fecha: new Date().toISOString().slice(0, 10),
      submitted_at: new Date().toISOString(),
      assignee: body.responsable || null,
      job_title: body.cargo || null,
      region: sectorCanon,
      reason: body.motivo || null,
      start_date: body.fechaInicio || null,
      end_date: body.fechaFin || null,
      amount: totalNum,
      status: "Pendiente",
      expense_ids: JSON.stringify(body.gastosIds || []),
      cost_center: body.centroCostos || null,
    };

    const { error } = await getSupabase().from(TABLES.expenseGroups).insert(payload);
    if (error) throw error;

    return NextResponse.json({ id, ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("[gastos-grupos POST]", msg);
    return NextResponse.json(
      { error: "Error creando grupo", detalle: msg },
      { status: 500 }
    );
  }
}
