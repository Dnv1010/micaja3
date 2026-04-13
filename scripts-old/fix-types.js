const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  "const sesiones = new Map();",
  "const sesiones = new Map<string, any>();"
);
c = c.replace(
  "export function getSesionGastos(chatId) {",
  "export function getSesionGastos(chatId: string) {"
);
c = c.replace(
  "export function setSesionGastos(chatId, data) {",
  "export function setSesionGastos(chatId: string, data: any) {"
);
c = c.replace(
  "export function deleteSesionGastos(chatId) {",
  "export function deleteSesionGastos(chatId: string) {"
);
c = c.replace(
  "export async function iniciarFlujGastos(chatId, usuario) {",
  "export async function iniciarFlujGastos(chatId: string, usuario: any) {"
);
c = c.replace(
  "export async function procesarMensajeGastos(chatId, texto) {",
  "export async function procesarMensajeGastos(chatId: string, texto: string) {"
);

fs.writeFileSync(f, c, "utf8");
console.log("✅ Listo");
