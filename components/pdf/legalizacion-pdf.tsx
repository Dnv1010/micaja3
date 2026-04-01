"use client";

import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { normalizeFirmaDataUrlForPdf } from "@/lib/drive-image-url";

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

export { normalizeFirmaDataUrlForPdf };

function valorNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
  const s = String(v).replace(/\$/g, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseInt(s.replace(/\./g, ""), 10);
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  return parseInt(s.replace(/\./g, ""), 10) || 0;
}

function formatCOPpdf(n: number): string {
  if (!n) return "$0";
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const styles = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 9, padding: 30, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 12 },
  logo: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  infoGrid: { flexDirection: "row", marginBottom: 14, gap: 20 },
  infoCol: { flex: 1 },
  labelRow: { flexDirection: "row", marginBottom: 3 },
  label: { fontWeight: 700, width: 120, fontSize: 8 },
  value: { flex: 1, fontSize: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a1a2e", color: "#ffffff", fontWeight: 700, fontSize: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc" },
  td: { padding: 4, fontSize: 8, borderRightWidth: 0.5, borderRightColor: "#cccccc" },
  wNo: { width: "5%" },
  wConcepto: { width: "22%" },
  wFactura: { width: "14%" },
  wCentro: { width: "15%" },
  wCategoria: { width: "14%" },
  wFecha: { width: "12%" },
  wValor: { width: "18%" },
  tdLast: { borderRightWidth: 0 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", padding: 4, fontWeight: 700, fontSize: 9 },
  legalNote: { fontSize: 7, color: "#555", marginTop: 8, marginBottom: 12 },
  sigRow: { flexDirection: "row", marginTop: 16 },
  sigBox: { flex: 1 },
  sigLabel: { fontSize: 8, marginBottom: 4 },
  sigImg: { width: 120, height: 50, objectFit: "contain", marginBottom: 4 },
  sigName: { fontSize: 8, fontWeight: 700 },
  sigCargo: { fontSize: 7, color: "#555" },
  adjPage: { fontFamily: "Roboto", fontSize: 9, padding: 30 },
  adjTitle: { fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 16 },
  adjBlock: { marginBottom: 12 },
  adjBlockTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4 },
  adjImg: { width: "100%", maxHeight: 280, objectFit: "contain", marginTop: 6 },
  adjSep: { borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginTop: 8 },
});

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
  const firmaCoordSrc = firmaCoordinador ? normalizeFirmaDataUrlForPdf(firmaCoordinador) : "";
  const firmaAdminSrc = firmaAdmin ? normalizeFirmaDataUrlForPdf(firmaAdmin) : "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.logo}>Bia</Text>
        <Text style={styles.title}>LEGALIZACION DE CAJA MENOR GASTOS</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
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
              <Text style={styles.value}>{coordinador.cedula || "--"}</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Subsidiaria:</Text>
              <Text style={styles.value}>BIA ENERGY SAS ESP</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Resp. Autorizacion:</Text>
              <Text style={styles.value}>Hernan Manjarres</Text>
            </View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Cuenta Mayor:</Text>
              <Text style={styles.value}>11051015</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
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

        <View style={styles.tableHeader}>
          <Text style={[styles.td, styles.wNo]}>No.</Text>
          <Text style={[styles.td, styles.wConcepto]}>CONCEPTO</Text>
          <Text style={[styles.td, styles.wFactura]}>No. FACTURA</Text>
          <Text style={[styles.td, styles.wCentro]}>CENTRO COSTOS</Text>
          <Text style={[styles.td, styles.wCategoria]}>CATEGORIA</Text>
          <Text style={[styles.td, styles.wFecha]}>FECHA</Text>
          <Text style={[styles.td, styles.wValor, styles.tdLast]}>VALOR</Text>
        </View>

        {facturas.map((f, i) => (
          <View key={f.id || `r-${i}`} style={styles.tableRow}>
            <Text style={[styles.td, styles.wNo]}>{i + 1}</Text>
            <Text style={[styles.td, styles.wConcepto]}>{f.concepto || "--"}</Text>
            <Text style={[styles.td, styles.wFactura]}>{f.nit || "--"}</Text>
            <Text style={[styles.td, styles.wCentro]}>{f.area || "--"}</Text>
            <Text style={[styles.td, styles.wCategoria]}>{f.tipoFactura || "--"}</Text>
            <Text style={[styles.td, styles.wFecha]}>{f.fecha || "--"}</Text>
            <Text style={[styles.td, styles.wValor, styles.tdLast]}>{formatCOPpdf(valorNum(f.valor))}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text>
            Total: {formatCOPpdf(total)} COP
          </Text>
        </View>

        <Text style={styles.legalNote}>
          (*) TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN ESTAR A NOMBRE
          DE BIA ENERGY S.A.S. C.S.P NIT 901.588.413-2.
        </Text>

        <View style={styles.sigRow}>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>Empleado que legaliza:</Text>
            {firmaCoordSrc ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- firma en PDF */
              <Image style={styles.sigImg} src={firmaCoordSrc} />
            ) : null}
            <Text style={styles.sigName}>{coordinador.responsable}</Text>
            <Text style={styles.sigCargo}>{coordinador.cargo}</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>Jefe directo (Aprueba):</Text>
            {firmaAdminSrc ? (
              /* eslint-disable-next-line jsx-a11y/alt-text -- firma admin en PDF */
              <Image style={styles.sigImg} src={firmaAdminSrc} />
            ) : null}
            <Text style={styles.sigName}>Hernan Manjarres</Text>
            <Text style={styles.sigCargo}>Manager Field Ops</Text>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.adjPage}>
        <Text style={styles.adjTitle}>Facturas Adjuntas</Text>
        {facturas.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#999" }}>Sin facturas en este reporte.</Text>
        ) : (
          facturas.map((f, i) => {
            const imgSrc = f.imagenUrl?.startsWith("data:") ? f.imagenUrl : null;
            return (
              <View key={f.id || `a-${i}`} style={styles.adjBlock}>
                <Text style={styles.adjBlockTitle}>
                  Factura: {f.nit || "--"} Fecha: {f.fecha || "--"}
                </Text>
                <Text style={{ fontSize: 8, color: "#333" }}>
                  Proveedor: {f.proveedor || "--"} Valor: {formatCOPpdf(valorNum(f.valor))}
                </Text>
                {imgSrc ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- adjunto en PDF */
                  <Image style={styles.adjImg} src={imgSrc} />
                ) : (
                  <Text style={{ fontSize: 8, color: "#999", marginTop: 4 }}>
                    {f.imagenUrl ? "Imagen no disponible" : "Sin imagen adjunta"}
                  </Text>
                )}
                {i < facturas.length - 1 ? <View style={styles.adjSep} /> : null}
              </View>
            );
          })
        )}
      </Page>
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
