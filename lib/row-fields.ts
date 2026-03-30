import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { BalanceRow, EntregaRow, EnvioRow, FacturaRow, LegalizacionRow } from "@/types/models";

function cell(row: Record<string, unknown>, ...aliases: string[]): string {
  return getCellCaseInsensitive(row, ...aliases);
}

/** Facturas — nombres nuevos y legado de la hoja */
export function facturaRowId(f: FacturaRow): string {
  const r = f as unknown as Record<string, unknown>;
  return (
    cell(r, "ID_Factura", "ID") ||
    cell(r, "Num_Factura", "Num Factura") ||
    `row-${f._rowIndex}`
  );
}

export function facturaFecha(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Fecha", "Fecha_Factura", "FECHA");
}

export function facturaProveedor(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Proveedor", "Razon_Social", "Razón Social", "Nombre_bia");
}

export function facturaNit(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "NIT", "Nit_Factura", "Nit Factura");
}

export function facturaConcepto(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Concepto", "Observacion", "Tipo_servicio", "Tipo servicio");
}

export function facturaValor(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Valor", "Monto_Factura", "Monto Factura");
}

export function facturaTipo(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "TipoFactura", "Tipo_Factura", "Tipo de Factura", "Tipo Factura");
}

export function facturaEstado(f: FacturaRow): string {
  const e = cell(f as unknown as Record<string, unknown>, "Estado", "Legalizado", "LEGALIZADO");
  return e || cell(f as unknown as Record<string, unknown>, "Legalizado");
}

export function facturaResponsable(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Responsable", "RESPONSABLE");
}

export function facturaArea(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Area", "Área");
}

export function facturaSector(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Sector", "SECTOR");
}

export function facturaImagenUrl(f: FacturaRow): string {
  return cell(
    f as unknown as Record<string, unknown>,
    "ImagenURL",
    "Adjuntar_Factura",
    "URL",
    "Adjuntar Factura"
  );
}

export function facturaVerificado(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Verificado", "VERIFICADO");
}

export function facturaNumero(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Num_Factura", "Num Factura", "Número");
}

export function facturaEntregaId(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "EntregaID", "ID_Entrega", "ID Entrega");
}

export function facturaCentroCosto(f: FacturaRow): string {
  return cell(f as unknown as Record<string, unknown>, "Centro de Costo", "CentroCosto");
}

/** Entregas */
export function entregaRowId(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "ID_Entrega", "ID", "ID Entrega") || `row-${e._rowIndex}`;
}

export function entregaFecha(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "Fecha_Entrega", "Fecha", "FECHA");
}

export function entregaResponsable(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "Responsable", "RESPONSABLE");
}

export function entregaMonto(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "Monto_Entregado", "Monto", "MONTO");
}

export function entregaEstado(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "Estado", "Aceptar", "ACEPTAR");
}

export function entregaSector(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "Sector", "SECTOR");
}

export function entregaIdEnvio(e: EntregaRow): string {
  return cell(e as unknown as Record<string, unknown>, "ID_Envio", "ID Envio");
}

/** Legalizaciones */
export function legalizacionRowId(l: LegalizacionRow): string {
  return (
    cell(l as unknown as Record<string, unknown>, "ID_Legalización", "ID_Legalizacion", "ID", "ID Legalización") ||
    `row-${l._rowIndex}`
  );
}

export function legalizacionFecha(l: LegalizacionRow): string {
  return cell(l as unknown as Record<string, unknown>, "Fecha_Legalización", "Fecha_Legalizacion", "Fecha", "FECHA");
}

export function legalizacionResponsable(l: LegalizacionRow): string {
  return cell(l as unknown as Record<string, unknown>, "Responsable", "RESPONSABLE");
}

export function legalizacionTotal(l: LegalizacionRow): string {
  return cell(
    l as unknown as Record<string, unknown>,
    "Total_Legalizado",
    "Total",
    "Monto_Total",
    "Monto Total"
  );
}

export function legalizacionEstado(l: LegalizacionRow): string {
  return cell(l as unknown as Record<string, unknown>, "Estado", "ESTADO");
}

export function legalizacionAprobadoPor(l: LegalizacionRow): string {
  return cell(l as unknown as Record<string, unknown>, "AprobadoPor", "Aprobado Por", "Aprobado");
}

export function legalizacionIdFactura(l: LegalizacionRow): string {
  return cell(l as unknown as Record<string, unknown>, "ID_Factura", "ID Factura");
}

/** Envíos */
export function envioRowId(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "IDEnvio", "ID_Envio", "ID") || `row-${e._rowIndex}`;
}

export function envioFecha(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "Fecha", "FECHA");
}

export function envioResponsable(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "Responsable", "RESPONSABLE");
}

export function envioMonto(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "Monto", "MONTO");
}

export function envioEstado(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "Estado", "ESTADO");
}

export function envioSector(e: EnvioRow): string {
  return cell(e as unknown as Record<string, unknown>, "Sector", "SECTOR");
}

/** Balance (pestaña Balance) */
export function balanceFecha(b: BalanceRow): string {
  return cell(b as unknown as Record<string, unknown>, "Fecha", "FECHA");
}

export function balanceConcepto(b: BalanceRow): string {
  return cell(b as unknown as Record<string, unknown>, "Concepto", "CONCEPTO");
}

export function balanceEntrada(b: BalanceRow): string {
  return cell(b as unknown as Record<string, unknown>, "Entrada", "ENTRADA", "Ingreso");
}

export function balanceSalida(b: BalanceRow): string {
  return cell(b as unknown as Record<string, unknown>, "Salida", "SALIDA", "Egreso");
}

export function balanceSaldo(b: BalanceRow): string {
  return cell(b as unknown as Record<string, unknown>, "Saldo", "SALDO");
}
