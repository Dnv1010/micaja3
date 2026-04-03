"use client";

import { useEffect, useMemo, useState } from "react";
import { limiteAprobacionZona } from "@/lib/coordinador-zona";
import { formatCOP, parseMonto } from "@/lib/format";
import { normalizeSector } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type FacturaRow = Record<string, unknown>;
type EntregaRow = Record<string, unknown>;

/** Prioridad Verificado → Legalizado → Estado (como en negocio). */
function estadoFacturaZona(f: FacturaRow): string {
  return String(
    getCellCaseInsensitive(f, "Verificado", "Legalizado", "Estado") || ""
  )
    .toLowerCase()
    .trim();
}

function esFacturaSoloAprobada(f: FacturaRow): boolean {
  return estadoFacturaZona(f) === "aprobada";
}

function esFacturaCompletada(f: FacturaRow): boolean {
  return estadoFacturaZona(f) === "completada";
}

function esFacturaPendienteActiva(f: FacturaRow): boolean {
  return estadoFacturaZona(f) === "pendiente";
}

function montoFactura(f: FacturaRow): number {
  return parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0"));
}

function montoEntrega(e: EntregaRow): number {
  return parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto") || "0"));
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

  const [tecnicosZona, setTecnicosZona] = useState<{ responsable: string }[]>([]);

  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const enc = encodeURIComponent(sectorQuery);
    fetch(`/api/usuarios?sector=${enc}&rol=user`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: { responsable: string }[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          const name = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
          if (name) list.push({ responsable: name });
        }
        setTecnicosZona(list);
      })
      .catch(() => {
        if (mounted) setTecnicosZona([]);
      });
    return () => {
      mounted = false;
    };
  }, [sectorQuery]);

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

  const totalAprobado = facturas
    .filter((f) => esFacturaSoloAprobada(f))
    .reduce((s, f) => s + montoFactura(f), 0);

  const totalCompletado = facturas
    .filter((f) => esFacturaCompletada(f))
    .reduce((s, f) => s + montoFactura(f), 0);

  const totalPendiente = facturas
    .filter((f) => esFacturaPendienteActiva(f))
    .reduce((s, f) => s + montoFactura(f), 0);

  const enTerreno = Math.max(0, totalEntregado - totalAprobado - totalPendiente);
  const porReportar = totalAprobado;
  const enCajaMenor = Math.max(0, limite - totalEntregado);
  const pctEntregado = limite > 0 ? Math.min(Math.round((totalEntregado / limite) * 100), 100) : 0;
  const pctUsado =
    limite > 0 ? Math.min(Math.round(((totalAprobado + totalPendiente) / limite) * 100), 100) : 0;

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
            <p className="mb-1 text-xs text-[#8892A4]">🔧 En terreno</p>
            <p className="text-xl font-bold text-white">{formatCOP(enTerreno)}</p>
            <p className="mt-1 text-xs text-[#525A72]">Entregado y disponible para gastar</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">📋 Por reportar</p>
            <p className="text-xl font-bold text-[#08DDBC]">{formatCOP(porReportar)}</p>
            <p className="mt-1 text-xs text-[#525A72]">Aprobadas pendientes de legalizar</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">🏦 En caja menor</p>
            <p className="text-xl font-bold text-white">{formatCOP(enCajaMenor)}</p>
            <p className="mt-1 text-xs text-[#525A72]">Sin entregar del límite</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4">
            <p className="mb-1 text-xs text-[#8892A4]">✅ Ya legalizado</p>
            <p className="text-xl font-bold text-[#525A72]">{formatCOP(totalCompletado)}</p>
            <p className="mt-1 text-xs text-[#525A72]">Histórico pagado</p>
          </div>
        </div>

        <p className="mb-2 text-xs text-[#8892A4]">
          Uso del límite (aprobadas + pendientes):{" "}
          <span className="font-semibold text-white">{pctUsado}%</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-white">{tecnicosZona.length}</p>
          <p className="mt-1 text-xs text-[#8892A4]">Técnicos activos</p>
        </div>
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {facturas.filter((f) => esFacturaPendienteActiva(f)).length}
          </p>
          <p className="mt-1 text-xs text-[#8892A4]">Fact. pendientes</p>
        </div>
        <div className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4 text-center">
          <p className="text-2xl font-bold text-[#08DDBC]">
            {facturas.filter((f) => esFacturaSoloAprobada(f)).length}
          </p>
          <p className="mt-1 text-xs text-[#8892A4]">Fact. aprobadas</p>
        </div>
      </div>
    </div>
  );
}
