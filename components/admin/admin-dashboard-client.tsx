"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString, parseSheetDate } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaRow = Record<string, unknown>;
type ReporteRow = Record<string, string>;

function facturaEstado(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}

function facturaFecha(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
}

function inCurrentMonth(fechaCell: string): boolean {
  const d = parseSheetDate(fechaCell);
  if (!d) return false;
  const n = new Date();
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, rRes] = await Promise.all([fetch("/api/facturas"), fetch("/api/legalizaciones")]);
      const [fJson, rJson] = await Promise.all([
        fRes.json().catch(() => ({ data: [] })),
        rRes.json().catch(() => ({ data: [] })),
      ]);
      setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
    } catch {
      setFacturas([]);
      setReportes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let totalMes = 0;
    let aprobadasMes = 0;
    let pendientes = 0;
    for (const f of facturas) {
      const fecha = facturaFecha(f);
      const monto = parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura"));
      const est = facturaEstado(f).toLowerCase();
      if (inCurrentMonth(fecha)) {
        totalMes += monto;
        if (est === "aprobada" || est === "completada") aprobadasMes += monto;
      }
      if (est === "pendiente") pendientes += 1;
    }
    const repPendientes = reportes.filter((r) => String(r.Estado || "") === "Pendiente Admin").length;
    return { totalMes, aprobadasMes, pendientes, repPendientes };
  }, [facturas, reportes]);

  const ultimasFacturas = useMemo(() => {
    const sorted = [...facturas].sort((a, b) => {
      const ta = parseSheetDate(facturaFecha(a))?.getTime() ?? 0;
      const tb = parseSheetDate(facturaFecha(b))?.getTime() ?? 0;
      return tb - ta;
    });
    return sorted.slice(0, 10);
  }, [facturas]);

  const reportesPendientes = useMemo(
    () => reportes.filter((r) => String(r.Estado || "") === "Pendiente Admin"),
    [reportes]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Panel administrador</h1>
        <p className="text-sm text-zinc-400">Resumen MiCaja · todas las zonas</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">🧾 Total fact. (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : formatCOP(stats.totalMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">✅ Aprobadas (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : formatCOP(stats.aprobadasMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">⏳ Pendientes revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : stats.pendientes}</p>
            <p className="text-xs text-zinc-500">facturas</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">✍️ Rep. pend. firma admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : stats.repPendientes}</p>
            <p className="text-xs text-zinc-500">reportes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Últimas 10 facturas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : ultimasFacturas.length ? (
                ultimasFacturas.map((f, i) => {
                  const sector = String(getCellCaseInsensitive(f, "Sector") || "");
                  return (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        {facturaFecha(f) || "—"}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Responsable")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatCOP(parseCOPString(getCellCaseInsensitive(f, "Valor", "Monto_Factura")))}
                      </TableCell>
                      <TableCell>{etiquetaZona(sector)}</TableCell>
                      <TableCell>{facturaEstado(f)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-zinc-500">
                    Sin facturas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Reportes pendientes de firma</CardTitle>
          <Link
            href="/admin/reportes"
            className="inline-flex h-8 items-center rounded-lg border border-zinc-600 px-2.5 text-sm hover:bg-zinc-800"
          >
            Ir a reportes
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Coordinador</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : reportesPendientes.length ? (
                reportesPendientes.map((r, i) => (
                  <TableRow key={`${reporteId(r)}-${i}`}>
                    <TableCell>{r.Fecha || "—"}</TableCell>
                    <TableCell>{r.Coordinador || "—"}</TableCell>
                    <TableCell>{etiquetaZona(String(r.Sector || ""))}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href="/admin/reportes"
                        className="inline-flex h-7 items-center rounded-lg bg-zinc-800 px-2.5 text-xs hover:bg-zinc-700"
                      >
                        ✍️ Firmar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-zinc-500">
                    No hay reportes pendientes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
