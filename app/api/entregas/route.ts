export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { parseSheetDate, todayISO } from "@/lib/format";
import { TABLES } from "@/lib/db-tables";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { uniqueSheetKey } from "@/lib/ids";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";

type EntregaDb = {
  id_entrega: string | null;
  fecha_entrega: string | null;
  id_envio: string | null;
  responsable: string | null;
  monto_entregado: number | string | null;
  saldo_total_entregado: number | string | null;
  aceptar: boolean | null;
  firma: string | null;
};

type EnvioDb = {
  id_envio: string | null;
  comprobante: string | null;
};

function entregaDbToApi(r: EntregaDb, comprobante: string): Record<string, string> {
  return {
    ID_Entrega: r.id_entrega ?? "",
    Fecha_Entrega: r.fecha_entrega ?? "",
    ID_Envio: r.id_envio ?? "",
    Responsable: r.responsable ?? "",
    Monto_Entregado: r.monto_entregado != null ? String(r.monto_entregado) : "",
    Saldo_Total_Entregado:
      r.saldo_total_entregado != null ? String(r.saldo_total_entregado) : "",
    Aceptar: r.aceptar === true ? "TRUE" : r.aceptar === false ? "FALSE" : "",
    Firma: r.firma ?? "",
    ComprobanteEnvio: comprobante,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const sb = getSupabase();
    const [entRes, envRes] = await Promise.all([
      sb
        .from(TABLES.deliveries)
        .select(
          "id_entrega, fecha_entrega, id_envio, responsable, monto_entregado, saldo_total_entregado, aceptar, firma, created_at"
        )
        .order("created_at", { ascending: true }),
      sb.from(TABLES.transfers).select("id_envio, comprobante"),
    ]);

    if (entRes.error) throw entRes.error;
    if (envRes.error) throw envRes.error;

    const comprobantesPorEnvio = new Map<string, string>();
    for (const e of (envRes.data ?? []) as EnvioDb[]) {
      if (e.id_envio) comprobantesPorEnvio.set(e.id_envio, e.comprobante ?? "");
    }

    let data = ((entRes.data ?? []) as EntregaDb[]).map((r) =>
      entregaDbToApi(r, comprobantesPorEnvio.get(r.id_envio ?? "") ?? "")
    );

    const rol = String(session.user.rol || "").toLowerCase();
    const { searchParams } = new URL(req.url);
    let responsableQ = searchParams.get("responsable")?.trim().toLowerCase() || "";
    if (rol === "user") {
      responsableQ = String(session.user.responsable || "").trim().toLowerCase();
      if (!responsableQ) return NextResponse.json({ data: [] });
    }

    const desde = parseSheetDate(searchParams.get("desde") || "");
    const hasta = parseSheetDate(searchParams.get("hasta") || "");
    const zonaSector = searchParams.get("zonaSector")?.trim() || "";

    let zonaSet: Set<string> | null = null;
    if (zonaSector && rol !== "user") {
      if (rol === "admin") {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else if (
        rol === "coordinador" &&
        sectorsEquivalent(String(session.user.sector || ""), zonaSector)
      ) {
        zonaSet = await responsablesEnZonaSheetSet(zonaSector);
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    data = data.filter((row) => {
      const responsable = row.Responsable;
      const fecha = parseSheetDate(row.Fecha_Entrega);
      if (zonaSet && !zonaSet.has(responsable.toLowerCase())) return false;
      if (responsableQ && responsable.toLowerCase() !== responsableQ) return false;
      if (desde && (!fecha || fecha < desde)) return false;
      if (hasta && (!fecha || fecha > hasta)) return false;
      return true;
    });

    data.reverse();
    return NextResponse.json({ data });
  } catch (e) {
    console.error("entregas GET:", e);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user")
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, string>;
    const idEntrega = String(body.ID_Entrega || body.ID || uniqueSheetKey("ENT")).trim();
    const fecha = String(body.Fecha_Entrega || body.Fecha || todayISO()).trim();
    const idEnvio = String(body.ID_Envio || "").trim();
    const responsable = String(body.Responsable || "").trim();
    const montoStr = String(body.Monto_Entregado || body.Monto || "0").replace(/[^\d]/g, "");
    const monto = Number(montoStr);

    if (!responsable || !monto) {
      return NextResponse.json(
        { error: "Responsable y monto son obligatorios" },
        { status: 400 }
      );
    }

    if (rol === "coordinador") {
      const limite = limiteAprobacionZona(String(session.user.sector || ""));
      if (monto > limite) {
        return NextResponse.json(
          {
            error: `El monto excede el límite de la zona (${limite.toLocaleString("es-CO")})`,
          },
          { status: 400 }
        );
      }
    }

    const saldoStr = String(body.Saldo_Total_Entregado || "").replace(/[^\d]/g, "");
    const aceptarRaw = String(body.Aceptar || "").trim().toUpperCase();
    const aceptar =
      aceptarRaw === "TRUE" || aceptarRaw === "SI" || aceptarRaw === "1"
        ? true
        : aceptarRaw === "FALSE" || aceptarRaw === "NO" || aceptarRaw === "0"
        ? false
        : null;

    const { error } = await getSupabase().from(TABLES.deliveries).insert({
      id_entrega: idEntrega,
      fecha_entrega: fecha,
      id_envio: idEnvio || null,
      responsable,
      monto_entregado: monto,
      saldo_total_entregado: saldoStr ? Number(saldoStr) : null,
      aceptar,
      firma: String(body.Firma || "").trim() || null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, id: idEntrega });
  } catch (e) {
    console.error("entregas POST:", e);
    return NextResponse.json(
      { ok: false, error: "No se pudo registrar" },
      { status: 500 }
    );
  }
}
