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

/** Rayo turquesa BIA — mismo polígono del manual, fill `#08DDBC` (Aqua Green). */
const RAYO_SVG_BASE64 =
  "data:image/svg+xml;base64," +
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMiAyMCI+PHBvbHlnb24gcG9pbnRzPSI3LDAgMSwxMSA2LDExIDUsMjAgMTIsOCA3LDgiIGZpbGw9IiMwOEREQkMiLz48L3N2Zz4=";

/**
 * Respaldo si el SVG no se dibuja: en `LegalizacionPdf` cambiar `src={RAYO_LOGO_SRC}` a `src={RAYO_PNG_BASE64}`.
 * (react-pdf documenta JPG/PNG en data URI; el SVG suele funcionar en la mayoría de casos.)
 */
export const RAYO_PNG_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAUCAYAAACkK5/bAAAACXBIWXMAAAsTAAALEwEAmpwYAAAApklEQVQoz5WSMQ6DMAxFHYTEzsDQkzAzc4fuUKkjF2HnJFygEqJ/SxMIiSoReZL9bT8nxph/MLMHgBvJC8kJwAXACmABsAI4F+4A9gT3QvKWVXFVbgDuJFckByRnID8AO4AdwA3ACeBR+ASwAzgR3AucSM4kf4ALgAfAHeAFcAN4ArgAOBI8Ac4AVgT3IucTM4kXwAXADeAA8AN4AbgCuAA4AjgSeIf6QHICcAN4A3gA/AFMA0qoJwAAAABJRU5ErkJggg==";

const RAYO_LOGO_SRC = RAYO_SVG_BASE64;

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

/** OPS en PDF sin tildes problemáticas en algunos renderers. */
function textoCentroCostosPdf(s: string): string {
  const t = (s || "--").trim() || "--";
  return t.replace(/ó/g, "o").replace(/Ó/g, "O").replace(/é/g, "e").replace(/É/g, "E");
}

function textoConceptoCelda(concepto: string): string {
  const c = (concepto || "").trim();
  if (!c || c.startsWith("data:")) return "--";
  return c;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Roboto", fontSize: 9, padding: 30, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 12 },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
  },
  logoTexto: {
    fontSize: 24,
    fontWeight: 700,
    color: "#001035",
    fontFamily: "Roboto",
    letterSpacing: 0.5,
  },
  logoRayo: {
    width: 16,
    height: 26,
  },
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
  adjBlockWrap: { marginBottom: 20 },
  adjHeading: { fontSize: 10, fontWeight: 700, marginBottom: 4, fontFamily: "Roboto" },
  adjMeta: { fontSize: 8, color: "#555", marginBottom: 6, fontFamily: "Roboto" },
  adjImg: { width: "100%", height: 440, objectFit: "contain" },
  adjSep: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginTop: 12 },
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
        <View style={styles.logoContainer}>
          <Text style={styles.logoTexto}>Bia</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (PDF, no HTML) */}
          <Image style={styles.logoRayo} src={RAYO_LOGO_SRC} />
        </View>
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
            <Text style={[styles.td, styles.wConcepto]}>{textoConceptoCelda(f.concepto)}</Text>
            <Text style={[styles.td, styles.wFactura]}>{f.nit?.trim() ? f.nit : "--"}</Text>
            <Text style={[styles.td, styles.wCentro]}>{textoCentroCostosPdf(f.area || "--")}</Text>
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
              <View key={f.id || `a-${i}`} style={styles.adjBlockWrap} wrap={false}>
                <Text style={styles.adjHeading}>
                  Factura {i + 1} — {f.proveedor || "--"}
                </Text>
                <Text style={styles.adjMeta}>
                  No. Factura: {f.nit || "--"} | Fecha: {f.fecha || "--"} | Valor:{" "}
                  {formatCOPpdf(valorNum(f.valor))}
                </Text>
                {imgSrc ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text -- adjunto en PDF */
                  <Image style={styles.adjImg} src={imgSrc} />
                ) : (
                  <Text style={{ fontSize: 8, color: "#999", fontStyle: "italic", fontFamily: "Roboto" }}>
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
