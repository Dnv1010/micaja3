"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sumasFacturasZona } from "@/lib/caja-menor-dashboard";
import { etiquetaZona, limiteAprobacionZona } from "@/lib/coordinador-zona";
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
  const [tecnicosPorSector, setTecnicosPorSector] = useState<{ sector: string }[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usuarios?rol=user")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: { sector: string }[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          list.push({
            sector: String(getCellCaseInsensitive(rec, "Sector", "Zona") || "Bogota").trim(),
          });
        }
        setTecnicosPorSector(list);
      })
      .catch(() => {
        if (!cancelled) setTecnicosPorSector([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const zonasResumen = useMemo(() => {
    const zonas: ("Bogota" | "Costa Caribe")[] = ["Bogota", "Costa Caribe"];
    return zonas.map((zona) => {
      const limite = limiteAprobacionZona(zona);
      const usuariosCount = tecnicosPorSector.filter((u) => u.sector === zona).length;
      const { totalAprobado, totalPendiente } = sumasFacturasZona(facturas, zona);
      const cap = limite * Math.max(usuariosCount, 1);
      const pctZona = cap > 0 ? Math.round((totalAprobado / cap) * 100) : 0;
      return { zona, limite, usuariosCount, totalAprobado, totalPendiente, pctZona };
    });
  }, [facturas, tecnicosPorSector]);

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
        <h1 className="text-2xl font-bold text-white">Panel administrador</h1>
        <p className="text-sm text-bia-gray-light">Resumen MiCaja · todas las zonas</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading
          ? [0, 1].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-[#525A72]/20 bg-[#0A1B4D]"
              />
            ))
          : zonasResumen.map(
              ({ zona, limite, usuariosCount, totalAprobado, totalPendiente, pctZona }) => {
                const pctBar = Math.min(pctZona, 100);
                return (
                  <div
                    key={zona}
                    className="rounded-2xl border border-[#525A72]/20 bg-[#0A1B4D] p-5"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-white">
                        Zona {zona === "Bogota" ? "Bogotá" : "Costa Caribe"}
                      </h3>
                      <span className="text-xs text-[#8892A4]">
                        {usuariosCount} técnicos · Límite {formatCOP(limite)}/c.u.
                      </span>
                    </div>
                    <div className="mb-4 h-3 overflow-hidden rounded-full bg-[#001035]">
                      <div
                        className="h-full rounded-full bg-[#08DDBC]"
                        style={{ width: `${pctBar}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl bg-[#001035] p-3 text-center">
                        <p className="font-bold text-[#08DDBC]">{formatCOP(totalAprobado)}</p>
                        <p className="text-xs text-[#525A72]">Total aprobado</p>
                      </div>
                      <div className="rounded-xl bg-[#001035] p-3 text-center">
                        <p className="font-bold text-yellow-400">{formatCOP(totalPendiente)}</p>
                        <p className="text-xs text-[#525A72]">Por legalizar</p>
                      </div>
                      <div className="rounded-xl bg-[#001035] p-3 text-center">
                        <p className="font-bold text-white">{pctZona}%</p>
                        <p className="text-xs text-[#525A72]">Ejecutado</p>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bia-gray-light">🧾 Total fact. (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : formatCOP(stats.totalMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bia-gray-light">✅ Aprobadas (mes actual)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : formatCOP(stats.aprobadasMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bia-gray-light">⏳ Pendientes revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : stats.pendientes}</p>
            <p className="text-xs text-bia-gray">facturas</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bia-gray-light">✍️ Rep. pend. firma admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold tabular-nums">{loading ? "—" : stats.repPendientes}</p>
            <p className="text-xs text-bia-gray">reportes</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
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
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
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
                  <TableCell colSpan={6} className="text-bia-gray">
                    Sin facturas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Reportes pendientes de firma</CardTitle>
          <Link
            href="/admin/reportes"
            className="inline-flex h-8 items-center rounded-lg border border-bia-gray/30 px-2.5 text-sm hover:bg-bia-blue-mid"
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
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
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
                        className="inline-flex h-7 items-center rounded-lg bg-bia-blue-mid px-2.5 text-xs hover:bg-bia-gray/25"
                      >
                        ✍️ Firmar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-bia-gray">
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
