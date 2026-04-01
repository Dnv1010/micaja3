"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FacturaImagenModal } from "@/components/factura-imagen-modal";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { facturaImageUrlForDisplay } from "@/lib/drive-image-url";
import { formatCOP, parseCOPString, parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { FALLBACK_USERS } from "@/lib/users-fallback";

type FacturaRow = Record<string, unknown>;

function facturaEstado(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}

function facturaFecha(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
}

export function AdminFacturasClient() {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [imagenModal, setImagenModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/facturas");
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usuariosOpciones = useMemo(
    () => FALLBACK_USERS.filter((u) => u.rol === "user").sort((a, b) => a.responsable.localeCompare(b.responsable)),
    []
  );

  const filtradas = useMemo(() => {
    const desdeD = desde ? parseSheetDate(desde) : null;
    const hastaD = hasta ? parseSheetDate(hasta) : null;
    return facturas.filter((f) => {
      const sector = String(getCellCaseInsensitive(f, "Sector") || "");
      if (filtroZona && sector !== filtroZona) return false;
      const resp = String(getCellCaseInsensitive(f, "Responsable") || "");
      if (filtroResponsable && resp.toLowerCase() !== filtroResponsable.toLowerCase()) return false;
      const est = facturaEstado(f).toLowerCase();
      if (filtroEstado && est !== filtroEstado.toLowerCase()) return false;
      const fd = parseSheetDate(facturaFecha(f));
      if (desdeD && (!fd || fd < desdeD)) return false;
      if (hastaD && (!fd || fd > hastaD)) return false;
      return true;
    });
  }, [facturas, filtroZona, filtroResponsable, filtroEstado, desde, hasta]);

  const totalAprobadas = useMemo(
    () =>
      filtradas.reduce((acc, f) => {
        const e = facturaEstado(f).toLowerCase();
        if (e !== "aprobada" && e !== "completada") return acc;
        return acc + parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura"));
      }, 0),
    [filtradas]
  );

  const pendientesCount = useMemo(
    () => filtradas.filter((f) => facturaEstado(f).toLowerCase() === "pendiente").length,
    [filtradas]
  );

  async function aprobar(id: string) {
    const res = await fetch(`/api/facturas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "Aprobada" }),
    });
    if (res.ok) await load();
  }

  async function confirmarRechazo() {
    if (!rejectId || !motivoRechazo.trim()) return;
    const res = await fetch(`/api/facturas/${encodeURIComponent(rejectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "Rechazada", motivoRechazo: motivoRechazo.trim() }),
    });
    if (res.ok) {
      setRejectId(null);
      setMotivoRechazo("");
      await load();
    }
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar esta factura?")) return;
    const res = await fetch(`/api/facturas/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="space-y-4">
      <FacturaImagenModal src={imagenModal} onClose={() => setImagenModal(null)} />

      <div>
        <h1 className="text-2xl font-bold text-white">Todas las facturas</h1>
        <p className="text-sm text-bia-gray-light">Administración · filtros y acciones</p>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="min-w-[160px] space-y-1">
            <Label className="text-xs text-bia-gray-light">Zona</Label>
            <Select
              value={filtroZona || "__all__"}
              onValueChange={(v) => setFiltroZona(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las zonas</SelectItem>
                <SelectItem value="Bogota">Bogotá</SelectItem>
                <SelectItem value="Costa Caribe">Costa Caribe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] space-y-1">
            <Label className="text-xs text-bia-gray-light">Usuario</Label>
            <Select
              value={filtroResponsable || "__all__"}
              onValueChange={(v) => setFiltroResponsable(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los usuarios</SelectItem>
                {usuariosOpciones.map((u) => (
                  <SelectItem key={u.email} value={u.responsable}>
                    {u.responsable}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-1">
            <Label className="text-xs text-bia-gray-light">Estado</Label>
            <Select
              value={filtroEstado || "__all__"}
              onValueChange={(v) => setFiltroEstado(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los estados</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Aprobada">Aprobada</SelectItem>
                <SelectItem value="Rechazada">Rechazada</SelectItem>
                <SelectItem value="Completada">Completada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-bia-gray-light">Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-bia-blue border-bia-gray/40 w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-bia-gray-light">Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-bia-blue border-bia-gray/40 w-[160px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Imagen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : filtradas.length ? (
                filtradas.map((f, i) => {
                  const id = String(getCellCaseInsensitive(f, "ID_Factura", "ID"));
                  const est = facturaEstado(f).toLowerCase();
                  const sector = String(getCellCaseInsensitive(f, "Sector") || "");
                  const imgSrc = facturaImageUrlForDisplay(
                    String(getCellCaseInsensitive(f, "Adjuntar_Factura") || ""),
                    String(getCellCaseInsensitive(f, "URL", "ImagenURL") || ""),
                    String(getCellCaseInsensitive(f, "DriveFileId") || "")
                  );
                  return (
                    <TableRow key={`${id}-${i}`}>
                      <TableCell className="whitespace-nowrap text-xs">{facturaFecha(f) || "—"}</TableCell>
                      <TableCell className="text-sm">{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                      <TableCell className="text-sm">{etiquetaZona(sector)}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-sm">
                        {getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {getCellCaseInsensitive(f, "NIT", "Nit_Factura") || "—"}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {getCellCaseInsensitive(f, "ServicioDeclarado", "Tipo_servicio") || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                      </TableCell>
                      <TableCell className="text-xs">{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "—"}</TableCell>
                      <TableCell className="text-xs">{facturaEstado(f)}</TableCell>
                      <TableCell className="text-center">
                        {imgSrc ? (
                          <button
                            type="button"
                            onClick={() => setImagenModal(imgSrc)}
                            className="rounded border border-bia-aqua/30 px-2 py-1 text-xs text-bia-aqua transition-colors hover:bg-bia-aqua/10 hover:text-white"
                            title="Ver imagen"
                          >
                            🖼️ Ver
                          </button>
                        ) : (
                          <span className="text-xs text-bia-gray" title="Sin imagen disponible">
                            Sin imagen
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {est === "pendiente" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 bg-bia-aqua px-2 text-xs font-semibold text-bia-blue hover:bg-[#06C4A8]"
                                onClick={() => void aprobar(id)}
                              >
                                ✓
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => setRejectId(id)}
                              >
                                ✗
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-bia-gray/30 px-2 text-xs text-red-300"
                            onClick={() => void eliminar(id)}
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
                  <TableCell colSpan={11} className="text-bia-gray">
                    Sin resultados con los filtros actuales
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-bia-gray-light">
            <span>Total facturas (filtradas): {filtradas.length}</span>
            <span>Total aprobadas + completadas: {formatCOP(totalAprobadas)}</span>
            <span>Pendientes: {pendientesCount}</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <DialogHeader>
            <DialogTitle>Motivo del rechazo</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="bg-bia-blue border-bia-gray/40"
            placeholder="Describe el motivo..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!motivoRechazo.trim()} onClick={() => void confirmarRechazo()}>
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
