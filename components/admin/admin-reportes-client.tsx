"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { pdf } from "@react-pdf/renderer";
import { FirmaCanvas } from "@/components/firma-canvas";
import {
  LegalizacionPdf,
  type FacturaPdf,
} from "@/components/pdf/legalizacion-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type ReporteRow = Record<string, string>;
type FacturaRow = Record<string, unknown>;

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

function isMicajaSector(s: string): boolean {
  return s === "Bogota" || s === "Costa Caribe";
}

function parseIds(raw: string): string[] {
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return String(raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export function AdminReportesClient() {
  const { data } = useSession();
  const adminSector = String(data?.user?.sector || "Bogota");

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [activo, setActivo] = useState<ReporteRow | null>(null);
  const [firmaAdmin, setFirmaAdmin] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, fRes] = await Promise.all([fetch("/api/legalizaciones"), fetch("/api/facturas")]);
      const [rJson, fJson] = await Promise.all([
        rRes.json().catch(() => ({ data: [] })),
        fRes.json().catch(() => ({ data: [] })),
      ]);
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
      setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
    } catch {
      setReportes([]);
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function facturasDelReporte(rep: ReporteRow): FacturaPdf[] {
    const ids = new Set(parseIds(String(rep.Facturas_IDs || rep.FacturasIds || "")));
    const areaCoord = "—";
    return facturas
      .filter((f) => ids.has(String(getCellCaseInsensitive(f, "ID_Factura", "ID"))))
      .map((f) => {
        const id = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "");
        const img = getCellCaseInsensitive(f, "ImagenURL", "URL", "Adjuntar_Factura") || "";
        const driveId = getCellCaseInsensitive(f, "DriveFileId") || "";
        return {
          id,
          fecha: formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura")),
          proveedor: getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-",
          nit: getCellCaseInsensitive(f, "NIT", "Nit_Factura", "Num_Factura") || "-",
          concepto: getCellCaseInsensitive(f, "Concepto", "Observacion") || "-",
          valor: parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")),
          tipoFactura: getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "—",
          area: getCellCaseInsensitive(f, "Area", "Centro de Costo", "InfoCentroCosto") || areaCoord,
          imagenUrl: String(img).trim() || undefined,
          driveFileId: String(driveId).trim() || undefined,
        };
      });
  }

  async function confirmarFirmaAdmin() {
    if (!activo || !firmaAdmin.trim()) return;
    setProcesando(true);
    setErrorMsg("");
    try {
      const sectorRep = String(activo.Sector || adminSector);
      const limite = limiteAprobacionZona(sectorRep);
      const coordNombre = String(activo.Coordinador || "");
      const firmaCoord = String(activo.Firma_Coordinador || activo.FirmaCoordinador || "");
      const generadoTxt = new Date().toLocaleDateString("es-CO");

      const facturasPdf = facturasDelReporte(activo);

      const doc = (
        <LegalizacionPdf
          coordinador={{
            responsable: coordNombre,
            cargo: "Coordinador de zona",
            sector: sectorRep,
            area: "—",
          }}
          facturas={facturasPdf}
          firmaCoordinador={firmaCoord}
          firmaAdmin={firmaAdmin}
          fechaGeneracion={generadoTxt}
          limiteZona={limite}
        />
      );

      const blob = await pdf(doc).toBlob();
      const idRep = reporteId(activo);
      const fd = new FormData();
      fd.append("file", blob, `Reporte_${idRep}.pdf`);
      fd.append("destino", "reportes");
      fd.append("sector", isMicajaSector(sectorRep) ? sectorRep : adminSector);
      fd.append("responsable", coordNombre || "admin");
      fd.append("fecha", new Date().toISOString().slice(0, 10));

      const upRes = await fetch("/api/facturas/upload", { method: "POST", body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        throw new Error(String(upJson.error || "Error al subir PDF"));
      }
      const url = String(upJson.url || "").trim();
      if (!url) throw new Error("Drive no devolvió URL");

      const patchRes = await fetch(`/api/legalizaciones/${encodeURIComponent(idRep)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmaAdmin, pdfUrl: url }),
      });
      if (!patchRes.ok) {
        const pj = await patchRes.json().catch(() => ({}));
        throw new Error(String(pj.error || "Error al guardar firma"));
      }

      setActivo(null);
      setFirmaAdmin("");
      await cargar();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarReporte(id: string) {
    if (!id || !window.confirm("¿Eliminar este reporte?")) return;
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await cargar();
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Reportes de legalización</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Coordinador</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : reportes.length ? (
                reportes.map((r, i) => {
                  const id = reporteId(r);
                  const est = String(r.Estado || "");
                  const pdfUrl = String(r.PDF_URL || r.PdfURL || "").trim();
                  return (
                    <TableRow key={`${id}-${i}`}>
                      <TableCell>{r.Fecha || "—"}</TableCell>
                      <TableCell>{r.Coordinador || "—"}</TableCell>
                      <TableCell>{r.Sector || "—"}</TableCell>
                      <TableCell className="max-w-[200px] text-xs whitespace-pre-wrap">
                        {r.Periodo_Desde || r.Periodo || "—"} → {r.Periodo_Hasta || "—"}
                      </TableCell>
                      <TableCell>{formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}</TableCell>
                      <TableCell>
                        {est === "Firmado" ? (
                          <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">{est}</Badge>
                        ) : (
                          <Badge className="border-amber-700 bg-amber-950 text-amber-200">{est}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {est === "Pendiente Admin" ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => setActivo(r)}>
                              ✍️ Revisar y firmar
                            </Button>
                          ) : null}
                          {est === "Firmado" && pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center rounded-lg border border-zinc-600 px-2.5 text-[0.8rem] text-zinc-100 hover:bg-zinc-800"
                            >
                              ⬇ Descargar
                            </a>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-900 text-red-300"
                            onClick={() => void eliminarReporte(id)}
                          >
                            🗑️
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-zinc-500">
                    No hay reportes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!activo} onOpenChange={(o) => !o && setActivo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reporte de {activo?.Coordinador}</DialogTitle>
          </DialogHeader>
          {activo ? (
            <>
              <p className="text-sm text-zinc-300">
                Período: {activo.Periodo_Desde || activo.Periodo || "—"} al {activo.Periodo_Hasta || "—"}
              </p>
              <p className="text-sm text-zinc-300">
                Total: {formatCOP(parseCOPString(String(activo.Total || activo.TotalAprobado || "0")))}
              </p>
              {errorMsg ? <p className="text-sm text-red-400">{errorMsg}</p> : null}
              <FirmaCanvas
                width={400}
                height={200}
                onFirma={(b64) => setFirmaAdmin(b64)}
                onLimpiar={() => setFirmaAdmin("")}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setActivo(null)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-emerald-700 hover:bg-emerald-600"
                  disabled={!firmaAdmin.trim() || procesando}
                  onClick={() => void confirmarFirmaAdmin()}
                >
                  {procesando ? "Generando..." : "Firmar y generar PDF"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
