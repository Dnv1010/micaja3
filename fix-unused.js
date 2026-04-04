const fs = require("fs");

// Fix route
let f1 = "app/api/gastos-pdf/route.ts";
let c1 = fs.readFileSync(f1, "utf8");
c1 = c1.replace(
  'import { GastosPdf, GastosDocument } from "@/components/pdf/gastos-pdf";',
  'import { GastosDocument } from "@/components/pdf/gastos-pdf";'
);
fs.writeFileSync(f1, c1, "utf8");

// Fix componente
let f2 = "components/pdf/gastos-pdf.tsx";
let c2 = fs.readFileSync(f2, "utf8");
c2 = c2.replace(
  'import { Document, Font, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";',
  'import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";'
);
fs.writeFileSync(f2, c2, "utf8");

console.log("ok");
