"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { Wallet, FileWarning, Truck, PlusCircle, TrendingUp, PiggyBank } from "lucide-react";

type DashboardPayload = {
  saldo: number;
  saldoCajaActual: number;
  facturasPendientes: number;
  facturasMes: { count: number; total: number };
  entregasActivas: number;
  gastosPorMes: { mes: string; label: string; total: number }[];
  ultimasFacturas: Array<{
    id: string;
    fecha: string;
    proveedor: string;
    nit: string;
    concepto: string;
    valor: string;
    tipo: string;
    estado: string;
    responsable: string;
  }>;
  ultimasEntregas: Array<{
    id: string;
    Fecha_Entrega: string;
    Responsable: string;
    Monto_Entregado: string;
    montoNum: number;
  }>;
};

export default function HomeDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) {
          setData({
            saldo: 0,
            saldoCajaActual: 0,
            facturasPendientes: 0,
            facturasMes: { count: 0, total: 0 },
            entregasActivas: 0,
            gastosPorMes: [],
            ultimasFacturas: [],
            ultimasEntregas: [],
          });
          return;
        }
        setData(j);
      })
      .catch(() =>
        setData({
          saldo: 0,
          saldoCajaActual: 0,
          facturasPendientes: 0,
          facturasMes: { count: 0, total: 0 },
          entregasActivas: 0,
          gastosPorMes: [],
          ultimasFacturas: [],
          ultimasEntregas: [],
        })
      );
  }, []);

  const maxGasto = Math.max(1, ...(data?.gastosPorMes.map((g) => g.total) ?? [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Hola, {session?.user?.responsable || session?.user?.name || "usuario"} — resumen de caja menor
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo caja (Balance)</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {data ? formatCOP(data.saldoCajaActual) : "…"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Último registro en hoja Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tu saldo asignado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{data ? formatCOP(data.saldo) : "…"}</p>
            <p className="text-xs text-muted-foreground mt-1">Entregas − legalizaciones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Facturas del mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{data?.facturasMes.count ?? "…"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total {data ? formatCOP(data.facturasMes.total) : "…"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes / Entregas</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {data ? `${data.facturasPendientes} pend.` : "…"}{" "}
              <span className="text-muted-foreground font-normal text-sm">
                · {data?.entregasActivas ?? "…"} entregas activas
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {data && data.gastosPorMes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por mes (facturas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {data.gastosPorMes.map((g) => (
                <div key={g.mes} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full max-w-[48px] mx-auto rounded-t bg-primary/80 min-h-[4px] transition-all"
                    style={{ height: `${Math.max(8, (g.total / maxGasto) * 120)}px` }}
                    title={formatCOP(g.total)}
                  />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {g.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas facturas</CardTitle>
          <Link href="/facturas/nueva" className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
            <PlusCircle className="h-4 w-4" /> Nueva
          </Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(data?.ultimasFacturas || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin facturas recientes</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Proveedor</th>
                  <th className="py-2 pr-2">NIT</th>
                  <th className="py-2 pr-2">Concepto</th>
                  <th className="py-2 pr-2 text-right">Valor</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(data?.ultimasFacturas || []).map((f) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatDateDDMMYYYY(f.fecha)}</td>
                    <td className="py-2 pr-2 max-w-[140px] truncate">{f.proveedor || "—"}</td>
                    <td className="py-2 pr-2">{f.nit || "—"}</td>
                    <td className="py-2 pr-2 max-w-[160px] truncate">{f.concepto || "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums font-medium">
                      {formatCOP(parseCOPString(f.valor || "0"))}
                    </td>
                    <td className="py-2 pr-2 text-xs">{f.tipo || "—"}</td>
                    <td className="py-2 text-xs">{f.estado || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" /> Últimas entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.ultimasEntregas || []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sin entregas recientes</p>
          )}
          {(data?.ultimasEntregas || []).map((e) => (
            <div
              key={e.id}
              className="flex justify-between gap-2 text-sm border-b border-border/60 pb-2 last:border-0"
            >
              <div>
                <p className="font-medium">{e.Responsable}</p>
                <p className="text-muted-foreground text-xs">{formatDateDDMMYYYY(e.Fecha_Entrega)}</p>
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
