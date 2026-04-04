const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Quitar el bloque completo de u0
c = c.replace(
  `  // Procesar sesion de gastos activa
  const sesionActiva = getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    const usuarios0 = await getUsuariosFromSheet();
    // u0 no usado
    await procesarMensajeGastos(chatId, texto);
    return NextResponse.json({ ok: true });
  }`,
  `  // Procesar sesion de gastos activa
  const sesionActiva = getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    await procesarMensajeGastos(chatId, texto);
    return NextResponse.json({ ok: true });
  }`
);

fs.writeFileSync(f, c, "utf8");
console.log("✅ Listo");
