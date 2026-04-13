const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
const c = fs.readFileSync(f, "utf8");
const idxSesion = c.indexOf("// Procesar sesion de gastos activa");
const idxMenu2 = c.indexOf('if (texto === "2")');
console.log("Sesion en posicion:", idxSesion);
console.log("Menu2 en posicion:", idxMenu2);
console.log("Sesion va primero:", idxSesion < idxMenu2);
