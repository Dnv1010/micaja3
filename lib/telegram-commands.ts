import { loadMicajaBalancesByResponsable } from "@/lib/balance-micaja";
import { etiquetaZona, limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP } from "@/lib/format";
import { enviarTelegram, escHtml } from "@/lib/notificaciones";
import { getUsuariosFromSheet, type UsuarioSheet } from "@/lib/usuarios-sheet";

function findUsuarioPorChatId(usuarios: UsuarioSheet[], chatId: string): UsuarioSheet | undefined {
  const id = String(chatId).trim();
  return usuarios.find((u) => String(u.telegram_chat_id || "").trim() === id);
}

function balanceEntryForNombre(
  map: Map<string, { recibido: number; gastado: number }>,
  nombre: string
): { recibido: number; gastado: number } {
  const n = nombre.trim();
  if (!n) return { recibido: 0, gastado: 0 };
  const direct = map.get(n);
  if (direct) return direct;
  const lower = n.toLowerCase();
  for (const [k, v] of Array.from(map.entries())) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return { recibido: 0, gastado: 0 };
}

/** /saldo — balance personal (misma lógica que balance-micaja). */
export async function handleComandoSaldo(chatId: string): Promise<void> {
  const usuarios = await getUsuariosFromSheet();
  const usuario = findUsuarioPorChatId(usuarios, chatId);

  if (!usuario) {
    await enviarTelegram(
      chatId,
      [
        "❌ No estás registrado en MiCaja.",
        "",
        "Escribe:",
        "<code>/registro TuNombreCompleto</code>",
        "",
        "Ejemplo: <code>/registro Carlos Salas</code>",
      ].join("\n")
    );
    return;
  }

  const map = await loadMicajaBalancesByResponsable();
  const nombre = usuario.responsable.trim();
  const { recibido: totalEntregado, gastado: totalFacturado } = balanceEntryForNombre(map, nombre);

  const porReportar = totalEntregado - totalFacturado;
  const limite = limiteAprobacionZona(usuario.sector);
  const enCaja = limite - totalEntregado;
  const pctEntregado = limite > 0 ? Math.round((totalEntregado / limite) * 100) : 0;
  const pctFacturado = limite > 0 ? Math.round((totalFacturado / limite) * 100) : 0;

  const base = etiquetaZona(usuario.sector);
  const zonaLabel =
    usuario.sector === "Costa Caribe" ? `${escHtml(base)} 🌊` : `${escHtml(base)} 🏙️`;

  let balanceMsg = "";
  if (porReportar > 0) {
    balanceMsg = `⚠️ Tienes <b>${escHtml(formatCOP(porReportar))}</b> sin facturar`;
  } else if (porReportar < 0) {
    balanceMsg = `✅ La empresa te debe <b>${escHtml(formatCOP(Math.abs(porReportar)))}</b>`;
  } else {
    balanceMsg = "✅ Estás al día";
  }

  const mensaje = [
    "💰 <b>Tu saldo en MiCaja</b>",
    `👤 ${escHtml(nombre)} — ${zonaLabel}`,
    "",
    `📦 <b>Entregado:</b> ${escHtml(formatCOP(totalEntregado))} (${pctEntregado}% del límite)`,
    `🧾 <b>Facturado:</b> ${escHtml(formatCOP(totalFacturado))} (${pctFacturado}% del límite)`,
    `📊 <b>Por reportar:</b> ${escHtml(formatCOP(Math.max(0, porReportar)))}`,
    `🏦 <b>Sin entregar aún:</b> ${escHtml(formatCOP(Math.max(0, enCaja)))}`,
    "",
    balanceMsg,
    "",
    `<i>Límite de zona: ${escHtml(formatCOP(limite))}</i>`,
  ].join("\n");

  await enviarTelegram(chatId, mensaje);
}

function esCoordinadorOAdmin(u: UsuarioSheet): boolean {
  const r = String(u.rol || "").toLowerCase();
  return r === "coordinador" || r === "admin";
}

