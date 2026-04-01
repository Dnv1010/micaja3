export const TIPOS_FACTURA_FIJOS = [
  "POS",
  "Electrónica",
  "Talonario",
  "Equivalente",
  "Cuenta de Cobro",
  "A Mano",
  "Servicios Públicos",
] as const;
export const SERVICIOS_DECLARADOS = [
  "Transporte",
  "Peajes",
  "Gasolina",
  "Alimentación",
  "IVA Hoteles",
  "Hospedaje",
  "Papelería",
  "Pago a proveedores",
  "Otro",
  "Convenciones",
  "Eventos",
  "Lavadero",
  "Parqueadero",
  "Llantera",
  "Gastos Bancarios",
] as const;
export const CIUDADES_FACTURA = [
  "Bogotá",
  "Santa Marta",
  "Cartagena",
  "Barranquilla",
  "Funza",
  "Galapa",
] as const;

/** Acepta variantes OCR / Sheet (ej. "Barranquilla, Atlántico"). */
export function ciudadFacturaValidaPermisiva(ciudad: string): boolean {
  const v = ciudad.toLowerCase().trim();
  if (!v) return false;
  return CIUDADES_FACTURA.some((c) => v.includes(c.toLowerCase()) || c.toLowerCase().includes(v));
}
export const SECTORES_FACTURA = ["Bogota", "Costa Caribe"] as const;
export const TIPOS_OPERACION = ["OPS - Activaciones", "OPS - Retención"] as const;
export type TipoFacturaFijo = (typeof TIPOS_FACTURA_FIJOS)[number];
export type ServicioDeclarado = (typeof SERVICIOS_DECLARADOS)[number];