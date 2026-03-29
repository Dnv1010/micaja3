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
import { filterEnvios, coordinadorAssignableUsers, type SessionCtx } from "@/lib/roles";
import type { EnvioRow, UsuarioRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { todayISO } from "@/lib/format";

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

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ data: [] });
  }

  try {
    const [envRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.ENVIO),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);
    const envios = rowsToObjects<EnvioRow>(envRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const filtered = filterEnvios(envios, ctx, usuarios);
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

  const rol = ctx.rol.toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, string>;
    const responsable = body.Responsable || "";
    const userRows = await getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);
    const assignable = coordinadorAssignableUsers(usuarios, ctx);
    if (rol === "coordinador") {
      const ok = assignable.some((u) => u.Responsable === responsable);
      if (!ok) return NextResponse.json({ error: "Responsable no permitido" }, { status: 400 });
    }

    const tel =
      usuarios.find((u) => u.Responsable === responsable)?.Telefono || "";

    const envSheet = await getSheetData("PETTY_CASH", SHEET_NAMES.ENVIO);
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
    await appendSheetRow("PETTY_CASH", SHEET_NAMES.ENVIO, envLine);
    revalidateSheet("PETTY_CASH", SHEET_NAMES.ENVIO);

    const entSheet = await getSheetData("PETTY_CASH", SHEET_NAMES.ENTREGAS);
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
      await appendSheetRow("PETTY_CASH", SHEET_NAMES.ENTREGAS, entLine);
      revalidateSheet("PETTY_CASH", SHEET_NAMES.ENTREGAS);
    }

    return NextResponse.json({ ok: true, id: idEnvio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
