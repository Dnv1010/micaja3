"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/format";
import { CheckCircle2, FileText, Pencil, Plus, RefreshCw, Search, Trash2, XCircle } from "lucide-react";
import EditarGastoModal, { GastoEditable } from "@/components/gastos/EditarGastoModal";
import AgregarFacturaModal from "@/components/gastos/AgregarFacturaModal";

export interface GastoRow extends GastoEditable {
  FechaCreacion: string;
  Responsable: string;
  Cargo: string;
}

function valorNum(raw: string): number {
  return parseFloat(String(raw).replace(/[^0-9.-]/g, "")) || 0;
}

export default function GastosIndividualesTab({ rol }: { rol: string; sector: string }) {
  const { data: session } = useSession();
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [edit, setEdit] = useState<GastoRow | null>(null);
  const [openAgregarFactura, setOpenAgregarFactura] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gastos");
      const json = (await res.json().catch(() => ({ data: [] }))) as { data?: GastoRow[] };
      setGastos(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return gastos;
    const q = busqueda.toLowerCase();
    return gastos.filter((g) =>
      [g.Responsable, g.Concepto, g.Ciudad, g.Motivo, g.CentroCostos].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [gastos, busqueda]);

  async function cambiarEstado(rowIndex: string, estado: string) {
    setActualizando(rowIndex);
    try {
      const res = await fetch("/api/gastos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, estado }),
      });
      if (!res.ok) return;
      setGastos((prev) => prev.map((g) => (g._rowIndex === rowIndex ? { ...g, Estado: estado } : g)));
    } finally {
      setActualizando(null);
    }
  }

  async function eliminarGasto(rowIndex: string) {
    if (!window.confirm("¿Estás seguro que deseas eliminar este gasto?")) return;
    setEliminando(rowIndex);
    try {
      const res = await fetch(`/api/gastos/${encodeURIComponent(rowIndex)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(error.error || "Error eliminando gasto");
        return;
      }
      setGastos((prev) => prev.filter((g) => g._rowIndex !== rowIndex));
    } finally {
      setEliminando(null);
    }
  }

  const totalValor = useMemo(() => filtrados.reduce((sum, g) => sum + valorNum(g.Valor), 0), [filtrados]);
  const estadoBadge = (estado: string) =>
    estado === "Aprobada"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : estado === "Rechazada"
        ? "bg-red-500/20 text-red-400 border-red-500/30"
        : "bg-amber-500/20 text-amber-400 border-amber-500/30";

  return (
    <div>
      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar gastos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border-white/10 bg-white/5 pl-9 text-white"
          />
        </div>
        <Button variant="outline" onClick={() => void cargar()} className="gap-2 border-white/10 text-gray-300">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
        {session?.user && (
          <Button
            onClick={() => setOpenAgregarFactura(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            + Agregar Factura
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-400">Cargando gastos...</div>
      ) : filtrados.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-30" />
          No hay registros
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left text-xs text-gray-400">Fecha</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Responsable</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Concepto</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Ciudad</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Valor</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400">Estado</th>
                <th className="px-3 py-2 text-center text-xs text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g) => (
                <tr key={g._rowIndex} className="border-b border-white/5">
                  <td className="px-3 py-2 text-xs text-gray-300">{g.FechaCreacion || "—"}</td>
                  <td className="px-3 py-2 text-xs text-white">{g.Responsable || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{g.Concepto || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-300">{g.Ciudad || "—"}</td>
                  <td className="px-3 py-2 text-xs text-cyan-400">{formatCOP(valorNum(g.Valor))}</td>
                  <td className="px-3 py-2">
                    <Badge className={`border text-xs ${estadoBadge(g.Estado || "Pendiente")}`}>
                      {g.Estado || "Pendiente"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(g)} className="h-7 px-2 text-blue-300">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={eliminando === g._rowIndex}
                        onClick={() => void eliminarGasto(g._rowIndex)}
                        className="h-7 px-2 text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {rol === "admin" ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actualizando === g._rowIndex || g.Estado === "Aprobada"}
                            onClick={() => void cambiarEstado(g._rowIndex, "Aprobada")}
                            className="h-7 px-2 text-emerald-400"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actualizando === g._rowIndex || g.Estado === "Rechazada"}
                            onClick={() => void cambiarEstado(g._rowIndex, "Rechazada")}
                            className="h-7 px-2 text-red-400"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-white/5">
                <td colSpan={4} className="px-3 py-2 text-xs text-gray-400">{filtrados.length} registros</td>
                <td className="px-3 py-2 text-xs font-semibold text-cyan-400">{formatCOP(totalValor)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <EditarGastoModal
        gasto={edit}
        open={!!edit}
        onClose={() => setEdit(null)}
        onSaved={(rowIndex, patch) => {
          setGastos((prev) => prev.map((g) => (g._rowIndex === rowIndex ? { ...g, ...patch } : g)));
        }}
      />
      {session?.user && (
        <AgregarFacturaModal
          open={openAgregarFactura}
          onClose={() => setOpenAgregarFactura(false)}
          responsable={String(session.user.responsable || "")}
          cargo={String(session.user.cargo || "")}
          cc={String(session.user.cc || "")}
          ciudad={String(session.user.ciudad || "")}
          onSaved={() => {
            setOpenAgregarFactura(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}
