import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { assertSheetsConfigured, getSheetsClient, SHEET_NAMES, SPREADSHEET_IDS } from "@/lib/google-sheets";
import { formatCOP, parseCOPString } from "@/lib/format";
import {
  deleteSheetRow,
  getSheetId,
  quoteSheetTitleForRange,
  sheetValuesToRecords,
} from "@/lib/sheets-helpers";
import { appPublicBaseUrl, enviarWhatsApp, telefonosCoordinadoresZona } from "@/lib/whatsapp";

const TAB = SHEET_NAMES.LEGALIZACIONES;
const RANGE = `${quoteSheetTitleForRange(TAB)}!A:N`;

function spreadsheetId(): string {
  const id = SPREADSHEET_IDS.MICAJA.trim();
  if (!id) throw new Error("MICAJA_SPREADSHEET_ID no configurada");
  return id;
}

function columnLetter(index: number): string {
  if (index < 0 || index > 25) return "A";
  return String.fromCharCode(65 + index);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reportId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin") {
    return NextResponse.json({ error: "Solo el administrador puede firmar el reporte" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { firmaAdmin?: string; pdfUrl?: string };
    const firmaAdmin = String(body.firmaAdmin || "").trim().slice(0, 45000);
    const pdfUrl = String(body.pdfUrl || "").trim();
    if (!firmaAdmin || !pdfUrl) {
      return NextResponse.json({ error: "firmaAdmin y pdfUrl son obligatorios" }, { status: 400 });
    }

    assertSheetsConfigured();
    const sheets = getSheetsClient();
    const sid = spreadsheetId();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: RANGE });
    const rows = res.data.values ?? [];
    if (rows.length < 2) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const headers = (rows[0] || []).map((h) => String(h ?? "").trim());
    const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "").trim() === reportId);
    if (rowIndex === -1) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const sheetRow = rowIndex + 1;

    // Solo estas columnas: no tocar Facturas_IDs, Firma_Coordinador ni el resto.
    const updateCol = async (colName: string, value: string) => {
      const colIndex = headers.findIndex((h) => h === colName);
      if (colIndex === -1) return;
      const colLetter = columnLetter(colIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sid,
        range: `${quoteSheetTitleForRange(TAB)}!${colLetter}${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [[value]] },
      });
    };

    await updateCol("Firma_Admin", firmaAdmin);
    await updateCol("PDF_URL", pdfUrl);
    await updateCol("Estado", "Firmado");

    const dataRow = rows[rowIndex] ?? [];
    const cell = (name: string) => {
      const colIndex = headers.findIndex((h) => h === name);
      return colIndex >= 0 ? String(dataRow[colIndex] ?? "").trim() : "";
    };
    const sectorReporte = cell("Sector");
    const totalRaw = cell("Total");
    const totalReporte = parseCOPString(totalRaw) || Number(totalRaw.replace(/[^\d]/g, "")) || 0;
    const base = appPublicBaseUrl();
    const msgCoord = `*BIA Energy - MiCaja*\n\nTu reporte ha sido *firmado y aprobado* por el administrador.\n\nTotal aprobado: ${formatCOP(totalReporte)}\nYa puedes descargarlo en PDF.\n\nDescarga en: ${base}/reporte`;
    for (const telefono of telefonosCoordinadoresZona(sectorReporte)) {
      void enviarWhatsApp(telefono, msgCoord).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("legalizaciones PATCH:", e);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reportId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    assertSheetsConfigured();
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: RANGE,
    });
    const rows = res.data.values ?? [];
    if (rows.length < 2) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[0] ?? "").trim() === reportId);
    if (rowIndex === -1) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const records = sheetValuesToRecords(rows);
    const match = records[rowIndex - 1];
    const estado = String(match?.Estado || "").trim();
    const coord = String(match?.Coordinador || "").trim();
    const mine = String(session.user.responsable || session.user.name || "").trim();

    if (rol === "coordinador") {
      if (coord !== mine) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      if (estado !== "Pendiente Admin") {
        return NextResponse.json({ error: "Solo se pueden eliminar reportes pendientes de firma del admin" }, { status: 400 });
      }
    }

    const sheetId = await getSheetId("MICAJA", TAB);
    if (sheetId == null) {
      return NextResponse.json({ error: "No se pudo obtener la pestaña" }, { status: 500 });
    }

    await deleteSheetRow("MICAJA", TAB, sheetId, rowIndex);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("legalizaciones DELETE:", e);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
