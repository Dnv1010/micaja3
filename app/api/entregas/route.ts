import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { appendSheetRow, getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { coordinadorAssignableUsers, filterEntregasWithUsuarios } from "@/lib/roles";
import type { EntregaRow } from "@/types/models";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";
import { todayISO } from "@/lib/format";
import { revalidateSheet } from "@/lib/revalidate-sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [entRows, usuarios] = await Promise.all([
      getSheetData(key, SHEET_NAMES.ENTREGAS),
      loadUsuariosMerged(),
    ]);
    const entregas = rowsToObjects<EntregaRow>(entRows);
    const filtered = filterEntregasWithUsuarios(entregas, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer entregas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const key = spreadsheetKeyForSession(ctx);

  try {
    const body = (await req.json()) as {
      Responsable: string;
      Fecha?: string;
      Monto: string;
      Observaciones?: string;
    };
    if (!body.Responsable?.trim() || !body.Monto?.trim()) {
      return NextResponse.json({ error: "Responsable y Monto son obligatorios" }, { status: 400 });
    }

    if (rol === "coordinador") {
      const usuarios = await loadUsuariosMerged();
      const ok = coordinadorAssignableUsers(usuarios, ctx).some(
        (u) => u.Responsable === body.Responsable
      );
      if (!ok) return NextResponse.json({ error: "Responsable no permitido para su zona" }, { status: 400 });
    }

    const rows = await getSheetData(key, SHEET_NAMES.ENTREGAS);
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Entregas sin encabezados" }, { status: 500 });
    }

    const idEnt = uniqueSheetKey("ENT");
    const data: Record<string, string> = {};

    for (const col of headers) {
      const c = String(col).trim();
      const low = c.toLowerCase();
      let v = "";
      if (low === "id_entrega" || low === "id") v = idEnt;
      else if (low === "fecha_entrega" || low === "fecha") v = body.Fecha || todayISO();
      else if (low === "id_envio" || low === "id envio") v = "";
      else if (low === "responsable") v = body.Responsable.trim();
      else if (low === "monto_entregado" || low === "monto") v = body.Monto.trim();
      else if (low.includes("saldo")) v = "";
      else if (low === "aceptar") v = "TRUE";
      else if (low.includes("observ")) v = body.Observaciones?.trim() || "";
      else if (low.includes("firma") || low.includes("identificacion") || low.includes("comprobante")) v = "";
      data[c] = v;
    }

    const line = buildAppendRow(headers, data);
    await appendSheetRow(key, SHEET_NAMES.ENTREGAS, line);
    revalidateSheet(key, SHEET_NAMES.ENTREGAS);

    return NextResponse.json({ ok: true, id: idEnt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar la entrega";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
