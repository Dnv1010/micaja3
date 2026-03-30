"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCOP, formatDateDDMMYYYY, parseCOPString, parseSheetDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FacturaRow } from "@/types/models";
import { canEditVerificado } from "@/lib/roles";
import { Plus, Zap, Download } from "lucide-react";
import {
  facturaEstado,
  facturaFecha,
  facturaImagenUrl,
  facturaNit,
  facturaProveedor,
  facturaConcepto,
  facturaResponsable,
  facturaRowId,
  facturaTipo,
  facturaValor,
  facturaVerificado,
} from "@/lib/row-fields";

export default function FacturasPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroLeg, setFiltroLeg] = useState<string>("all");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroVer, setFiltroVer] = useState<string>("all");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/facturas")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((f) => {
      const resp = facturaResponsable(f);
      if (filtroResp && !resp.toLowerCase().includes(filtroResp.toLowerCase())) {
        return false;
      }
      const leg = (f.Legalizado || "").trim();
      if (filtroLeg !== "all" && leg !== filtroLeg) return false;
      const est = (facturaEstado(f) || leg || "").trim();
      if (filtroEstado && est !== filtroEstado) return false;
      const ver = (facturaVerificado(f) || "").toLowerCase();
      if (filtroVer === "si" && ver !== "si" && ver !== "sí") return false;
      if (filtroVer === "no" && (ver === "si" || ver === "sí")) return false;
      const d = parseSheetDate(facturaFecha(f));
      if (fechaDesde) {
        const a = new Date(fechaDesde);
        if (!d || d < a) return false;
      }
      if (fechaHasta) {
        const b = new Date(fechaHasta);
        b.setHours(23, 59, 59, 999);
        if (!d || d > b) return false;
      }
      return true;
    });
  }, [rows, filtroResp, filtroLeg, filtroEstado, filtroVer, fechaDesde, fechaHasta]);

  const grouped = useMemo(() => {
    const map = new Map<string, FacturaRow[]>();
    const sorted = [...filtered].sort(
      (a, b) =>
        (parseSheetDate(facturaFecha(a))?.getTime() ?? 0) -
        (parseSheetDate(facturaFecha(b))?.getTime() ?? 0)
    );
    for (const f of sorted) {
      const k = facturaResponsable(f) || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(f);
    }
    return map;
  }, [filtered]);

  const email = session?.user?.email || "";

  async function confirmExport() {
    const res = await fetch("/api/facturas/exportar");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "facturas.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Facturas</h1>
        <Link
          href="/facturas/nueva"
          className={cn(
            buttonVariants({ size: "lg" }),
            "inline-flex items-center justify-center gap-2 min-h-12"
          )}
        >
          <Plus className="h-5 w-5" /> Nueva
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1">
          <Label className="text-xs">Responsable</Label>
          <Input
            value={filtroResp}
            onChange={(e) => setFiltroResp(e.target.value)}
            placeholder="Buscar…"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Legalizado</Label>
          <Select value={filtroLeg} onValueChange={(v) => setFiltroLeg(v ?? "all")}>
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendiente">Pendiente</SelectItem>
              <SelectItem value="Completado">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Estado (exacto)</Label>
          <Input
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            placeholder="Todos"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde</Label>
          <Input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hasta</Label>
          <Input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Verificado</Label>
          <Select value={filtroVer} onValueChange={(v) => setFiltroVer(v ?? "all")}>
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full min-h-11 inline-flex items-center justify-center gap-2"
              )}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Exportar facturas</DialogTitle>
                <DialogDescription>
                  Estimado usuario {email}, esta acción exportará los datos visibles para usted en CSV
                  (separador punto y coma, locale es-CO). Fecha: {new Date().toLocaleDateString("es-CO")}.
                  ¿Desea proceder?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setExportOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmExport}>Exportar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {Array.from(grouped.entries()).map(([resp, list]) => {
        const sum = list.reduce((a, f) => a + parseCOPString(facturaValor(f) || "0"), 0);
        return (
          <div key={resp} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">{resp}</h2>
              <p className="text-sm font-bold tabular-nums">Σ {formatCOP(sum)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((f) => {
                const id = facturaRowId(f);
                const verSi =
                  String(facturaVerificado(f)).toLowerCase() === "si" ||
                  String(facturaVerificado(f)).toLowerCase() === "sí";
                const showVer = session?.user?.rol && canEditVerificado(session.user.rol);
                const img = facturaImagenUrl(f);
                return (
                  <Card key={id}>
                    <CardHeader className="pb-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          {facturaProveedor(f) || facturaConcepto(f) || f.Tipo_servicio || "Factura"}
                        </CardTitle>
                        {showVer && (
                          <Badge
                            className={cn(
                              verSi
                                ? "bg-cyan-600 hover:bg-cyan-600 text-white"
                                : "bg-red-600 hover:bg-red-600 text-white"
                            )}
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {verSi ? "Verif." : "No verif."}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateDDMMYYYY(facturaFecha(f))} · NIT {facturaNit(f) || "—"} ·{" "}
                        {facturaEstado(f) || f.Legalizado || "—"}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-lg font-bold tabular-nums">
                        {formatCOP(parseCOPString(facturaValor(f) || "0"))}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {facturaTipo(f) ? `${facturaTipo(f)} · ` : ""}#{id}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/facturas/${encodeURIComponent(id)}`}
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                        >
                          Detalle
                        </Link>
                        {img && (
                          <a
                            href={img}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            Imagen
                          </a>
                        )}
                        {f.URL && !img && (
                          <a
                            href={f.URL}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                          >
                            URL
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay facturas con los filtros actuales.</p>
      )}
    </div>
  );
}
