import { Document, Image, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 10,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandText: { flexDirection: "column" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f1729" },
  small: { fontSize: 8, color: "#6b7280" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  infoItem: { width: "48%", marginRight: "2%", marginBottom: 6, padding: 6, backgroundColor: "#f9fafb" },
  infoLabel: { fontSize: 7, color: "#9ca3af", marginBottom: 2 },
  infoValue: { fontSize: 9, color: "#111827" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
  headerRow: { backgroundColor: "#0f1729", paddingVertical: 5, paddingHorizontal: 2 },
  th: { fontSize: 7, color: "#fff", fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8, color: "#111827" },
  f: { width: "15%" },
  c: { width: "25%" },
  n: { width: "15%" },
  ci: { width: "15%" },
  cc: { width: "15%" },
  v: { width: "15%", textAlign: "right" },
  total: { marginTop: 8, flexDirection: "row", justifyContent: "flex-end" },
  totalText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827" },
  firmasRow: { marginTop: 28, flexDirection: "row", justifyContent: "space-between", gap: 20 },
  firmaBox: { width: "48%" },
  firmaImg: { width: 120, height: 48, objectFit: "contain" },
  firmaPlaceholder: { height: 48 },
  firmaCaption: { fontSize: 7, color: "#6b7280", fontFamily: "Helvetica-Bold", marginBottom: 2 },
  line: { borderTopWidth: 0.5, borderTopColor: "#374151", marginTop: 4, marginBottom: 3 },
  adjPage: { padding: 28, backgroundColor: "#fff" },
  adjTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f1729", marginBottom: 10 },
  adjImg: { width: "100%", objectFit: "contain" },
});

function formatCOPpdf(v: number) {
  return `$${v.toLocaleString("es-CO")}`;
}

function valNum(raw: string | number): number {
  if (typeof raw === "number") return raw;
  return parseFloat(String(raw || "").replace(/[^\d.-]/g, "")) || 0;
}

export interface GastoGrupoPdfItem {
  FechaFactura: string;
  Concepto: string;
  NIT: string;
  Ciudad: string;
  CentroCostos: string;
  Valor: string;
  imagenBase64?: string;
}

export interface GastoGrupoPdfData {
  ID_Grupo: string;
  Responsable: string;
  Cargo: string;
  Motivo: string;
  FechaInicio: string;
  FechaFin: string;
  CentroCostos: string;
  Total: string;
}

export function GastosGruposPdf({
  grupo,
  gastos,
  firma,
}: {
  grupo: GastoGrupoPdfData;
  gastos: GastoGrupoPdfItem[];
  firma?: string;
}) {
  const total = gastos.reduce((s, g) => s + valNum(g.Valor), 0);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Svg width={14} height={18} viewBox="0 0 14 18">
              <Polygon points="8,0 0,10 5,10 3,18 14,7 8,7 10,0" fill="#08DDBC" />
            </Svg>
            <View style={styles.brandText}>
              <Text style={styles.title}>BIA ENERGY SAS ESP</Text>
              <Text style={styles.small}>REPORTE DE GASTOS GENERALES</Text>
            </View>
          </View>
          <View>
            <Text style={styles.small}>{grupo.ID_Grupo}</Text>
            <Text style={styles.small}>{new Date().toLocaleDateString("es-CO")}</Text>
          </View>
        </View>
        <View style={styles.infoGrid}>
          {[
            { label: "Responsable", value: grupo.Responsable },
            { label: "Cargo", value: grupo.Cargo },
            { label: "Motivo", value: grupo.Motivo },
            { label: "Centro de costos", value: grupo.CentroCostos },
            { label: "Periodo", value: `${grupo.FechaInicio} → ${grupo.FechaFin}` },
            { label: "Total", value: formatCOPpdf(total) },
          ].map((item) => (
            <View key={item.label} style={styles.infoItem}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value || "—"}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.f, styles.th]}>Fecha</Text>
          <Text style={[styles.c, styles.th]}>Concepto</Text>
          <Text style={[styles.n, styles.th]}>NIT</Text>
          <Text style={[styles.ci, styles.th]}>Ciudad</Text>
          <Text style={[styles.cc, styles.th]}>C. Costo</Text>
          <Text style={[styles.v, styles.th]}>Valor</Text>
        </View>
        {gastos.map((g, i) => (
          <View key={`${g.Concepto}-${i}`} style={styles.row}>
            <Text style={[styles.f, styles.td]}>{g.FechaFactura || "—"}</Text>
            <Text style={[styles.c, styles.td]}>{g.Concepto || "—"}</Text>
            <Text style={[styles.n, styles.td]}>{g.NIT || "—"}</Text>
            <Text style={[styles.ci, styles.td]}>{g.Ciudad || "—"}</Text>
            <Text style={[styles.cc, styles.td]}>{g.CentroCostos || "—"}</Text>
            <Text style={[styles.v, styles.td]}>{formatCOPpdf(valNum(g.Valor))}</Text>
          </View>
        ))}
        <View style={styles.total}>
          <Text style={styles.totalText}>TOTAL: {formatCOPpdf(total)}</Text>
        </View>
        <View style={styles.firmasRow}>
          <View style={styles.firmaBox}>
            <Text style={styles.firmaCaption}>FIRMA DEL RESPONSABLE</Text>
            {firma ? (
              /* eslint-disable-next-line jsx-a11y/alt-text */
              <Image style={styles.firmaImg} src={firma} />
            ) : (
              <View style={styles.firmaPlaceholder} />
            )}
            <View style={styles.line} />
            <Text style={styles.infoValue}>{grupo.Responsable}</Text>
            <Text style={styles.small}>{grupo.Cargo}</Text>
          </View>
          <View style={styles.firmaBox}>
            <Text style={styles.firmaCaption}>FIRMA DE AUTORIZACIÓN</Text>
            <View style={styles.firmaPlaceholder} />
            <View style={styles.line} />
            <Text style={styles.infoValue}>Nombre</Text>
            <Text style={styles.small}>Cargo</Text>
          </View>
        </View>
      </Page>
      {gastos
        .filter((g) => !!g.imagenBase64)
        .map((g, i) => (
          <Page key={`adj-${i}`} size="A4" style={styles.adjPage}>
            <Text style={styles.adjTitle}>
              Soporte #{i + 1} — {g.Concepto || "Factura"} — {g.FechaFactura || ""}
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image style={styles.adjImg} src={String(g.imagenBase64)} />
          </Page>
        ))}
    </Document>
  );
}
