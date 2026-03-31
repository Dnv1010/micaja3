export type RolUsuario = "admin" | "user" | "coordinador" | "verificador";

export interface UsuarioRow {
  _rowIndex: number;
  Responsable: string;
  Correos: string;
  Telefono: string;
  Rol: string;
  UserActive: string;
  Area: string;
  Cargo: string;
  Cedula: string;
  Sector: string;
  /** PIN de 4 dígitos en Sheet; si está vacío, solo login con Google. */
  PIN?: string;
}

/**
 * Fila de hoja (encabezados variables). Usar `getCellCaseInsensitive` vía `lib/row-fields.ts`.
 */
export type FacturaRow = {
  _rowIndex: number;
  ID?: string;
  Fecha?: string;
  Proveedor?: string;
  NIT?: string;
  Concepto?: string;
  Valor?: string;
  TipoFactura?: string;
  ServicioDeclarado?: string;
  TipoOperacion?: string;
  ANombreBia?: string;
  Ciudad?: string;
  Responsable?: string;
  Area?: string;
  Sector?: string;
  Estado?: string;
  ImagenURL?: string;
  DriveFileId?: string;
  FechaCreacion?: string;
  EntregaID?: string;
  /** Campos legado frecuentes en hojas actuales */
  ID_Factura?: string;
  Num_Factura?: string;
  Fecha_Factura?: string;
  Monto_Factura?: string;
  Tipo_Factura?: string;
  Tipo_servicio?: string;
  Nit_Factura?: string;
  Razon_Social?: string;
  Nombre_bia?: string;
  Observacion?: string;
  Adjuntar_Factura?: string;
  URL?: string;
  Legalizado?: string;
  Verificado?: string;
  "Centro de Costo"?: string;
  InfoCentroCosto?: string;
  [key: string]: string | number | undefined;
};

export type EntregaRow = {
  _rowIndex: number;
  ID?: string;
  Fecha?: string;
  Responsable?: string;
  Area?: string;
  Sector?: string;
  Monto?: string;
  Estado?: string;
  ID_Entrega?: string;
  Fecha_Entrega?: string;
  ID_Envio?: string;
  Monto_Entregado?: string;
  Saldo_Total_Entregado?: string;
  Aceptar?: string;
  Firma?: string;
  Identificacion?: string;
  Comprobante?: string;
  Observaciones?: string;
  [key: string]: string | number | undefined;
};

export type LegalizacionRow = {
  _rowIndex: number;
  ID?: string;
  Fecha?: string;
  Coordinador?: string;
  Zona?: string;
  Periodo?: string;
  TotalAprobado?: string;
  FacturasIds?: string;
  FirmaCoordinador?: string;
  PdfBase64?: string;
  PdfURL?: string;
  DatosPdfJSON?: string;
  Responsable?: string;
  Area?: string;
  Sector?: string;
  Total?: string;
  Estado?: string;
  AprobadoPor?: string;
  ID_Legalización?: string;
  Fecha_Legalización?: string;
  ID_Factura?: string;
  Total_Legalizado?: string;
  Monto_Total?: string;
  Total_Caja?: string;
  _ComputedKey?: string;
  [key: string]: string | number | undefined;
};

export type BalanceRow = {
  _rowIndex: number;
  Fecha?: string;
  Concepto?: string;
  Entrada?: string;
  Salida?: string;
  Saldo?: string;
  [key: string]: string | number | undefined;
};

export type EnvioRow = {
  _rowIndex: number;
  IDEnvio?: string;
  Fecha?: string;
  Monto?: string;
  Responsable?: string;
  Comprobante?: string;
  Telefono?: string;
  Sector?: string;
  Estado?: string;
  [key: string]: string | number | undefined;
};

export interface SessionUserContext {
  email: string;
  rol: string;
  responsable: string;
  area: string;
  sector: string;
}
