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

export interface EntregaRow {
  _rowIndex: number;
  ID_Entrega: string;
  Fecha_Entrega: string;
  ID_Envio: string;
  Responsable: string;
  Monto_Entregado: string;
  Saldo_Total_Entregado: string;
  Aceptar: string;
  Firma: string;
  Identificacion: string;
  Comprobante: string;
}

export interface FacturaRow {
  _rowIndex: number;
  ID_Factura: string;
  Num_Factura: string;
  Fecha_Factura: string;
  Monto_Factura: string;
  Responsable: string;
  Tipo_servicio: string;
  Tipo_Factura: string;
  Nit_Factura: string;
  Razon_Social: string;
  Nombre_bia: string;
  Observacion: string;
  Adjuntar_Factura: string;
  URL: string;
  Legalizado: string;
  Verificado: string;
  Ciudad: string;
  Sector: string;
  "Centro de Costo": string;
  InfoCentroCosto: string;
}

export interface LegalizacionRow {
  _rowIndex: number;
  ID_Legalización: string;
  Fecha_Legalización: string;
  ID_Factura: string;
  Total_Legalizado: string;
  Monto_Total: string;
  Total_Caja: string;
  Responsable: string;
  _ComputedKey?: string;
}

export interface EnvioRow {
  _rowIndex: number;
  IDEnvio: string;
  Fecha: string;
  Monto: string;
  Responsable: string;
  Comprobante: string;
  Telefono: string;
}

export interface SessionUserContext {
  email: string;
  rol: string;
  responsable: string;
  area: string;
  sector: string;
}
