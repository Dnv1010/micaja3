const fs = require("fs");
const f = "lib/telegram-gastos.ts";
let c = fs.readFileSync(f, "utf8");

const viejo = `s.paso = "mas_facturas";
    const total = s.facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
    await guardarSesion(chatId, s);`;

const nuevo = `s.paso = "listo";
    const total = s.facturas.reduce((acc: number, f: any) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
    await guardarSesion(chatId, s);`;

if (c.includes(viejo)) {
  c = c.replace(viejo, nuevo);
  console.log("✅ Reemplazado");
} else {
  console.log("❌ No encontrado");
}

fs.writeFileSync(f, c, "utf8");
