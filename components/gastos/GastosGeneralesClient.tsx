"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCOP } from "@/lib/format";
import { CheckCircle2, FileText, RefreshCw, Search, XCircle } from "lucide-react";

interface GastoRow {
  _rowIndex: string;
  FechaCreacion: string;
  Responsable: string;
  Cargo: string;
  CC: string;
  Ciudad: string;
  Motivo: string;
  FechaInicio: string;
  FechaFin: string;
  Concepto: string;
  CentroCostos: string;
  NIT: string;
  FechaFactura: string;
  Valor: string;
  Estado: string;
}

interface Props {
  rol: string;
  sector: string;
}

function valorNum(raw: string): number {
  return parseFloat(String(raw).replace(/[^0-9.-]/g, "")) || 0;
}

function fechaText(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("es-CO");
  return raw;
}

export default function GastosGeneralesClient({ rol }: Props) {
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroResponsable, setFiltroResponsable] = useState("Todos");
  const [actualizando, setActualizando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gastos");
      const json = (await res.json().catch(() => ({ data: [] }))) as { data?: GastoRow[] };
      setGastos(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      setGastos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarEstado = async (rowIndex: string, estado: string) => {
    setActualizando(rowIndex);
    try {
      const res = await fetch("/api/gastos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, estado }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(`❌ ${j.error || "No se pudo actualizar estado"}`);
        return;
      }
      setGastos((prev) => prev.map((g) => (g._rowIndex === rowIndex ? { ...g, Estado: estado } : g)));
    } finally {
      setActualizando(null);
    }
  };

  const responsables = useMemo(
    () => ["Todos", ...Array.from(new Set(gastos.map((g) => g.Responsable).filter(Boolean)))],
    [gastos]
  );

  const filtrados = useMemo(
    () =>
      gastos.filter((g) => {
        if (filtroEstado !== "Todos" && (g.Estado || "Pendiente") !== filtroEstado) return false;
        if (filtroResponsable !== "Todos" && g.Responsable !== filtroResponsable) return false;
        if (busqueda) {
          const q = busqueda.toLowerCase();
          return (
            g.Responsable?.toLowerCase().includes(q) ||
            g.Concepto?.toLowerCase().includes(q) ||
            g.Ciudad?.toLowerCase().includes(q) ||
            g.Motivo?.toLowerCase().includes(q) ||
            g.CentroCostos?.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [gastos, filtroEstado, filtroResponsable, busqueda]
  );

  const totalValor = useMemo(() => filtrados.reduce((sum, g) => sum + valorNum(g.Valor), 0), [filtrados]);

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case "Aprobada":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Rechazada":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-1 text-xs text-gray-400">Total registros</p>
          <p className="text-2xl font-semibold text-white">{filtrados.length}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-1 text-xs text-gray-400">Total valor</p>
          <p className="text-2xl font-semibold text-cyan-400">{formatCOP(totalValor)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-1 text-xs text-gray-400">Pendientes</p>
          <p className="text-2xl font-semibold text-amber-400">
            {filtrados.filter((g) => !g.Estado || g.Estado === "Pendiente").length}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-1 text-xs text-gray-400">Aprobados</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {filtrados.filter((g) => g.Estado === "Aprobada").length}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, concepto, ciudad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-gray-500"
          />
        </div>
        <Select
          value={filtroEstado}
          onValueChange={(value) => setFiltroEstado(value ?? "Todos")}
        >
          <SelectTrigger className="w-[160px] border-white/10 bg-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los estados</SelectItem>
            <SelectItem value="Aprobada">Aprobada</SelectItem>
            <SelectItem value="Rechazada">Rechazada</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filtroResponsable}
          onValueChange={(value) => setFiltroResponsable(value ?? "Todos")}
        >
          <SelectTrigger className="w-[200px] border-white/10 bg-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {responsables.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void cargar()}
          className="gap-2 border-white/10 text-gray-400 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Cargando gastos...</div>
      ) : filtrados.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p>No hay gastos registrados</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Responsable</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Ciudad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Motivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Concepto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Centro Costo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Fecha Factura</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Estado</th>
                  {rol === "admin" ? (
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((g, i) => (
                  <tr
                    key={g._rowIndex}
                    className={`border-b border-white/5 transition-colors hover:bg-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">{fechaText(g.FechaCreacion)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-white">{g.Responsable || "—"}</div>
                      <div className="text-xs text-gray-500">{g.Cargo || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-gray-300">{g.Ciudad || "—"}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-xs text-gray-300" title={g.Motivo}>
                      {g.Motivo || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">{g.Concepto || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-300">{g.CentroCostos || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">{g.FechaFactura || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-cyan-400">
                      {formatCOP(valorNum(g.Valor))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`border text-xs ${estadoBadge(g.Estado || "Pendiente")}`}>
                        {g.Estado || "Pendiente"}
                      </Badge>
                    </td>
                    {rol === "admin" ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={g.Estado === "Aprobada" || actualizando === g._rowIndex}
                            onClick={() => void cambiarEstado(g._rowIndex, "Aprobada")}
                            className="h-7 px-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                            title="Aprobar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={g.Estado === "Rechazada" || actualizando === g._rowIndex}
                            onClick={() => void cambiarEstado(g._rowIndex, "Rechazada")}
                            className="h-7 px-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            title="Rechazar"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/5">
                  <td colSpan={rol === "admin" ? 7 : 6} className="px-4 py-3 text-xs text-gray-400">
                    {filtrados.length} registros
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-cyan-400">{formatCOP(totalValor)}</td>
                  <td colSpan={rol === "admin" ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
