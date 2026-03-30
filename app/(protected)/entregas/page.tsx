"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDateDDMMYYYY, parseCOPString, parseSheetDate } from "@/lib/format";
import type { EntregaRow } from "@/types/models";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  entregaEstado,
  entregaFecha,
  entregaMonto,
  entregaResponsable,
  entregaRowId,
  entregaSector,
} from "@/lib/row-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function EntregasPage() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<EntregaRow[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [filtroSector, setFiltroSector] = useState<string>("all");

  const canCreate =
    session?.user?.rol &&
    ["admin", "coordinador"].includes(String(session.user.rol).toLowerCase());

  useEffect(() => {
    fetch("/api/entregas")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((e) => {
      const est = (entregaEstado(e) || "").trim();
      if (filtroEstado !== "all" && est !== filtroEstado) return false;
      const sec = (entregaSector(e) || "").toLowerCase();
      if (filtroSector === "bogota" && !sec.includes("bogota")) return false;
      if (filtroSector === "costa" && !sec.includes("costa") && !sec.includes("caribe")) return false;
      return true;
    });
  }, [rows, filtroEstado, filtroSector]);

  const grouped = useMemo(() => {
    const map = new Map<string, EntregaRow[]>();
    const sorted = [...filtered].sort(
      (a, b) =>
        (parseSheetDate(entregaFecha(a))?.getTime() ?? 0) -
        (parseSheetDate(entregaFecha(b))?.getTime() ?? 0)
    );
    for (const e of sorted) {
      const k = entregaResponsable(e) || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Entregas</h1>
        {canCreate && (
          <Link href="/entregas/nueva" className={cn(buttonVariants({ size: "lg" }), "min-h-11 shrink-0")}>
            + Nueva entrega
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 max-w-md">
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v ?? "all")}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="TRUE">Aceptada</SelectItem>
              <SelectItem value="FALSE">Pendiente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sector</Label>
          <Select value={filtroSector} onValueChange={(v) => setFiltroSector(v ?? "all")}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="bogota">Bogotá</SelectItem>
              <SelectItem value="costa">Costa Caribe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {Array.from(grouped.entries()).map(([resp, list]) => (
        <div key={resp} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {resp}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((e) => (
              <Card key={entregaRowId(e)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatDateDDMMYYYY(entregaFecha(e))}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-semibold tabular-nums">
                    {formatCOP(parseCOPString(entregaMonto(e) || "0"))}
                  </p>
                  <p className="text-muted-foreground text-xs">ID: {entregaRowId(e)}</p>
                  <p className="text-xs">Estado: {entregaEstado(e) || "—"}</p>
                  {e.Comprobante && (
                    <a
                      href={String(e.Comprobante)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm underline"
                    >
                      Ver comprobante
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay entregas para mostrar.</p>
      )}
    </div>
  );
}
