export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { normalizeSector } from "@/lib/sector-normalize";

type GrupoDb = {
  id: string;
  id_gasto: string | null;
  fecha: string | null;
  fecha_creacion: string | null;
  responsable: string | null;
  cargo: string | null;
  sector: string | null;
  motivo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  monto: number | string | null;
  estado: string | null;
  gastos_ids: string | null;
  pdf_url: string | null;
  firma: string | null;
  centro_costos: string | null;
};

function dbToApi(r: GrupoDb): Record<string, string> {
  return {
    _rowIndex: r.id,
    ID_Grupo: r.id_gasto ?? "",
    FechaCreacion: r.fecha_creacion ?? r.fecha ?? "",
    Responsable: r.responsable ?? "",
    Cargo: r.cargo ?? "",
    Sector: r.sector ?? "",
    Motivo: r.motivo ?? "",
    FechaInicio: r.fecha_inicio ?? "",
    FechaFin: r.fecha_fin ?? "",
    Total: r.monto != null ? String(r.monto) : "0",
    Estado: r.estado ?? "",
    Gastos_IDs: r.gastos_ids ?? "",
    PDF_URL: r.pdf_url ?? "",
    Firma: r.firma ?? "",
    CentroCostos: r.centro_costos ?? "",
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
      .from("gastos_grupos")
      .select(
        "id, id_gasto, fecha, fecha_creacion, responsable, cargo, sector, motivo, fecha_inicio, fecha_fin, monto, estado, gastos_ids, pdf_url, firma, centro_costos, created_at"
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
      id_gasto: id,
      fecha: new Date().toISOString().slice(0, 10),
      fecha_creacion: new Date().toISOString(),
      responsable: body.responsable || null,
      cargo: body.cargo || null,
      sector: sectorCanon,
      motivo: body.motivo || null,
      fecha_inicio: body.fechaInicio || null,
      fecha_fin: body.fechaFin || null,
      monto: totalNum,
      estado: "Pendiente",
      gastos_ids: JSON.stringify(body.gastosIds || []),
      centro_costos: body.centroCostos || null,
    };

    const { error } = await getSupabase().from("gastos_grupos").insert(payload);
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
