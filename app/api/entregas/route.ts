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
  delivery_id: string | null;
  delivery_date: string | null;
  transfer_id: string | null;
  assignee: string | null;
  delivered_amount: number | string | null;
  cumulative_delivered: number | string | null;
  confirmed: boolean | null;
  signature: string | null;
};

type EnvioDb = {
  transfer_id: string | null;
  voucher_number: string | null;
};

function entregaDbToApi(r: EntregaDb, comprobante: string): Record<string, string> {
  return {
    ID_Entrega: r.delivery_id ?? "",
    Fecha_Entrega: r.delivery_date ?? "",
    ID_Envio: r.transfer_id ?? "",
    Responsable: r.assignee ?? "",
    Monto_Entregado: r.delivered_amount != null ? String(r.delivered_amount) : "",
    Saldo_Total_Entregado:
      r.cumulative_delivered != null ? String(r.cumulative_delivered) : "",
    Aceptar: r.confirmed === true ? "TRUE" : r.confirmed === false ? "FALSE" : "",
    Firma: r.signature ?? "",
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
          "delivery_id, delivery_date, transfer_id, assignee, delivered_amount, cumulative_delivered, confirmed, signature, created_at"
        )
        .order("created_at", { ascending: true }),
      sb.from(TABLES.transfers).select("transfer_id, voucher_number"),
    ]);

    if (entRes.error) throw entRes.error;
    if (envRes.error) throw envRes.error;

    const comprobantesPorEnvio = new Map<string, string>();
    for (const e of (envRes.data ?? []) as EnvioDb[]) {
      if (e.transfer_id) comprobantesPorEnvio.set(e.transfer_id, e.voucher_number ?? "");
    }

    let data = ((entRes.data ?? []) as EntregaDb[]).map((r) =>
      entregaDbToApi(r, comprobantesPorEnvio.get(r.transfer_id ?? "") ?? "")
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
    const confirmed =
      aceptarRaw === "TRUE" || aceptarRaw === "SI" || aceptarRaw === "1"
        ? true
        : aceptarRaw === "FALSE" || aceptarRaw === "NO" || aceptarRaw === "0"
        ? false
        : null;

    const { error } = await getSupabase().from(TABLES.deliveries).insert({
      delivery_id: idEntrega,
      delivery_date: fecha,
      transfer_id: idEnvio || null,
      assignee: responsable,
      delivered_amount: monto,
      cumulative_delivered: saldoStr ? Number(saldoStr) : null,
      confirmed,
      signature: String(body.Firma || "").trim() || null,
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
