const fs = require('fs');
const content = [
'import { redirect } from "next/navigation";',
'import { getServerSession } from "next-auth";',
'import { authOptions } from "@/lib/auth-options";',
'import { GastosGeneralesClient } from "@/components/coordinador/gastos-generales-client";',
'import { getUsuariosFromSheet } from "@/lib/usuarios-sheet";',
'export default async function GastosPage() {',
'  const session = await getServerSession(authOptions);',
'  if (!session?.user?.email) redirect("/login");',
'  const rol = String(session.user.rol || "user").toLowerCase();',
'  if (rol !== "coordinador" && rol !== "admin") redirect("/");',
'  const sector = String(session.user.sector || "");',
'  const responsable = String(session.user?.responsable || session.user?.name || "").trim();',
'  const usuarios = await getUsuariosFromSheet();',
'  const u = usuarios.find((u) => u.email === session.user.email);',
'  const chatId = u?.telegram_chat_id || "";',
'  return <GastosGeneralesClient sector={sector} responsable={responsable} rol={rol} chatId={chatId} />;',
'}',
].join('\n');
fs.writeFileSync('app/(dashboard)/gastos/page.tsx', content, 'utf8');
console.log('OK');
