"use client";

import { useEffect, useMemo, useState } from "react";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { normalizeSector } from "@/lib/sector-normalize";
import { fallbackActiveZoneUsers } from "@/lib/users-fallback";
import type { FallbackUser } from "@/lib/users-fallback";

type FacturaRow = Record<string, unknown>;
type EntregaRow = Record<string, unknown>;

function estadoFactura(f: FacturaRow): string {
  return String(
    getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente"
  ).toLowerCase();
}

function montoFactura(f: FacturaRow): number {
  return parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0"));
}

function montoEntrega(e: EntregaRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto") || "0"));
}

function responsableRow(r: FacturaRow | EntregaRow): string {
  return String(getCellCaseInsensitive(r, "Responsable") || "").trim();
}

export function CoordinadorDashboardClient({
  sector,
  zonaLabel,
}: {
  sector: string;
  zonaLabel: string;
}) {
  const sectorQuery = useMemo(() => normalizeSector(sector) ?? sector.trim(), [sector]);
  const limite = limiteAprobacionZona(sectorQuery);

  const tecnicosZona = useMemo(
    () => fallbackActiveZoneUsers(sector),
    [sector]
  );

  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const enc = encodeURIComponent(sectorQuery);
      try {
        const [fRes, eRes] = await Promise.all([
          fetch(`/api/facturas?zonaSector=${enc}`),
          fetch(`/api/entregas?zonaSector=${enc}`),
        ]);
        const fJson = (await fRes.json().catch(() => ({ data: [] }))) as { data?: FacturaRow[] };
        const eJson = (await eRes.json().catch(() => ({ data: [] }))) as { data?: EntregaRow[] };
        if (!mounted) return;
        setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
        setEntregas(Array.isArray(eJson.data) ? eJson.data : []);
      } catch {
        if (!mounted) return;
        setFacturas([]);
        setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [sectorQuery]);

  const totalEntregado = entregas.reduce((s, e) => s + montoEntrega(e), 0);

  const totalLegalizado = facturas
    .filter((f) => ["aprobada", "completada"].includes(estadoFactura(f)))
    .reduce((s, f) => s + montoFactura(f), 0);

  const totalPendiente = facturas
    .filter((f) => estadoFactura(f) === "pendiente")
    .reduce((s, f) => s + montoFactura(f), 0);

  const porEntregar = Math.max(0, limite - totalEntregado);
  const pctEntregado = limite > 0 ? Math.min(Math.round((totalEntregado / limite) * 100), 100) : 0;
  const pctLegalizado =
    totalEntregado > 0 ? Math.round((totalLegalizado / totalEntregado) * 100) : 0;
  const pctPorLegalizar =
    totalEntregado > 0 ? Math.round((totalPendiente / totalEntregado) * 100) : 0;

  function recibidoPor(nombre: string): number {
    const n = nombre.toLowerCase();
    return entregas
      .filter((e) => responsableRow(e).toLowerCase() === n)
      .reduce((s, e) => s + montoEntrega(e), 0);
  }

  function aprobadoPor(nombre: string): number {
    const n = nombre.toLowerCase();
    return facturas
      .filter(
        (f) =>
          responsableRow(f).toLowerCase() === n &&
          ["aprobada", "completada"].includes(estadoFactura(f))
      )
      .reduce((s, f) => s + montoFactura(f), 0);
  }

  function pendientePor(nombre: string): number {
    const n = nombre.toLowerCase();
    return facturas
      .filter((f) => responsableRow(f).toLowerCase() === n && estadoFactura(f) === "pendiente")
      .reduce((s, f) => s + montoFactura(f), 0);
  }

  const pctLegalSobreLimite =
    limite > 0 ? Math.round((totalLegalizado / limite) * 100) : 0;
  const pctPendSobreLimite =
    limite > 0 ? Math.round((totalPendiente / limite) * 100) : 0;

  if (loading) {
    return (
      <div className="animate-pulse p-8 text-[#8892A4]">Cargando zona...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Zona {zonaLabel}</h1>
        <p className="text-sm text-[#8892A4]">Límite de caja menor: {formatCOP(limite)}</p>
      </div>

      <div className="rounded-2xl border border-[#525A72]/20 bg-[#0A1B4D] p-6">
        <div className="mb-5">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-[#8892A4]">Entregado a técnicos</span>
            <span className="font-semibold text-white">
              {formatCOP(totalEntregado)}{" "}
              <span className="text-[#08DDBC]">({pctEntregado}%)</span>
            </span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-[#001035]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pctEntregado}%`,
                backgroundColor:
                  pctEntregado >= 90 ? "#ef4444" : pctEntregado >= 70 ? "#f59e0b" : "#08DDBC",
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-[#525A72]">$0</span>
            <span className="text-[#525A72]">{formatCOP(limite)} (100%)</span>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">💸 Entregado</p>
            <p className="text-xl font-bold text-white">{formatCOP(totalEntregado)}</p>
            <p className="mt-1 text-xs text-[#08DDBC]">{pctEntregado}% del límite</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">✅ Legalizado</p>
            <p className="text-xl font-bold text-[#08DDBC]">{formatCOP(totalLegalizado)}</p>
            <p className="mt-1 text-xs text-[#525A72]">{pctLegalizado}% de lo entregado</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">⏳ Por legalizar</p>
            <p className="text-xl font-bold text-yellow-400">{formatCOP(totalPendiente)}</p>
            <p className="mt-1 text-xs text-[#525A72]">{pctPorLegalizar}% de lo entregado</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">🏦 Por entregar</p>
            <p className="text-xl font-bold text-white">{formatCOP(porEntregar)}</p>
            <p className="mt-1 text-xs text-[#525A72]">{100 - pctEntregado}% disponible</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-[#8892A4]">Desglose del límite</p>
          <div className="flex h-6 overflow-hidden rounded-full bg-[#001035]">
            <div
              style={{ width: `${pctLegalSobreLimite}%` }}
              className="flex h-full items-center justify-center bg-[#08DDBC]"
            >
              {pctLegalSobreLimite > 8 ? (
                <span className="text-xs font-bold text-[#001035]">{pctLegalSobreLimite}%</span>
              ) : null}
            </div>
            <div
              style={{ width: `${pctPendSobreLimite}%` }}
              className="flex h-full items-center justify-center bg-yellow-400"
            >
              {pctPendSobreLimite > 5 ? (
                <span className="text-xs font-bold text-yellow-900">{pctPendSobreLimite}%</span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex gap-4">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-[#08DDBC]" />
              <span className="text-xs text-[#8892A4]">Legalizado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <span className="text-xs text-[#8892A4]">Por legalizar</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full border border-[#525A72]/30 bg-[#001035]" />
              <span className="text-xs text-[#8892A4]">Por entregar</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-white">{tecnicosZona.length}</p>
          <p className="mt-1 text-xs text-[#8892A4]">Técnicos activos</p>
        </div>
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {facturas.filter((f) => estadoFactura(f) === "pendiente").length}
          </p>
          <p className="mt-1 text-xs text-[#8892A4]">Fact. pendientes</p>
        </div>
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-[#08DDBC]">
            {
              facturas.filter((f) => ["aprobada", "completada"].includes(estadoFactura(f)))
                .length
            }
          </p>
          <p className="mt-1 text-xs text-[#8892A4]">Fact. aprobadas</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-white">Caja menor por técnico</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tecnicosZona.map((u: FallbackUser) => {
            const recibido = recibidoPor(u.responsable);
            const aprobado = aprobadoPor(u.responsable);
            const pendiente = pendientePor(u.responsable);
            const disponible = recibido - aprobado - pendiente;
            const pct = recibido > 0 ? Math.min(Math.round((aprobado / recibido) * 100), 100) : 0;
            const inicial = (u.responsable.trim().charAt(0) || "?").toUpperCase();

            return (
              <div
                key={u.email}
                className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#08DDBC]/20 text-sm font-bold text-[#08DDBC]">
                      {inicial}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight text-white">
                        {u.responsable}
                      </p>
                      <p className="text-xs text-[#525A72]">{u.cargo}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      pct >= 90
                        ? "bg-red-500/10 text-red-400"
                        : pct >= 70
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-[#08DDBC]/10 text-[#08DDBC]"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#001035]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor:
                        pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#08DDBC",
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-sm font-bold text-[#08DDBC]">{formatCOP(aprobado)}</p>
                    <p className="text-xs text-[#525A72]">Aprobado</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-400">{formatCOP(pendiente)}</p>
                    <p className="text-xs text-[#525A72]">Pendiente</p>
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold ${disponible >= 0 ? "text-white" : "text-red-400"}`}
                    >
                      {formatCOP(Math.abs(disponible))}
                    </p>
                    <p className="text-xs text-[#525A72]">
                      {disponible >= 0 ? "Disponible" : "Excedido"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
