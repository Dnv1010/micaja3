const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar guardarGastosEnSheet para hacer una sola llamada
c = c.replace(
  `async function guardarGastosEnSheet(s: any): Promise<void> {
  for (const f of s.facturas) {
    await appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(), s.nombre, s.cargo, s.cc,
      s.ciudad || "", s.motivo || "", s.fechaInicio || "", s.fechaFin || "",
      f.concepto, f.centroCostos, f.nit || "", f.fecha, f.valor, "Aprobada"
    ]);
  }
}`,
  `async function guardarGastosEnSheet(s: any): Promise<void> {
  // Guardar todas las facturas en paralelo para ser mas rapido
  await Promise.all(s.facturas.map((f: any) =>
    appendSheetRow("MICAJA", "Gastos_Generales", [
      new Date().toISOString(), s.nombre, s.cargo, s.cc,
      s.ciudad || "", s.motivo || "", s.fechaInicio || "", s.fechaFin || "",
      f.concepto, f.centroCostos, f.nit || "", f.fecha, f.valor, "Aprobada"
    ])
  ));
}`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
