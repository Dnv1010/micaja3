import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import {
  appendSheetRow,
  getSheetData,
  rowsToObjects,
} from "@/lib/sheets-helpers";
import { buildAppendRow } from "@/lib/sheet-row";
import { uniqueSheetKey } from "@/lib/ids";
import { filterFacturas, type SessionCtx } from "@/lib/roles";
import { CENTRO_COSTO_INFO, todayISO } from "@/lib/format";
import type { FacturaRow, UsuarioRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";

function sessionCtx(session: Session | null): SessionCtx | null {
  if (!session) return null;
  const email = session.user?.email;
  if (!email) return null;
  return {
    email,
    rol: session.user.rol || "user",
    responsable: session.user.responsable || "",
    area: session.user.area || "",
    sector: session.user.sector || "",
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [factRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);
    const facturas = rowsToObjects<FacturaRow>(factRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const filtered = filterFacturas(facturas, ctx, usuarios);
    return NextResponse.json({ data: filtered });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, string>;
    const rows = await getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS);
    const headers = rows[0];
    if (!headers?.length) {
      return NextResponse.json({ error: "Hoja Facturas sin encabezados" }, { status: 500 });
    }

    const centro = body["Centro de Costo"] || "";
    const info = CENTRO_COSTO_INFO[centro] || "";

    const data: Record<string, string> = {
      ...body,
      ID_Factura: body.ID_Factura || uniqueSheetKey("FC"),
      Responsable: body.Responsable || ctx.responsable,
      Fecha_Factura: body.Fecha_Factura || todayISO(),
      Legalizado: body.Legalizado || "Pendiente",
      Verificado: body.Verificado || "No",
      InfoCentroCosto: info,
    };

    const line = buildAppendRow(headers, data);
    await appendSheetRow("PETTY_CASH", SHEET_NAMES.FACTURAS, line);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);

    return NextResponse.json({ ok: true, id: data.ID_Factura });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
