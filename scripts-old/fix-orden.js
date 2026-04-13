const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Mover el bloque de sesion de gastos ANTES del bloque de texto==="2"
const bloqueMenu2 = `  if (texto === "2") {
    const usuarios2m = await getUsuariosFromSheet();
    const u2m = usuarios2m.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    if (u2m) {
      const rol2m = String(u2m.rol || "").toLowerCase();
      if (rol2m === "coordinador" || rol2m === "admin") {
        await iniciarFlujGastos(chatId, u2m);
        return NextResponse.json({ ok: true });
      }
    }
  }`;

const bloqueSesion = `  // Procesar sesion de gastos activa
  const sesionActiva = getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    await procesarMensajeGastos(chatId, texto);
    return NextResponse.json({ ok: true });
  }`;

// Quitar bloque sesion de donde esta
c = c.replace(bloqueSesion, "");

// Insertar sesion ANTES del bloque menu2
c = c.replace(bloqueMenu2, bloqueSesion + "\n\n" + bloqueMenu2);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
