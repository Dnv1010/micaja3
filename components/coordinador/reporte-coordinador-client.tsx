"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { pdf } from "@react-pdf/renderer";
import { FirmaCanvas } from "@/components/firma-canvas";
import {
  LegalizacionPdf,
  type FacturaPdf,
  type LegalizacionPdfStoredPayload,
} from "@/components/pdf/legalizacion-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { etiquetaZona, limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaRow = Record<string, unknown>;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function ReporteCoordinadorClient() {
  const router = useRouter();
  const { data } = useSession();
  const sector = String(data?.user?.sector || "");
  const coordinador = String(data?.user?.responsable || data?.user?.name || "");
  const cargo = String(data?.user?.cargo || "");
  const cedula = String(data?.user?.cedula || "").trim();
  const areaCoord = String(data?.user?.area || "");
  const zonaLabel = etiquetaZona(sector);
  const limite = limiteAprobacionZona(sector);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState<FacturaRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  async function cargarPendientes() {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        zonaSector: sector,
        estado: "pendiente",
        desde,
        hasta,
      });
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setLista(Array.isArray(json.data) ? json.data : []);
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

  async function confirmarRechazo() {
    if (!rejectId) return;
    try {
      await fetch(`/api/facturas/${encodeURIComponent(rejectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Rechazada", motivoRechazo }),
      });
      setLista((prev) => prev.filter((f) => getCellCaseInsensitive(f, "ID_Factura", "ID") !== rejectId));
      setRejectId(null);
      setMotivoRechazo("");
    } catch {
      /* silencioso */
    }
  }

  async function onFirmaLista(firmaDataUrl: string) {
    if (!selectedRows.length || superaLimite) return;
    setSignOpen(false);
    setProcesando(true);
    try {
      for (const f of selectedRows) {
        const id = getCellCaseInsensitive(f, "ID_Factura", "ID");
        await fetch(`/api/facturas/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "Aprobada" }),
        });
      }

      const facturasPdf: FacturaPdf[] = selectedRows.map((f) => {
        const id = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "");
        const img =
          getCellCaseInsensitive(f, "ImagenURL", "URL", "Adjuntar_Factura") || "";
        const driveId = getCellCaseInsensitive(f, "DriveFileId") || "";
        return {
          id,
          fecha: formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura")),
          proveedor: getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-",
          nit: getCellCaseInsensitive(f, "NIT", "Nit_Factura", "Num_Factura") || "-",
          concepto: getCellCaseInsensitive(f, "Concepto") || "-",
          valor: parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")),
          tipoFactura: getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "—",
          area: getCellCaseInsensitive(f, "Area", "Centro de Costo", "InfoCentroCosto") || areaCoord || "—",
          imagenUrl: img.trim() || undefined,
          driveFileId: driveId.trim() || undefined,
        };
      });

      const periodoTxt = `${formatDateDDMMYYYY(desde)} al ${formatDateDDMMYYYY(hasta)}`;
      const generadoTxt = formatDateDDMMYYYY(new Date().toISOString().slice(0, 10));

      const payloadPdf: LegalizacionPdfStoredPayload = {
        coordinador: {
          responsable: coordinador,
          cargo,
          cedula: cedula || undefined,
          sector,
          area: areaCoord,
        },
        facturas: facturasPdf,
        firmaCoordinador: firmaDataUrl,
        fechaGeneracion: generadoTxt,
        limiteZona: limite,
      };

      const doc = (
        <LegalizacionPdf
          coordinador={payloadPdf.coordinador}
          facturas={payloadPdf.facturas}
          firmaCoordinador={firmaDataUrl}
          fechaGeneracion={generadoTxt}
          limiteZona={limite}
        />
      );

      const blob = await pdf(doc).toBlob();
      const pdfBase64 = await blobToDataUrl(blob);
      const ids = selectedRows.map((f) => getCellCaseInsensitive(f, "ID_Factura", "ID")).join(",");

      await fetch("/api/legalizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinador,
          zona: zonaLabel,
          periodo: periodoTxt,
          totalAprobado: String(totalSeleccionado),
          facturasIds: ids,
          firmaCoordinador: firmaDataUrl,
          pdfBase64,
          datosPdfJson: JSON.stringify(payloadPdf),
        }),
      });

      router.push("/legalizaciones?enviado=1");
    } catch {
      setProcesando(false);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Paso 1 — Seleccionar período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <Button
            type="button"
            className="bg-black text-white hover:bg-zinc-800"
            onClick={cargarPendientes}
            disabled={loading || !desde || !hasta}
          >
            {loading ? "Cargando..." : "Cargar facturas pendientes"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100 lg:col-span-2">
          <CardHeader>
            <CardTitle>Paso 2 — Revisar facturas</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>NIT</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="h-6 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                  </TableRow>
                ) : lista.length ? (
                  lista.map((f, i) => {
                    const id = getCellCaseInsensitive(f, "ID_Factura", "ID");
                    return (
                      <TableRow key={`${id}-${i}`}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(id)}
                            onCheckedChange={(v) => toggleId(id, v === true)}
                          />
                        </TableCell>
                        <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}</TableCell>
                        <TableCell>{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                        <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                        <TableCell>{getCellCaseInsensitive(f, "NIT", "Nit_Factura") || "-"}</TableCell>
                        <TableCell>
                          {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                        </TableCell>
                        <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "-"}</TableCell>
                        <TableCell>
                          <Button type="button" variant="destructive" size="sm" onClick={() => setRejectId(id)}>
                            ✗ Rechazar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-zinc-500">
                      Cargue un período con facturas pendientes
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <CardTitle>Paso 3 — Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Facturas seleccionadas: <strong>{selectedRows.length}</strong>
            </p>
            <p>
              Total a aprobar: <strong>{formatCOP(totalSeleccionado)}</strong>
            </p>
            <p>
              Límite zona ({zonaLabel}): <strong>{formatCOP(limite)}</strong>
            </p>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
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
              className="mt-4 w-full bg-black text-white hover:bg-zinc-800"
              disabled={!selectedRows.length || superaLimite || procesando}
              onClick={() => setSignOpen(true)}
            >
              Firmar y enviar al Administrador 📋
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Motivo del rechazo</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="bg-zinc-900 border-zinc-700"
            placeholder="Describa el motivo..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmarRechazo} disabled={!motivoRechazo.trim()}>
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Firma del coordinador</DialogTitle>
          </DialogHeader>
          <FirmaCanvas
            width={400}
            height={200}
            onFirma={(b64) => void onFirmaLista(b64)}
            onLimpiar={() => {}}
          />
          {procesando ? <p className="text-sm text-zinc-400">Procesando aprobaciones y PDF...</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
