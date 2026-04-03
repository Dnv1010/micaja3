"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceStatusTone } from "@/lib/balance-status";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { formatCOP } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

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

type ZonaUsuario = { responsable: string; cargo: string; email: string };

function balanceForUser(m: Map<string, BalanceApi>, u: ZonaUsuario): BalanceApi {
  return (
    m.get(u.responsable.trim().toLowerCase()) || {
      responsable: u.responsable,
      totalRecibido: 0,
      totalGastado: 0,
      balance: 0,
    }
  );
}

function rowToZonaUsuario(rec: Record<string, unknown>): ZonaUsuario | null {
  const responsable = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
  const email = String(getCellCaseInsensitive(rec, "Correos", "Correo", "Email") || "").trim();
  if (!responsable || !email) return null;
  return {
    responsable,
    email,
    cargo: String(getCellCaseInsensitive(rec, "Cargo") || "").trim(),
  };
}

export function UsuariosZonaClient({
  sectorLabel,
  sectorFilter,
}: {
  sectorLabel: string;
  /** null = admin: todas las zonas (incl. inactivos vía todos=true) */
  sectorFilter: string | null;
}) {
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [zoneUsers, setZoneUsers] = useState<ZonaUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceApi[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingUsers(true);
    const q =
      sectorFilter === null
        ? "todos=true"
        : `sector=${encodeURIComponent(sectorFilter)}`;
    fetch(`/api/usuarios?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: ZonaUsuario[] = [];
        for (const row of rows) {
          const u = rowToZonaUsuario(row as Record<string, unknown>);
          if (u) list.push(u);
        }
        list.sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
        setZoneUsers(list);
      })
      .catch(() => {
        if (!cancelled) setZoneUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectorFilter]);

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

  const sorted = zoneUsers;
  const tableLoading = loadingUsers || loading;

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
              {tableLoading ? (
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
                    b.balance > 0 ? "text-[#08DDBC]" : b.balance < 0 ? "text-red-400" : "text-bia-gray-light";
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
                    No hay usuarios en esta zona.
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
