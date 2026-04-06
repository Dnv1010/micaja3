const fs = require('fs');
const f = 'app/api/telegram/webhook/route.ts';
let c = fs.readFileSync(f, 'utf8');
const i = c.indexOf('Analiza esta factura colombiana y devuelve JSON.');
if (i === -1) { console.log('NO ENCONTRADO'); process.exit(1); }
const end = c.indexOf('"}', i) + 2;
const newPrompt = 'Analiza esta factura colombiana y extrae datos en JSON.\\n\\nREGLAS CRITICAS:\\n1. Factura electronica de venta y similares son TIPOS DE DOCUMENTO, NUNCA el proveedor.\\n2. El PROVEEDOR es la empresa VENDEDORA: nombre cerca del logo, con S.A.S, LTDA o nombre comercial.\\n3. BIA ENERGY S.A.S. ESP (NIT 901588412 o 901588413) es SIEMPRE el CLIENTE, NUNCA el proveedor.\\n4. NIT del proveedor cerca de su nombre. NUNCA retornes 901588412 ni 901588413.\\n5. Si no identificas proveedor o NIT retorna cadena vacia.\\n\\nCampos:\\n- proveedor: Razon social del VENDEDOR. Nunca BIA Energy ni tipo de documento.\\n- nit: NIT del VENDEDOR. Nunca NIT de BIA.\\n- numero_factura: Numero (FE, FV, FEHU, No., #).\\n- fecha: DD/MM/YYYY\\n- valor: Total en pesos entero. 41.000=41000.\\n- a_nombre_de_bia: true si BIA aparece como cliente.\\n- ciudad: Ciudad visible.\\n- tipo_factura: Electronica/POS/Equivalente/Talonario/null\\n- servicio: Parqueadero/Peajes/Gasolina/Alimentacion/Hospedaje/Transporte/Lavadero/Llantera/Papeleria/Pago a proveedores/null\\n- descripcion: Concepto.\\n\\nJSON: {\\"proveedor\\":\\"\\",\\"nit\\":\\"\\",\\"numero_factura\\":\\"\\",\\"fecha\\":\\"\\",\\"valor\\":0,\\"a_nombre_de_bia\\":false,\\"ciudad\\":\\"\\",\\"tipo_factura\\":\\"\\",\\"servicio\\":\\"\\",\\"descripcion\\":\\"\\"}';
c = c.slice(0, i) + newPrompt + c.slice(end);
fs.writeFileSync(f, c, 'utf8');
console.log('OK');
