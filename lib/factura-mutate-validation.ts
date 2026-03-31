import {
  CIUDADES_FACTURA,
  SERVICIOS_DECLARADOS,
  SECTORES_FACTURA,
  TIPOS_FACTURA_FIJOS,
  TIPOS_OPERACION,
} from "@/lib/factura-field-options";
import { parseCOPString } from "@/lib/format";
import { isFechaFacturaFutura, parseFechaFacturaDDMMYYYY } from "@/lib/nueva-factura-validation";

const setTipo = new Set<string>(TIPOS_FACTURA_FIJOS);
const setServ = new Set<string>(SERVICIOS_DECLARADOS);
const setCiudad = new Set<string>(CIUDADES_FACTURA);
const setSector = new Set<string>(SECTORES_FACTURA);
const setOp = new Set<string>(TIPOS_OPERACION);

export type FacturaMutateFields = {
  fecha: string;
  proveedor: string;
  concepto: string;
  tipoFactura: string;
  servicioDeclarado: string;
  tipoOperacion: string;
  ciudad: string;
  sector: string;
  nit: string;
  valorRaw: string;
  aNombreBia: boolean;
};

/** Validación compartida POST facturas y PUT edición. Devuelve mensaje de error o null si OK. */
export function validateFacturaNegocio(f: FacturaMutateFields): string | null {
  const fechaObj = parseFechaFacturaDDMMYYYY(f.fecha);
  if (!fechaObj) return "La fecha es obligatoria (DD/MM/YYYY)";
  if (isFechaFacturaFutura(fechaObj)) return "La fecha no puede ser futura";
  if (!f.proveedor.trim()) return "Proveedor es obligatorio";
  if (!f.concepto.trim()) return "Concepto es obligatorio";
  if (!f.tipoFactura || !setTipo.has(f.tipoFactura)) return "Tipo de factura no válido";
  if (!f.servicioDeclarado || !setServ.has(f.servicioDeclarado)) return "Servicio declarado no válido";
  if (!f.tipoOperacion || !setOp.has(f.tipoOperacion)) return "Tipo de operación no válido";
  if (!f.ciudad || !setCiudad.has(f.ciudad)) return "Ciudad no válida";
  if (!f.sector || !setSector.has(f.sector)) return "Sector no válido";
  const valorNum = parseCOPString(String(f.valorRaw || "0"));
  if (!Number.isFinite(valorNum) || valorNum <= 0) return "El valor debe ser mayor a 0";
  if (f.aNombreBia && !f.nit.trim()) return "Si la factura es a nombre de BIA, el NIT es obligatorio";
  return null;
}
