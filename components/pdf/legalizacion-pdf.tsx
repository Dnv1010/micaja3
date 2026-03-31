"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCOP, parseCOPString } from "@/lib/format";

export type FacturaPdf = {
  id: string;
  fecha: string;
  proveedor: string;
  nit: string;
  concepto: string;
  valor: string | number;
  tipoFactura: string;
  area: string;
  imagenUrl?: string;
};

export type LegalizacionPdfProps = {
  coordinador: {
    responsable: string;
    cargo: string;
    cedula?: string;
    sector: string;
    area: string;
  };
  facturas: FacturaPdf[];
  firmaCoordinador: string;
  firmaAdmin?: string;
  fechaGeneracion: string;
  limiteZona: number;
};

const MARGIN = 30;
const styles = StyleSheet.create({
  page: {
    padding: MARGIN,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
  },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  logoBolt: { fontSize: 18, marginRight: 4 },
  logoText: { fontSize: 16, fontWeight: 700 },
  mainTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 14,
  },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 12 },
  col: { flex: 1 },
  labelRow: { flexDirection: "row", marginBottom: 4 },
  label: { width: 120, fontWeight: 700 },
  value: { flex: 1 },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#cccccc" },
  th: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc", fontSize: 8 },
  trEven: { backgroundColor: "#f8f8f8" },
  trOdd: { backgroundColor: "#ffffff" },
  td: { paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 0.5, borderRightColor: "#cccccc" },
  tdLast: { borderRightWidth: 0 },
  wNo: { width: "6%" },
  wConcepto: { width: "22%" },
  wFactura: { width: "14%" },
  wCentro: { width: "16%" },
  wCat: { width: "14%" },
  wFecha: { width: "10%" },
  wValor: { width: "18%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#e8e8e8",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderTopWidth: 0,
    fontWeight: 700,
    fontSize: 9,
  },
  legalNote: { fontSize: 7, marginTop: 10, lineHeight: 1.35, color: "#333" },
  signSection: { flexDirection: "row", marginTop: 20, gap: 24 },
  signCol: { flex: 1 },
  signTitle: { fontSize: 9, fontWeight: 700, marginBottom: 6 },
  signImg: { width: 140, height: 56, objectFit: "contain", marginBottom: 4 },
  signName: { fontSize: 9 },
  sectionTitle: { fontSize: 11, fontWeight: 700, textAlign: "center", marginBottom: 12 },
  attachBlock: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#cccccc" },
  attachHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, fontSize: 9 },
  attachImg: { maxHeight: 380, objectFit: "contain", marginTop: 4 },
  muted: { fontSize: 9, color: "#666", fontStyle: "italic" },
});

function valorNum(v: string | number): number {
  if (typeof v === "number") return v;
  return parseCOPString(String(v));
}

