const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  `  await enviarTelegram(chatId,
    "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\\n" +
    "💰 Total: <b>" + formatCOP(total) + "</b>\\n\\n" +
    "✅ Legalizacion completada. Datos en Sheet <b>Gastos_Generales</b>."
  );`,
  `  // Enviar archivo por Telegram
  if (htmlContent) {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
      const formTg = new FormData();
      const blob = new Blob([htmlContent], { type: "text/html" });
      formTg.append("chat_id", chatId);
      formTg.append("document", blob, "Legalizacion_Gastos_" + s.nombre.replace(/\\s+/g, "_") + ".html");
      formTg.append("caption", "📋 Reporte de Gastos\\n💰 Total: " + formatCOP(total));
      await fetch("https://api.telegram.org/bot" + token + "/sendDocument", {
        method: "POST",
        body: formTg,
      });
    } catch(e) { console.error("sendDocument:", e); }
  }

  await enviarTelegram(chatId,
    "📧 Reporte enviado a <b>" + escHtml(correo) + "</b>\\n" +
    "💰 Total: <b>" + formatCOP(total) + "</b>\\n\\n" +
    "✅ Legalizacion completada. Datos en Sheet <b>Gastos_Generales</b>."
  );`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
