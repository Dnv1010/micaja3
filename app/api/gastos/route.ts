export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { normalizeSector, sectorsEquivalent } from "@/lib/sector-normalize";

type GastoGeneralDb = {
  id: string;
  id_gasto: string | null;
  fecha: string | null;
  responsable: string | null;
  cargo: string | null;
  ciudad: string | null;
  motivo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  concepto: string | null;
  centro_costos: string | null;
  nit: string | null;
  fecha_factura: string | null;
  monto: number | string | null;
  estado: string | null;
  sector: string | null;
  fecha_creacion: string | null;
};

function dbToApi(r: GastoGeneralDb): Record<string, string> {
  return {
    _rowIndex: r.id,
    ID_Gasto: r.id_gasto ?? "",
    FechaCreacion: r.fecha_creacion ?? r.fecha ?? "",
    Responsable: r.responsable ?? "",
    Cargo: r.cargo ?? "",
    Ciudad: r.ciudad ?? "",
    Motivo: r.motivo ?? "",
    FechaInicio: r.fecha_inicio ?? "",
    FechaFin: r.fecha_fin ?? "",
    Concepto: r.concepto ?? "",
    CentroCostos: r.centro_costos ?? "",
    NIT: r.nit ?? "",
    FechaFactura: r.fecha_factura ?? "",
    Valor: r.monto != null ? String(r.monto) : "",
    Estado: r.estado ?? "",
    Sector: r.sector ?? "",
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
      .from("gastos_generales")
      .select(
        "id, id_gasto, fecha, responsable, cargo, ciudad, motivo, fecha_inicio, fecha_fin, concepto, centro_costos, nit, fecha_factura, monto, estado, sector, fecha_creacion, created_at"
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
      .from("gastos_generales")
      .insert({
        id_gasto: id,
        fecha: new Date().toISOString().slice(0, 10),
        fecha_creacion: new Date().toISOString(),
        responsable,
        cargo: body.cargo || null,
        ciudad: body.ciudad || null,
        motivo: body.motivo || null,
        fecha_inicio: body.fechaInicio || null,
        fecha_fin: body.fechaFin || null,
        concepto: body.concepto || null,
        nit: body.nit || null,
        fecha_factura: body.fechaFactura || null,
        monto: montoNum,
        centro_costos: body.centroCostos || null,
        sector,
        estado: "Pendiente",
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
      .from("gastos_generales")
      .update({ estado, updated_at: new Date().toISOString() })
      .eq("id", rowIndex);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[gastos PATCH]", e);
    return NextResponse.json({ error: "Error actualizando estado" }, { status: 500 });
  }
}
