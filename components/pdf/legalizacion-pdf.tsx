"use client";

import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf",
      fontWeight: 300,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
      fontWeight: 500,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: 700,
    },
  ],
});

const FONT = "Roboto";

/** Firma del canvas: data URL completa o solo base64 (react-pdf requiere data:…). */
export function normalizeFirmaDataUrlForPdf(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t.startsWith("data:image/")) return t;
  return `data:image/png;base64,${t}`;
}

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
  driveFileId?: string;
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

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    padding: 30,
    color: "#1a1a1a",
  },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, fontFamily: FONT },
  logoBolt: { fontSize: 18, marginRight: 4, fontFamily: FONT },
  logoText: { fontSize: 16, fontWeight: 700, fontFamily: FONT },
  mainTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 14,
    fontFamily: FONT,
  },
  twoCol: { flexDirection: "row", gap: 16, marginBottom: 12, fontFamily: FONT },
  col: { flex: 1, fontFamily: FONT },
  labelRow: { flexDirection: "row", marginBottom: 4, fontFamily: FONT },
  label: { width: 120, fontWeight: 700, fontFamily: FONT },
  value: { flex: 1, fontFamily: FONT },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#cccccc", fontFamily: FONT },
  th: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    fontFamily: FONT,
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
    fontSize: 8,
    fontFamily: FONT,
  },
  trEven: { backgroundColor: "#f8f8f8" },
  trOdd: { backgroundColor: "#ffffff" },
  td: { paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 0.5, borderRightColor: "#cccccc", fontFamily: FONT },
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
    fontFamily: FONT,
  },
  legalNote: { fontSize: 7, marginTop: 10, lineHeight: 1.35, color: "#333", fontFamily: FONT },
  signSection: { flexDirection: "row", marginTop: 20, gap: 24, fontFamily: FONT },
  signCol: { flex: 1, fontFamily: FONT },
  signTitle: { fontSize: 9, fontWeight: 700, marginBottom: 6, fontFamily: FONT },
  signImg: { width: 150, height: 60, objectFit: "contain", marginBottom: 4 },
  signName: { fontSize: 9, fontFamily: FONT },
  sectionTitle: { fontSize: 11, fontWeight: 700, textAlign: "center", marginBottom: 12, fontFamily: FONT },
  muted: { fontSize: 9, color: "#666", fontStyle: "italic", fontFamily: FONT },
  facturaAdjunta: { marginBottom: 8, paddingBottom: 8, fontFamily: FONT },
  facturaAdjuntaTitulo: { fontSize: 9, fontWeight: 700, color: "#111", fontFamily: FONT },
});

function valorNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "").trim();
  if (!s || s === "0") return 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseInt(s.replace(/\./g, ""), 10);
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  const cleaned = s.replace(/\./g, "");
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatCOPpdf(n: number): string {
  if (!n) return "$0";
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
  const firmaCoordSrc = firmaCoordinador ? normalizeFirmaDataUrlForPdf(firmaCoordinador) : "";
  const firmaAdminSrc = firmaAdmin ? normalizeFirmaDataUrlForPdf(firmaAdmin) : "";
  const emDash = "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.logoRow}>
          <Text style={styles.logoBolt}>{"\u26A1"}</Text>
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
              <Text style={styles.value}>{formatCOPpdf(limiteZona)}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Valor a Reembolsar:</Text>
              <Text style={styles.value}>{formatCOPpdf(total)}</Text>
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
            <View key={f.id || `row-${i}`} style={[styles.tr, i % 2 === 0 ? styles.trEven : styles.trOdd]} wrap={false}>
              <Text style={[styles.td, styles.wNo]}>{i + 1}</Text>
              <Text style={[styles.td, styles.wConcepto]}>{f.concepto}</Text>
              <Text style={[styles.td, styles.wFactura]}>{f.nit}</Text>
              <Text style={[styles.td, styles.wCentro]}>{f.area || emDash}</Text>
              <Text style={[styles.td, styles.wCat]}>{f.tipoFactura || emDash}</Text>
              <Text style={[styles.td, styles.wFecha]}>{f.fecha}</Text>
              <Text style={[styles.td, styles.wValor, styles.tdLast]}>
                {formatCOPpdf(valorNum(f.valor))}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>Total:</Text>
            <Text> {formatCOPpdf(total)}</Text>
          </View>
        </View>

        <Text style={styles.legalNote}>
          (*) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE
          DE BIA ENERGY S.A.S. C.S.P NIT 901.588.413-2.
        </Text>

        <View style={styles.signSection}>
          <View style={styles.signCol}>
            <Text style={styles.signTitle}>Empleado que legaliza:</Text>
            {firmaCoordSrc ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- PDF firma */
              <Image style={styles.signImg} src={firmaCoordSrc} />
            ) : null}
            <Text style={styles.signName}>{coordinador.responsable}</Text>
            <Text style={styles.signName}>{coordinador.cargo}</Text>
          </View>
          <View style={styles.signCol}>
            <Text style={styles.signTitle}>Jefe directo (Aprueba):</Text>
            {firmaAdminSrc ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- PDF firma admin */
              <Image style={styles.signImg} src={firmaAdminSrc} />
            ) : (
              <View style={{ height: 60 }} />
            )}
            <Text style={styles.signName}>Hernan Manjarres</Text>
            <Text style={styles.signName}>Manager Field Ops</Text>
          </View>
        </View>
      </Page>

      {facturas.length ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Facturas Adjuntas</Text>
          {facturas.map((f, i) => {
            const imgSrc = f.imagenUrl?.startsWith("data:") ? f.imagenUrl : null;
            return (
              <View key={f.id || `f-${i}`} style={styles.facturaAdjunta} wrap={false}>
                <Text style={styles.facturaAdjuntaTitulo}>
                  Factura {i + 1}: {f.nit || emDash} Fecha: {f.fecha || emDash}
                </Text>
                <Text style={{ fontSize: 8, color: "#333", marginTop: 2, fontFamily: FONT }}>
                  Proveedor: {f.proveedor || emDash} Valor: {formatCOPpdf(valorNum(f.valor))}
                </Text>
                {imgSrc ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- adjunto en PDF */
                  <Image
                    src={imgSrc}
                    style={{ width: "100%", maxHeight: 280, objectFit: "contain", marginTop: 6 }}
                  />
                ) : (
                  <Text style={{ fontSize: 8, color: "#999", marginTop: 4, fontStyle: "italic", fontFamily: FONT }}>
                    {f.imagenUrl ? "Imagen no disponible" : "Sin imagen adjunta"}
                  </Text>
                )}
                {i < facturas.length - 1 ? (
                  <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 8 }} />
                ) : null}
              </View>
            );
          })}
        </Page>
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
