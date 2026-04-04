const fs = require("fs");
const f = "lib/factura-parser.ts";
let c = fs.readFileSync(f, "utf8");

// Reemplazar toda la funcion detectServicio
const oldStart = c.indexOf("function detectServicio(text: string): string | null {");
const oldEnd = c.indexOf("\n// ", oldStart + 10);

const newFunc = `function detectServicio(text: string): string | null {
  // Parqueadero
  if (/PARQUEADERO|PARKING|ESTACIONAMIENTO|PARQUEO|TARIFA\\s*MOTOS?|TARIFA\\s*CARROS?|TARIFA\\s*VEHIC/i.test(text))
    return "Parqueadero";

  // Peajes
  if (/PEAJE|CONCESI[OÓ]N|AUTOPISTA/i.test(text))
    return "Peajes";

  // Gasolina / Combustible
  if (/GASOLINA|COMBUSTIBLE|ACPM|DIESEL|GAS\\s*NATURAL\\s*VEHIC|ESTACION\\s*DE\\s*SERVICIO|PETROLEO|GAL[OÓ]N/i.test(text))
    return "Gasolina";

  // Hospedaje
  if (/HOTEL|HOSTAL|HOSPEDAJE|ALOJAMIENTO|HABITACI[OÓ]N/i.test(text))
    return "Hospedaje";

  // Alimentacion (antes de transporte porque restaurantes pueden tener "servicio")
  if (/RESTAURANTE|ALMUERZO|COMIDA|DESAYUNO|CENA|PANADERI|SUPERMERCADO|PLAZA\\s*DE\\s*MERCADO|FRUTAS|CARNES|ALIMENTOS|SERVICIO\\s*A\\s*LA\\s*MESA|POLLO|PIZZA|HAMBURGUESA|AREPA|EMPANADA|ASADERO|CAFETER[IÍ]A|SUSHI|COMIDAS\\s*R[AÁ]PIDAS|BEBIDAS|JUGOS|HELAD|PASTEL|BAKERY|PARRILLA|BRASA|FRITANGA|BANDEJA|CORRIENTAZO|MENU\\s*DEL\\s*D[IÍ]A|BUFFET/i.test(text))
    return "Alimentación";

  // Transporte
  if (/TRANSPORTE|TAXI|UBER|REMESA|FLETE|ENCOMIENDA|ENV[IÍ]O|MENSAJER[IÍ]A|DIDI|INDRIVER|BEAT/i.test(text))
    return "Transporte";

  // Lavadero
  if (/LAVADERO|LAVADO|CAR\\s*WASH|LAVAUTO|LAVAAUTOS/i.test(text))
    return "Lavadero";

  // Llantera
  if (/LLANTA|LLANTERA|NEUM[AÁ]TICO|VULCANIZADORA|PINCHADO|MONTALLANTAS/i.test(text))
    return "Llantera";

  // Papeleria
  if (/PAPELER[IÍ]A|[UÚ]TILES\\s*DE\\s*OFICINA|LIBRER[IÍ]A|IMPRESION|FOTOCOPIAS/i.test(text))
    return "Papelería";

  // Pago a proveedores / materiales
  if (/MATERIALES|FERRETER[IÍ]A|INSUMOS|REPUESTOS|HERRAMIENTAS|TORNILLOS|CABLES|TUBER[IÍ]A|CEMENTO|PINTURA|SOLDADURA|ELECTRI/i.test(text))
    return "Pago a proveedores";

  // Gastos bancarios
  if (/COMISI[OÓ]N\\s*BANCARIA|TRANSFERENCIA\\s*BANCARIA|TRANSACCI[OÓ]N\\s*BANCARIA/i.test(text))
    return "Gastos Bancarios";

  // Servicios publicos
  if (/FACTURA\\s*DE\\s*SERVICIO|SERVICIO\\s*P[UÚ]BLICO|EMPRESAS\\s*P[UÚ]BLICAS|ACUEDUCTO|GAS\\s*NATURAL(?!\\s*VEHIC)/i.test(text))
    return "Servicios Públicos";

  return null;
}
`;

c = c.substring(0, oldStart) + newFunc + c.substring(oldEnd);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
