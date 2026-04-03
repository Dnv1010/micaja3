import { parseMonto, parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { findFacturaDuplicadaPorNitNumResponsable } from "@/lib/factura-duplicada-micaja";
import type { FacturaRow } from "@/types/models";

export type ResultadoAutoAprobacion = {
  aprobar: boolean;
  motivo: string;
};

function foldKey(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Límites COP por tipo de servicio (auto-aprobación). 0 = no auto. */
const LIMITES_AUTO_APROBACION: Record<string, number> = {
  Parqueadero: 50_000,
  Peajes: 30_000,
  Gasolina: 200_000,
  Alimentación: 50_000,
  Transporte: 80_000,
  Papelería: 30_000,
  Lavadero: 40_000,
  Llantera: 80_000,
  "Gastos Bancarios": 20_000,
};

const SIEMPRE_REVISION = new Set(
  [
    "Hospedaje",
    "IVA Hoteles",
    "Convenciones",
    "Eventos",
    "Pago a proveedores",
    "Otro",
  ].map((s) => foldKey(s))
);

function limiteParaServicio(servicio: string): number | undefined {
  const t = servicio.trim();
  if (LIMITES_AUTO_APROBACION[t] !== undefined) return LIMITES_AUTO_APROBACION[t];
  const fk = foldKey(t);
  for (const [k, v] of Object.entries(LIMITES_AUTO_APROBACION)) {
    if (foldKey(k) === fk) return v;
  }
  return undefined;
}

function servicioRequiereRevisionManual(servicio: string): boolean {
  return SIEMPRE_REVISION.has(foldKey(servicio));
}

/**
 * Evalúa si una factura nueva puede auto-aprobarse.
 * `facturasExistentes`: filas ya en hoja (misma zona de negocio que uses en POST).
 * `excludeId`: ID de la factura si fuera edición (no aplica en POST nuevo).
 */
export function evaluarAutoAprobacion(
  factura: Record<string, unknown>,
  facturasExistentes: FacturaRow[],
  opts?: { excludeFacturaId?: string }
): ResultadoAutoAprobacion {
  const nit = String(getCellCaseInsensitive(factura, "Nit_Factura", "NIT") || "").trim();
  const numFactura = String(
    getCellCaseInsensitive(factura, "Num_Factura", "NumFactura") || ""
  ).trim();
  const imagenUrl = String(
    getCellCaseInsensitive(factura, "Adjuntar_Factura", "URL", "ImagenURL") || ""
  ).trim();
  const nombreBiaRaw = String(getCellCaseInsensitive(factura, "Nombre_bia", "ANombreBia") || "")
    .trim()
    .toUpperCase();
  const servicio = String(getCellCaseInsensitive(factura, "Tipo_servicio", "ServicioDeclarado") || "").trim();
  const valorRaw = String(getCellCaseInsensitive(factura, "Monto_Factura", "Valor") || "0");
  const valor = parseMonto(valorRaw);
  const responsable = String(getCellCaseInsensitive(factura, "Responsable") || "").trim();

  if (!imagenUrl.startsWith("https://")) {
    return { aprobar: false, motivo: "Sin imagen adjunta (URL https) — requiere revisión manual" };
  }

  if (valor <= 0) {
    return { aprobar: false, motivo: "El valor debe ser mayor a $0 — requiere revisión manual" };
  }

  if (!nit) {
    return { aprobar: false, motivo: "Sin NIT del proveedor — requiere revisión manual" };
  }

  if (!numFactura) {
    return { aprobar: false, motivo: "Sin número de factura — requiere revisión manual" };
  }

  if (nombreBiaRaw !== "TRUE") {
    return {
      aprobar: false,
      motivo: "Factura no está a nombre de BIA Energy — requiere revisión manual",
    };
  }

  const dup = findFacturaDuplicadaPorNitNumResponsable(facturasExistentes, {
    nit,
    numFactura,
    responsable,
    excludeFacturaId: opts?.excludeFacturaId,
  });
  if (dup) {
    return { aprobar: false, motivo: "Factura duplicada (mismo NIT, número y responsable) — requiere revisión manual" };
  }

  if (servicioRequiereRevisionManual(servicio)) {
    return { aprobar: false, motivo: `Servicio "${servicio}" requiere aprobación manual` };
  }

  const limite = limiteParaServicio(servicio);
  if (limite === undefined) {
    return { aprobar: false, motivo: `Servicio "${servicio}" no reconocido para auto-aprobación — requiere revisión manual` };
  }

  if (limite === 0) {
    return { aprobar: false, motivo: `Servicio "${servicio}" requiere aprobación manual` };
  }

  if (valor > limite) {
    return {
      aprobar: false,
      motivo: `Valor $${valor.toLocaleString("es-CO")} supera el límite de auto-aprobación de $${limite.toLocaleString("es-CO")} para ${servicio}`,
    };
  }

  const ahora = new Date();
  const desde7 = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const mismoNitReciente = facturasExistentes.filter((f) => {
    const idF = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "").trim();
    if (opts?.excludeFacturaId && idF === opts.excludeFacturaId) return false;
    const nitF = String(getCellCaseInsensitive(f, "Nit_Factura", "NIT") || "").trim();
    if (nitF !== nit) return false;
    const respF = String(getCellCaseInsensitive(f, "Responsable") || "").trim().toLowerCase();
    if (respF !== responsable.toLowerCase()) return false;
    const fd = parseSheetDate(String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || ""));
    return fd != null && fd >= desde7;
  });

  if (mismoNitReciente.length >= 1) {
    return {
      aprobar: false,
      motivo: `El proveedor (NIT ${nit}) ya tiene factura(s) en los últimos 7 días — requiere revisión manual`,
    };
  }

  return {
    aprobar: true,
    motivo: `Auto-aprobada: ${servicio} $${valor.toLocaleString("es-CO")} cumple todos los criterios`,
  };
}
