"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceStatusTone } from "@/lib/balance-status";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { formatCOP } from "@/lib/format";
import { FALLBACK_USERS, type FallbackUser } from "@/lib/users-fallback";

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

export function AdminUsuariosClient() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceApi[]>([]);
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

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

  const filtrados = useMemo(() => {
    return FALLBACK_USERS.filter((u) => {
      if (filtroZona && u.sector !== filtroZona) return false;
      if (filtroRol && u.rol !== filtroRol) return false;
      return true;
    });
  }, [filtroZona, filtroRol]);

  const resumen = useMemo(() => {
    let alDia = 0;
    let deuda = 0;
    for (const u of filtrados) {
      const b = balanceForUser(bMap, u);
      if (b.balance === 0) alDia += 1;
      else deuda += 1;
    }
    return { total: filtrados.length, alDia, deuda };
  }, [filtrados, bMap]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Usuarios</h1>
        <p className="text-sm text-zinc-400">Lista base · balances desde Entregas y Facturas</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">👥 Total (filtrado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : resumen.total}</p>
            <p className="text-xs text-zinc-500">usuarios</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">✅ Al día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{loading ? "—" : resumen.alDia}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">⚠️ No al día</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{loading ? "—" : resumen.deuda}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="min-w-[180px] space-y-1">
            <label className="text-xs text-zinc-400">Zona</label>
            <Select
              value={filtroZona || "__all__"}
              onValueChange={(v) => setFiltroZona(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las zonas</SelectItem>
                <SelectItem value="Bogota">Bogotá</SelectItem>
                <SelectItem value="Costa Caribe">Costa Caribe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] space-y-1">
            <label className="text-xs text-zinc-400">Rol</label>
            <Select
              value={filtroRol || "__all__"}
              onValueChange={(v) => setFiltroRol(!v || v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los roles</SelectItem>
                <SelectItem value="user">Técnicos</SelectItem>
                <SelectItem value="coordinador">Coordinadores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Zona</TableHead>
                <TableHead>Total recibido</TableHead>
                <TableHead>Total gastado</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : filtrados.length ? (
                filtrados.map((u) => {
                  const b = balanceForUser(bMap, u);
                  const tone = balanceStatusTone(b.balance);
                  return (
                    <TableRow key={u.email}>
                      <TableCell className="font-medium">{u.responsable}</TableCell>
                      <TableCell className="text-sm text-zinc-400">{u.cargo}</TableCell>
                      <TableCell>{etiquetaZona(u.sector)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalRecibido)}</TableCell>
                      <TableCell className="tabular-nums text-sm">{formatCOP(b.totalGastado)}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        <span className={tone.cls}>{formatCOP(b.balance)}</span>
                        <span className="ml-2 text-xs text-zinc-500">{tone.label}</span>
                      </TableCell>
                      <TableCell>
                        {u.userActive ? (
                          <Badge className="border-emerald-800 bg-emerald-950 text-emerald-200">Activo</Badge>
                        ) : (
                          <Badge className="border-zinc-600 bg-zinc-900 text-zinc-400">Inactivo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-zinc-500">
                    Sin usuarios con estos filtros
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
