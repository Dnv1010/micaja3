import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { filterEnvios } from "@/lib/roles";
import type { EnvioRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { todayISO } from "@/lib/format";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json({ data: [] });
  }

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [envRows, usuarios] = await Promise.all([
      getSheetData(key, SHEET_NAMES.ENVIO),
      loadUsuariosMerged(),
    ]);
    const envios = rowsToObjects<EnvioRow>(envRows);
    const filtered = filterEnvios(envios, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer envíos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo administrador" }, { status: 403 });
  }

  const key = spreadsheetKeyForSession(ctx);

  try {
    const body = (await req.json()) as Record<string, string>;
    const responsable = body.Responsable || "";
    const usuarios = await loadUsuariosMerged();
    const tel = usuarios.find((u) => u.Responsable === responsable)?.Telefono || "";

    const envSheet = await getSheetData(key, SHEET_NAMES.ENVIO);
    const envHeaders = envSheet[0];
    if (!envHeaders?.length) {
      return NextResponse.json({ error: "Hoja Envio sin encabezados" }, { status: 500 });
    }

    const idEnvio = body.IDEnvio || uniqueSheetKey("ENV");
    const envData: Record<string, string> = {
      ...body,
      IDEnvio: idEnvio,
      Fecha: body.Fecha || todayISO(),
      Monto: body.Monto || "0",
      Responsable: responsable,
      Comprobante: body.Comprobante || "",
      Telefono: tel,
    };
    const envLine = buildAppendRow(envHeaders, envData);
    await appendSheetRow(key, SHEET_NAMES.ENVIO, envLine);
    revalidateSheet(key, SHEET_NAMES.ENVIO);

    const entSheet = await getSheetData(key, SHEET_NAMES.ENTREGAS);
    const entHeaders = entSheet[0];
    if (entHeaders?.length) {
      const idEntrega = uniqueSheetKey("ENT");
      const entregaData: Record<string, string> = {
        ID_Entrega: idEntrega,
        Fecha_Entrega: envData.Fecha,
        ID_Envio: idEnvio,
        Responsable: responsable,
        Monto_Entregado: "",
        Saldo_Total_Entregado: "",
        Aceptar: "TRUE",
        Firma: "",
        Identificacion: "",
        Comprobante: "",
      };
      const entLine = buildAppendRow(entHeaders, entregaData);
      await appendSheetRow(key, SHEET_NAMES.ENTREGAS, entLine);
      revalidateSheet(key, SHEET_NAMES.ENTREGAS);
    }

    return NextResponse.json({ ok: true, id: idEnvio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar envío";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
