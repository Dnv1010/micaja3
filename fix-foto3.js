const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

const viejo = `      const sesionGastos2 = getSesionGastos(chatId);
      if (sesionGastos2) {
        sesionGastos2.facturaActual = {
          concepto: datos.descripcion || datos.razon_social || "Por confirmar",
          fecha: datos.fecha_factura || new Date().toLocaleDateString("es-CO"),
          valor: String(Math.max(0, Math.round(datos.monto_factura ?? 0))),
          urlImagen: imagenUrl,
        };
        sesionGastos2.paso = "factura_centro";
        await enviarTelegram(chatId,
          "Factura leida:\\n" +
          "Concepto: <b>" + (datos.descripcion || datos.razon_social || "Por confirmar") + "</b>\\n" +
          "Valor: <b>$" + Math.round(datos.monto_factura ?? 0).toLocaleString("es-CO") + "</b>\\n" +
          "Fecha: <b>" + (datos.fecha_factura || "N/A") + "</b>\\n\\n" +
          "Selecciona <b>Centro de Costos</b>:\\n1 Ops-Activacion\\n2 Ops-Retention"
        );
        return NextResponse.json({ ok: true });
      }`;

const nuevo = `      const sesionGastos2 = getSesionGastos(chatId);
      if (sesionGastos2) {
        await procesarFotoGasto(chatId, datos, imagenUrl);
        return NextResponse.json({ ok: true });
      }`;

if (c.includes(viejo)) {
  c = c.replace(viejo, nuevo);
  fs.writeFileSync(f, c, "utf8");
  console.log("✅ Reemplazado correctamente");
} else {
  // Reemplazar por posicion
  const idx = c.indexOf("const sesionGastos2 = getSesionGastos(chatId);");
  const fin = c.indexOf("return NextResponse.json({ ok: true });\n      }", idx) + "return NextResponse.json({ ok: true });\n      }".length;
  c = c.substring(0, idx) + nuevo + c.substring(fin);
  fs.writeFileSync(f, c, "utf8");
  console.log("✅ Reemplazado por posicion");
}
