"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDateDisplay, parseCOPString } from "@/lib/format";
import type { EntregaRow } from "@/types/models";

export default function EntregasPage() {
  const [rows, setRows] = useState<EntregaRow[]>([]);

  useEffect(() => {
    fetch("/api/entregas")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, EntregaRow[]>();
    const sorted = [...rows].sort(
      (a, b) => new Date(a.Fecha_Entrega).getTime() - new Date(b.Fecha_Entrega).getTime()
    );
    for (const e of sorted) {
      const k = e.Responsable || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Entregas</h1>
      {Array.from(grouped.entries()).map(([resp, list]) => (
        <div key={resp} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {resp}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((e) => (
              <Card key={e.ID_Entrega}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatDateDisplay(e.Fecha_Entrega)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-semibold tabular-nums">
                    {formatCOP(parseCOPString(e.Monto_Entregado || "0"))}
                  </p>
                  <p className="text-muted-foreground text-xs">ID: {e.ID_Entrega}</p>
                  {e.Comprobante && (
                    <a
                      href={e.Comprobante}
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
      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay entregas para mostrar.</p>
      )}
    </div>
  );
}
