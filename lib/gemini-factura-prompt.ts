/**
 * Prompt maestro para extracción de datos de facturas colombianas vía Gemini.
 * Centralizado para que los 3 flujos (app, bot telegram, gastos) usen el mismo criterio.
 *
 * El modelo debe devolver SOLO JSON válido (sin markdown). Los campos son los que
 * consume `parseGeminiJson` / los endpoints OCR. `nombre_bia=true` sólo cuando el
 * NIT de BIA (901.588.412 o 901.588.413) aparece como cliente/receptor.
 */

export const GEMINI_FACTURA_PROMPT_CORE = `Analiza esta factura colombiana y devuelve SOLO JSON válido (sin markdown ni backticks).

ROLES EN LA FACTURA (crítico, no confundirlos):
- PROVEEDOR / VENDEDOR: quien vende. Aparece ARRIBA, con logo, nombre grande y SU NIT propio. Lo que buscamos.
- CLIENTE / COMPRADOR / RECEPTOR: quien compra. Aparece en "Señores", "Cliente", "Razón Social Cliente", "Facturado a", "Cliente:". En este caso SIEMPRE es BIA Energy.

BIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413 o 901.588.413-2) es SIEMPRE el CLIENTE, NUNCA el proveedor. NO uses ese NIT ni ese nombre como proveedor.

CÓMO LEER LOS CAMPOS (usa cualquier sinónimo/etiqueta):

1. PROVEEDOR (razon_social):
   - Nombre de la empresa/persona que VENDE. Suele estar al tope, junto o encima del logo.
   - También aparece AL LADO (arriba, abajo, derecha, izquierda) del NIT del proveedor.
   - NO confundir con BIA Energy ni con "Cliente"/"Facturado a".

2. NIT del proveedor (nit_factura):
   - Busca etiquetas: "NIT", "NIT.", "N.I.T.", "Nit:", "Nit.", "RUT", "Identificación".
   - IGNORA si es 901588412 o 901588413 (esos son de BIA, se usa para nombre_bia).
   - Formato de salida: "000.000.000-0" (con puntos y guión) o "900123456" si no hay dígito de verificación.

3. NÚMERO de factura (num_factura):
   - Busca: "Factura", "Factura No.", "No.", "Número", "N°", "Nº", "Nro", "FE", "FV", "FC", "Numero Factura", "Consecutivo".
   - Valor: alfanumérico (ej: "FE-12345", "FV001", "1234567").

4. FECHA (fecha_factura):
   - Busca: "Fecha", "Fecha factura", "Fecha emisión", "Fecha expedición", "Emitida", "Fecha de venta".
   - IGNORA "Fecha vencimiento" o "Fecha entrega" si hay fecha de emisión disponible.
   - Formato salida: "DD/MM/YYYY".

5. VALOR TOTAL (monto_factura):
   - Es el MAYOR de los valores numéricos: busca "Total", "Total a pagar", "Valor total", "Gran total", "Neto a pagar", "Pago", "Valor a pagar", "Total general", "Total factura", "Suma total".
   - NO confundir con "Subtotal", "Base gravable", "IVA", "Descuento" (esos son parciales).
   - Entero en pesos colombianos. Ignora separadores: 7.200 = 7200; 1.234.567 = 1234567.

6. DESCRIPCIÓN / CONCEPTO (descripcion):
   - Busca: "Concepto", "Descripción", "Detalle", "Detalle producto", "Item", "Ítem", "Producto/Servicio", "Servicio", "Artículo".
   - Si hay varios items, pon el principal o un resumen corto. Máx 100 caracteres.

7. CIUDAD:
   - Aparece en dirección del proveedor o en "Ciudad:", "Ciudad expedición".

8. NOMBRE_BIA (nombre_bia):
   - true si el NIT de BIA (901588412 o 901588413) aparece como cliente/receptor.
   - false en cualquier otro caso.

9. TIPO_FACTURA: una de: "Electrónica", "POS", "Equivalente", "Talonario", "A Mano", o null.

10. SERVICIO_DECLARADO: una de: "Parqueadero", "Peajes", "Gasolina", "Alimentación", "Hospedaje", "Transporte", "Lavadero", "Llantera", "Papelería", "Pago a proveedores", "Otro", o null.

FORMATO DE SALIDA (EXACTAMENTE estos campos, en este orden, sin añadir otros):
{"fecha_factura":"DD/MM/YYYY o null","razon_social":"nombre proveedor o null","nit_factura":"NIT proveedor o null","num_factura":"numero o null","descripcion":"concepto o null","monto_factura":numero o null,"nombre_bia":true o false,"ciudad":"ciudad o null","tipo_factura":"tipo o null","servicio_declarado":"servicio o null"}`;
