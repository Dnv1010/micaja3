"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { formatCOP, parseCOPString, parseMonto, parseSheetDate } from "@/lib/format";
import { sectorsEquivalent } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaRow = Record<string, unknown>;
type EntregaRow = Record<string, unknown>;
type ReporteRow = Record<string, string>;

/** Misma prioridad que balance / coordinador: Verificado → Legalizado → Estado */
function estadoFacturaCaja(f: FacturaRow): string {
  return String(
    getCellCaseInsensitive(f, "Verificado", "Legalizado", "Estado") || ""
  )
    .toLowerCase()
    .trim();
}

function facturaEstado(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
}

function montoEntregaRow(e: EntregaRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto", "Valor") || "0"));
}

function montoFacturaRow(f: FacturaRow): number {
  return parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0"));
}

function facturaEnZona(f: FacturaRow, zona: "Bogota" | "Costa Caribe"): boolean {
  const s = String(getCellCaseInsensitive(f, "Sector") || "");
  return sectorsEquivalent(s, zona);
}

function calcularZona(
  entregasZona: EntregaRow[],
  facturasZona: FacturaRow[],
  limite: number
) {
  const entregado = entregasZona.reduce((s, e) => s + montoEntregaRow(e), 0);
  const facturado = facturasZona
    .filter((f) => {
      const estado = estadoFacturaCaja(f);
      return estado === "aprobada" || estado === "completada" || estado === "pendiente";
    })
    .reduce((s, f) => s + montoFacturaRow(f), 0);
  const porReportar = Math.max(0, entregado - facturado);
  const disponible = Math.max(0, limite - entregado);
  const pctEntregado = limite > 0 ? Math.min(100, Math.round((entregado / limite) * 100)) : 0;
  const pctFacturado = limite > 0 ? Math.min(100, Math.round((facturado / limite) * 100)) : 0;
  const pctReportar = limite > 0 ? Math.min(100, Math.round((porReportar / limite) * 100)) : 0;
  return { entregado, facturado, porReportar, disponible, pctEntregado, pctFacturado, pctReportar };
}

function facturaFecha(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
}

