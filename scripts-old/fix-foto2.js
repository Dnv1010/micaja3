const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar el bloque viejo por llamada a procesarFotoGasto
c = c.replace(
  `      // Si hay sesion de gastos activa, guardar en gastos en vez de caja menor
      const sesionGastos2 = getSesionGastos(chatId);
      if (sesionGastos2) {
        sesionGastos2.facturaActual = {
          concepto: datos.descripcion || datos.razon_social || "",
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
      }`,
  `      // Si hay sesion de gastos activa, usar procesarFotoGasto
      const sesionGastos2 = getSesionGastos(chatId);
      if (sesionGastos2) {
        await procesarFotoGasto(chatId, datos, imagenUrl);
        return NextResponse.json({ ok: true });
      }`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
