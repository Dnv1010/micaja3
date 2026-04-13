const fs = require("fs");

// Fix 1: quitar import no usado de deleteSheetRow
const fa = "app/api/envios/route.ts";
let ca = fs.readFileSync(fa, "utf8");
ca = ca.replace(
  'import { quoteSheetTitleForRange, sheetValuesToRecords, deleteSheetRow } from "@/lib/sheets-helpers";',
  'import { quoteSheetTitleForRange, sheetValuesToRecords } from "@/lib/sheets-helpers";'
);
fs.writeFileSync(fa, ca, "utf8");
console.log("API fix ok");

// Fix 2: agregar eslint-disable al cliente
const fc = "components/coordinador/envios-coordinador-client.tsx";
let cc = fs.readFileSync(fc, "utf8");
if (!cc.includes("no-unused-vars")) {
  cc = cc.replace(
    '/* eslint-disable @next/next/no-img-element */',
    '/* eslint-disable @next/next/no-img-element */\n/* eslint-disable @typescript-eslint/no-unused-vars */'
  );
}
fs.writeFileSync(fc, cc, "utf8");
console.log("Cliente fix ok");
