const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar ruta especial para /reporte que lee la sesion con paso listo
c = c.replace(
  'if (primeraPalabra === "/cancelar") {',
  `if (primeraPalabra === "/reporte") {
    const sesionR = await getSesionGastos(chatId);
    if (sesionR) {
      await deleteSesionGastos(chatId);
      await enviarTelegram(chatId, "⏳ Generando reporte...");
      const { enviarReporteDirecto, guardarGastosEnSheetPublic } = await import("@/lib/telegram-gastos");
      await guardarGastosEnSheetPublic(sesionR);
      await enviarReporteDirecto(chatId, sesionR);
    } else {
      await enviarTelegram(chatId, "No hay reporte pendiente. Usa /gastos para crear uno.");
    }
    return NextResponse.json({ ok: true });
  }
  if (primeraPalabra === "/cancelar") {`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
