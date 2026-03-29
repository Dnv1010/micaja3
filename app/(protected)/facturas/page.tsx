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
import { formatCOP, formatDateDisplay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FacturaRow } from "@/types/models";
import { canEditVerificado } from "@/lib/roles";
import { Plus, Zap, Download } from "lucide-react";

function parseMonto(s: string): number {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function FacturasPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroLeg, setFiltroLeg] = useState<string>("all");
  const [filtroVer, setFiltroVer] = useState<string>("all");
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
      if (filtroResp && !(f.Responsable || "").toLowerCase().includes(filtroResp.toLowerCase())) {
        return false;
      }
      if (filtroLeg !== "all" && f.Legalizado !== filtroLeg) return false;
      if (filtroVer === "si" && String(f.Verificado).toLowerCase() !== "si") return false;
      if (filtroVer === "no" && String(f.Verificado).toLowerCase() === "si") return false;
      return true;
    });
  }, [rows, filtroResp, filtroLeg, filtroVer]);

  const grouped = useMemo(() => {
    const map = new Map<string, FacturaRow[]>();
    const sorted = [...filtered].sort(
      (a, b) => new Date(a.Fecha_Factura).getTime() - new Date(b.Fecha_Factura).getTime()
    );
    for (const f of sorted) {
      const k = f.Responsable || "—";
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        const sum = list.reduce((a, f) => a + parseMonto(f.Monto_Factura), 0);
        return (
          <div key={resp} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">{resp}</h2>
              <p className="text-sm font-bold tabular-nums">Σ {formatCOP(sum)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((f) => {
                const verSi = String(f.Verificado).toLowerCase() === "si";
                const showVer = session?.user?.rol && canEditVerificado(session.user.rol);
                return (
                  <Card key={f.ID_Factura}>
                    <CardHeader className="pb-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{f.Tipo_servicio || "Factura"}</CardTitle>
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
                        {formatDateDisplay(f.Fecha_Factura)} · {f.Legalizado}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p className="text-lg font-bold tabular-nums">{formatCOP(parseMonto(f.Monto_Factura))}</p>
                      <p className="text-xs text-muted-foreground truncate">#{f.Num_Factura}</p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/facturas/${encodeURIComponent(f.ID_Factura)}`}
                          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                        >
                          Detalle
                        </Link>
                        {f.Adjuntar_Factura && (
                          <a
                            href={f.Adjuntar_Factura}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            Imagen
                          </a>
                        )}
                        {f.URL && (
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
