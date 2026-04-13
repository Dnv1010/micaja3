const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar manejo de respuesta "2" al menu antes del procesamiento de sesion
c = c.replace(
  '  // Procesar sesion de gastos activa',
  `  // Respuesta al menu
  const sesionMenu = sesiones ? null : null; // placeholder
  if (texto === "2") {
    const usuarios2m = await getUsuariosFromSheet();
    const u2m = usuarios2m.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    if (u2m) {
      const rol2m = String(u2m.rol || "").toLowerCase();
      if (rol2m === "coordinador" || rol2m === "admin") {
        await iniciarFlujGastos(chatId, u2m);
        return NextResponse.json({ ok: true });
      }
    }
  }

  // Procesar sesion de gastos activa`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
