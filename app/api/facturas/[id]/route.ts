import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  validateFacturaNegocio,
  type FacturaMutateFields,
} from "@/lib/factura-mutate-validation";
import { parseCOPString } from "@/lib/format";
import {
  deleteFactura,
  findFacturaById,
  loadFacturas,
  updateFactura,
  updateFacturaEstado,
  type FacturaUpdateFields,
} from "@/lib/facturas-supabase";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import {
  parseFechaFacturaDDMMYYYY,
  sheetANombreBiaTrue,
} from "@/lib/nueva-factura-validation";
import { findFacturaDuplicadaPorNitNumResponsable } from "@/lib/factura-duplicada-micaja";
import { responsablesEnZonaSheetSet } from "@/lib/usuarios-sheet";
import { appPublicBaseUrl, escHtml, notificarUsuario } from "@/lib/notificaciones";
import type { FacturaRow } from "@/types/models";

function facturaEstadoRow(f: FacturaRow): string {
  return getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
}

function jsonDuplicadaEdicion(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Ya existe otra factura con ese NIT y número de factura para este responsable.",
      duplicada: true,
    },
    { status: 409 }
  );
}

async function duplicateEditIfAny(
  currentId: string,
  nit: string,
  numFactura: string,
  responsable: string
): Promise<NextResponse | null> {
  const n = nit.trim();
  const num = numFactura.trim();
  if (!n || !num) return null;
  const list = await loadFacturas();
  const dup = findFacturaDuplicadaPorNitNumResponsable(list, {
    nit: n,
    numFactura: num,
    responsable,
    excludeFacturaId: currentId,
  });
  return dup ? jsonDuplicadaEdicion() : null;
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
  // Solo Completada bloquea la edición; Pendiente, Aprobada, Rechazada sí permiten editar
  return facturaEstadoRow(row).toLowerCase() !== "completada";
}

async function puedeEditarContenido(
  session: {
    user?: {
      rol?: string;
      sector?: string;
      responsable?: string | null;
      name?: string | null;
    };
  },
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
    aNombreBia: sheetANombreBiaTrue(
      getCellCaseInsensitive(f, "ANombreBia", "Nombre_bia")
    ),
  };
}

function extractNuevaUpdates(body: Record<string, unknown>): FacturaUpdateFields {
  const u: FacturaUpdateFields = {};
  if (body.fecha !== undefined) u.fecha = String(body.fecha);
  if (body.proveedor !== undefined) u.proveedor = String(body.proveedor);
  if (body.nit !== undefined) u.nit = String(body.nit);
  if (body.numFactura !== undefined) u.numFactura = String(body.numFactura);
  if (body.concepto !== undefined) u.concepto = String(body.concepto);
  if (body.valor !== undefined) u.valor = String(body.valor);
  if (body.tipoFactura !== undefined) u.tipoFactura = String(body.tipoFactura);
  if (body.servicioDeclarado !== undefined)
    u.servicioDeclarado = String(body.servicioDeclarado);
  if (body.tipoOperacion !== undefined) u.tipoOperacion = String(body.tipoOperacion);
  if (body.aNombreBia !== undefined) u.aNombreBia = Boolean(body.aNombreBia);
  if (body.ciudad !== undefined) u.ciudad = String(body.ciudad);
  if (body.sector !== undefined) u.sector = String(body.sector);
  if (body.imagenUrl !== undefined) u.imagenUrl = String(body.imagenUrl);
  if (body.driveFileId !== undefined) u.driveFileId = String(body.driveFileId);
  return u;
}

/** Body legacy (claves Sheet-style como Fecha_Factura/Razon_Social) → FacturaUpdateFields. */
function legacyBodyToUpdates(body: Record<string, unknown>): FacturaUpdateFields {
  const u: FacturaUpdateFields = {};
  if (body.Fecha_Factura !== undefined) u.fecha = String(body.Fecha_Factura);
  if (body.Razon_Social !== undefined) u.proveedor = String(body.Razon_Social);
  if (body.Nit_Factura !== undefined) u.nit = String(body.Nit_Factura);
  if (body.Num_Factura !== undefined) u.numFactura = String(body.Num_Factura);
  if (body.Observacion !== undefined) u.concepto = String(body.Observacion);
  if (body.Monto_Factura !== undefined) u.valor = String(body.Monto_Factura);
  if (body.Tipo_Factura !== undefined) u.tipoFactura = String(body.Tipo_Factura);
  if (body.Tipo_servicio !== undefined) u.servicioDeclarado = String(body.Tipo_servicio);
  if (body.TipoOperacion !== undefined) u.tipoOperacion = String(body.TipoOperacion);
  if (body.Ciudad !== undefined) u.ciudad = String(body.Ciudad);
  if (body.Sector !== undefined) u.sector = String(body.Sector);
  if (body.Adjuntar_Factura !== undefined) u.imagenUrl = String(body.Adjuntar_Factura);
  if (body.Nombre_bia !== undefined) {
    const s = String(body.Nombre_bia).toLowerCase();
    u.aNombreBia = s === "sí" || s === "si" || s === "true" || s === "1";
  }
  return u;
}

