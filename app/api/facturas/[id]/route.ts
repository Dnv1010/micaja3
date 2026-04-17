import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { validateFacturaNegocio, type FacturaMutateFields } from "@/lib/factura-mutate-validation";
import { parseCOPString } from "@/lib/format";
import {
  legacyFacturaFormBodyToPatch,
  loadMicajaFacturasSheetRows,
  mapEstadoPatchToSheet,
  mapFacturaUpdateBodyToSheetPatch,
  type FacturaApiUpdateBody,
} from "@/lib/micaja-facturas-sheet";
import { mergeUpdateRow } from "@/lib/sheet-row";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { deleteSheetRow, getSheetId, rowsToObjects } from "@/lib/sheets-helpers";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { parseFechaFacturaDDMMYYYY, sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";
import { findFacturaDuplicadaPorNitNumResponsable } from "@/lib/factura-duplicada-micaja";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { appPublicBaseUrl, escHtml, notificarUsuario } from "@/lib/notificaciones";
import type { FacturaRow } from "@/types/models";

function facturaIdCell(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "ID_Factura", "ID");
}

function jsonDuplicadaEdicion(): NextResponse {
  return NextResponse.json(
    {
      error: "Ya existe otra factura con ese NIT y número de factura para este responsable.",
      duplicada: true,
    },
    { status: 409 }
  );
}

/** Si hay duplicado (otra fila con mismo NIT + número + responsable), respuesta 409. */
function duplicateEditIfAny(
  rows: string[][],
  currentId: string,
  nit: string,
  numFactura: string,
  responsable: string
): NextResponse | null {
  const n = nit.trim();
  const num = numFactura.trim();
  if (!n || !num) return null;
  const list = rowsToObjects<FacturaRow>(rows);
  const dup = findFacturaDuplicadaPorNitNumResponsable(list, {
    nit: n,
    numFactura: num,
    responsable,
    excludeFacturaId: currentId,
  });
  return dup ? jsonDuplicadaEdicion() : null;
}

function facturaEstadoRow(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
}

async function getFacturaById(id: string): Promise<FacturaRow | null> {
  try {
    const rows = await loadMicajaFacturasSheetRows();
    const list = rowsToObjects<FacturaRow>(rows);
    return list.find((f) => facturaIdCell(f) === id) ?? null;
  } catch {
    return null;
  }
}

async function puedeCoordinadorEditar(
  session: { user?: { rol?: string; sector?: string } },
  row: FacturaRow
): Promise<boolean> {
  const rol = String(session.user?.rol || "").toLowerCase();
  if (rol === "admin") return true;
  if (rol !== "coordinador") return false;
  const sector = String(session.user?.sector || "");
  const resp = getCellCaseInsensitive(row, "Responsable");
  const set = await responsablesEnZonaSheetSet(sector);
  return set.has(resp.toLowerCase());
}

function estadoEdicionPermitido(row: FacturaRow): boolean {
  const e = facturaEstadoRow(row).toLowerCase();
  if (e === "completada") return false;
  return e === "pendiente" || e === "rechazada";
}

async function puedeEditarContenido(
  session: { user?: { rol?: string; sector?: string; responsable?: string | null; name?: string | null } },
  row: FacturaRow
): Promise<boolean> {
  if (!estadoEdicionPermitido(row)) return false;
  const rol = String(session.user?.rol || "user").toLowerCase();
  if (rol === "admin") return true;
  if (rol === "coordinador") return puedeCoordinadorEditar(session, row);
  if (rol === "user") {
    const resp = getCellCaseInsensitive(row, "Responsable");
    const mine = String(session.user?.responsable || session.user?.name || "").trim();
    return mine.length > 0 && resp.toLowerCase() === mine.toLowerCase();
  }
  return false;
}

