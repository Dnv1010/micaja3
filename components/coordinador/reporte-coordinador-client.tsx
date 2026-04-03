"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FirmaCanvas } from "@/components/firma-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BiaConfirm } from "@/components/ui/bia-confirm";
import { etiquetaZona, limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { facturaRowToFacturaPdfForLegalizacion } from "@/lib/legalizacion-factura-pdf-map";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { cn } from "@/lib/utils";

type FacturaRow = Record<string, unknown>;
type ReporteRow = Record<string, string>;

function facturaEstadoEffective(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

export function ReporteCoordinadorClient() {
  const { data } = useSession();
  const sector = String(data?.user?.sector || "");
  const coordinador = String(data?.user?.responsable || data?.user?.name || "");
  const zonaLabel = etiquetaZona(sector);
  const limite = limiteAprobacionZona(sector);

  const [tab, setTab] = useState<"nuevo" | "pdfs">("nuevo");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<FacturaRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [signOpen, setSignOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [yaEnviando, setYaEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const [repLoading, setRepLoading] = useState(true);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null);

  const cargarReportes = useCallback(async () => {
    setRepLoading(true);
    try {
      const res = await fetch("/api/legalizaciones");
      const json = await res.json().catch(() => ({ data: [] }));
      setReportes(Array.isArray(json.data) ? json.data : []);
    } catch {
      setReportes([]);
    } finally {
      setRepLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarReportes();
  }, [cargarReportes]);

  async function cargarDisponibles() {
    setLoading(true);
    setOkMsg("");
    try {
      const q = new URLSearchParams({
        zonaSector: sector,
        estado: "aprobada",
        desde,
        hasta,
      });
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      const raw = (Array.isArray(json.data) ? json.data : []) as FacturaRow[];
      const filtradas = raw.filter((f: FacturaRow) => {
        const est = facturaEstadoEffective(f).toLowerCase();
        if (est === "completada") return false;
        return est === "aprobada";
      });
      setLista(filtradas);
      setSelected(new Set());
    } catch {
      setLista([]);
    } finally {
      setLoading(false);
    }
  }

  const selectedRows = useMemo(
    () => lista.filter((f) => selected.has(String(getCellCaseInsensitive(f, "ID_Factura", "ID")))),
    [lista, selected]
  );

  const totalSeleccionado = useMemo(
    () =>
      selectedRows.reduce(
        (acc, f) => acc + parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")),
        0
      ),
    [selectedRows]
  );

  const superaLimite = totalSeleccionado > limite;
  const pctBarra = limite > 0 ? Math.min(100, (totalSeleccionado / limite) * 100) : 0;

  function toggleId(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  async function onFirmaLista(firmaDataUrl: string) {
    if (yaEnviando || !selectedRows.length || superaLimite) return;
    setYaEnviando(true);
    setSignOpen(false);
    setProcesando(true);
    setOkMsg("");

    const user = data?.user;
    const userArea = String(user?.area || "");

    try {
      const facturasIds = selectedRows.map((f) => String(getCellCaseInsensitive(f, "ID_Factura", "ID")));
      const facturasPdf = selectedRows.map((f) =>
        facturaRowToFacturaPdfForLegalizacion(f, { area: userArea })
      );

      const res = await fetch("/api/legalizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodoDe: desde,
          periodoHasta: hasta,
          total: totalSeleccionado,
          facturasIds,
          facturasPdf,
          firmaCoordinador: firmaDataUrl,
          pdfUrl: "",
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setOkMsg(err.error || "Error al guardar el reporte");
        return;
      }

      setOkMsg("✅ Reporte enviado al administrador para su firma");
      setSelected(new Set());
      setTab("pdfs");
      await cargarReportes();
    } catch (e) {
      console.error("onFirmaLista error:", e);
      setOkMsg("Error al enviar el reporte. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  async function eliminarReporteConfirmado(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) await cargarReportes();
    } catch {
      /* noop */
    }
  }

  function estadoReporteBadge(estado: string) {
    const e = estado.toLowerCase();
    if (e.includes("firmado")) {
      return <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">{estado}</Badge>;
    }
    return <Badge className="border-amber-700 bg-amber-950 text-amber-200">{estado}</Badge>;
  }

  return (
    <div className="space-y-6">
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "nuevo" ? "default" : "outline"}
          className={cn(tab === "nuevo" ? "bg-bia-aqua text-bia-blue font-semibold" : "border-bia-gray/30")}
          onClick={() => setTab("nuevo")}
        >
          📋 Nuevo reporte
        </Button>
        <Button
          type="button"
          variant={tab === "pdfs" ? "default" : "outline"}
          className={cn(tab === "pdfs" ? "bg-bia-aqua text-bia-blue font-semibold" : "border-bia-gray/30")}
          onClick={() => setTab("pdfs")}
        >
          📄 PDFs
        </Button>
      </div>

      {tab === "nuevo" ? (
        <>
          <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
            <CardHeader>
              <CardTitle>Paso 1 — Período y facturas aprobadas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="bg-bia-blue border-bia-gray/40"
                />
              </div>
              <div className="space-y-1">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="bg-bia-blue border-bia-gray/40"
                />
              </div>
              <Button
                type="button"
                className="bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid"
                onClick={() => void cargarDisponibles()}
                disabled={loading || !desde || !hasta}
              >
                {loading ? "Cargando..." : "Cargar facturas disponibles"}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="border-bia-gray/20 bg-bia-blue-mid text-white lg:col-span-2">
              <CardHeader>
                <CardTitle>Paso 2 — Seleccionar facturas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>NIT</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                        </TableCell>
                      </TableRow>
                    ) : lista.length ? (
                      lista.map((f, i) => {
                        const id = String(getCellCaseInsensitive(f, "ID_Factura", "ID"));
                        return (
                          <TableRow key={`${id}-${i}`}>
                            <TableCell>
                              <Checkbox
                                checked={selected.has(id)}
                                onCheckedChange={(v) => toggleId(id, v === true)}
                              />
                            </TableCell>
                            <TableCell>
                              {formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}
                            </TableCell>
                            <TableCell>{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                            <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                            <TableCell>{getCellCaseInsensitive(f, "NIT", "Nit_Factura") || "-"}</TableCell>
                            <TableCell>
                              {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                            </TableCell>
                            <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-bia-gray">
                          Indique fechas y cargue facturas aprobadas aún no incluidas en un reporte
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
              <CardHeader>
                <CardTitle>Paso 3 — Resumen y firma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Facturas seleccionadas: <strong>{selectedRows.length}</strong>
                </p>
                <p>
                  Total: <strong>{formatCOP(totalSeleccionado)}</strong>
                </p>
                <p>
                  Límite zona ({zonaLabel}): <strong>{formatCOP(limite)}</strong>
                </p>
                <div className="h-3 w-full overflow-hidden rounded-full bg-bia-blue-mid">
                  <div
                    className={`h-full transition-all ${superaLimite ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${pctBarra}%` }}
                  />
                </div>
                {superaLimite ? (
                  <p className="text-red-400">Supera el límite de la zona. Reduzca la selección.</p>
                ) : null}
                <Button
                  type="button"
                  className="mt-4 w-full bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid"
                  disabled={!selectedRows.length || superaLimite || procesando || yaEnviando}
                  onClick={() => setSignOpen(true)}
                >
                  {yaEnviando ? "Enviando..." : "Firmar y enviar al administrador"}
                </Button>
                {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}
              </CardContent>
            </Card>
          </div>

          <Dialog open={signOpen} onOpenChange={setSignOpen}>
            <DialogContent className="max-w-lg border-bia-gray/20 bg-bia-blue-mid text-white">
              <DialogHeader>
                <DialogTitle>Firma del coordinador</DialogTitle>
              </DialogHeader>
              <FirmaCanvas
                width={400}
                height={200}
                disabled={yaEnviando || procesando}
                onFirma={(b64) => void onFirmaLista(b64)}
                onLimpiar={() => {}}
              />
              {procesando ? <p className="text-sm text-bia-gray-light">Enviando reporte...</p> : null}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader>
            <CardTitle>Mis reportes — {coordinador}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                    </TableCell>
                  </TableRow>
                ) : reportes.length ? (
                  reportes.map((r, i) => {
                    const id = reporteId(r);
                    const pdfUrl = String(r.PDF_URL || "").trim();
                    const est = String(r.Estado || "");
                    return (
                      <TableRow key={`${id}-${i}`}>
                        <TableCell>{r.Fecha || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.Periodo_Desde || r.Periodo || "—"} → {r.Periodo_Hasta || "—"}
                        </TableCell>
                        <TableCell>{formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}</TableCell>
                        <TableCell>{estadoReporteBadge(est)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {est.toLowerCase().includes("firmado") && pdfUrl ? (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-bia-aqua hover:underline"
                              >
                                ⬇ Descargar PDF firmado
                              </a>
                            ) : est.toLowerCase().includes("firmado") ? (
                              <span className="text-xs text-amber-200">PDF no disponible</span>
                            ) : (
                              <span className="text-xs text-amber-300">⏳ Pendiente firma del admin</span>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-red-500/30 text-red-400"
                              onClick={() => setConfirmEliminarId(id)}
                            >
                              🗑️ Eliminar
                            </Button>
                          </div>
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
      )}
    </div>
  );
}
