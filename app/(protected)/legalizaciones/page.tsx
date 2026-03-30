"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCOP, formatDateDDMMYYYY, parseCOPString, parseSheetDate } from "@/lib/format";
import type { LegalizacionRow } from "@/types/models";
import { cn } from "@/lib/utils";
import {
  legalizacionAprobadoPor,
  legalizacionEstado,
  legalizacionFecha,
  legalizacionIdFactura,
  legalizacionResponsable,
  legalizacionRowId,
  legalizacionTotal,
} from "@/lib/row-fields";

export default function LegalizacionesPage() {
  const [rows, setRows] = useState<LegalizacionRow[]>([]);

  function load() {
    fetch("/api/legalizaciones")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, LegalizacionRow[]>();
    const sorted = [...rows].sort(
      (a, b) =>
        (parseSheetDate(legalizacionFecha(b))?.getTime() ?? 0) -
        (parseSheetDate(legalizacionFecha(a))?.getTime() ?? 0)
    );
    for (const l of sorted) {
      const k = legalizacionResponsable(l) || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return map;
  }, [rows]);

  async function eliminar(l: LegalizacionRow) {
    if (!confirm("¿Eliminar legalización y dejar factura en Pendiente?")) return;
    const q = new URLSearchParams({
      id: legalizacionRowId(l),
      idFactura: legalizacionIdFactura(l),
    });
    const res = await fetch(`/api/legalizaciones?${q}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Error");
      return;
    }
    load();
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-2xl font-bold">Legalizaciones</h1>
        <Link
          href="/legalizaciones/nueva"
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 shrink-0")}
        >
          Nueva
        </Link>
      </div>

      {Array.from(grouped.entries()).map(([resp, list]) => (
        <div key={resp} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">{resp}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((l) => (
              <Card key={`${legalizacionRowId(l)}-${legalizacionIdFactura(l)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatDateDDMMYYYY(legalizacionFecha(l))}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>Factura: {legalizacionIdFactura(l)}</p>
                  <p className="font-semibold tabular-nums">
                    {formatCOP(parseCOPString(legalizacionTotal(l) || "0"))}
                  </p>
                  <p className="text-xs">Estado: {legalizacionEstado(l) || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Aprobado por: {legalizacionAprobadoPor(l) || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saldo caja (sheet): {l.Total_Caja || "—"}
                  </p>
                  <Button variant="outline" size="sm" type="button" onClick={() => eliminar(l)}>
                    Eliminar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay legalizaciones.</p>
      )}
    </div>
  );
}
