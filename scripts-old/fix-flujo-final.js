const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

// Cuando usuario escribe 2 en mas_facturas: solo guardar paso y responder rapido
c = c.replace(
  `  } else if (s.paso === "mas_facturas" && texto === "2") {
    await borrarSesion(chatId);
    await enviarTelegram(chatId, "⏳ Generando reporte...");
    await guardarGastosEnSheet(s);
    await enviarReporteDirecto(chatId, s);
  }`,
  `  } else if (s.paso === "mas_facturas") {
    if (texto === "1") {
      s.paso = "esperando_foto"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "📸 Sube la foto de la Factura #" + (s.facturas.length + 1) + ":");
    } else {
      s.paso = "listo"; await guardarSesion(chatId, s);
      await enviarTelegram(chatId, "✅ Facturas registradas.\\n\\nEscribe <code>/reporte</code> para generar y recibir el PDF aqui.");
    }
  }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
