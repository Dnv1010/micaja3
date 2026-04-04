const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
const c = fs.readFileSync(f, "utf8");
const idxSesion = c.indexOf("const sesionActiva = await getSesionGastos");
const idxMenu2 = c.indexOf('if (texto === "2")');
console.log("Sesion posicion:", idxSesion);
console.log("Menu2 posicion:", idxMenu2);
console.log("Sesion va primero:", idxSesion < idxMenu2);