function isLegacyFormBody(body: Record<string, unknown>): boolean {
  return (
    body.Fecha_Factura !== undefined ||
    body.Razon_Social !== undefined ||
    body.Monto_Factura !== undefined
  );
}

function applyNuevaUpdates(
  base: FacturaMutateFields,
  u: FacturaUpdateFields
): FacturaMutateFields {
  return {
    fecha: u.fecha !== undefined ? String(u.fecha).trim() : base.fecha,
    proveedor: u.proveedor !== undefined ? u.proveedor.trim() : base.proveedor,
    concepto: u.concepto !== undefined ? u.concepto.trim() : base.concepto,
    tipoFactura: u.tipoFactura !== undefined ? u.tipoFactura.trim() : base.tipoFactura,
    servicioDeclarado:
      u.servicioDeclarado !== undefined ? u.servicioDeclarado.trim() : base.servicioDeclarado,
    tipoOperacion:
      u.tipoOperacion !== undefined ? u.tipoOperacion.trim() : base.tipoOperacion,
    ciudad: u.ciudad !== undefined ? u.ciudad.trim() : base.ciudad,
    sector: u.sector !== undefined ? u.sector.trim() : base.sector,
    nit: u.nit !== undefined ? u.nit.trim() : base.nit,
    valorRaw: u.valor !== undefined ? String(u.valor) : base.valorRaw,
    aNombreBia: u.aNombreBia !== undefined ? u.aNombreBia : base.aNombreBia,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await findFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ data: found });
}

async function runUpdate(
  req: NextRequest,
  id: string,
  found: FacturaRow,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const updates = isLegacyFormBody(body)
    ? legacyBodyToUpdates(body)
    : extractNuevaUpdates(body);
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Sin datos para actualizar" }, { status: 400 });
  }

  const base = rowToMutateFields(found);
  const merged = applyNuevaUpdates(base, updates);
  const err = validateFacturaNegocio(merged);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // imagenUrl es opcional en edición: se preserva la existente si el body no la incluye.
  // Si la existente tampoco existe, no se toca el campo imagen en la DB.
  const imagenUrl =
    updates.imagenUrl !== undefined
      ? updates.imagenUrl.trim()
      : getCellCaseInsensitive(found, "ImagenURL", "URL", "Adjuntar_Factura");

  const numFactura =
    updates.numFactura !== undefined
      ? updates.numFactura.trim()
      : getCellCaseInsensitive(found, "Num_Factura", "NumFactura");

  const respRow = String(getCellCaseInsensitive(found, "Responsable") || "").trim();
  const dup = await duplicateEditIfAny(id, merged.nit, numFactura, respRow);
  if (dup) {
    void req;
    return dup;
  }

  await updateFactura(id, {
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
    imagenUrl: imagenUrl || undefined,
    driveFileId: updates.driveFileId,
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await findFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (!(await puedeEditarContenido(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  return runUpdate(req, id, found, body);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const found = await findFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const estadoIn = typeof body.estado === "string" ? body.estado.trim() : "";
  const isApproval = estadoIn === "Aprobada" || estadoIn === "Rechazada";

  if (isApproval) {
    if (facturaEstadoRow(found).toLowerCase() === "completada") {
      return NextResponse.json(
        { error: "La factura ya fue incluida en un reporte (Completada)" },
        { status: 400 }
      );
    }
    if (!(await puedeCoordinadorEditar(session, found))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const motivo =
      estadoIn === "Rechazada" ? String(body.motivoRechazo || "").trim() : "";
    if (estadoIn === "Rechazada" && !motivo) {
      return NextResponse.json(
        { error: "Motivo de rechazo obligatorio" },
        { status: 400 }
      );
    }
    await updateFacturaEstado(id, estadoIn, estadoIn === "Rechazada" ? motivo : undefined);
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

  // Caso especial: coordinador puede editar solo tipoOperacion aun sin estar sobre el responsable
  if (typeof body.tipoOperacion === "string" && body.tipoOperacion.trim()) {
    const puedeCoord = await puedeCoordinadorEditar(session, found);
    const puedeContenido = await puedeEditarContenido(session, found);
    if (puedeCoord || puedeContenido) {
      await updateFactura(id, { tipoOperacion: body.tipoOperacion.trim() });
      const soloOps =
        Object.keys(body).length === 1 && "tipoOperacion" in body;
      if (soloOps) return NextResponse.json({ ok: true });
    }
  }

  if (!(await puedeEditarContenido(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return runUpdate(req, id, found, body);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    return NextResponse.json({ error: "Sin permiso para eliminar" }, { status: 403 });
  }

  const found = await findFacturaById(id);
  if (!found) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  if (rol === "coordinador" && !(await puedeCoordinadorEditar(session, found))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const ok = await deleteFactura(id);
  if (!ok) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
