const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
let c = fs.readFileSync(f, "utf8");

// Agregar imports
c = c.replace(
  'import {\n  handleComandoEquipo,\n  handleComandoSaldo,\n  handleComandoStartHelp,\n} from "@/lib/telegram-commands";',
  'import {\n  handleComandoEquipo,\n  handleComandoSaldo,\n  handleComandoStartHelp,\n} from "@/lib/telegram-commands";\nimport { iniciarFlujGastos, procesarMensajeGastos, getSesionGastos } from "@/lib/telegram-gastos";'
);

// Agregar comando /menu antes del comando /saldo
c = c.replace(
  'if (primeraPalabra === "/saldo" || primeraPalabra === "/mi_saldo") {',
  `if (primeraPalabra === "/menu") {
    await enviarTelegram(chatId, "👋 <b>MiCaja BIA Energy</b>\\n\\n¿Qué deseas hacer?\\n\\n1️⃣ <code>/cajamenor</code> — Caja Menor\\n2️⃣ <code>/gastos</code> — Gastos Generales\\n3️⃣ <code>/saldo</code> — Ver mi saldo\\n4️⃣ <code>/equipo</code> — Ver equipo (coordinadores)");
    return NextResponse.json({ ok: true });
  }
  if (primeraPalabra === "/gastos") {
    const usuarios2 = await getUsuariosFromSheet();
    const u2 = usuarios2.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    if (!u2) { await enviarTelegram(chatId, "❌ No estás registrado. Escribe /registro TuNombre"); return NextResponse.json({ ok: true }); }
    const rol2 = String(u2.rol || "").toLowerCase();
    if (rol2 !== "coordinador" && rol2 !== "admin") { await enviarTelegram(chatId, "❌ Solo coordinadores y administradores pueden usar Gastos Generales."); return NextResponse.json({ ok: true }); }
    await iniciarFlujGastos(chatId, u2);
    return NextResponse.json({ ok: true });
  }
  if (primeraPalabra === "/saldo" || primeraPalabra === "/mi_saldo") {`
);

// Agregar procesamiento de sesión de gastos antes del procesamiento de fotos
c = c.replace(
  '  const usuarios = await getUsuariosFromSheet();',
  `  // Procesar sesion de gastos activa
  const sesionActiva = getSesionGastos(chatId);
  if (sesionActiva && texto && !texto.startsWith("/")) {
    const usuarios0 = await getUsuariosFromSheet();
    const u0 = usuarios0.find((u) => String(u.telegram_chat_id || "").trim() === chatId);
    await procesarMensajeGastos(chatId, texto, u0);
    return NextResponse.json({ ok: true });
  }

  const usuarios = await getUsuariosFromSheet();`
);

fs.writeFileSync(f, c, "utf8");
console.log("✅ webhook actualizado");
