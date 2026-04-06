const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar el prompt de Gemini con uno mas claro
c = c.replace(
  /text: "Eres un analista contable experto procesando facturas colombianas[\s\S]*?descripcion\\":\\"\\"}"[\s\S]*?\}/,
  `text: "Analiza esta factura colombiana y devuelve JSON.\\n\\nIMPORTANTE: En una factura hay DOS partes:\\n1. PROVEEDOR/VENDEDOR: aparece ARRIBA, cerca del logo, con su nombre grande y su NIT. Es quien VENDE.\\n2. CLIENTE/COMPRADOR: aparece en campos como Senores, Cliente, Razon Social del cliente. En este caso SIEMPRE es BIA Energy.\\n\\nBIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413) es SIEMPRE el CLIENTE, NUNCA el proveedor.\\n\\nCampos:\\n- proveedor: Nombre/razon social del VENDEDOR (arriba, logo). NUNCA BIA Energy.\\n- nit: NIT del VENDEDOR (cerca de su nombre arriba). NUNCA 901588412 ni 901588413.\\n- numero_factura: Numero de factura (FE, FV, Venta, No., N).\\n- fecha: DD/MM/YYYY\\n- valor: Total a pagar en pesos enteros. Puntos y comas son miles (7.200=7200).\\n- a_nombre_de_bia: true si BIA Energy aparece como cliente.\\n- ciudad: Ciudad visible.\\n- tipo_factura: Electronica/POS/Equivalente/Talonario/null\\n- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/null\\n- descripcion: Concepto.\\n\\nJSON: {\\"proveedor\\":\\"\\",\\"nit\\":\\"\\",\\"numero_factura\\":\\"\\",\\"fecha\\":\\"\\",\\"valor\\":0,\\"a_nombre_de_bia\\":false,\\"ciudad\\":\\"\\",\\"tipo_factura\\":\\"\\",\\"servicio\\":\\"\\",\\"descripcion\\":\\"\\"}" }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok:", c.includes("SIEMPRE es BIA Energy"));
console.log("ok:", c.includes("NUNCA BIA Energy"));
