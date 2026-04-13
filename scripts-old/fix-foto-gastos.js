const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar manejo de foto en sesion de gastos
c = c.replace(
  '  const esImagenDoc =\n    documento?.mime_type?.startsWith("image/") && documento.file_id;\n  if (foto?.length || esImagenDoc) {',
  `  const esImagenDoc =
    documento?.mime_type?.startsWith("image/") && documento.file_id;

  // Si hay sesion de gastos activa y llega foto, procesarla para gastos
  const sesionGastosActiva = getSesionGastos(chatId);
  if ((foto?.length || esImagenDoc) && sesionGastosActiva && 
      (sesionGastosActiva.paso === "factura_concepto" || sesionGastosActiva.paso === "fecha_fin")) {
    await enviarTelegram(chatId, "📸 Analizando factura con IA...");
    // Continuar con el flujo normal de OCR pero guardar en sesion de gastos
    sesionGastosActiva.paso = "procesando_foto_gasto";
  }

  if (foto?.length || esImagenDoc) {`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