/** /equipo — resumen de zona (solo coordinador o admin). */
export async function handleComandoEquipo(chatId: string): Promise<void> {
  const usuarios = await getUsuariosFromSheet();
  const coordinador = findUsuarioPorChatId(usuarios, chatId);

  if (!coordinador) {
    await enviarTelegram(
      chatId,
      [
        "❌ No estás registrado en MiCaja.",
        "",
        "Escribe:",
        "<code>/registro TuNombreCompleto</code>",
      ].join("\n")
    );
    return;
  }

  if (!esCoordinadorOAdmin(coordinador)) {
    await enviarTelegram(
      chatId,
      [
        "❌ Este comando es solo para coordinadores.",
        "",
        "Usa <code>/saldo</code> para ver tu saldo personal.",
      ].join("\n")
    );
    return;
  }

  const zona = coordinador.sector;
  const tecnicos = usuarios
    .filter(
      (u) =>
        u.userActive &&
        u.rol === "user" &&
        u.sector === zona
    )
    .sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));

  const balanceMap = await loadMicajaBalancesByResponsable({ sectorRaw: zona });

  const limite = limiteAprobacionZona(zona);
  const base = etiquetaZona(zona);
  const zonaLabel = zona === "Costa Caribe" ? `${escHtml(base)} 🌊` : `${escHtml(base)} 🏙️`;

  let totalEntregadoZona = 0;
  let totalFacturadoZona = 0;
  const lineas: string[] = [];

  for (const tec of tecnicos) {
    const nombre = tec.responsable.trim();
    const { recibido: entregado, gastado: facturado } = balanceEntryForNombre(balanceMap, nombre);
    totalEntregadoZona += entregado;
    totalFacturadoZona += facturado;

    const porReportar = entregado - facturado;
    const icon = porReportar > 0 ? "⚠️" : porReportar < 0 ? "🔵" : "✅";
    const estado =
      porReportar > 0
        ? `por reportar: ${escHtml(formatCOP(porReportar))}`
        : porReportar < 0
          ? `empresa le debe: ${escHtml(formatCOP(Math.abs(porReportar)))}`
          : "al día";

    lineas.push(
      `${icon} <b>${escHtml(nombre)}</b>\n   Entregado: ${escHtml(formatCOP(entregado))} | Facturado: ${escHtml(formatCOP(facturado))}\n   ${estado}`
    );
  }

  const porReportarZona = totalEntregadoZona - totalFacturadoZona;
  const enCajaZona = limite - totalEntregadoZona;
  const pctEntregado = limite > 0 ? Math.round((totalEntregadoZona / limite) * 100) : 0;
  const pctFacturado = limite > 0 ? Math.round((totalFacturadoZona / limite) * 100) : 0;

  const detalle = lineas.length ? lineas.join("\n\n") : "<i>No hay técnicos activos en esta zona.</i>";

  const mensaje = [
    `📊 <b>Equipo ${zonaLabel}</b>`,
    `Límite: ${escHtml(formatCOP(limite))}`,
    "",
    `📦 Entregado: ${escHtml(formatCOP(totalEntregadoZona))} (${pctEntregado}%)`,
    `🧾 Facturado: ${escHtml(formatCOP(totalFacturadoZona))} (${pctFacturado}%)`,
    `⚠️ Por reportar: ${escHtml(formatCOP(Math.max(0, porReportarZona)))}`,
    `🏦 En caja: ${escHtml(formatCOP(Math.max(0, enCajaZona)))}`,
    "",
    "<b>Detalle por técnico:</b>",
    detalle,
  ].join("\n");

  await enviarTelegram(chatId, mensaje);
}

export async function handleComandoStartHelp(chatId: string): Promise<void> {
  await enviarTelegram(
    chatId,
    [
      "👋 Hola, soy el bot de <b>MiCaja BIA Energy</b>.",
      "",
      "<b>Comandos disponibles:</b>",
      "<code>/registro TuNombre</code> — Regístrate para recibir notificaciones",
      "<code>/saldo</code> — Consulta tu balance personal",
      "<code>/equipo</code> — Ver saldo de todos tus técnicos (solo coordinadores)",
      "",
      "Para registrarte escribe:",
      "<code>/registro Carlos Salas</code>",
    ].join("\n")
  );
}
