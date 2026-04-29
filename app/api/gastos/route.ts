export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { normalizeSector, sectorsEquivalent } from "@/lib/sector-normalize";
import { TABLES } from "@/lib/db-tables";

type GastoGeneralDb = {
  id: string;
  expense_id: string | null;
  fecha: string | null;
  assignee: string | null;
  job_title: string | null;
  city: string | null;
  reason: string | null;
  start_date: string | null;
  end_date: string | null;
  concept: string | null;
  cost_center: string | null;
  nit: string | null;
  invoice_date: string | null;
  amount: number | string | null;
  status: string | null;
  region: string | null;
  submitted_at: string | null;
};

function dbToApi(r: GastoGeneralDb): Record<string, string> {
  return {
    _rowIndex: r.id,
    ID_Gasto: r.expense_id ?? "",
    FechaCreacion: r.submitted_at ?? r.fecha ?? "",
    Responsable: r.assignee ?? "",
    Cargo: r.job_title ?? "",
    Ciudad: r.city ?? "",
    Motivo: r.reason ?? "",
    FechaInicio: r.start_date ?? "",
    FechaFin: r.end_date ?? "",
    Concepto: r.concept ?? "",
    CentroCostos: r.cost_center ?? "",
    NIT: r.nit ?? "",
    FechaFactura: r.invoice_date ?? "",
    Valor: r.amount != null ? String(r.amount) : "",
    Estado: r.status ?? "",
    Sector: r.region ?? "",
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const { data, error } = await getSupabase()
      .from(TABLES.expenses)
      .select(
        "id, expense_id, fecha, assignee, job_title, city, reason, start_date, end_date, concept, cost_center, nit, invoice_date, amount, status, region, submitted_at, created_at"
      )
      .order("created_at", { ascending: true });
    if (error) throw error;

    let rows = ((data ?? []) as GastoGeneralDb[]).map(dbToApi);

    if (rol === "coordinador") {
      const sector = String(session.user.sector || "");
      const { getUsuariosFromSheet } = await import("@/lib/usuarios-sheet");
      const usuarios = await getUsuariosFromSheet();
      const responsablesZona = new Set(
        usuarios
          .filter((u) => sectorsEquivalent(u.sector, sector))
          .map((u) => u.responsable.toLowerCase().trim())
      );
      rows = rows.filter((d) =>
        responsablesZona.has((d.Responsable || "").toLowerCase().trim())
      );
    }

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error("[gastos GET]", e);
    return NextResponse.json({ error: "Error leyendo gastos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    responsable?: string;
    cargo?: string;
    ciudad?: string;
    motivo?: string;
    fechaInicio?: string;
    fechaFin?: string;
    concepto?: string;
    nit?: string;
    valor?: string | number;
    fechaFactura?: string;
    centroCostos?: string;
    sector?: string;
  };

  const responsable = String(body.responsable || session.user.responsable || session.user.name || "").trim();
  if (!responsable) return NextResponse.json({ error: "Falta responsable" }, { status: 400 });

  const sector =
    normalizeSector(String(body.sector || "")) ||
    normalizeSector(String(session.user.sector || "")) ||
    "Bogota";

  const montoNum = Number(String(body.valor ?? "0").replace(/[^\d.-]/g, "")) || 0;
  const id = `GAS-${Date.now()}`;

  try {
    const { data, error } = await getSupabase()
      .from(TABLES.expenses)
      .insert({
        expense_id: id,
        fecha: new Date().toISOString().slice(0, 10),
        submitted_at: new Date().toISOString(),
        assignee: responsable,
        job_title: body.cargo || null,
        city: body.ciudad || null,
        reason: body.motivo || null,
        start_date: body.fechaInicio || null,
        end_date: body.fechaFin || null,
        concept: body.concepto || null,
        nit: body.nit || null,
        invoice_date: body.fechaFactura || null,
        amount: montoNum,
        cost_center: body.centroCostos || null,
        region: sector,
        status: "Pendiente",
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data?.id ?? id, ok: true });
  } catch (e) {
    console.error("[gastos POST]", e);
    const msg = e instanceof Error ? e.message : "Error creando gasto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (String(session.user.rol || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Solo admin" }, { status: 403 });
  }

  const { rowIndex, estado } = (await req.json().catch(() => ({}))) as {
    rowIndex?: string;
    estado?: string;
  };
  if (!rowIndex || !estado) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  try {
    const { error } = await getSupabase()
      .from(TABLES.expenses)
      .update({ status: estado, updated_at: new Date().toISOString() })
      .eq("id", rowIndex);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos PATCH]", e);
    return NextResponse.json({ error: "Error actualizando estado" }, { status: 500 });
  }
}
