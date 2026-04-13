const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `  if (primeraPalabra === "/reporte") {
    const sesionR = await getSesionGastos(chatId);
    if (sesionR) {
      await deleteSesionGastos(chatId);
      await enviarTelegram(chatId, "\\u23f3 Generando reporte...");
      const { enviarReporteDirecto, guardarGastosEnSheetPublic } = await import("@/lib/telegram-gastos");
      await guardarGastosEnSheetPublic(sesionR);
      await enviarReporteDirecto(chatId, sesionR);
    } else {
      await enviarTelegram(chatId, "No hay reporte pendiente. Usa /gastos para crear uno.");
    }
    return NextResponse.json({ ok: true });
  }`,
  `  if (primeraPalabra === "/reporte") {
    const sesionR = await getSesionGastos(chatId);
    if (sesionR) {
      await deleteSesionGastos(chatId);
      await enviarTelegram(chatId, "\\u23f3 Generando reporte...");
      // Generar en background para no bloquear respuesta a Telegram
      (async () => {
        try {
          const { enviarReporteDirecto, guardarGastosEnSheetPublic } = await import("@/lib/telegram-gastos");
          await guardarGastosEnSheetPublic(sesionR);
          await enviarReporteDirecto(chatId, sesionR);
        } catch (e) {
          console.error("Error generando reporte:", e);
          await enviarTelegram(chatId, "\\u274c Error generando el reporte. Intenta de nuevo con /gastos");
        }
      })();
    } else {
      await enviarTelegram(chatId, "No hay reporte pendiente. Usa /gastos para crear uno.");
    }
    return NextResponse.json({ ok: true });
  }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok:", c.includes("background"));
