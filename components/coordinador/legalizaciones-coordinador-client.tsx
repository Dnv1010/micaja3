"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { pdf } from "@react-pdf/renderer";
import {
  LegalizacionPdf,
  legalizacionPdfPropsFromPayload,
  type FacturaPdf,
  type LegalizacionPdfStoredPayload,
} from "@/components/pdf/legalizacion-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, parseCOPString } from "@/lib/format";
import { parseFacturasPdfFromReporteCell } from "@/lib/legalizacion-factura-pdf-map";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type LegRow = Record<string, unknown>;

function estadoBadge(estado: string) {
  const e = estado.toLowerCase();
  if (e.includes("aprobado") && !e.includes("pendiente")) {
    return <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">{estado}</Badge>;
  }
  if (e.includes("rechaz")) {
    return <Badge className="border-red-700 bg-red-950 text-red-200">{estado}</Badge>;
  }
  return <Badge className="border-yellow-700 bg-yellow-950 text-yellow-200">{estado}</Badge>;
}

export function LegalizacionesCoordinadorClient() {
  const { data } = useSession();
  const coordinador = String(data?.user?.responsable || data?.user?.name || "");
  const searchParams = useSearchParams();
  const enviado = searchParams.get("enviado") === "1";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LegRow[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/legalizaciones");
        const json = await res.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!mounted) return;
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (coordinador) load();
    else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [coordinador]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(getCellCaseInsensitive(b, "Fecha")).localeCompare(String(getCellCaseInsensitive(a, "Fecha")))
    );
  }, [rows]);

  function parsePayload(raw: string): LegalizacionPdfStoredPayload | null {
    try {
      const p = JSON.parse(raw) as LegalizacionPdfStoredPayload;
      if (!p?.coordinador?.responsable || !Array.isArray(p.facturas)) return null;
      return p;
    } catch {
      return null;
    }
  }

  async function descargarPdf(row: LegRow) {
    const pdfDirect = String(getCellCaseInsensitive(row, "PDF_URL", "PdfURL") || "").trim();
    if (pdfDirect) {
      window.open(pdfDirect, "_blank");
      return;
    }

    const facturasCell = String(getCellCaseInsensitive(row, "Facturas_IDs", "FacturasIds") || "");
    const fromCell = parseFacturasPdfFromReporteCell(facturasCell);
    if (fromCell?.length && typeof fromCell[0] === "object") {
      try {
        const facturasPdf = fromCell as FacturaPdf[];
        const sector = String(getCellCaseInsensitive(row, "Sector") || "");
        const lim = sector === "Bogota" ? 1_000_000 : sector === "Costa Caribe" ? 3_000_000 : 1_000_000;
        const estado = String(getCellCaseInsensitive(row, "Estado") || "").toLowerCase();
        const firmaAd = String(getCellCaseInsensitive(row, "Firma_Admin") || "").trim();
        const props = {
          coordinador: {
            responsable: String(getCellCaseInsensitive(row, "Coordinador") || ""),
            cargo: "",
            cedula: "",
            sector,
            area: "",
          },
          facturas: facturasPdf,
          firmaCoordinador: String(getCellCaseInsensitive(row, "Firma_Coordinador", "FirmaCoordinador") || ""),
          firmaAdmin: estado.includes("firmado") && firmaAd ? firmaAd : undefined,
          fechaGeneracion: String(getCellCaseInsensitive(row, "Fecha") || new Date().toLocaleDateString("es-CO")),
          limiteZona: lim,
        };
        const blob = await pdf(<LegalizacionPdf {...props} />).toBlob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        const coord = props.coordinador.responsable.replace(/\s+/g, "_");
        a.download = `Legalizacion_${coord}_${props.fechaGeneracion.replace(/\//g, "-")}.pdf`;
        a.click();
        URL.revokeObjectURL(objUrl);
        return;
      } catch {
        /* continuar con otros orígenes */
      }
    }

    const datosRaw = getCellCaseInsensitive(row, "DatosPdfJSON");
    const parsed = datosRaw ? parsePayload(String(datosRaw)) : null;
    if (parsed) {
      try {
        const props = legalizacionPdfPropsFromPayload(parsed);
        const blob = await pdf(<LegalizacionPdf {...props} />).toBlob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        const coord = props.coordinador.responsable.replace(/\s+/g, "_");
        a.download = `Legalizacion_${coord}_${props.fechaGeneracion.replace(/\//g, "-")}.pdf`;
        a.click();
        URL.revokeObjectURL(objUrl);
        return;
      } catch {
        /* fallback a PDF almacenado */
      }
    }
    const url = getCellCaseInsensitive(row, "PDF_URL", "PdfURL");
    const b64 = getCellCaseInsensitive(row, "PdfBase64");
    if (url) {
      window.open(url, "_blank");
      return;
    }
    if (b64) {
      const a = document.createElement("a");
      a.href = b64.startsWith("data:") ? b64 : `data:application/pdf;base64,${b64}`;
      a.download = `legalizacion-${getCellCaseInsensitive(row, "ID")}.pdf`;
      a.click();
    }
  }

  return (
    <div className="space-y-4">
      {enviado ? (
        <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          ✅ Reporte enviado correctamente
        </p>
      ) : null}
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Legalizaciones enviadas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : sorted.length ? (
                sorted.map((r, i) => {
                  const estado = getCellCaseInsensitive(r, "Estado") || "Pendiente Admin";
                  const aprobado = estado.toLowerCase() === "firmado";
                  const tieneDatos = !!String(getCellCaseInsensitive(r, "DatosPdfJSON") || "").trim();
                  const tienePdf =
                    !!String(getCellCaseInsensitive(r, "PDF_URL", "PdfURL") || "").trim() ||
                    !!getCellCaseInsensitive(r, "PdfBase64");
                  const puedeDescargar = tieneDatos || tienePdf;
                  const desdeP = getCellCaseInsensitive(r, "Periodo_Desde") || getCellCaseInsensitive(r, "Periodo");
                  const hastaP = getCellCaseInsensitive(r, "Periodo_Hasta");
                  const periodoTxt = hastaP ? `${desdeP} → ${hastaP}` : desdeP || "—";
                  const totalC = getCellCaseInsensitive(r, "Total") || getCellCaseInsensitive(r, "TotalAprobado");
                  return (
                    <TableRow key={i}>
                      <TableCell>{getCellCaseInsensitive(r, "Fecha") || "—"}</TableCell>
                      <TableCell className="max-w-[220px] text-xs">{periodoTxt}</TableCell>
                      <TableCell>{formatCOP(parseCOPString(totalC))}</TableCell>
                      <TableCell>{estadoBadge(estado)}</TableCell>
                      <TableCell>
                        {puedeDescargar ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void descargarPdf(r)}
                          >
                            {aprobado ? "⬇ Descargar PDF firmado" : "⬇ Descargar borrador / PDF"}
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-bia-gray">
                    No hay reportes registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
