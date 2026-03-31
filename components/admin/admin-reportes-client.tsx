"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { FirmaCanvas } from "@/components/firma-canvas";
import type { FacturaPdf } from "@/components/pdf/legalizacion-pdf";
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
import { formatCOP, parseCOPString } from "@/lib/format";
import {
  extractIdsFromReporteFacturasCell,
  facturaRowToFacturaPdfForLegalizacion,
  parseFacturasPdfFromReporteCell,
} from "@/lib/legalizacion-factura-pdf-map";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type ReporteRow = Record<string, string>;
type FacturaRow = Record<string, unknown>;

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

function isMicajaSector(s: string): boolean {
  return s === "Bogota" || s === "Costa Caribe";
}

function firmaSrc(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("data:") || t.startsWith("http://") || t.startsWith("https://")) return t;
  return `data:image/png;base64,${t}`;
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

  function facturasDelReporteLocal(rep: ReporteRow): FacturaPdf[] {
    const raw = String(rep.Facturas_IDs || rep.FacturasIds || "");
    const parsed = parseFacturasPdfFromReporteCell(raw);
    if (parsed?.length && typeof parsed[0] === "object") {
      return parsed as FacturaPdf[];
    }
    const ids = new Set(extractIdsFromReporteFacturasCell(raw));
    return facturas
      .filter((f) => ids.has(String(getCellCaseInsensitive(f, "ID_Factura", "ID"))))
      .map((f) => facturaRowToFacturaPdfForLegalizacion(f, { area: "—" }));
  }

  async function confirmarFirmaAdmin() {
    if (!activo || !firmaAdmin.trim()) return;
    setProcesando(true);
    setErrorMsg("");
    try {
      const sectorRep = String(activo.Sector || adminSector);
      const limite =
        sectorRep === "Bogota" ? 1_000_000 : sectorRep === "Costa Caribe" ? 3_000_000 : limiteAprobacionZona(sectorRep);
      const coordNombre = String(activo.Coordinador || "");
      const firmaCoord = String(activo.Firma_Coordinador || activo.FirmaCoordinador || "");
      const generadoTxt = new Date().toLocaleDateString("es-CO");

      const rawCell = String(activo.Facturas_IDs || activo.FacturasIds || "");
      const parsedCell = parseFacturasPdfFromReporteCell(rawCell);
      let facturasPdf: FacturaPdf[] = [];
      if (parsedCell?.length && typeof parsedCell[0] === "object") {
        facturasPdf = parsedCell as FacturaPdf[];
      } else {
        const ids = extractIdsFromReporteFacturasCell(rawCell);
        const facturasRes = await Promise.all(
          ids.map((id) => fetch(`/api/facturas/${encodeURIComponent(id)}`).then((r) => r.json()))
        );
        const fetched = facturasRes.map((r) => r.data as FacturaRow | undefined).filter(Boolean) as FacturaRow[];
        facturasPdf =
          fetched.length > 0
            ? fetched.map((f) => facturaRowToFacturaPdfForLegalizacion(f, { area: "—" }))
            : facturasDelReporteLocal(activo);
      }

      const [{ pdf }, { LegalizacionPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/legalizacion-pdf"),
      ]);

      const doc = (
        <LegalizacionPdf
          coordinador={{
            responsable: coordNombre,
            cargo: "",
            sector: sectorRep,
            area: "",
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
      fd.append("fecha", String(activo.Fecha || "").trim() || new Date().toISOString().slice(0, 10));

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
            <DialogTitle>Revisar y firmar</DialogTitle>
          </DialogHeader>
          {activo ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
                <div>
                  <span className="text-zinc-500">Coordinador</span>
                  <p className="text-zinc-100">{activo.Coordinador || "—"}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Sector</span>
                  <p className="text-zinc-100">{activo.Sector || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-zinc-500">Período</span>
                  <p className="text-zinc-100">
                    {activo.Periodo_Desde || activo.Periodo || "—"} al {activo.Periodo_Hasta || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Total</span>
                  <p className="text-zinc-100">
                    {formatCOP(parseCOPString(String(activo.Total || activo.TotalAprobado || "0")))}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-1 text-sm text-zinc-400">Firma del coordinador:</p>
                {firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || "")) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || ""))}
                    alt="Firma coordinador"
                    className="h-20 max-w-full rounded border border-zinc-700 bg-white object-contain"
                  />
                ) : (
                  <p className="text-xs text-zinc-500">Sin firma registrada</p>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-1 text-sm text-zinc-400">Tu firma:</p>
                <FirmaCanvas
                  width={400}
                  height={150}
                  onFirma={(b64) => setFirmaAdmin(b64)}
                  onLimpiar={() => setFirmaAdmin("")}
                />
              </div>

              {errorMsg ? <p className="mt-2 text-sm text-red-400">{errorMsg}</p> : null}

              <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" onClick={() => setActivo(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-700 hover:bg-emerald-600"
                  disabled={!firmaAdmin.trim() || procesando}
                  onClick={() => void confirmarFirmaAdmin()}
                >
                  {procesando ? "Generando PDF..." : "✅ Firmar y generar PDF"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
