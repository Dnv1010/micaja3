/* eslint-disable @next/next/no-img-element */
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
import { BiaAlert } from "@/components/ui/bia-alert";
import { BiaConfirm } from "@/components/ui/bia-confirm";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { findFallbackUserByResponsable } from "@/lib/users-fallback";
import { formatCOP, parseCOPString } from "@/lib/format";
import {
  extractIdsFromReporteFacturasCell,
  facturaRowToFacturaPdfForLegalizacion,
  parseFacturasJsonFromSheetCell,
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

/** URL para previsualizar adjunto (data URL, http(s) o Drive por id). */
function adjuntoVistaSrc(f: FacturaPdf): string | null {
  const u = f.imagenUrl?.trim();
  if (u && !u.startsWith("Facturas_Images")) {
    if (u.startsWith("data:") || u.startsWith("http://") || u.startsWith("https://")) {
      return u;
    }
  }
  const id = f.driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?id=${id}`;
  return null;
}

function urlParaProxyFactura(f: FacturaPdf): string | null {
  const u = f.imagenUrl?.trim();
  if (u?.startsWith("data:")) return null;
  if (u && (u.startsWith("http://") || u.startsWith("https://"))) {
    if (u.includes("drive.google.com") || u.includes("googleusercontent.com")) return u;
    return null;
  }
  const id = f.driveFileId?.trim();
  if (id) return `https://drive.google.com/uc?id=${id}`;
  return null;
}

async function resolveFacturaImages(facturas: FacturaPdf[]): Promise<FacturaPdf[]> {
  return Promise.all(
    facturas.map(async (f) => {
      const target = urlParaProxyFactura(f);
      if (!target) return f;
      try {
        const res = await fetch(`/api/proxy-imagen-base64?url=${encodeURIComponent(target)}`);
        if (!res.ok) return f;
        const j = (await res.json()) as { dataUrl?: string };
        if (!j.dataUrl) return f;
        return { ...f, imagenUrl: j.dataUrl };
      } catch {
        return f;
      }
    })
  );
}

export function AdminReportesClient() {
  const { data } = useSession();
  const adminSector = String(data?.user?.sector || "Bogota");

  const [loading, setLoading] = useState(true);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [activo, setActivo] = useState<ReporteRow | null>(null);
  const [facturasReporte, setFacturasReporte] = useState<FacturaPdf[]>([]);
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [firmaAdmin, setFirmaAdmin] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null);
  const [resumenIA, setResumenIA] = useState("");
  const [cargandoResumenIA, setCargandoResumenIA] = useState(false);

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

  function abrirReporte(reporte: ReporteRow) {
    setActivo(reporte);
    setFirmaAdmin("");
    setImagenModal(null);
    try {
      const raw = String(reporte.Facturas_IDs || reporte.FacturasIds || "[]");
      let parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === "object" &&
        parsed[0] !== null
      ) {
        setFacturasReporte(parsed as FacturaPdf[]);
        return;
      }
    } catch {
      /* usar fallback */
    }
    setFacturasReporte(facturasDelReporteLocal(reporte));
  }

  async function confirmarFirmaAdmin() {
    if (!activo || !firmaAdmin.trim()) return;
    setProcesando(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const sectorRep = String(activo.Sector || adminSector);
      const limite = limiteAprobacionZona(sectorRep);
      const coordNombre = String(activo.Coordinador || "");
      const coordFallback = findFallbackUserByResponsable(coordNombre);
      const firmaCoord = String(activo.Firma_Coordinador || activo.FirmaCoordinador || "");
      const generadoTxt = new Date().toLocaleDateString("es-CO");

      const rawFacturas = String(activo.Facturas_IDs || activo.FacturasIds || "[]").trim();
      console.log("[admin firma] Facturas_IDs raw:", activo.Facturas_IDs);

      let facturasPdf: FacturaPdf[] = [];

      try {
        const parsedUnknown = parseFacturasJsonFromSheetCell(rawFacturas || "[]");
        if (parsedUnknown === null || !Array.isArray(parsedUnknown) || parsedUnknown.length === 0) {
          facturasPdf = facturasDelReporteLocal(activo);
        } else if (typeof parsedUnknown[0] === "string") {
          console.log("[admin firma] Solo IDs, cargando facturas...");
          const responses = await Promise.all(
            (parsedUnknown as string[]).map((id) =>
              fetch(`/api/facturas/${encodeURIComponent(id)}`)
                .then((r) => r.json())
                .catch(() => null)
            )
          );
          const rows = responses
            .map((r) =>
              r && typeof r === "object" && r !== null && "data" in r
                ? (r as { data: FacturaRow }).data
                : null
            )
            .filter(Boolean) as FacturaRow[];
          facturasPdf = rows.map((f) => facturaRowToFacturaPdfForLegalizacion(f, { area: "—" }));
          if (facturasPdf.length === 0) facturasPdf = facturasDelReporteLocal(activo);
        } else if (typeof parsedUnknown[0] === "object" && parsedUnknown[0] !== null) {
          facturasPdf = (parsedUnknown as FacturaRow[]).map((row) =>
            facturaRowToFacturaPdfForLegalizacion(row, { area: "—" })
          );
        } else {
          facturasPdf = facturasDelReporteLocal(activo);
        }
      } catch (e) {
        console.error("[admin firma] Error parseando facturas:", e);
        facturasPdf = facturasDelReporteLocal(activo);
      }

      console.log("[admin firma] Facturas parseadas:", facturasPdf.length, facturasPdf);

      const facturasConImagenes = await resolveFacturaImages(facturasPdf);

      const [{ pdf }, { LegalizacionPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/legalizacion-pdf"),
      ]);

      const doc = (
        <LegalizacionPdf
          coordinador={{
            responsable: coordNombre,
            cargo: coordFallback?.cargo || "Field Ops Planner",
            cedula: coordFallback?.cedula || "",
            sector: sectorRep,
            area: coordFallback?.area || "",
          }}
          facturas={facturasConImagenes}
          firmaCoordinador={firmaCoord}
          firmaAdmin={firmaAdmin}
          fechaGeneracion={generadoTxt}
          limiteZona={limite}
        />
      );
      const blob = await pdf(doc).toBlob();

      const idRep = reporteId(activo);
      const sectorUpload = isMicajaSector(sectorRep) ? sectorRep : adminSector;
      const fd = new FormData();
      fd.append(
        "file",
        blob,
        `Reporte_${coordNombre.replace(/\s+/g, "_")}_Firmado_${Date.now()}.pdf`
      );
      fd.append("sector", sectorUpload);
      fd.append("responsable", coordNombre || "admin");
      fd.append("fecha", new Date().toISOString().slice(0, 7));

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
      setSuccessMsg("Reporte firmado y PDF generado correctamente");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al generar el PDF. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarReporteConfirmado(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await cargar();
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-4">
      {confirmEliminarId ? (
        <BiaConfirm
          mensaje="¿Eliminar este reporte?"
          confirmLabel="Eliminar"
          onCancelar={() => setConfirmEliminarId(null)}
          onConfirmar={() => {
            const id = confirmEliminarId;
            setConfirmEliminarId(null);
            void eliminarReporteConfirmado(id);
          }}
        />
      ) : null}
      {successMsg ? <BiaAlert type="success" message={successMsg} /> : null}
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
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
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
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
                          <Badge className="border-bia-aqua/30 bg-bia-aqua/10 text-bia-aqua">{est}</Badge>
                        ) : (
                          <Badge className="border-amber-700 bg-amber-950 text-amber-200">{est}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {est === "Pendiente Admin" ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => abrirReporte(r)}>
                              ✍️ Revisar y firmar
                            </Button>
                          ) : null}
                          {est === "Firmado" && pdfUrl ? (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center rounded-lg border border-bia-gray/30 px-2.5 text-[0.8rem] text-white hover:bg-bia-blue-mid"
                            >
                              ⬇ Descargar
                            </a>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 text-red-400"
                            onClick={() => setConfirmEliminarId(id)}
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
                  <TableCell colSpan={7} className="text-bia-gray">
                    No hay reportes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!activo}
        onOpenChange={(o) => {
          if (!o) {
            setActivo(null);
            setImagenModal(null);
            setFacturasReporte([]);
            setResumenIA("");
            setCargandoResumenIA(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-bia-gray/20 bg-bia-blue-mid text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar y firmar</DialogTitle>
          </DialogHeader>
          {activo ? (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
                <div>
                  <span className="text-bia-gray">Coordinador</span>
                  <p className="text-white">{activo.Coordinador || "—"}</p>
                </div>
                <div>
                  <span className="text-bia-gray">Sector</span>
                  <p className="text-white">{activo.Sector || "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-bia-gray">Período</span>
                  <p className="text-white">
                    {activo.Periodo_Desde || activo.Periodo || "—"} al {activo.Periodo_Hasta || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-bia-gray">Total</span>
                  <p className="text-white">
                    {formatCOP(parseCOPString(String(activo.Total || activo.TotalAprobado || "0")))}
                  </p>
                </div>
              </div>

              {facturasReporte.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-white">
                    Facturas incluidas ({facturasReporte.length})
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-[#525A72]/20">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#001035] text-[#8892A4]">
                        <tr>
                          <th className="px-3 py-2 text-left">No.</th>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-left">Concepto</th>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 text-center">Adjunto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturasReporte.map((f, i) => {
                          const imgSrc = adjuntoVistaSrc(f);
                          return (
                            <tr
                              key={`${f.id || i}-${i}`}
                              className="border-t border-[#525A72]/10 hover:bg-[#0A1B4D]/50"
                            >
                              <td className="px-3 py-2 text-[#8892A4]">{i + 1}</td>
                              <td className="px-3 py-2 text-white">{f.proveedor || "—"}</td>
                              <td className="px-3 py-2 text-[#8892A4]">{f.concepto || "—"}</td>
                              <td className="px-3 py-2 text-[#8892A4]">{f.fecha || "—"}</td>
                              <td className="px-3 py-2 text-right text-sm font-medium text-[#08DDBC]">
                                ${Number(f.valor || 0).toLocaleString("es-CO")}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {imgSrc ? (
                                  <button
                                    type="button"
                                    onClick={() => setImagenModal(imgSrc)}
                                    className="text-xs text-[#08DDBC] hover:underline"
                                  >
                                    🖼️ Ver
                                  </button>
                                ) : (
                                  <span className="text-xs text-[#525A72]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#001035]">
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-2 text-right text-xs font-semibold text-[#8892A4]"
                          >
                            Total:
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-white">
                            $
                            {facturasReporte
                              .reduce((s, f) => s + Number(f.valor || 0), 0)
                              .toLocaleString("es-CO")}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : null}

              {(resumenIA || cargandoResumenIA) && (
                <div className="my-4 rounded-xl border border-[#4728EF]/20 bg-[#4728EF]/5 p-4">
                  <p className="mb-2 text-xs font-semibold text-[#DEDEF9]">✨ Análisis IA</p>
                  {cargandoResumenIA ? (
                    <p className="animate-pulse text-sm text-[#525A72]">Generando resumen...</p>
                  ) : (
                    <p className="text-sm leading-relaxed text-[#DEDEF9]">{resumenIA}</p>
                  )}
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-sm text-[#8892A4]">Firma del coordinador:</p>
                {firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || "")) ? (
                  <img
                    src={firmaSrc(String(activo.Firma_Coordinador || activo.FirmaCoordinador || ""))}
                    alt="Firma coordinador"
                    className="h-20 rounded border border-[#525A72]/20 bg-white object-contain p-2"
                  />
                ) : (
                  <p className="text-xs italic text-[#525A72]">Sin firma registrada</p>
                )}
              </div>

              <div className="mt-4">
                <p className="mb-1 text-sm text-bia-gray-light">Tu firma:</p>
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
                  className="bg-bia-aqua text-bia-blue hover:bg-[#06C4A8]"
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

      {imagenModal ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImagenModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#0A1B4D] px-4 py-2">
              <span className="text-sm font-medium text-white">Factura adjunta</span>
              <button
                type="button"
                onClick={() => setImagenModal(null)}
                className="text-[#525A72] hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <img
              src={
                imagenModal.startsWith("data:")
                  ? imagenModal
                  : `/api/proxy-imagen?url=${encodeURIComponent(imagenModal)}`
              }
              alt="Factura"
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
