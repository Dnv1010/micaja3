"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceStatusTone } from "@/lib/balance-status";
import { formatCOP, formatDateDDMMYYYY, parseCOPString, parseMonto } from "@/lib/format";
import { normalizeSector } from "@/lib/sector-normalize";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

export type ZonaUsuarioRow = { responsable: string; cargo: string };

type Row = Record<string, unknown>;

export function CoordinatorZonaClient({
  sector,
  zonaLabel,
  coordinatorName,
  coordinatorCargo,
  zoneUsers,
}: {
  sector: string;
  zonaLabel: string;
  coordinatorName: string;
  coordinatorCargo: string;
  zoneUsers: ZonaUsuarioRow[];
}) {
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<Row[]>([]);
  const [entregas, setEntregas] = useState<Row[]>([]);
  const [envios, setEnvios] = useState<Row[]>([]);
  const [detalleUser, setDetalleUser] = useState<string | null>(null);

  const sectorQuery = useMemo(() => normalizeSector(sector) ?? sector, [sector]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const enc = encodeURIComponent(sectorQuery);
        const [fRes, eRes, vRes] = await Promise.all([
          fetch(`/api/facturas?zonaSector=${enc}`),
          fetch(`/api/entregas?zonaSector=${enc}`),
          fetch(`/api/envios?sector=${enc}`),
        ]);
        const [fJson, eJson, vJson] = await Promise.all([
          fRes.json().catch(() => ({ data: [] })),
          eRes.json().catch(() => ({ data: [] })),
          vRes.json().catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
        setEntregas(Array.isArray(eJson.data) ? eJson.data : []);
        setEnvios(Array.isArray(vJson.data) ? vJson.data : []);
      } catch {
        if (!mounted) return;
        setFacturas([]);
        setEntregas([]);
        setEnvios([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [sectorQuery]);

  const porUsuario = useMemo(() => {
    const recibido = new Map<string, number>();
    const gastado = new Map<string, number>();
    for (const e of entregas) {
      const r = getCellCaseInsensitive(e, "Responsable");
      const m = parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto"));
      recibido.set(r, (recibido.get(r) || 0) + m);
    }
    for (const f of facturas) {
      const r = getCellCaseInsensitive(f, "Responsable");
      const est = String(getCellCaseInsensitive(f, "Verificado", "Estado", "Legalizado") || "").toLowerCase();
      if (est !== "aprobada") continue;
      const m = parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor"));
      gastado.set(r, (gastado.get(r) || 0) + m);
    }
    return { recibido, gastado };
  }, [entregas, facturas]);

  const stats = useMemo(() => {
    const activos = zoneUsers.length;
    const pendientes = facturas.filter(
      (f) => getCellCaseInsensitive(f, "Estado").toLowerCase() === "pendiente"
    ).length;
    const totalEnviado = envios.reduce(
      (acc, v) => acc + parseCOPString(getCellCaseInsensitive(v, "Monto")),
      0
    );
    return { activos, pendientes, totalEnviado };
  }, [facturas, envios, zoneUsers.length]);

  const ultimasFacturasUser = (nombre: string) =>
    [...facturas]
      .filter((f) => getCellCaseInsensitive(f, "Responsable") === nombre)
      .slice(-10)
      .reverse()
      .slice(0, 3);

  const ultimasEntregasUser = (nombre: string) =>
    [...entregas]
      .filter((e) => getCellCaseInsensitive(e, "Responsable") === nombre)
      .slice(-10)
      .reverse()
      .slice(0, 3);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Mi Zona — {zonaLabel}</h1>
        <p className="text-sm text-zinc-400">
          {coordinatorName} · {coordinatorCargo}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm">👥 Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : stats.activos}</p>
            <p className="text-xs text-zinc-400">activos</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm">🧾 Fact. Pend.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : stats.pendientes}</p>
            <p className="text-xs text-zinc-400">pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <CardTitle className="text-sm">💸 Total enviado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : formatCOP(stats.totalEnviado)}</p>
            <p className="text-xs text-zinc-400">en envíos</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Usuarios de la zona</CardTitle>
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
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-5 animate-pulse rounded bg-zinc-800" />
                    </TableCell>
                  </TableRow>
                ))
              ) : zoneUsers.length ? (
                zoneUsers.map((u) => {
                  const rec = porUsuario.recibido.get(u.responsable) || 0;
                  const gas = porUsuario.gastado.get(u.responsable) || 0;
                  const bal = rec - gas;
                  const tone = balanceStatusTone(bal);
                  return (
                    <TableRow key={u.responsable}>
                      <TableCell className="font-medium">{u.responsable}</TableCell>
                      <TableCell className="text-zinc-400">{u.cargo}</TableCell>
                      <TableCell>{formatCOP(rec)}</TableCell>
                      <TableCell>{formatCOP(gas)}</TableCell>
                      <TableCell>
                        <span className={`tabular-nums ${tone.cls}`}>{formatCOP(bal)}</span>
                        <p className="text-xs text-zinc-500">{tone.label}</p>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" type="button" onClick={() => setDetalleUser(u.responsable)}>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-zinc-500">
                    No hay usuarios en esta zona
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalleUser} onOpenChange={(o) => !o && setDetalleUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>{detalleUser}</DialogTitle>
          </DialogHeader>
          {detalleUser ? (
            <>
              <p className="mb-2 text-sm text-zinc-400">Últimas facturas</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimasFacturasUser(detalleUser).map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                      <TableCell>
                        {formatCOP(parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor")))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mb-2 mt-4 text-sm text-zinc-400">Últimas entregas</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Enviado por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimasEntregasUser(detalleUser).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha_Entrega", "Fecha"))}</TableCell>
                      <TableCell>
                        {formatCOP(parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")))}
                      </TableCell>
                      <TableCell>{getCellCaseInsensitive(e, "ComprobanteEnvio", "Comprobante") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
