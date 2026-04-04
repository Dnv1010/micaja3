const fs = require("fs");
const f = "components/pdf/gastos-pdf.tsx";
let c = fs.readFileSync(f, "utf8");

c = c.replace(
  'import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";',
  'import { Document, Font, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";'
);

// Renombrar GastosPdf a GastosDocument que retorna Document
c = c.replace(
  'export function GastosPdf({',
  'export function GastosDocument({'
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
