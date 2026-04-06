const fs = require('fs');
const f = 'app/api/telegram/webhook/route.ts';
let c = fs.readFileSync(f, 'utf8');
const i = c.indexOf('Analiza esta factura colombiana y extrae datos en JSON.');
if (i === -1) { console.log('NO ENCONTRADO'); process.exit(1); }
const end = c.indexOf('"}', i) + 2;
const newPrompt = 'Analiza esta imagen de factura colombiana. Devuelve SOLO JSON, sin texto adicional.\\n\\nLA FACTURA TIENE DOS EMPRESAS:\\nA) VENDEDOR (proveedor): aparece en la parte SUPERIOR de la factura, cerca del logo. Tiene su propio NIT ahi mismo.\\nB) COMPRADOR (cliente): aparece en campos como Senores, Cliente, Facturar a. SIEMPRE es BIA Energy en estas facturas.\\n\\nREGLA ABSOLUTA: Si el nombre que encuentras es BIA ENERGY o contiene BIA ENERGY, eso es el COMPRADOR, no el vendedor. El vendedor es la OTRA empresa.\\nREGLA ABSOLUTA: El NIT del vendedor esta junto a su nombre en la parte superior. Nunca es 901588412 ni 901588413.\\n\\nJSON a retornar:\\n- proveedor: nombre de la empresa VENDEDORA (la que NO es BIA Energy)\\n- nit: NIT de la empresa VENDEDORA (el que esta arriba junto al logo)\\n- numero_factura: numero del documento\\n- fecha: DD/MM/YYYY\\n- valor: monto total en pesos como numero entero\\n- a_nombre_de_bia: true si BIA Energy es el comprador\\n- ciudad: ciudad del vendedor\\n- tipo_factura: Electronica/POS/Equivalente/Talonario/null\\n- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/null\\n- descripcion: concepto del servicio\\n\\nJSON: {\\"proveedor\\":\\"\\",\\"nit\\":\\"\\",\\"numero_factura\\":\\"\\",\\"fecha\\":\\"\\",\\"valor\\":0,\\"a_nombre_de_bia\\":false,\\"ciudad\\":\\"\\",\\"tipo_factura\\":\\"\\",\\"servicio\\":\\"\\",\\"descripcion\\":\\"\\"}';
c = c.slice(0, i) + newPrompt + c.slice(end);
fs.writeFileSync(f, c, 'utf8');
console.log('OK');
