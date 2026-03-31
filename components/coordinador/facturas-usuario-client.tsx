"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FacturaEditDialog } from "@/components/coordinador/factura-edit-dialog";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
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

  const loadFacturas = useCallback(async () => {
    if (!responsable) {
      setFacturas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/facturas?responsable=${encodeURIComponent(responsable)}`);
      const json = await res.json().catch(() => ({ data: [] }));
      setFacturas(Array.isArray(json.data) ? json.data : []);
    } catch {
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [responsable]);

  useEffect(() => {
    void loadFacturas();
  }, [loadFacturas]);

  const saved = useMemo(() => {
    if (typeof window === "undefined") return false;
    const qs = new URLSearchParams(window.location.search);
    return qs.get("saved") === "1";
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
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturas</CardTitle>
          {saved ? <Badge className="bg-emerald-700 text-white">✅ Factura guardada</Badge> : null}
        </CardHeader>
        <CardContent>
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
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={COLS}>
                        <div className="h-5 w-full animate-pulse rounded bg-zinc-800" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : facturas.length ? (
                  facturas.map((f, i) => {
                    const estado = getCellCaseInsensitive(f, "Estado") || "Pendiente";
                    const estadoLower = estado.toLowerCase();
                    const motivo = getCellCaseInsensitive(f, "MotivoRechazo");
                    const fid = String(getCellCaseInsensitive(f, "ID") || "");
                    const aBia = sheetANombreBiaTrue(
                      getCellCaseInsensitive(f, "ANombreBia", "AnombreBia", "NombreBia")
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
                            <span className="text-zinc-600">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getCellCaseInsensitive(f, "TipoFactura", "Tipo_Factura") || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={estadoClass(estado)} title={motivo || undefined}>
                            {estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(estadoLower === "pendiente" || estadoLower === "rechazada") && fid ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-zinc-600"
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
                    <TableCell colSpan={COLS} className="text-zinc-500">
                      No hay facturas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Link href="/facturas/nueva" className="fixed bottom-20 right-4 z-40">
        <Button className="h-12 w-12 rounded-full bg-black text-white shadow-lg">+</Button>
      </Link>
    </div>
  );
}