function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [entregasBogota, setEntregasBogota] = useState<EntregaRow[]>([]);
  const [entregasCosta, setEntregasCosta] = useState<EntregaRow[]>([]);
  const [tecnicosPorSector, setTecnicosPorSector] = useState<{ sector: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const encB = encodeURIComponent("Bogota");
      const encC = encodeURIComponent("Costa Caribe");
      const [fRes, rRes, eBogRes, eCostaRes] = await Promise.all([
        fetch("/api/facturas"),
        fetch("/api/legalizaciones"),
        fetch(`/api/entregas?zonaSector=${encB}`),
        fetch(`/api/entregas?zonaSector=${encC}`),
      ]);
      const [fJson, rJson, eBogJson, eCostaJson] = await Promise.all([
        fRes.json().catch(() => ({ data: [] })),
        rRes.json().catch(() => ({ data: [] })),
        eBogRes.json().catch(() => ({ data: [] })),
        eCostaRes.json().catch(() => ({ data: [] })),
      ]);
      setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
      setEntregasBogota(Array.isArray(eBogJson.data) ? eBogJson.data : []);
      setEntregasCosta(Array.isArray(eCostaJson.data) ? eCostaJson.data : []);
    } catch {
      setFacturas([]);
      setReportes([]);
      setEntregasBogota([]);
      setEntregasCosta([]);
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

  const limiteBogota = 1_000_000;
  const limiteCosta = 3_000_000;

  const bogota = useMemo(() => {
    const facturasZona = facturas.filter((f) => facturaEnZona(f, "Bogota"));
    return calcularZona(entregasBogota, facturasZona, limiteBogota);
  }, [facturas, entregasBogota]);

  const costa = useMemo(() => {
    const facturasZona = facturas.filter((f) => facturaEnZona(f, "Costa Caribe"));
    return calcularZona(entregasCosta, facturasZona, limiteCosta);
  }, [facturas, entregasCosta]);

  const usuariosBogota = useMemo(
    () => tecnicosPorSector.filter((u) => u.sector === "Bogota").length,
    [tecnicosPorSector]
  );
  const usuariosCosta = useMemo(
    () => tecnicosPorSector.filter((u) => u.sector === "Costa Caribe").length,
    [tecnicosPorSector]
  );

  const facturasPendientes = useMemo(
    () => facturas.filter((f) => estadoFacturaCaja(f) === "pendiente").length,
    [facturas]
  );

  const reportesPendientesFirma = useMemo(
    () =>
      reportes.filter((r) => {
        const estado = String(r.Estado || "").toLowerCase();
        return estado.includes("pendiente") || estado === "enviado";
      }).length,
    [reportes]
  );

  const ultimasFacturas = useMemo(() => {
    const sorted = [...facturas].sort((a, b) => {
      const ta = parseSheetDate(facturaFecha(a))?.getTime() ?? 0;
      const tb = parseSheetDate(facturaFecha(b))?.getTime() ?? 0;
      return tb - ta;
    });
    return sorted.slice(0, 10);
  }, [facturas]);

  const reportesPendientes = useMemo(
    () =>
      reportes.filter((r) => {
        const estado = String(r.Estado || "").toLowerCase();
        return estado.includes("pendiente") || estado === "enviado";
      }),
    [reportes]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel administrador</h1>
        <p className="text-sm text-bia-gray-light">Resumen MiCaja · todas las zonas</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-[#525A72]/20 bg-[#001035]"
            />
          ))
        ) : (
          <>
            <div className="rounded-xl bg-[#001035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Zona Bogotá</h3>
                  <p className="text-xs text-[#8892A4]">
                    Límite {formatCOP(limiteBogota)} · {usuariosBogota} técnicos
                  </p>
                </div>
                <span className="text-xl font-bold text-[#08DDBC]">{bogota.pctEntregado}%</span>
              </div>
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-[#0a1628]">
                <div
                  style={{ width: `${bogota.pctFacturado}%` }}
                  className="h-full bg-[#08DDBC]"
                />
                <div
                  style={{ width: `${bogota.pctReportar}%` }}
                  className="h-full bg-yellow-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#8892A4]">💸 Entregado</p>
                  <p className="font-bold text-white">{formatCOP(bogota.entregado)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8892A4]">🧾 Facturado</p>
                  <p className="font-bold text-[#08DDBC]">{formatCOP(bogota.facturado)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8892A4]">⚠️ Por reportar</p>
                  <p className="font-bold text-yellow-400">{formatCOP(bogota.porReportar)}</p>
                </div>
              </div>
              <div className="mt-2 border-t border-[#0a1628] pt-2">
                <p className="text-xs text-[#8892A4]">
                  🏦 Disponible en caja:{" "}
                  <span className="font-medium text-white">{formatCOP(bogota.disponible)}</span>
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-[#001035] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Zona Costa Caribe</h3>
                  <p className="text-xs text-[#8892A4]">
                    Límite {formatCOP(limiteCosta)} · {usuariosCosta} técnicos
                  </p>
                </div>
                <span className="text-xl font-bold text-[#08DDBC]">{costa.pctEntregado}%</span>
              </div>
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-[#0a1628]">
                <div
                  style={{ width: `${costa.pctFacturado}%` }}
                  className="h-full bg-[#08DDBC]"
                />
                <div
                  style={{ width: `${costa.pctReportar}%` }}
                  className="h-full bg-yellow-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-[#8892A4]">💸 Entregado</p>
                  <p className="font-bold text-white">{formatCOP(costa.entregado)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8892A4]">🧾 Facturado</p>
                  <p className="font-bold text-[#08DDBC]">{formatCOP(costa.facturado)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8892A4]">⚠️ Por reportar</p>
                  <p className="font-bold text-yellow-400">{formatCOP(costa.porReportar)}</p>
                </div>
              </div>
              <div className="mt-2 border-t border-[#0a1628] pt-2">
                <p className="text-xs text-[#8892A4]">
                  🏦 Disponible en caja:{" "}
                  <span className="font-medium text-white">{formatCOP(costa.disponible)}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#001035] p-4">
          <p className="mb-1 text-xs text-[#8892A4]">📋 Pendientes de revisión</p>
          <p className="text-2xl font-bold text-yellow-400">
            {loading ? "—" : facturasPendientes}
          </p>
          <p className="text-xs text-[#525A72]">facturas por revisar</p>
        </div>
        <div className="rounded-xl bg-[#001035] p-4">
          <p className="mb-1 text-xs text-[#8892A4]">✍️ Reportes por firmar</p>
          <p className="text-2xl font-bold text-orange-400">
            {loading ? "—" : reportesPendientesFirma}
          </p>
          <p className="text-xs text-[#525A72]">reportes pendientes</p>
        </div>
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