function fechaCellToDDMM(cell: string): string {
  const t = cell.trim();
  if (parseFechaFacturaDDMMYYYY(t)) return t;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

function rowToMutateFields(f: FacturaRow): FacturaMutateFields {
  return {
    fecha: fechaCellToDDMM(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura")),
    proveedor: getCellCaseInsensitive(f, "Proveedor", "Razon_Social"),
    concepto: getCellCaseInsensitive(f, "Concepto", "Observacion"),
    tipoFactura: getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura"),
    servicioDeclarado: getCellCaseInsensitive(f, "ServicioDeclarado", "Tipo_servicio"),
    tipoOperacion: getCellCaseInsensitive(f, "OPS", "TipoOperacion"),
    ciudad: getCellCaseInsensitive(f, "Ciudad"),
    sector: getCellCaseInsensitive(f, "Sector"),
    nit: getCellCaseInsensitive(f, "NIT", "Nit_Factura"),
    valorRaw: getCellCaseInsensitive(f, "Valor", "Monto_Factura"),
    aNombreBia: sheetANombreBiaTrue(getCellCaseInsensitive(f, "ANombreBia", "Nombre_bia")),
  };
}

function extractNuevaUpdates(body: Record<string, unknown>): FacturaApiUpdateBody {
  const u: FacturaApiUpdateBody = {};
  if (body.fecha !== undefined) u.fecha = String(body.fecha);
  if (body.proveedor !== undefined) u.proveedor = String(body.proveedor);
  if (body.nit !== undefined) u.nit = String(body.nit);
  if (body.numFactura !== undefined) u.numFactura = String(body.numFactura);
  if (body.concepto !== undefined) u.concepto = String(body.concepto);
  if (body.valor !== undefined) u.valor = String(body.valor);
  if (body.tipoFactura !== undefined) u.tipoFactura = String(body.tipoFactura);
  if (body.servicioDeclarado !== undefined) u.servicioDeclarado = String(body.servicioDeclarado);
  if (body.tipoOperacion !== undefined) u.tipoOperacion = String(body.tipoOperacion);
  if (body.aNombreBia !== undefined) u.aNombreBia = Boolean(body.aNombreBia);
  if (body.ciudad !== undefined) u.ciudad = String(body.ciudad);
  if (body.sector !== undefined) u.sector = String(body.sector);
  if (body.imagenUrl !== undefined) u.imagenUrl = String(body.imagenUrl);
  if (body.driveFileId !== undefined) u.driveFileId = String(body.driveFileId);
  return u;
}

function applyNuevaUpdates(base: FacturaMutateFields, u: FacturaApiUpdateBody): FacturaMutateFields {
  return {
    fecha: u.fecha !== undefined ? u.fecha.trim() : base.fecha,
    proveedor: u.proveedor !== undefined ? u.proveedor.trim() : base.proveedor,
    concepto: u.concepto !== undefined ? u.concepto.trim() : base.concepto,
    tipoFactura: u.tipoFactura !== undefined ? u.tipoFactura.trim() : base.tipoFactura,
    servicioDeclarado: u.servicioDeclarado !== undefined ? u.servicioDeclarado.trim() : base.servicioDeclarado,
    tipoOperacion: u.tipoOperacion !== undefined ? u.tipoOperacion.trim() : base.tipoOperacion,
    ciudad: u.ciudad !== undefined ? u.ciudad.trim() : base.ciudad,
    sector: u.sector !== undefined ? u.sector.trim() : base.sector,
    nit: u.nit !== undefined ? u.nit.trim() : base.nit,
    valorRaw: u.valor !== undefined ? String(u.valor) : base.valorRaw,
    aNombreBia: u.aNombreBia !== undefined ? u.aNombreBia : base.aNombreBia,
  };
}

function isLegacyFormBody(body: Record<string, unknown>): boolean {
  return body.Fecha_Factura !== undefined || body.Razon_Social !== undefined || body.Monto_Factura !== undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ data: found });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (!(await puedeEditarContenido(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const rows = await loadMicajaFacturasSheetRows();
  const headers = rows[0] || [];

  if (isLegacyFormBody(body)) {
    const legacyPatch = legacyFacturaFormBodyToPatch(headers, body);
    if (!Object.keys(legacyPatch).length) {
      return NextResponse.json({ error: "Sin campos reconocidos" }, { status: 400 });
    }
    const nitEff =
      body.Nit_Factura !== undefined && body.Nit_Factura !== null
        ? String(body.Nit_Factura).trim()
        : String(getCellCaseInsensitive(found, "Nit_Factura", "NIT") || "").trim();
    const numEff =
      body.Num_Factura !== undefined && body.Num_Factura !== null
        ? String(body.Num_Factura).trim()
        : String(getCellCaseInsensitive(found, "Num_Factura", "NumFactura") || "").trim();
    const respEff = String(getCellCaseInsensitive(found, "Responsable") || "").trim();
    const dupPutLegacy = duplicateEditIfAny(rows, id, nitEff, numEff, respEff);
    if (dupPutLegacy) return dupPutLegacy;
    await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, legacyPatch);
    return NextResponse.json({ ok: true });
  }

  const updates = extractNuevaUpdates(body);
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Sin datos para actualizar" }, { status: 400 });
  }

  const base = rowToMutateFields(found);
  const merged = applyNuevaUpdates(base, updates);
  const err = validateFacturaNegocio(merged);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const imagenUrl =
    updates.imagenUrl !== undefined
      ? String(updates.imagenUrl).trim()
      : getCellCaseInsensitive(found, "ImagenURL", "URL", "Adjuntar_Factura");
  if (!imagenUrl) {
    return NextResponse.json({ error: "La factura debe incluir imagenUrl" }, { status: 400 });
  }

  const numFactura =
    updates.numFactura !== undefined
      ? String(updates.numFactura).trim()
      : getCellCaseInsensitive(found, "Num_Factura", "NumFactura");

  const driveFileId =
    updates.driveFileId !== undefined
      ? String(updates.driveFileId).trim()
      : getCellCaseInsensitive(found, "DriveFileId");

  const patch = mapFacturaUpdateBodyToSheetPatch(headers, {
    fecha: merged.fecha,
    proveedor: merged.proveedor,
    nit: merged.nit,
    numFactura,
    concepto: merged.concepto,
    valor: String(Math.round(parseCOPString(merged.valorRaw))),
    tipoFactura: merged.tipoFactura,
    servicioDeclarado: merged.servicioDeclarado,
    tipoOperacion: merged.tipoOperacion,
    aNombreBia: merged.aNombreBia,
    ciudad: merged.ciudad,
    sector: merged.sector,
    imagenUrl,
    driveFileId: driveFileId || undefined,
  });

  const respRow = String(getCellCaseInsensitive(found, "Responsable") || "").trim();
  const dupPutNueva = duplicateEditIfAny(rows, id, merged.nit, numFactura, respRow);
  if (dupPutNueva) return dupPutNueva;

  await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, patch);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const estadoIn = typeof body.estado === "string" ? body.estado.trim() : "";
  const isApproval = estadoIn === "Aprobada" || estadoIn === "Rechazada";

  const rows = await loadMicajaFacturasSheetRows();
  const headers = rows[0] || [];

  if (isApproval) {
    if (facturaEstadoRow(found).toLowerCase() === "completada") {
      return NextResponse.json({ error: "La factura ya fue incluida en un reporte (Completada)" }, { status: 400 });
    }
    if (!(await puedeCoordinadorEditar(session, found))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const motivo = estadoIn === "Rechazada" ? String(body.motivoRechazo || "").trim() : "";
    if (estadoIn === "Rechazada" && !motivo) {
      return NextResponse.json({ error: "Motivo de rechazo obligatorio" }, { status: 400 });
    }
    const patch = mapEstadoPatchToSheet(headers, estadoIn, estadoIn === "Rechazada" ? motivo : "");
    await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, patch);
    if (estadoIn === "Rechazada") {
      const responsableFactura = getCellCaseInsensitive(found, "Responsable");
      const proveedorFactura = getCellCaseInsensitive(found, "Razon_Social", "Proveedor");
      const base = appPublicBaseUrl();
      const msgRechazo = [
        `⚠️ <b>BIA Energy - MiCaja</b>`,
        ``,
        `Tu factura de <b>${escHtml(proveedorFactura || "—")}</b> fue rechazada.`,
        ``,
        `<b>Motivo:</b> ${escHtml(motivo)}`,
        ``,
        `Corrígela en: ${escHtml(`${base}/facturas`)}`,
      ].join("\n");
      void notificarUsuario(responsableFactura, msgRechazo).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (!estadoEdicionPermitido(found)) {
    return NextResponse.json(
      { error: "La factura ya fue incluida en un reporte y no puede editarse" },
      { status: 400 }
    );
  }

  if (typeof body.tipoOperacion === "string" && body.tipoOperacion.trim()) {
    if ((await puedeCoordinadorEditar(session, found)) || (await puedeEditarContenido(session, found))) {
      const opsPatch = mapFacturaUpdateBodyToSheetPatch(headers, {
        tipoOperacion: body.tipoOperacion.trim(),
      });
      if (Object.keys(opsPatch).length) {
        await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, opsPatch);
        const soloOps = Object.keys(body).length === 1 && "tipoOperacion" in body;
        if (soloOps) return NextResponse.json({ ok: true });
      }
    }
  }

  if (!(await puedeEditarContenido(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (isLegacyFormBody(body)) {
    const legacyPatch = legacyFacturaFormBodyToPatch(headers, body);
    if (!Object.keys(legacyPatch).length) {
      return NextResponse.json({ error: "Sin campos reconocidos" }, { status: 400 });
    }
    const nitEff =
      body.Nit_Factura !== undefined && body.Nit_Factura !== null
        ? String(body.Nit_Factura).trim()
        : String(getCellCaseInsensitive(found, "Nit_Factura", "NIT") || "").trim();
    const numEff =
      body.Num_Factura !== undefined && body.Num_Factura !== null
        ? String(body.Num_Factura).trim()
        : String(getCellCaseInsensitive(found, "Num_Factura", "NumFactura") || "").trim();
    const respEff = String(getCellCaseInsensitive(found, "Responsable") || "").trim();
    const dupPatchLegacy = duplicateEditIfAny(rows, id, nitEff, numEff, respEff);
    if (dupPatchLegacy) return dupPatchLegacy;
    await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, legacyPatch);
    return NextResponse.json({ ok: true });
  }

  const updates = extractNuevaUpdates(body);
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Sin datos para actualizar" }, { status: 400 });
  }

  const base = rowToMutateFields(found);
  const merged = applyNuevaUpdates(base, updates);
  const err = validateFacturaNegocio(merged);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const imagenUrl =
    updates.imagenUrl !== undefined
      ? String(updates.imagenUrl).trim()
      : getCellCaseInsensitive(found, "ImagenURL", "URL", "Adjuntar_Factura");
  if (!imagenUrl) {
    return NextResponse.json({ error: "La factura debe incluir imagenUrl" }, { status: 400 });
  }

  const numFactura =
    updates.numFactura !== undefined
      ? String(updates.numFactura).trim()
      : getCellCaseInsensitive(found, "Num_Factura", "NumFactura");

  const driveFileId =
    updates.driveFileId !== undefined
      ? String(updates.driveFileId).trim()
      : getCellCaseInsensitive(found, "DriveFileId");

  const patch = mapFacturaUpdateBodyToSheetPatch(headers, {
    fecha: merged.fecha,
    proveedor: merged.proveedor,
    nit: merged.nit,
    numFactura,
    concepto: merged.concepto,
    valor: String(Math.round(parseCOPString(merged.valorRaw))),
    tipoFactura: merged.tipoFactura,
    servicioDeclarado: merged.servicioDeclarado,
    tipoOperacion: merged.tipoOperacion,
    aNombreBia: merged.aNombreBia,
    ciudad: merged.ciudad,
    sector: merged.sector,
    imagenUrl,
    driveFileId: driveFileId || undefined,
  });

  const respRowPatch = String(getCellCaseInsensitive(found, "Responsable") || "").trim();
  const dupPatchNueva = duplicateEditIfAny(rows, id, merged.nit, numFactura, respRowPatch);
  if (dupPatchNueva) return dupPatchNueva;

  await mergeUpdateRow("MICAJA", SHEET_NAMES.FACTURAS, found._rowIndex, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso para eliminar" }, { status: 403 });
  }

  const found = await getFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (rol === "coordinador" && !(await puedeCoordinadorEditar(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sheetId = await getSheetId("MICAJA", SHEET_NAMES.FACTURAS);
  if (sheetId == null) {
    return NextResponse.json({ error: "No se pudo obtener sheetId" }, { status: 500 });
  }
  await deleteSheetRow("MICAJA", SHEET_NAMES.FACTURAS, sheetId, found._rowIndex - 1);
  return NextResponse.json({ ok: true });
}
