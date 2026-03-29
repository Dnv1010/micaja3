/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image no usa alt */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import type { FacturaRow } from "@/types/models";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, textAlign: "center", marginBottom: 16, fontWeight: "bold" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 140, fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginTop: 12,
    paddingBottom: 4,
    fontWeight: "bold",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, paddingVertical: 4 },
  cellConcepto: { width: "22%" },
  cellFactura: { width: "14%" },
  cellCc: { width: "14%" },
  cellCat: { width: "14%" },
  cellFecha: { width: "12%" },
  cellValor: { width: "14%", textAlign: "right" },
  cellNo: { width: "6%" },
  total: { marginTop: 8, textAlign: "right", fontWeight: "bold" },
  footer: { marginTop: 24, fontSize: 8, fontStyle: "italic" },
  facturaBlock: { marginBottom: 16 },
  facturaImg: { maxHeight: 400, objectFit: "contain", marginTop: 8 },
});

export interface InformePdfProps {
  nombre: string;
  fecha: string;
  cargo: string;
  cedula: string;
  ciudadSector: string;
  montoAsignado: number;
  valorReembolsar: number;
  pctEjecutado: number;
  facturas: FacturaRow[];
  firmaLegaliza?: string;
  firmaAprueba?: string;
  logoDataUrl?: string;
}

function formatCop(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

export function InformePdfDocument({
  nombre,
  fecha,
  cargo,
  cedula,
  ciudadSector,
  montoAsignado,
  valorReembolsar,
  pctEjecutado,
  facturas,
  firmaLegaliza,
  firmaAprueba,
  logoDataUrl,
}: InformePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {logoDataUrl ? (
          <Image src={logoDataUrl} style={{ width: 120, marginBottom: 12 }} />
        ) : (
          <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 12 }}>
            BIA ENERGY SAS ESP
          </Text>
        )}
        <Text style={styles.title}>LEGALIZACIÓN DE CAJA MENOR GASTOS</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Nombre:</Text>
          <Text>{nombre}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha:</Text>
          <Text>{fecha}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cargo:</Text>
          <Text>{cargo}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>CC:</Text>
          <Text>{cedula}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Subsidiaria:</Text>
          <Text>BIA ENERGY SAS ESP</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Responsable de Autorización:</Text>
          <Text>Hernan Manjarres</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cuenta Mayor:</Text>
          <Text>11051015</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ciudad / Sector:</Text>
          <Text>{ciudadSector}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Monto Asignado:</Text>
          <Text>{formatCop(montoAsignado)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Valor a Reembolsar:</Text>
          <Text>{formatCop(valorReembolsar)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>% Ejecutado:</Text>
          <Text>{pctEjecutado}%</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.cellNo}>No.</Text>
          <Text style={styles.cellConcepto}>CONCEPTO</Text>
          <Text style={styles.cellFactura}>No. FACTURA</Text>
          <Text style={styles.cellCc}>C.C.</Text>
          <Text style={styles.cellCat}>CATEGORÍA</Text>
          <Text style={styles.cellFecha}>FECHA</Text>
          <Text style={styles.cellValor}>VALOR</Text>
        </View>
        {facturas.map((f, i) => (
          <View key={f.ID_Factura} style={styles.tableRow} wrap={false}>
            <Text style={styles.cellNo}>{i + 1}</Text>
            <Text style={styles.cellConcepto}>
              Actividad en {f.Ciudad || ciudadSector}
            </Text>
            <Text style={styles.cellFactura}>{f.Num_Factura}</Text>
            <Text style={styles.cellCc}>{f["Centro de Costo"]}</Text>
            <Text style={styles.cellCat}>{f.Tipo_servicio}</Text>
            <Text style={styles.cellFecha}>{f.Fecha_Factura}</Text>
            <Text style={styles.cellValor}>
              {formatCop(Number(String(f.Monto_Factura).replace(/\./g, "").replace(",", ".")) || 0)}
            </Text>
          </View>
        ))}

        <Text style={styles.total}>Total: {formatCop(valorReembolsar)} COP</Text>

        <View style={{ marginTop: 20 }}>
          <Text>Firma empleado que legaliza:</Text>
          {firmaLegaliza ? (
            <Image src={firmaLegaliza} style={{ width: 160, height: 60, marginTop: 4 }} />
          ) : null}
          <Text style={{ marginTop: 4 }}>{nombre}</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text>Firma jefe directo (Aprueba):</Text>
          {firmaAprueba ? (
            <Image src={firmaAprueba} style={{ width: 160, height: 60, marginTop: 4 }} />
          ) : null}
          <Text style={{ marginTop: 4 }}>Hernan Manjarres</Text>
        </View>

        <Text style={styles.footer}>
          TODOS LOS GASTOS DEBEN ENCONTRARSE DEBIDAMENTE SOPORTADOS Y TODAS LAS FACTURAS DEBEN
          ESTAR A NOMBRE DE BIA ENERGY S.A.S. E.S.P NIT 901.588.412-3.
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 12, marginBottom: 12, fontWeight: "bold" }}>
          Facturas adjuntas
        </Text>
        {facturas.map((f) => (
          <View key={`img-${f.ID_Factura}`} style={styles.facturaBlock} wrap={false}>
            <Text>
              Factura: {f.Num_Factura} — Fecha: {f.Fecha_Factura}
            </Text>
            {f.Adjuntar_Factura ? (
              <Image src={f.Adjuntar_Factura} style={styles.facturaImg} />
            ) : (
              <Text style={{ color: "#666" }}>(Sin imagen adjunta)</Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
