import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { assertSheetsConfigured, getSheetsClient, SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { applyFacturaEstadoById } from "@/lib/factura-estado-server";
import { quoteSheetTitleForRange, rowsToObjects, sheetValuesToRecords } from "@/lib/sheets-helpers";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString } from "@/lib/format";
import { appPublicBaseUrl, escHtml, notificarAdmins } from "@/lib/notificaciones";
import { generarResumenLegalizacionGemini } from "@/lib/gemini-resumen-legalizacion";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { facturaRowToFacturaPdfForLegalizacion } from "@/lib/legalizacion-factura-pdf-map";
import { loadMicajaFacturasSheetRows } from "@/lib/micaja-facturas-sheet";
import type { FacturaRow } from "@/types/models";

const RANGE = `${quoteSheetTitleForRange(SHEET_NAMES.LEGALIZACIONES)}!A:N`;

function spreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

function facturaIdCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "ID_Factura", "ID");
}

function facturaEstadoCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    assertSheetsConfigured();
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: RANGE,
    });
    const rows = res.data.values ?? [];
    let data = sheetValuesToRecords(rows);

    const rol = String(session.user.rol || "").toLowerCase();
    const coordinador = String(session.user.responsable || session.user.name || "").trim();

    if (rol !== "admin") {
      data = data.filter((r) => String(r.Coordinador || "").trim() === coordinador);
    }

    data.reverse();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      periodoDe?: string;
      periodoHasta?: string;
      total?: string | number;
      facturasIds?: string[];
      facturasPdf?: Array<Record<string, unknown>>;
      firmaCoordinador?: string;
      pdfUrl?: string;
    };

    const periodoDe = String(body.periodoDe || "").trim();
    const periodoHasta = String(body.periodoHasta || "").trim();
    const facturasIds = Array.isArray(body.facturasIds) ? body.facturasIds.map(String) : [];
    const firmaCoordinador = String(body.firmaCoordinador || "").trim().slice(0, 45000);
    const pdfUrl = String(body.pdfUrl || "").trim();
    const totalStr = String(
      typeof body.total === "number" && Number.isFinite(body.total) ? Math.round(body.total) : body.total || "0"
    );

    if (!periodoDe || !periodoHasta || !facturasIds.length || !firmaCoordinador) {
      return NextResponse.json(
        { error: "Faltan periodoDe, periodoHasta, facturasIds o firmaCoordinador" },
        { status: 400 }
      );
    }

    const sector = String(session.user.sector || "").trim();
    const coordinadorNombre = String(session.user.responsable || session.user.name || "").trim();
    const userArea = String((session.user as { area?: string }).area || "").trim();
    const zonaSet = rol === "coordinador" ? await responsablesEnZonaSheetSet(sector) : null;
    const mine = coordinadorNombre.toLowerCase();

    const factRows = await loadMicajaFacturasSheetRows();
    const facturas = rowsToObjects<FacturaRow>(factRows);
    const byId = new Map(facturas.map((f) => [facturaIdCell(f), f]));

    for (const fid of facturasIds) {
      const f = byId.get(fid);
      if (!f) {
        return NextResponse.json({ error: `Factura no encontrada: ${fid}` }, { status: 400 });
      }
      const est = facturaEstadoCell(f).toLowerCase();
      if (est === "completada") {
        return NextResponse.json({ error: `La factura ${fid} ya está completada` }, { status: 400 });
      }
      if (est !== "aprobada") {
        return NextResponse.json({ error: `La factura ${fid} no está aprobada` }, { status: 400 });
      }
      if (zonaSet) {
        const resp = getCellCaseInsensitive(f, "Responsable").toLowerCase();
        if (!zonaSet.has(resp) && resp !== mine) {
          return NextResponse.json({ error: `Factura fuera de zona: ${fid}` }, { status: 403 });
        }
      }
    }

    const serverFacturasPdf = facturasIds.map((fid) =>
      facturaRowToFacturaPdfForLegalizacion(byId.get(fid)!, { area: userArea })
    );
    const fromClient = body.facturasPdf;
    const clientOk =
      Array.isArray(fromClient) &&
      fromClient.length === facturasIds.length &&
      facturasIds.every((fid, i) => String(fromClient[i]?.id ?? "") === fid);
    const facturasJson = JSON.stringify(clientOk ? fromClient : serverFacturasPdf);
    const facturasPdfParaIa = (clientOk ? fromClient : serverFacturasPdf) as Array<{
      proveedor?: string;
      concepto?: string;
      valor?: string | number;
      fecha?: string;
      tipoFactura?: string;
    }>;

    const totalNum = parseCOPString(totalStr) || Number(totalStr) || 0;
    const limiteZona = limiteAprobacionZona(sector);
    let resumenIA = "";
    try {
      resumenIA = await generarResumenLegalizacionGemini({
        facturas: facturasPdfParaIa.map((f) => ({
          proveedor: f.proveedor,
          concepto: f.concepto,
          valor: f.valor,
          fecha: f.fecha,
          tipoFactura: f.tipoFactura,
        })),
        coordinador: coordinadorNombre,
        sector,
        total: totalNum,
        limite: limiteZona,
      });
    } catch (e) {
      console.error("legalizaciones POST resumen IA:", e);
    }

    // Marcar facturas como Completada ANTES de insertar el reporte, para evitar
    // reportes huérfanos si falla alguna actualización. Si falla alguna, se revierten
    // las ya aplicadas y se aborta sin crear el reporte.
    assertSheetsConfigured();
    const updateResults = await Promise.all(
      facturasIds.map(async (fid) => {
        try {
          const r = await applyFacturaEstadoById(fid, "Completada", "");
          return { fid, ok: r.ok, error: r.ok ? null : r.error };
        } catch (e) {
          return { fid, ok: false, error: String(e) };
        }
      })
    );
    const fallidas = updateResults.filter((r) => !r.ok);
    if (fallidas.length) {
      const exitosas = updateResults.filter((r) => r.ok);
      await Promise.allSettled(
        exitosas.map((s) => applyFacturaEstadoById(s.fid, "Aprobada", ""))
      );
      console.error(
        "legalizaciones POST: rollback por fallo al marcar Completada",
        fallidas
      );
      return NextResponse.json(
        { error: "No se pudieron marcar todas las facturas como Completada. Intenta nuevamente." },
        { status: 500 }
      );
    }

    const id = `REP-${Date.now()}`;
    const fila = [
      id,
      new Date().toLocaleDateString("es-CO"),
      coordinadorNombre,
      sector,
      periodoDe,
      periodoHasta,
      totalStr,
      "Pendiente Admin",
      facturasJson,
      firmaCoordinador,
      "",
      pdfUrl,
      new Date().toISOString(),
      resumenIA,
    ];

    try {
      await getSheetsClient().spreadsheets.values.append({
        spreadsheetId: spreadsheetId(),
        range: RANGE,
        valueInputOption: "RAW",
        requestBody: { values: [fila] },
      });
    } catch (e) {
      await Promise.allSettled(
        facturasIds.map((fid) => applyFacturaEstadoById(fid, "Aprobada", ""))
      );
      console.error("legalizaciones POST: rollback por fallo al insertar reporte", e);
      return NextResponse.json(
        { error: "No se pudo insertar el reporte. Se revirtieron las facturas." },
        { status: 500 }
      );
    }

    const base = appPublicBaseUrl();
    const msgAdmin = [
      `📋 <b>BIA Energy - MiCaja</b>`,
      ``,
      `Nuevo reporte pendiente de firma.`,
      ``,
      `<b>Coordinador:</b> ${escHtml(coordinadorNombre)}`,
      `<b>Zona:</b> ${escHtml(sector)}`,
      `<b>Total:</b> ${escHtml(formatCOP(totalNum))}`,
      `<b>Período:</b> ${escHtml(periodoDe)} al ${escHtml(periodoHasta)}`,
      ``,
      `Firmar en: ${escHtml(`${base}/admin/reportes`)}`,
    ].join("\n");
    void notificarAdmins(msgAdmin).catch(() => {});

    return NextResponse.json({ ok: true, id, pdfUrl });
  } catch (e) {
    console.error("legalizaciones POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo crear el reporte" }, { status: 500 });
  }
}
