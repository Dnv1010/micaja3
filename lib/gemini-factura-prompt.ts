/**
 * Prompt para extracción de datos de facturas colombianas vía Gemini.
 * Usado por /api/ocr/factura, /api/ia/ocr y el bot Telegram.
 * Devuelve SOLO JSON válido sin markdown.
 */

export const GEMINI_FACTURA_PROMPT_CORE = `Analiza esta factura colombiana y devuelve JSON valido (sin markdown ni backticks).

IMPORTANTE: En una factura hay DOS partes:
1. PROVEEDOR/VENDEDOR: aparece ARRIBA, cerca del logo, con su nombre grande y su NIT. Es quien VENDE.
2. CLIENTE/COMPRADOR: aparece en campos como Senores, Cliente, Facturado a, Razon Social del cliente. En este caso SIEMPRE es BIA Energy.

BIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413) es SIEMPRE el CLIENTE, NUNCA el proveedor.

Campos a extraer (usa cualquier sinonimo/etiqueta que aparezca):
- proveedor: Nombre/razon social del VENDEDOR (arriba con logo, o junto/encima/debajo de su NIT). NUNCA BIA Energy.
- nit: NIT del VENDEDOR. Etiquetas posibles: NIT, NIT., N.I.T., Nit:, RUT, Identificacion. NUNCA 901588412 ni 901588413.
- numero_factura: Numero de factura. Etiquetas: Factura, No., Numero, N°, Nº, Nro, FE, FV, FC, Consecutivo.
- fecha: Fecha de emision. Etiquetas: Fecha, Fecha factura, Fecha emision, Fecha expedicion, Emitida. Formato DD/MM/YYYY.
- valor: TOTAL A PAGAR en pesos enteros. Etiquetas posibles: Total, Total a pagar, Total factura, Total general, Total venta, Gran total, Valor total, Valor a pagar, Neto a pagar, Pago, Pago total, A pagar, Suma total. Si hay varios, elige el MAS GRANDE (nunca Subtotal, Base, IVA, Descuento, Cambio). Puntos y comas son miles: 7.200=7200; 1.234.567=1234567.
- a_nombre_de_bia: true si BIA Energy aparece como cliente.
- ciudad: Ciudad visible.
- tipo_factura: Electronica/POS/Equivalente/Talonario/A Mano/null.
- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/Otro/null.
- descripcion: Concepto. Etiquetas: Concepto, Descripcion, Detalle, Item, Articulo, Producto, Servicio.

JSON: {"proveedor":"","nit":"","numero_factura":"","fecha":"","valor":0,"a_nombre_de_bia":false,"ciudad":"","tipo_factura":"","servicio":"","descripcion":""}`;
