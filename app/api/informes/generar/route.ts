import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { Readable } from "stream";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { drive, assertSheetsConfigured } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects, appendSheetRow } from "@/lib/sheets-helpers";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { filterFacturas, type SessionCtx } from "@/lib/roles";
import { uniqueSheetKey } from "@/lib/ids";
import { InformePdfDocument } from "@/components/informes/informe-pdf";
import type { FacturaRow, UsuarioRow } from "@/types/models";
import { revalidateSheet } from "@/lib/revalidate-sheets";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

function parseMonto(s: string): number {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function inDateRange(iso: string, start: string, end: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const a = new Date(start);
  const b = new Date(end);
  b.setHours(23, 59, 59, 999);
  return d >= a && d <= b;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const ctx = session ? sessionCtx(session) : null;
  if (!ctx || !session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = ctx.rol.toLowerCase();
  if (!["admin", "coordinador", "verificador"].includes(rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const authSession = session;

  try {
    const body = (await req.json()) as {
      fecha_inicio: string;
      fecha_fin: string;
      usuario_responsable: string;
      factura_ids: string[];
      firma_legaliza?: string;
      firma_aprueba?: string;
    };

    const { fecha_inicio, fecha_fin, usuario_responsable, factura_ids } = body;
    if (!fecha_inicio || !fecha_fin || !usuario_responsable || !factura_ids?.length) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    assertSheetsConfigured();
    const informesFolder = process.env.GOOGLE_DRIVE_INFORMES_FOLDER_ID;
    if (!informesFolder) {
      return NextResponse.json({ error: "Falta GOOGLE_DRIVE_INFORMES_FOLDER_ID" }, { status: 500 });
    }

    const [factRows, userRows] = await Promise.all([
      getSheetData("PETTY_CASH", SHEET_NAMES.FACTURAS),
      getSheetData("PETTY_CASH", SHEET_NAMES.USUARIOS),
    ]);
    const todas = rowsToObjects<FacturaRow>(factRows);
    const usuarios = rowsToObjects<UsuarioRow>(userRows);

    const selected = todas.filter(
      (f) =>
        factura_ids.includes(f.ID_Factura) &&
        f.Responsable === usuario_responsable &&
        (f.Verificado || "").toLowerCase() !== "si" &&
        inDateRange(f.Fecha_Factura, fecha_inicio, fecha_fin)
    );

    const visible = filterFacturas(selected, ctx, usuarios);
    if (visible.length !== selected.length) {
      return NextResponse.json({ error: "Facturas no permitidas para su rol" }, { status: 403 });
    }

    if (!selected.length) {
      return NextResponse.json({ error: "No hay facturas válidas" }, { status: 400 });
    }

    const usuario = usuarios.find((u) => u.Responsable === usuario_responsable);
    const montoAsignado = Number(process.env.NEXT_PUBLIC_MONTO_ASIGNADO || 3_000_000);
    const valorReembolsar = selected.reduce((acc, f) => acc + parseMonto(f.Monto_Factura), 0);
    const pct = montoAsignado > 0 ? Math.round((valorReembolsar / montoAsignado) * 100) : 0;

    const fechaStr = format(new Date(), "d 'de' MMMM yyyy", { locale: es });

    const pdfElement = React.createElement(InformePdfDocument, {
      nombre: usuario_responsable,
      fecha: fechaStr,
      cargo: usuario?.Cargo || "",
      cedula: String(usuario?.Cedula || ""),
      ciudadSector: usuario?.Sector || "",
      montoAsignado,
      valorReembolsar,
      pctEjecutado: pct,
      facturas: selected,
      firmaLegaliza: body.firma_legaliza,
      firmaAprueba: body.firma_aprueba,
    }) as React.ReactElement;

    const buffer = await renderToBuffer(pdfElement);

    const fileName = `informe_${usuario_responsable.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

    for (const f of selected) {
      await mergeUpdateRow("PETTY_CASH", SHEET_NAMES.FACTURAS, f._rowIndex, { Verificado: "Si" });
    }
    revalidateSheet("PETTY_CASH", SHEET_NAMES.FACTURAS);

    const paramRows = await getSheetData("MICAJA", SHEET_NAMES.PARAMETROS_PDF);
    const paramHeaders = paramRows[0];
    if (paramHeaders?.length) {
      const id = uniqueSheetKey("PDF");
      const totalAlmac = valorReembolsar.toString();
      const facturasCsv = selected.map((f) => f.ID_Factura).join(",");
      const line = paramHeaders.map((h) => {
        const map: Record<string, string> = {
          ID: id,
          Fecha: new Date().toISOString(),
          Inicio: fecha_inicio,
          Fin: fecha_fin,
          Usuario: authSession.user?.responsable || authSession.user?.email || "",
          FacturaAlmacenada: facturasCsv,
          TotalAlmacenado: totalAlmac,
          FirmaLegaliza: body.firma_legaliza || "",
          FirmaAprueba: body.firma_aprueba || "",
        };
        return map[h] ?? "";
      });
      await appendSheetRow("MICAJA", SHEET_NAMES.PARAMETROS_PDF, line);
      revalidateSheet("MICAJA", SHEET_NAMES.PARAMETROS_PDF);
    }

    await drive!.files.create({
      requestBody: {
        name: fileName,
        parents: [informesFolder],
      },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(Buffer.from(buffer)),
      },
      fields: "id",
    });

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
