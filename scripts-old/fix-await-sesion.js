const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `    if (sesionActiva.paso === "mas_facturas" && texto === "2") {
      // Procesar en background sin bloquear
      responsePromise.catch(e => console.error("gastos bg:", e));
      return NextResponse.json({ ok: true });
    }`,
  `    // Siempre esperar para que la sesion se guarde correctamente`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok:", !c.includes("responsePromise.catch"));
