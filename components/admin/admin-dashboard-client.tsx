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
type EnvioRow = Record<string, unknown>;
type ReporteRow = Record<string, string>;

function estadoFacturaCaja(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Verificado", "Legalizado", "Estado") || "").toLowerCase().trim();
}
function facturaGastado(f: FacturaRow): boolean {
  const e = estadoFacturaCaja(f);
  return e === "aprobada" || e === "completada" || e === "pendiente";
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
function montoEnvioRow(e: EnvioRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto", "Valor") || "0"));
}
function facturaEnZona(f: FacturaRow, zona: "Bogota" | "Costa Caribe"): boolean {
  return sectorsEquivalent(String(getCellCaseInsensitive(f, "Sector") || ""), zona);
}
function facturaFecha(f: FacturaRow): string {
  return String(getCellCaseInsensitive(f, "Fecha_Factura", "Fecha") || "");
}
function reporteId(r: ReporteRow): string {
  return String(r.ID_Reporte || r.ID || "").trim();
}
function respKey(r: Record<string, unknown>): string {
  return String(getCellCaseInsensitive(r, "Responsable") || "").trim().toLowerCase();
}

function BarraProgreso({ pctFacturado, pctPendiente }: { pctFacturado: number; pctPendiente: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#0a1628] flex">
      <div style={{ width: `${pctFacturado}%` }} className="h-full bg-[#08DDBC] transition-all" />
      <div style={{ width: `${pctPendiente}%` }} className="h-full bg-yellow-400 transition-all" />
    </div>
  );
}

function calcularPendientePorUsuario(entregas: EntregaRow[], facturas: FacturaRow[]): number {
  const responsables = new Set([...entregas.map(respKey), ...facturas.map(respKey)]);
  let total = 0;
  for (const resp of Array.from(responsables)) {
    if (!resp) continue;
    const recibido = entregas.filter((e) => respKey(e) === resp).reduce((s, e) => s + montoEntregaRow(e), 0);
    const gastado = facturas.filter((f) => respKey(f) === resp && facturaGastado(f)).reduce((s, f) => s + montoFacturaRow(f), 0);
    const saldo = recibido - gastado;
    if (saldo > 0) total += saldo;
  }
  return total;
}

function ZonaCard({ titulo, limite, tecnicos, entregado, facturado, pendiente, enCaja, pctEntregado, pctFacturado, pctPendiente }: {
  titulo: string; limite: number; tecnicos: number;
  entregado: number; facturado: number; pendiente: number; enCaja: number;
  pctEntregado: number; pctFacturado: number; pctPendiente: number;
}) {
  return (
    <div className="rounded-xl bg-[#001035] p-5 border border-white/5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          <p className="text-xs text-[#8892A4]">Límite {formatCOP(limite)} · {tecnicos} técnicos</p>
        </div>
        <span className="text-lg font-bold text-[#08DDBC]">{pctEntregado}%</span>
      </div>
      <BarraProgreso pctFacturado={pctFacturado} pctPendiente={pctPendiente} />
      <div className="mt-1 flex gap-3 text-xs text-[#525A72]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#08DDBC] inline-block" />Facturado</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />Pendiente</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><p className="text-xs text-[#8892A4]">💸 Entregado</p><p className="font-bold text-white text-sm">{formatCOP(entregado)}</p></div>
        <div><p className="text-xs text-[#8892A4]">🧾 Facturado</p><p className="font-bold text-[#08DDBC] text-sm">{formatCOP(facturado)}</p></div>
        <div><p className="text-xs text-[#8892A4]">⚠️ Pendiente legalizar</p><p className="font-bold text-yellow-400 text-sm">{formatCOP(pendiente)}</p></div>
        <div>
          <p className="text-xs text-[#8892A4]">🏦 En caja</p>
          <p className={`font-bold text-sm ${enCaja >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {enCaja < 0 ? "-" : ""}{formatCOP(Math.abs(enCaja))}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [envios, setEnvios] = useState<EnvioRow[]>([]);
  const [entregasBogota, setEntregasBogota] = useState<EntregaRow[]>([]);
  const [entregasCosta, setEntregasCosta] = useState<EntregaRow[]>([]);
  const [tecnicosPorSector, setTecnicosPorSector] = useState<{ sector: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const encB = encodeURIComponent("Bogota");
      const encC = encodeURIComponent("Costa Caribe");
      const [fRes, rRes, eBogRes, eCostaRes, envRes] = await Promise.all([
        fetch("/api/facturas"),
        fetch("/api/legalizaciones"),
        fetch(`/api/entregas?zonaSector=${encB}`),
        fetch(`/api/entregas?zonaSector=${encC}`),
        fetch("/api/envios"),
      ]);
      const [fJson, rJson, eBogJson, eCostaJson, envJson] = await Promise.all([
        fRes.json().catch(() => ({ data: [] })),
        rRes.json().catch(() => ({ data: [] })),
        eBogRes.json().catch(() => ({ data: [] })),
        eCostaRes.json().catch(() => ({ data: [] })),
        envRes.json().catch(() => ({ data: [] })),
      ]);
      setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
      setReportes(Array.isArray(rJson.data) ? rJson.data : []);
      setEntregasBogota(Array.isArray(eBogJson.data) ? eBogJson.data : []);
      setEntregasCosta(Array.isArray(eCostaJson.data) ? eCostaJson.data : []);
      setEnvios(Array.isArray(envJson.data) ? envJson.data : []);
    } catch {
      setFacturas([]); setReportes([]); setEntregasBogota([]); setEntregasCosta([]); setEnvios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usuarios?rol=user")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        setTecnicosPorSector(rows.map((row: Record<string, unknown>) => ({
          sector: String(getCellCaseInsensitive(row, "Sector", "Zona") || "Bogota").trim(),
        })));
      })
      .catch(() => { if (!cancelled) setTecnicosPorSector([]); });
    return () => { cancelled = true; };
  }, []);

  const limiteBogota = 1_000_000;
  const limiteCosta = 3_000_000;

  const bogota = useMemo(() => {
    const fz = facturas.filter((f) => facturaEnZona(f, "Bogota"));
    const entregado = entregasBogota.reduce((s, e) => s + montoEntregaRow(e), 0);
    const facturado = fz.filter(facturaGastado).reduce((s, f) => s + montoFacturaRow(f), 0);
    const pendiente = calcularPendientePorUsuario(entregasBogota, fz);
    const reportadoFX = fz.filter((f) => { const e = estadoFacturaCaja(f); return e === "completada" || e === "aprobada"; }).reduce((s, f) => s + montoFacturaRow(f), 0);
    const respsBog = new Set([...entregasBogota.map(respKey), ...fz.map(respKey)]);
    const enviadoZona = envios.filter((e) => respsBog.has(respKey(e))).reduce((s, e) => s + montoEnvioRow(e), 0);
    const enCajaZona = enviadoZona - reportadoFX;
    const pctEntregado = limiteBogota > 0 ? Math.min(100, Math.round((entregado / limiteBogota) * 100)) : 0;
    const pctFacturado = limiteBogota > 0 ? Math.min(100, Math.round((facturado / limiteBogota) * 100)) : 0;
    const pctPendiente = limiteBogota > 0 ? Math.min(100, Math.round((pendiente / limiteBogota) * 100)) : 0;
    return { entregado, facturado, pendiente, enCajaZona, pctEntregado, pctFacturado, pctPendiente };
  }, [facturas, entregasBogota, envios]);

  const costa = useMemo(() => {
    const fz = facturas.filter((f) => facturaEnZona(f, "Costa Caribe"));
    const entregado = entregasCosta.reduce((s, e) => s + montoEntregaRow(e), 0);
    const facturado = fz.filter(facturaGastado).reduce((s, f) => s + montoFacturaRow(f), 0);
    const pendiente = calcularPendientePorUsuario(entregasCosta, fz);
    const reportadoFX = fz.filter((f) => { const e = estadoFacturaCaja(f); return e === "completada" || e === "aprobada"; }).reduce((s, f) => s + montoFacturaRow(f), 0);
    const respsCosta = new Set([...entregasCosta.map(respKey), ...fz.map(respKey)]);
    const enviadoZona = envios.filter((e) => respsCosta.has(respKey(e))).reduce((s, e) => s + montoEnvioRow(e), 0);
    const enCajaZona = enviadoZona - reportadoFX;
    const pctEntregado = limiteCosta > 0 ? Math.min(100, Math.round((entregado / limiteCosta) * 100)) : 0;
    const pctFacturado = limiteCosta > 0 ? Math.min(100, Math.round((facturado / limiteCosta) * 100)) : 0;
    const pctPendiente = limiteCosta > 0 ? Math.min(100, Math.round((pendiente / limiteCosta) * 100)) : 0;
    return { entregado, facturado, pendiente, enCajaZona, pctEntregado, pctFacturado, pctPendiente };
  }, [facturas, entregasCosta, envios]);

  const usuariosBogota = useMemo(() => tecnicosPorSector.filter((u) => u.sector === "Bogota").length, [tecnicosPorSector]);
  const usuariosCosta = useMemo(() => tecnicosPorSector.filter((u) => u.sector === "Costa Caribe").length, [tecnicosPorSector]);
  const facturasPendientes = useMemo(() => facturas.filter((f) => estadoFacturaCaja(f) === "pendiente").length, [facturas]);
  const reportesPendientesFirma = useMemo(() => reportes.filter((r) => { const e = String(r.Estado || "").toLowerCase(); return e.includes("pendiente") || e === "enviado"; }).length, [reportes]);
  const ultimasFacturas = useMemo(() => [...facturas].sort((a, b) => { const ta = parseSheetDate(facturaFecha(a))?.getTime() ?? 0; const tb = parseSheetDate(facturaFecha(b))?.getTime() ?? 0; return tb - ta; }).slice(0, 10), [facturas]);
  const reportesPendientes = useMemo(() => reportes.filter((r) => { const e = String(r.Estado || "").toLowerCase(); return e.includes("pendiente") || e === "enviado"; }), [reportes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Panel administrador</h1>
        <p className="text-sm text-[#8892A4]">Resumen MiCaja · todas las zonas</p>
      </div>

      {/* ── POR ZONA ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loading ? (
          [0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-[#001035]" />)
        ) : (
          <>
            <ZonaCard titulo="Zona Bogotá" limite={limiteBogota} tecnicos={usuariosBogota}
              entregado={bogota.entregado} facturado={bogota.facturado} pendiente={bogota.pendiente} enCaja={bogota.enCajaZona}
              pctEntregado={bogota.pctEntregado} pctFacturado={bogota.pctFacturado} pctPendiente={bogota.pctPendiente} />
            <ZonaCard titulo="Zona Costa Caribe" limite={limiteCosta} tecnicos={usuariosCosta}
              entregado={costa.entregado} facturado={costa.facturado} pendiente={costa.pendiente} enCaja={costa.enCajaZona}
              pctEntregado={costa.pctEntregado} pctFacturado={costa.pctFacturado} pctPendiente={costa.pctPendiente} />
          </>
        )}
      </div>

      {/* ── CONTADORES ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#001035] p-4 border border-white/5">
          <p className="mb-1 text-xs text-[#8892A4]">📋 Facturas pendientes</p>
          <p className="text-2xl font-bold text-yellow-400">{loading ? "—" : facturasPendientes}</p>
          <p className="text-xs text-[#525A72]">por revisar</p>
        </div>
        <div className="rounded-xl bg-[#001035] p-4 border border-white/5">
          <p className="mb-1 text-xs text-[#8892A4]">✍️ Reportes por firmar</p>
          <p className="text-2xl font-bold text-orange-400">{loading ? "—" : reportesPendientesFirma}</p>
          <p className="text-xs text-[#525A72]">pendientes</p>
        </div>
      </div>

      {/* ── ÚLTIMAS FACTURAS ── */}
      <Card className="border-white/5 bg-[#001035] text-white">
        <CardHeader><CardTitle className="text-base">Últimas 10 facturas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-[#8892A4]">Fecha</TableHead>
                <TableHead className="text-[#8892A4]">Responsable</TableHead>
                <TableHead className="text-[#8892A4]">Proveedor</TableHead>
                <TableHead className="text-[#8892A4]">Valor</TableHead>
                <TableHead className="text-[#8892A4]">Zona</TableHead>
                <TableHead className="text-[#8892A4]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6}><div className="h-6 animate-pulse rounded bg-white/5" /></TableCell></TableRow>
              ) : ultimasFacturas.length ? (
                ultimasFacturas.map((f, i) => (
                  <TableRow key={i} className="border-white/5 hover:bg-white/5">
                    <TableCell className="whitespace-nowrap text-sm">{facturaFecha(f) || "—"}</TableCell>
                    <TableCell className="text-sm">{String(getCellCaseInsensitive(f, "Responsable") || "—")}</TableCell>
                    <TableCell className="text-sm">{String(getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—")}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatCOP(parseCOPString(String(getCellCaseInsensitive(f, "Valor", "Monto_Factura") || "0")))}</TableCell>
                    <TableCell className="text-sm">{etiquetaZona(String(getCellCaseInsensitive(f, "Sector") || ""))}</TableCell>
                    <TableCell className="text-sm">{facturaEstado(f)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={6} className="text-[#8892A4]">Sin facturas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── REPORTES PENDIENTES ── */}
      <Card className="border-white/5 bg-[#001035] text-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Reportes pendientes de firma</CardTitle>
          <Link href="/admin/reportes" className="inline-flex h-8 items-center rounded-lg border border-white/20 px-3 text-xs hover:bg-white/5">
            Ir a reportes
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-[#8892A4]">Fecha</TableHead>
                <TableHead className="text-[#8892A4]">Coordinador</TableHead>
                <TableHead className="text-[#8892A4]">Zona</TableHead>
                <TableHead className="text-[#8892A4]">Total</TableHead>
                <TableHead className="text-right text-[#8892A4]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}><div className="h-6 animate-pulse rounded bg-white/5" /></TableCell></TableRow>
              ) : reportesPendientes.length ? (
                reportesPendientes.map((r, i) => (
                  <TableRow key={`${reporteId(r)}-${i}`} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-sm">{r.Fecha || "—"}</TableCell>
                    <TableCell className="text-sm">{r.Coordinador || "—"}</TableCell>
                    <TableCell className="text-sm">{etiquetaZona(String(r.Sector || ""))}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatCOP(parseCOPString(String(r.Total || r.TotalAprobado || "0")))}</TableCell>
                    <TableCell className="text-right">
                      <Link href="/admin/reportes" className="inline-flex h-7 items-center rounded-lg bg-white/5 px-3 text-xs hover:bg-white/10">
                        ✍️ Firmar
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-[#8892A4]">No hay reportes pendientes</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}