const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  'if (texto === "/help" || /^\\/start(\\s|$)/i.test(texto)) {',
  `if (primeraPalabra === "/cancelar") {
    const { deleteSesionGastos } = await import("@/lib/telegram-gastos");
    await deleteSesionGastos(chatId);
    await enviarTelegram(chatId, "✅ Sesion cancelada. Escribe /menu para empezar.");
    return NextResponse.json({ ok: true });
  }
  if (texto === "/help" || /^\\/start(\\s|$)/i.test(texto)) {`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
