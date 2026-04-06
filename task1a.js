const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("parseGeminiJson")) {
  c += `

/** Convierte el JSON de Gemini al tipo FacturaData. Lanza error si el JSON no es valido. */
export function parseGeminiJson(raw: string): FacturaData {
  const obj = JSON.parse(raw);
  const valorRaw = obj.valor;
  let monto = 0;
  if (typeof valorRaw === "number") {
    monto = valorRaw;
  } else if (typeof valorRaw === "string") {
    let s = String(valorRaw).trim();
    s = s.replace(/[.,]\\d{1,2}$/, "");
    s = s.replace(/[.,]/g, "");
    monto = parseInt(s, 10) || 0;
  }
  return {
    num_factura: obj.numero_factura || null,
    fecha_factura: obj.fecha || null,
    monto_factura: monto > 0 ? monto : null,
    nit_factura: obj.nit || null,
    razon_social: obj.proveedor || null,
    nombre_bia: Boolean(obj.a_nombre_de_bia),
    ciudad: obj.ciudad || null,
    descripcion: obj.descripcion || null,
    tipo_factura: obj.tipo_factura || null,
    servicio_declarado: obj.servicio || null,
  };
}
`;
  fs.writeFileSync(f, c, "utf8");
  console.log("parseGeminiJson agregado");
} else {
  console.log("ya existe parseGeminiJson");
}
