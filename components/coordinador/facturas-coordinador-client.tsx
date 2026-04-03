"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { FacturaImagenModal } from "@/components/factura-imagen-modal";
import { BiaAlert } from "@/components/ui/bia-alert";
import { BiaConfirm } from "@/components/ui/bia-confirm";
import { SIN_FILTRO } from "@/lib/filter-select";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { facturaImageUrlForDisplay } from "@/lib/drive-image-url";
import { sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaItem = Record<string, unknown>;

function estadoClass(estado: string): string {
  const e = estado.toLowerCase();
  if (e === "aprobada") return "border-emerald-700 text-emerald-300";
  if (e === "rechazada") return "border-red-700 text-red-300";
  return "border-yellow-700 text-yellow-300";
}

const COLS = 13;

export function FacturasCoordinadorClient({ admin }: { admin?: boolean }) {
  const { data } = useSession();
  const sector = String(data?.user?.sector || "");
  const [zoneUsers, setZoneUsers] = useState<{ responsable: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    const url = admin
      ? "/api/usuarios"
      : `/api/usuarios?sector=${encodeURIComponent(sector)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: { responsable: string }[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          const rolU = String(getCellCaseInsensitive(rec, "Rol") || "user").toLowerCase();
          if (rolU !== "user" && rolU !== "coordinador") continue;
          const name = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
          if (name) list.push({ responsable: name });
        }
        list.sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
        setZoneUsers(list);
      })
      .catch(() => {
        if (!cancelled) setZoneUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [admin, sector]);

  const [usuario, setUsuario] = useState<string>(SIN_FILTRO);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estado, setEstado] = useState<string>(SIN_FILTRO);
  const [loading, setLoading] = useState(false);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [editar, setEditar] = useState<FacturaItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalRechazo, setModalRechazo] = useState<{ id: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [confirmEliminarId, setConfirmEliminarId] = useState<string | null>(null);
  const [biaAlert, setBiaAlert] = useState<{ type: "error" | "success"; message: string } | null>(null);

  async function filtrar() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (!admin) q.set("zonaSector", sector);
      if (usuario && usuario !== SIN_FILTRO) q.set("responsable", usuario);
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      if (estado && estado !== SIN_FILTRO) q.set("estado", estado);
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
      setBiaAlert({
        type: "error",
        message: e instanceof Error ? e.message : "Error al aprobar",
      });
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
      setBiaAlert({
        type: "error",
        message: e instanceof Error ? e.message : "Error al rechazar",
      });
    } finally {
      setRechazando(false);
    }
  }

  async function handleEliminar(facturaId: string) {
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(facturaId)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Error al eliminar");
      }
      setBiaAlert({ type: "success", message: "Factura eliminada" });
      await filtrar();
    } catch (e: unknown) {
      setBiaAlert({
        type: "error",
        message: e instanceof Error ? e.message : "Error al eliminar",
      });
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
    <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
      {confirmEliminarId ? (
        <BiaConfirm
          mensaje="¿Eliminar esta factura? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onCancelar={() => setConfirmEliminarId(null)}
          onConfirmar={() => {
            const id = confirmEliminarId;
            setConfirmEliminarId(null);
            if (id) void handleEliminar(id);
          }}
        />
      ) : null}
      <Dialog
        open={!!modalRechazo}
        onOpenChange={(open) => {
          if (!open) {
            setModalRechazo(null);
            setMotivoRechazo("");
          }
        }}
      >
        <DialogContent className="border-bia-gray/20 bg-bia-blue-mid text-white sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Motivo del rechazo</DialogTitle>
          </DialogHeader>
          <Textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="min-h-24 resize-none bg-bia-blue border-bia-gray/40"
            placeholder="Describe el motivo del rechazo..."
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-bia-gray/30"
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
        {biaAlert ? (
          <BiaAlert type={biaAlert.type} message={biaAlert.message} />
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Usuario</Label>
            <Select value={usuario || SIN_FILTRO} onValueChange={(v) => setUsuario(v || SIN_FILTRO)}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todos</SelectItem>
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
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={estado || SIN_FILTRO} onValueChange={(v) => setEstado(v || SIN_FILTRO)}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_FILTRO}>Todas</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid" onClick={filtrar} disabled={loading}>
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
                <TableHead className="text-center">Imagen</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={COLS}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : facturas.length ? (
                facturas.map((f, i) => {
                  const responsableRow = String(getCellCaseInsensitive(f, "Responsable") || "");
                  const esPropio = responsableRow === responsableSesion;
                  const est =
                    getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
                  const estLower = est.toLowerCase();
                  const observacionCoord = getCellCaseInsensitive(f, "Observacion", "Concepto");
                  const esAutoAprobada =
                    String(observacionCoord || "").includes("[AUTO]") && estLower === "aprobada";
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
                  const imgSrc = facturaImageUrlForDisplay(
                    String(getCellCaseInsensitive(f, "Adjuntar_Factura") || ""),
                    String(getCellCaseInsensitive(f, "URL", "ImagenURL") || ""),
                    String(getCellCaseInsensitive(f, "DriveFileId") || "")
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
                          <span className="text-bia-gray">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {esAutoAprobada ? (
                            <span className="rounded-full border border-[#08DDBC]/20 bg-[#08DDBC]/10 px-2 py-0.5 text-xs text-[#08DDBC]">
                              ✓ Auto-aprobada
                            </span>
                          ) : null}
                          <Badge variant="outline" className={estadoClass(est)}>
                            {est}
                          </Badge>
                        </div>
                      </TableCell>
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
                              className="h-7 border-bia-gray/30 px-2 text-xs"
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
                              onClick={() => setConfirmEliminarId(fid)}
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
                  <TableCell colSpan={COLS} className="text-bia-gray">
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-right text-sm text-bia-gray-light">Total facturas: {facturas.length}</p>
      </CardContent>

      <FacturaImagenModal src={imagenModal} onClose={() => setImagenModal(null)} />

      <Link
        href="/facturas/nueva"
        className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black text-lg text-white shadow-lg hover:bg-bia-blue-mid"
        aria-label="Nueva factura"
      >
        +
      </Link>
    </Card>
  );
}
