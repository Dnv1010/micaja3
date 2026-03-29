"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCOP, formatDateDisplay, parseCOPString } from "@/lib/format";
import type { EnvioRow } from "@/types/models";
import { cn } from "@/lib/utils";

export default function EnviosPage() {
  const [rows, setRows] = useState<EnvioRow[]>([]);

  useEffect(() => {
    fetch("/api/envios")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }, []);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex justify-between items-center gap-2">
        <h1 className="text-2xl font-bold">Envíos</h1>
        <Link href="/envios/nuevo" className={cn(buttonVariants({ size: "lg" }), "min-h-11")}>
          Nuevo envío
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((e) => (
          <Card key={e.IDEnvio}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{e.Responsable}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-semibold tabular-nums">{formatCOP(parseCOPString(e.Monto || "0"))}</p>
              <p className="text-muted-foreground">{formatDateDisplay(e.Fecha)}</p>
              <p className="text-xs">ID: {e.IDEnvio}</p>
              {e.Comprobante && (
                <a href={e.Comprobante} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
                  Comprobante
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No hay envíos en su vista.</p>
      )}
    </div>
  );
}