export function LegalizacionPdf({
  coordinador,
  facturas,
  firmaCoordinador,
  firmaAdmin,
  fechaGeneracion,
  limiteZona,
}: LegalizacionPdfProps) {
  const total = facturas.reduce((acc, f) => acc + valorNum(f.valor), 0);
  const ejecutado = limiteZona > 0 ? Math.round((total / limiteZona) * 100) : 0;
  const cc = coordinador.cedula?.trim() || "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.logoRow}>
          <Text style={styles.logoBolt}>⚡</Text>
          <Text style={styles.logoText}>Bia</Text>
        </View>
        <Text style={styles.mainTitle}>LEGALIZACIÓN DE CAJA MENOR GASTOS</Text>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Nombre:</Text>
              <Text style={styles.value}>{coordinador.responsable}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Cargo:</Text>
              <Text style={styles.value}>{coordinador.cargo}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>CC:</Text>
              <Text style={styles.value}>{cc}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Subsidiaria:</Text>
              <Text style={styles.value}>BIA ENERGY SAS ESP</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Responsable de Autorización:</Text>
              <Text style={styles.value}>Hernan Manjarres</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Cuenta Mayor:</Text>
              <Text style={styles.value}>11051015</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Fecha:</Text>
              <Text style={styles.value}>{fechaGeneracion}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Ciudad:</Text>
              <Text style={styles.value}>{coordinador.sector}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Monto Asignado:</Text>
              <Text style={styles.value}>{formatCOP(limiteZona)}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Valor a Reembolsar:</Text>
              <Text style={styles.value}>{formatCOP(total)}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Ejecutado:</Text>
              <Text style={styles.value}>{ejecutado}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={[styles.td, styles.wNo]}>No.</Text>
            <Text style={[styles.td, styles.wConcepto]}>CONCEPTO</Text>
            <Text style={[styles.td, styles.wFactura]}>No. DE FACTURA</Text>
            <Text style={[styles.td, styles.wCentro]}>CENTRO DE COSTOS</Text>
            <Text style={[styles.td, styles.wCat]}>CATEGORÍA</Text>
            <Text style={[styles.td, styles.wFecha]}>FECHA</Text>
            <Text style={[styles.td, styles.wValor, styles.tdLast]}>VALOR</Text>
          </View>
          {facturas.map((f, i) => (
            <View key={f.id} style={[styles.tr, i % 2 === 0 ? styles.trEven : styles.trOdd]} wrap={false}>
              <Text style={[styles.td, styles.wNo]}>{i + 1}</Text>
              <Text style={[styles.td, styles.wConcepto]}>{f.concepto}</Text>
              <Text style={[styles.td, styles.wFactura]}>{f.nit}</Text>
              <Text style={[styles.td, styles.wCentro]}>{f.area || "—"}</Text>
              <Text style={[styles.td, styles.wCat]}>{f.tipoFactura || "—"}</Text>
              <Text style={[styles.td, styles.wFecha]}>{f.fecha}</Text>
              <Text style={[styles.td, styles.wValor, styles.tdLast]}>
                {formatCOP(valorNum(f.valor))} COP
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>Total:</Text>
            <Text> {formatCOP(total)} COP</Text>
          </View>
        </View>

        <Text style={styles.legalNote}>
          (*) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE
          DE BIA ENERGY S.A.S. C.S.P NIT 901.588.413-2.
        </Text>

        <View style={styles.signSection}>
          <View style={styles.signCol}>
            <Text style={styles.signTitle}>Empleado que legaliza:</Text>
            {firmaCoordinador ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- PDF firma */
              <Image style={styles.signImg} src={firmaCoordinador} />
            ) : null}
            <Text style={styles.signName}>{coordinador.responsable}</Text>
            <Text style={styles.signName}>{coordinador.cargo}</Text>
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signTitle}>Jefe directo (Aprueba):</Text>
            {firmaAdmin ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- PDF firma admin */
              <Image style={styles.signImg} src={firmaAdmin} />
            ) : (
              <View style={{ height: 56 }} />
            )}
            <Text style={styles.signName}>Hernan Manjarres</Text>
            <Text style={styles.signName}>Manager Field Ops</Text>
          </View>
        </View>
      </Page>

      {facturas.length ? (
        facturas.map((f, i) => (
          <Page key={`att-${f.id}`} size="A4" style={styles.page}>
            {i === 0 ? <Text style={styles.sectionTitle}>Facturas Adjuntas</Text> : null}
            <View style={[styles.attachBlock, i === facturas.length - 1 ? { borderBottomWidth: 0 } : {}]} wrap={false}>
              <View style={styles.attachHeader}>
                <Text>Factura: {f.nit}</Text>
                <Text>Fecha: {f.fecha}</Text>
              </View>
              {f.imagenUrl?.trim() ? (
                /* eslint-disable-next-line jsx-a11y/alt-text -- adjunto factura */
                <Image style={styles.attachImg} src={f.imagenUrl.trim()} />
              ) : (
                <Text style={styles.muted}>Sin imagen adjunta</Text>
              )}
            </View>
          </Page>
        ))
      ) : (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Facturas Adjuntas</Text>
          <Text style={styles.muted}>Sin facturas en este reporte.</Text>
        </Page>
      )}
    </Document>
  );
}

/** Payload serializable para guardar y regenerar el PDF (p. ej. en Sheets). */
export type LegalizacionPdfStoredPayload = {
  coordinador: LegalizacionPdfProps["coordinador"];
  facturas: FacturaPdf[];
  firmaCoordinador: string;
  firmaAdmin?: string;
  fechaGeneracion: string;
  limiteZona: number;
};

export function legalizacionPdfPropsFromPayload(p: LegalizacionPdfStoredPayload): LegalizacionPdfProps {
  return {
    coordinador: p.coordinador,
    facturas: p.facturas,
    firmaCoordinador: p.firmaCoordinador,
    firmaAdmin: p.firmaAdmin,
    fechaGeneracion: p.fechaGeneracion,
    limiteZona: p.limiteZona,
  };
}
