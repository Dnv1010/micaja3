"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceStatusTone } from "@/lib/balance-status";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { formatCOP } from "@/lib/format";
import type { FallbackUser } from "@/lib/users-fallback";

type BalanceApi = {
  responsable: string;
  totalRecibido: number;
  totalGastado: number;
  balance: number;
};

function balanceMapFromApi(rows: BalanceApi[]): Map<string, BalanceApi> {
  const m = new Map<string, BalanceApi>();
  for (const r of rows) {
    m.set(r.responsable.trim().toLowerCase(), r);
  }
  return m;
}

function balanceForUser(m: Map<string, BalanceApi>, u: FallbackUser): BalanceApi {
  return (
    m.get(u.responsable.trim().toLowerCase()) || {
      responsable: u.responsable,
      totalRecibido: 0,
      totalGastado: 0,
      balance: 0,
    }
  );
}

export function UsuariosZonaClient({
  sectorLabel,
  zoneUsers,
}: {
  sectorLabel: string;
  zoneUsers: FallbackUser[];
}) {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceApi[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balance");
      const json = await res.json().catch(() => ({ data: [] }));
      setBalances(Array.isArray(json.data) ? json.data : []);
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bMap = useMemo(() => balanceMapFromApi(balances), [balances]);

  const sorted = useMemo(() => {
    return [...zoneUsers].sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
  }, [zoneUsers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios de la zona</h1>
        <p className="text-sm text-bia-gray-light">
          {etiquetaZona(sectorLabel)} · balances desde Entregas y Facturas
        </p>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Balances</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Recibido</TableHead>
                <TableHead>Gastado</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="h-6 animate-pulse rounded bg-bia-blue-mid" />
                  </TableCell>
                </TableRow>
              ) : sorted.length ? (
                sorted.map((u) => {
                  const b = balanceForUser(bMap, u);
                  const tone = balanceStatusTone(b.balance);
                  const balCls =
                    b.balance > 0 ? "text-emerald-400" : b.balance < 0 ? "text-red-400" : "text-bia-gray-light";
                  return (
                    <TableRow key={u.email}>
                      <TableCell className="font-medium">{u.responsable}</TableCell>
                      <TableCell className="text-sm text-bia-gray-light">{u.cargo}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalRecibido)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalGastado)}</TableCell>
                      <TableCell className={`tabular-nums text-sm font-medium ${balCls}`}>
                        {formatCOP(b.balance)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className={tone.cls}>{tone.label}</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-bia-gray">
                    No hay usuarios en esta zona (lista base).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
