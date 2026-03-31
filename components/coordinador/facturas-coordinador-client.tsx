"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FacturaEditDialog } from "@/components/coordinador/factura-edit-dialog";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { fallbackActiveZoneUsers } from "@/lib/users-fallback";

type FacturaItem = Record<string, unknown>;

function estadoClass(estado: string): string {
  const e = estado.toLowerCase();
  if (e === "aprobada") return "border-emerald-700 text-emerald-300";
  if (e === "rechazada") return "border-red-700 text-red-300";
  return "border-yellow-700 text-yellow-300";
}

const COLS = 12;

export function FacturasCoordinadorClient({ admin }: { admin?: boolean }) {
  const { data } = useSession();
  const sector = String(data?.user?.sector || "");
  const zoneUsers = useMemo(() => fallbackActiveZoneUsers(sector), [sector]);

  const [usuario, setUsuario] = useState<string>("__todos__");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState<string>("__todas__");
  const [loading, setLoading] = useState(false);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [editar, setEditar] = useState<FacturaItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalRechazo, setModalRechazo] = useState<{ id: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  async function filtrar() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (!admin) q.set("zonaSector", sector);
      if (usuario && usuario !== "__todos__") q.set("responsable", usuario);
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      if (estado && estado !== "__todas__") q.set("estado", estado);
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAprobar(facturaId: string) {
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(facturaId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Aprobada" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Error al aprobar");
      }
      await filtrar();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al aprobar");
    }
  }

  function abrirRechazo(id: string) {
    setMotivoRechazo("");
    setModalRechazo({ id });
  }

  async function confirmarRechazo() {
    if (!modalRechazo || !motivoRechazo.trim()) return;
    setRechazando(true);
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(modalRechazo.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "Rechazada",
          motivoRechazo: motivoRechazo.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Error al rechazar");
      }
      setModalRechazo(null);
      setMotivoRechazo("");
      await filtrar();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al rechazar");
    } finally {
      setRechazando(false);
    }
  }

  async function handleEliminar(facturaId: string) {
    if (typeof window !== "undefined" && !window.confirm("¿Eliminar esta factura?")) return;
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(facturaId)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Error al eliminar");
      }
      await filtrar();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  function handleEditar(f: FacturaItem) {
    setEditar(f);
    setDialogOpen(true);
  }

  useEffect(() => {
    void filtrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, [admin, sector]);

  const rolSesion = String(data?.user?.rol || "user").toLowerCase();
  const responsableSesion = String(data?.user?.responsable || "");

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
      <Dialog
        open={!!modalRechazo}
        onOpenChange={(open) => {
          if (!open) {
            setModalRechazo(null);
            setMotivoRechazo("");
          }
        }}
      >
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Motivo del rechazo</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="min-h-24 resize-none bg-zinc-900 border-zinc-700"
            placeholder="Describe el motivo del rechazo..."
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600"
              onClick={() => {
                setModalRechazo(null);
                setMotivoRechazo("");
              }}
              disabled={rechazando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmarRechazo()}
              disabled={!motivoRechazo.trim() || rechazando}
            >
              {rechazando ? "Rechazando..." : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FacturaEditDialog
        factura={editar}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditar(null);
        }}
        onSaved={() => void filtrar()}
      />
      <CardHeader>
        <CardTitle>Facturas de la zona</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Select value={usuario} onValueChange={(v) => setUsuario(v || "__todos__")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {zoneUsers.map((u) => (
                  <SelectItem key={u.responsable} value={u.responsable}>
                    {u.responsable}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-zinc-900 border-zinc-700" />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v || "__todas__")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full bg-black text-white hover:bg-zinc-800" onClick={filtrar} disabled={loading}>
              Filtrar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>OPS</TableHead>
                <TableHead>BIA</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={COLS}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : facturas.length ? (
                facturas.map((f, i) => {
                  const responsableRow = String(getCellCaseInsensitive(f, "Responsable") || "");
                  const esPropio = responsableRow === responsableSesion;
                  const est =
                    getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
                  const estLower = est.toLowerCase();
                  const fid = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "");
                  const puedeAprobarRechazar =
                    (rolSesion === "coordinador" || rolSesion === "admin") && estLower === "pendiente";
                  const puedeEditar =
                    estLower !== "completada" &&
                    (estLower === "pendiente" || estLower === "rechazada") &&
                    (rolSesion === "admin" || rolSesion === "coordinador" || esPropio);
                  const puedeEliminar = rolSesion === "coordinador" || rolSesion === "admin";
                  const aBia = sheetANombreBiaTrue(
                    getCellCaseInsensitive(f, "ANombreBia", "AnombreBia", "NombreBia", "Nombre_bia")
                  );
                  return (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {getCellCaseInsensitive(f, "NIT", "Nit_Factura") || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Ciudad") || "—"}</TableCell>
                      <TableCell>
                        {getCellCaseInsensitive(f, "ServicioDeclarado", "Tipo_servicio") || "—"}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate" title={getCellCaseInsensitive(f, "OPS", "TipoOperacion")}>
                        {getCellCaseInsensitive(f, "OPS", "TipoOperacion") || "—"}
                      </TableCell>
                      <TableCell>
                        {aBia ? (
                          <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">BIA</Badge>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estadoClass(est)}>
                          {est}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {puedeAprobarRechazar && fid ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 bg-emerald-700 px-2 text-xs text-white hover:bg-emerald-600"
                                onClick={() => void handleAprobar(fid)}
                              >
                                ✓ Aprobar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => abrirRechazo(fid)}
                              >
                                ✗ Rechazar
                              </Button>
                            </>
                          ) : null}
                          {puedeEditar && fid ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-zinc-600 px-2 text-xs"
                              onClick={() => handleEditar(f)}
                            >
                              ✏️ Editar
                            </Button>
                          ) : null}
                          {puedeEliminar && fid ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 border-red-800 px-2 text-xs text-red-300 hover:bg-red-950"
                              onClick={() => void handleEliminar(fid)}
                            >
                              🗑️ Eliminar
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-zinc-500">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-right text-sm text-zinc-400">Total facturas: {facturas.length}</p>
      </CardContent>
      <Link
        href="/facturas/nueva"
        className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-lg text-white shadow-lg hover:bg-zinc-800"
        aria-label="Nueva factura"
      >
        +
      </Link>
    </Card>
  );
}
