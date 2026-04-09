"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NuevaAgrupacionModal from "@/components/gastos/NuevaAgrupacionModal";

interface GrupoRow {
  _rowIndex: string;
  ID_Grupo: string;
  FechaCreacion: string;
  Responsable: string;
  Cargo: string;
  Sector: string;
  Motivo: string;
  FechaInicio: string;
  FechaFin: string;
  Total: string;
  Estado: string;
  Gastos_IDs: string;
  PDF_URL: string;
  Firma: string;
  CentroCostos: string;
}

interface GastoBase {
  _rowIndex: string;
  Responsable: string;
  FechaFactura: string;
  Concepto: string;
  NIT: string;
  Ciudad: string;
  CentroCostos: string;
  Valor: string;
  ImagenURL?: string;
}

export default function GastosAgrupacionesTab({ rol }: { rol: string; sector: string }) {
  const { data } = useSession();
  const [grupos, setGrupos] = useState<GrupoRow[]>([]);
  const [gastos, setGastos] = useState<GastoBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [g1, g2] = await Promise.all([
        fetch("/api/gastos-grupos").then((r) => r.json().catch(() => ({ data: [] }))),
        fetch("/api/gastos").then((r) => r.json().catch(() => ({ data: [] }))),
      ]);
      setGrupos(Array.isArray(g1.data) ? g1.data : []);
      setGastos(Array.isArray(g2.data) ? g2.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const disponible = useMemo(() => {
    const usados = new Set<string>();
    for (const g of grupos) {
      const ids = JSON.parse(String(g.Gastos_IDs || "[]")) as string[];
      ids.forEach((id) => usados.add(String(id)));
    }
    return gastos.filter((g) => !usados.has(g._rowIndex));
  }, [gastos, grupos]);

  async function eliminar(grupo: GrupoRow) {
    if (String(grupo.Estado || "").toLowerCase() !== "borrador") {
      window.alert("Solo puedes eliminar borradores");
      return;
    }
    const ok = window.confirm(`Eliminar ${grupo.ID_Grupo}?`);
    if (!ok) return;
    await fetch(`/api/gastos-grupos/${encodeURIComponent(grupo.ID_Grupo)}`, { method: "DELETE" });
    void cargar();
  }

  const me = String(data?.user?.responsable || data?.user?.name || "");
  const cargo = String(data?.user?.cargo || "");
  const sector = String(data?.user?.sector || "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Agrupaciones / Reportes</h3>
          <p className="text-sm text-gray-400">Agrupa gastos, firma y genera PDF final</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="bg-purple-600 hover:bg-purple-700">
          + Nueva Agrupación
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400">Cargando grupos...</div>
      ) : grupos.length === 0 ? (
        <div className="py-10 text-center text-gray-400">No hay agrupaciones</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left text-xs text-gray-400">Grupo</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Período</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Responsable</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Total</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Estado</th>
                <th className="px-3 py-2 text-right text-xs text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.ID_Grupo} className="border-b border-white/5">
                  <td className="px-3 py-2 text-xs text-white">{g.ID_Grupo}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{g.FechaInicio} → {g.FechaFin}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{g.Responsable}</td>
                  <td className="px-3 py-2 text-xs text-cyan-400">{g.Total || "0"}</td>
                  <td className="px-3 py-2">
                    <Badge className={`border text-xs ${String(g.Estado || "").toLowerCase().includes("firm") ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                      {g.Estado || "Borrador"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      {g.PDF_URL ? (
                        <a href={g.PDF_URL} target="_blank" rel="noreferrer" className="rounded-md border border-cyan-500/30 px-2 py-1 text-xs text-cyan-300">
                          Ver PDF
                        </a>
                      ) : null}
                      {rol === "admin" || String(g.Estado || "").toLowerCase() === "borrador" ? (
                        <Button size="sm" variant="outline" onClick={() => void eliminar(g)} className="border-red-500/30 text-red-400">
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NuevaAgrupacionModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        responsable={me}
        cargo={cargo}
        sector={sector}
        gastos={disponible}
        onCreated={() => void cargar()}
      />
    </div>
  );
}
