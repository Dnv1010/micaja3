"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  line: { marginBottom: 6 },
  center: { textAlign: "center" },
  title: { fontSize: 14, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 11, marginBottom: 16, textAlign: "center" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#333", marginVertical: 8 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginTop: 8,
    fontWeight: 700,
  },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#ccc" },
  c1: { width: "12%" },
  c2: { width: "18%" },
  c3: { width: "22%" },
  c4: { width: "14%" },
  c5: { width: "18%" },
  c6: { width: "16%" },
  firma: { width: 200, height: 80, marginTop: 8, objectFit: "contain" },
});

export type FilaFacturaPdf = {
  fecha: string;
  responsable: string;
  proveedor: string;
  nit: string;
  concepto: string;
  valor: string;
};

export function LegalizacionCajaPdfDocumento({
  zona,
  coordinador,
  cargo,
  periodo,
  generado,
  filas,
  totalAprobado,
  limiteZona,
  firmaDataUrl,
}: {
  zona: string;
  coordinador: string;
  cargo: string;
  periodo: string;
  generado: string;
  filas: FilaFacturaPdf[];
  totalAprobado: string;
  limiteZona: string;
  firmaDataUrl: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>BIA ENERGY SAS ESP</Text>
        <Text style={styles.subtitle}>LEGALIZACIÓN DE CAJA MENOR</Text>
        <View style={styles.rule} />
        <Text style={styles.line}>Zona: {zona}</Text>
        <Text style={styles.line}>Coordinador: {coordinador}</Text>
        <Text style={styles.line}>Cargo: {cargo}</Text>
        <Text style={styles.line}>Período: {periodo}</Text>
        <Text style={styles.line}>Generado: {generado}</Text>
        <View style={styles.rule} />
        <Text style={{ marginTop: 8, marginBottom: 4, fontWeight: 700 }}>DETALLE DE FACTURAS APROBADAS</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.c1}>Fecha</Text>
          <Text style={styles.c2}>Responsable</Text>
          <Text style={styles.c3}>Proveedor</Text>
          <Text style={styles.c4}>NIT</Text>
          <Text style={styles.c5}>Concepto</Text>
          <Text style={styles.c6}>Valor</Text>
        </View>
        {filas.map((f, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.c1}>{f.fecha}</Text>
            <Text style={styles.c2}>{f.responsable}</Text>
            <Text style={styles.c3}>{f.proveedor}</Text>
            <Text style={styles.c4}>{f.nit}</Text>
            <Text style={styles.c5}>{f.concepto}</Text>
            <Text style={styles.c6}>{f.valor}</Text>
          </View>
        ))}
        <View style={styles.rule} />
        <Text style={{ marginTop: 12 }}>TOTAL APROBADO: {totalAprobado}</Text>
        <Text style={styles.line}>LÍMITE ZONA: {limiteZona}</Text>
        <View style={styles.rule} />
        <Text style={{ marginTop: 12, fontWeight: 700 }}>Firma coordinador:</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- firma decorativa en PDF */}
        {firmaDataUrl ? <Image style={styles.firma} src={firmaDataUrl} /> : null}
        <Text style={styles.line}>Nombre: {coordinador}</Text>
        <Text style={styles.line}>Cargo: {cargo}</Text>
        <Text style={styles.line}>Fecha: {generado}</Text>
        <View style={styles.rule} />
        <Text style={{ ...styles.center, marginTop: 16, fontWeight: 700 }}>
          Estado: PENDIENTE DE APROBACIÓN ADMIN
        </Text>
      </Page>
    </Document>
  );
}
