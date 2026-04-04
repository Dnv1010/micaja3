const fs = require("fs");
const f = "app/api/telegram/webhook/route.ts";
const c = fs.readFileSync(f, "utf8");
const idxSesionFoto = c.indexOf("sesionGastos2");
const idxFotoNormal = c.indexOf("Recib");
console.log("sesionGastos2 posicion:", idxSesionFoto);
console.log("Flujo normal foto posicion:", idxFotoNormal);
console.log("Sesion foto va primero:", idxSesionFoto < idxFotoNormal);
