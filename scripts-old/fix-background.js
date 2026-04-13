const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// En el paso mas_facturas, responder inmediatamente y procesar despues
c = c.replace(
  `  const sesionActiva = await getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    await procesarMensajeGastos(chatId, texto);
    return NextResponse.json({ ok: true });
  }`,
  `  const sesionActiva = await getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    // Responder inmediatamente a Telegram para evitar reintentos
    const responsePromise = procesarMensajeGastos(chatId, texto);
    if (sesionActiva.paso === "mas_facturas" && texto === "2") {
      // Procesar en background sin bloquear
      responsePromise.catch(e => console.error("gastos bg:", e));
      return NextResponse.json({ ok: true });
    }
    await responsePromise;
    return NextResponse.json({ ok: true });
  }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
