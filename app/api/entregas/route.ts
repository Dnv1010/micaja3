export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";
import { parseSheetDate } from "@/lib/format";
import { TABLES } from "@/lib/db-tables";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";

type TransferDb = {
  transfer_id: string | null;
  fecha: string | null;
  assignee: string | null;
  amount: number | string | null;
  region: string | null;
  voucher_number: string | null;
  observacion: string | null;
};

function transferToEntregaApi(r: TransferDb): Record<string, string> {
  return {
    ID_Entrega: r.transfer_id ?? "",
    Fecha_Entrega: r.fecha ?? "",
    ID_Envio: r.transfer_id ?? "",
    Responsable: r.assignee ?? "",
    Monto_Entregado: r.amount != null ? String(r.amount) : "",
    Saldo_Total_Entregado: "",
    Aceptar: "",
    Firma: "",
    ComprobanteEnvio: r.voucher_number ?? "",
    Observacion: r.observacion ?? "",
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const sb = getSupabase();
    const { data: rows, error } = await sb
      .from(TABLES.transfers)
      .select("transfer_id, fecha, assignee, amount, region, voucher_number, observacion, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    let data = ((rows ?? []) as TransferDb[]).map(transferToEntregaApi);

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
