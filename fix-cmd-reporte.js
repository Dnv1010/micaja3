const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  'if (primeraPalabra === "/cancelar") {',
  `if (primeraPalabra === "/reporte") {
    const sesionR = await getSesionGastos(chatId);
    if (sesionR && sesionR.paso === "listo") {
      await enviarTelegram(chatId, "⏳ Generando reporte...");
      await deleteSesionGastos(chatId);
      const { enviarReporteDirecto } = await import("@/lib/telegram-gastos");
      await guardarGastosEnSheet_webhook(sesionR, chatId);
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
