const fs = require("fs");
const f = "components/pdf/gastos-pdf.tsx";
let c = fs.readFileSync(f, "utf8");

// Agregar Image al import
c = c.replace(
  'import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";',
  'import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";'
);

// Agregar estilo para imagen
c = c.replace(
  '  firmaLabel: { fontSize: 8, fontWeight: 700, marginBottom: 4 },',
  `  firmaLabel: { fontSize: 8, fontWeight: 700, marginBottom: 4 },
  facturaImg: { width: "100%", marginTop: 8, marginBottom: 8 },
  facturaImgTitle: { fontSize: 9, fontWeight: 700, color: "#001035", marginTop: 12, marginBottom: 4 },`
);

// Actualizar tipo de factura para incluir urlImagen
c = c.replace(
  'facturas: { concepto: string; centroCostos: string; nit: string; fecha: string; valor: string }[];',
  'facturas: { concepto: string; centroCostos: string; nit: string; fecha: string; valor: string; urlImagen?: string }[];'
);

// Agregar paginas de imagenes despues de la firma
c = c.replace(
  `        <Text style={s.footer}>(1) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P</Text>
      </Page>
    </Document>`,
  `        <Text style={s.footer}>(1) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P</Text>
      </Page>
      {facturas.filter(f => f.urlImagen).map((f, i) => (
        <Page key={"img-" + i} size="A4" style={s.page}>
          <View style={s.header}>
            <Text style={s.headerTitle}>BIA Energy SAS ESP</Text>
            <Text style={s.headerSub}>Soporte Factura #{i + 1}</Text>
          </View>
          <Text style={s.facturaImgTitle}>Factura #{i + 1} - {f.concepto}</Text>
          <Text style={[s.infoRow as any, { fontSize: 8, color: "#555", marginBottom: 8 }]}>Centro: {f.centroCostos} | Fecha: {f.fecha} | Valor: {formatCOP(Number(String(f.valor).replace(/[^0-9]/g, "")))}</Text>
          {f.urlImagen && <Image style={s.facturaImg} src={f.urlImagen} />}
        </Page>
      ))}
    </Document>`
);

fs.writeFileSync(f, c, "utf8");
console.log("ok");
