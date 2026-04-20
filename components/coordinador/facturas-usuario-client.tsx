"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FacturaEditDialog } from "@/components/coordinador/factura-edit-dialog";
import { FacturaImagenModal } from "@/components/factura-imagen-modal";
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

const COLS = 12;

export function FacturasUsuarioClient() {
  const { data } = useSession();
  const responsable = String(data?.user?.responsable || "");
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [editar, setEditar] = useState<FacturaItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [imagenModal, setImagenModal] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const loadFacturas = useCallback(async () => {
    if (!responsable) {
      setFacturas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ responsable });
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      const res = await fetch(`/api/facturas?${q}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [responsable, desde, hasta]);

  useEffect(() => {
    void loadFacturas();
  }, [loadFacturas]);

  const facturasOrdenadas = useMemo(() => {
    const key = (f: FacturaItem) => {
      const fc = String(getCellCaseInsensitive(f, "FechaCreacion", "Fecha_ISO") || "");
      const tFc = fc ? new Date(fc).getTime() : NaN;
      if (Number.isFinite(tFc)) return tFc;
      const fd = String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
      return new Date(fd).getTime() || 0;
    };
    return [...facturas].sort((a, b) => key(b) - key(a));
  }, [facturas]);

  const bannerGuardado = useMemo(() => {
    if (typeof window === "undefined") return null;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("saved") !== "1") return null;
    const auto = qs.get("auto");
    if (auto === "aprobada") {
      return { clase: "bg-[#08DDBC]/15 text-[#08DDBC] border-[#08DDBC]/30", texto: "Factura guardada y aprobada automáticamente" };
    }
    if (auto === "pendiente") {
      return {
        clase: "border-amber-500/30 bg-amber-500/10 text-amber-200",
        texto: "Factura guardada. Pendiente de revisión por tu coordinador.",
      };
    }
    return { clase: "bg-emerald-700 text-white", texto: "Factura guardada" };
  }, []);

  return (
    <div className="space-y-4">
      <FacturaEditDialog
        factura={editar}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditar(null);
        }}
        onSaved={() => void loadFacturas()}
      />
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturas</CardTitle>
          {bannerGuardado ? (
            <Badge variant="outline" className={`${bannerGuardado.clase} shrink-0`}>
              {bannerGuardado.texto}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <Label className="mb-1 text-xs text-bia-gray">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="bg-bia-blue border-bia-gray/40 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1 text-xs text-bia-gray">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="bg-bia-blue border-bia-gray/40 [color-scheme:dark]"
              />
            </div>
            {(desde || hasta) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDesde(""); setHasta(""); }}
                className="border-white/20 text-gray-300"
              >
                Limpiar
              </Button>
            )}
            <div className="ml-auto text-xs text-bia-gray">
              {loading ? "Cargando..." : `${facturasOrdenadas.length} factura${facturasOrdenadas.length === 1 ? "" : "s"}`}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
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
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={COLS}>
                        <div className="h-5 w-full animate-pulse rounded bg-bia-blue-mid" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : facturasOrdenadas.length ? (
                  facturasOrdenadas.map((f, i) => {
                    const estado =
                      getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
                    const estadoLower = estado.toLowerCase();
                    const observacion = getCellCaseInsensitive(f, "Observacion", "Concepto");
                    const esAutoAprobada =
                      String(observacion || "").includes("[AUTO]") && estadoLower === "aprobada";
                    const motivo = getCellCaseInsensitive(f, "MotivoRechazo");
                    const fid = String(getCellCaseInsensitive(f, "ID_Factura", "ID") || "");
                    const aBia = sheetANombreBiaTrue(
                      getCellCaseInsensitive(f, "ANombreBia", "AnombreBia", "NombreBia", "Nombre_bia")
                    );
                    const imgSrc = facturaImageUrlForDisplay(
                      String(getCellCaseInsensitive(f, "Adjuntar_Factura") || ""),
                      String(getCellCaseInsensitive(f, "URL", "ImagenURL") || ""),
                      String(getCellCaseInsensitive(f, "DriveFileId") || "")
                    );
                    return (
                      <TableRow key={`f-${i}`}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}
                        </TableCell>
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
                        <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            {esAutoAprobada ? (
                              <span className="rounded-full border border-[#08DDBC]/20 bg-[#08DDBC]/10 px-2 py-0.5 text-xs text-[#08DDBC]">
                                ✓ Auto-aprobada
                              </span>
                            ) : null}
                            <Badge variant="outline" className={estadoClass(estado)} title={motivo || undefined}>
                              {estado}
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
                          {fid ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-bia-gray/30"
                              onClick={() => {
                                setEditar(f);
                                setDialogOpen(true);
                              }}
                            >
                              ✏️ Editar
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={COLS} className="text-bia-gray">
                      No hay facturas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FacturaImagenModal src={imagenModal} onClose={() => setImagenModal(null)} />

      <Link href="/facturas/nueva" className="fixed bottom-20 right-4 z-40">
        <Button className="h-12 w-12 rounded-full bg-bia-aqua text-bia-blue font-semibold shadow-lg">+</Button>
      </Link>
    </div>
  );
}
