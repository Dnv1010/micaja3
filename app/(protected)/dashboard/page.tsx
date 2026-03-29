"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCOP, formatDateDisplay } from "@/lib/format";
import { Wallet, FileWarning, Truck, PlusCircle } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<{
    saldo: number;
    facturasPendientes: number;
    ultimasEntregas: Array<{
      ID_Entrega: string;
      Fecha_Entrega: string;
      Monto_Entregado: string;
      Responsable: string;
      montoNum: number;
    }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ saldo: 0, facturasPendientes: 0, ultimasEntregas: [] }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
        <p className="text-muted-foreground text-sm">Resumen de tu caja menor</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tu saldo</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {data ? formatCOP(data.saldo) : "…"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Entregas − legalizaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Facturas pendientes</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.facturasPendientes ?? "…"}</p>
            <p className="text-xs text-muted-foreground mt-1">Por legalizar</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" /> Últimas entregas
          </CardTitle>
          <Link
            href="/facturas/nueva"
            className={cn(buttonVariants({ size: "sm" }), "inline-flex items-center")}
          >
            <PlusCircle className="h-4 w-4 mr-1" /> Nueva factura
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.ultimasEntregas || []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin entregas recientes</p>
          )}
          {(data?.ultimasEntregas || []).map((e) => (
            <div
              key={e.ID_Entrega}
              className="flex justify-between gap-2 text-sm border-b border-border/60 pb-2 last:border-0"
            >
              <div>
                <p className="font-medium">{e.Responsable}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDateDisplay(e.Fecha_Entrega)}
                </p>
              </div>
              <p className="font-semibold tabular-nums shrink-0">{formatCOP(e.montoNum)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Link
        href="/facturas/nueva"
        className={cn(
          buttonVariants({ size: "lg" }),
          "w-full min-h-12 sm:hidden inline-flex justify-center items-center"
        )}
      >
        Registrar factura
      </Link>
    </div>
  );
}
