import { Document, Font, Page, StyleSheet, Text, View, type DocumentProps } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf", fontWeight: 400 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf", fontWeight: 700 },
  ],
});

const s = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 9, padding: 30, color: "#333" },
  header: { backgroundColor: "#001035", padding: 12, marginBottom: 12, borderRadius: 4 },
  headerTitle: { color: "#08DDBC", fontSize: 14, fontWeight: 700 },
  headerSub: { color: "white", fontSize: 9, marginTop: 2 },
  title: { fontSize: 12, fontWeight: 700, textAlign: "center", marginBottom: 10, color: "#001035" },
  infoRow: { flexDirection: "row", marginBottom: 4 },
  infoLabel: { fontWeight: 700, width: 80, color: "#555" },
  infoValue: { flex: 1 },
  table: { marginTop: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: "#001035", padding: 5 },
  tableHeaderCell: { color: "white", fontWeight: 700, textAlign: "center" },
  tableRow: { flexDirection: "row", padding: 4, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableRowAlt: { flexDirection: "row", padding: 4, backgroundColor: "#f9f9f9", borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  cell: { textAlign: "center" },
  totalRow: { flexDirection: "row", backgroundColor: "#001035", padding: 5, marginTop: 2 },
  totalLabel: { color: "white", fontWeight: 700, textAlign: "right" },
  totalValue: { color: "white", fontWeight: 700, textAlign: "right" },
  firmaSection: { flexDirection: "row", marginTop: 30, gap: 20 },
  firmaBox: { flex: 1, borderWidth: 0.5, borderColor: "#ddd", height: 60, padding: 5 },
  firmaLabel: { fontSize: 8, fontWeight: 700, marginBottom: 4 },
  footer: { marginTop: 10, fontSize: 7, color: "#666", borderTopWidth: 0.5, borderTopColor: "#ddd", paddingTop: 5 },
});

function formatCOP(v: number) {
  return "$ " + v.toLocaleString("es-CO");
}

export function GastosDocument({ nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas }: {
  nombre: string; cargo: string; cc: string; ciudad: string; motivo: string;
  fechaInicio: string; fechaFin: string;
  facturas: { concepto: string; centroCostos: string; nit: string; fecha: string; valor: string }[];
}) {
  const total = facturas.reduce((acc, f) => acc + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
  const cols = [30, 140, 90, 70, 60, 70];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerTitle}>BIA Energy SAS ESP</Text>
          <Text style={s.headerSub}>Legalizacion de Gastos</Text>
        </View>
        <Text style={s.title}>LEGALIZACION DE GASTOS</Text>
        <View style={s.infoRow}><Text style={s.infoLabel}>Nombre:</Text><Text style={s.infoValue}>{nombre}</Text><Text style={s.infoLabel}>Cargo:</Text><Text style={s.infoValue}>{cargo}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>CC:</Text><Text style={s.infoValue}>{cc}</Text><Text style={s.infoLabel}>Ciudad:</Text><Text style={s.infoValue}>{ciudad}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Motivo:</Text><Text style={s.infoValue}>{motivo}</Text></View>
        <View style={s.infoRow}><Text style={s.infoLabel}>Periodo:</Text><Text style={s.infoValue}>{fechaInicio} al {fechaFin}</Text></View>
        <View style={s.table}>
          <View style={s.tableHeader}>
            {["No.", "Concepto", "Centro Costos", "NIT", "Fecha", "Valor"].map((h, i) => (
              <Text key={i} style={[s.tableHeaderCell, { width: cols[i] }]}>{h}</Text>
            ))}
          </View>
          {facturas.map((f, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.cell, { width: cols[0] }]}>{i + 1}</Text>
              <Text style={[s.cell, { width: cols[1] }]}>{f.concepto}</Text>
              <Text style={[s.cell, { width: cols[2] }]}>{f.centroCostos}</Text>
              <Text style={[s.cell, { width: cols[3] }]}>{f.nit || ""}</Text>
              <Text style={[s.cell, { width: cols[4] }]}>{f.fecha}</Text>
              <Text style={[s.cell, { width: cols[5] }]}>{formatCOP(Number(String(f.valor).replace(/[^0-9]/g, "")))}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { width: cols[0] + cols[1] + cols[2] + cols[3] + cols[4] }]}>TOTAL:</Text>
            <Text style={[s.totalValue, { width: cols[5] }]}>{formatCOP(total)}</Text>
          </View>
        </View>
        <View style={s.firmaSection}>
          <View style={s.firmaBox}><Text style={s.firmaLabel}>Empleado que Legaliza:</Text></View>
          <View style={s.firmaBox}><Text style={s.firmaLabel}>Jefe Directo (Aprueba):</Text></View>
        </View>
        <Text style={s.footer}>(1) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P</Text>
      </Page>
    </Document>
  );
}
