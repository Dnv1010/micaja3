"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { estadoFacturaCajaRow, metricasCajaMenorUsuario } from "@/lib/caja-menor-dashboard";
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

  const metricasPorUsuario = useMemo(() => {
    const map = new Map<string, ReturnType<typeof metricasCajaMenorUsuario>>();
    for (const u of zoneUsers) {
      map.set(u.responsable, metricasCajaMenorUsuario(facturas, entregas, u.responsable, sector));
    }
    return map;
  }, [zoneUsers, facturas, entregas, sector]);

  const stats = useMemo(() => {
    const activos = zoneUsers.length;
    const pendientes = facturas.filter((f) => estadoFacturaCajaRow(f) === "pendiente").length;
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
        <h1 className="text-2xl font-bold text-white">Mi Zona — {zonaLabel}</h1>
        <p className="text-sm text-bia-gray-light">
          {coordinatorName} · {coordinatorCargo}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader>
            <CardTitle className="text-sm">👥 Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : stats.activos}</p>
            <p className="text-xs text-bia-gray-light">activos</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader>
            <CardTitle className="text-sm">🧾 Fact. Pend.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : stats.pendientes}</p>
            <p className="text-xs text-bia-gray-light">pendientes</p>
          </CardContent>
        </Card>
        <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
          <CardHeader>
            <CardTitle className="text-sm">💸 Total enviado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loading ? "—" : formatCOP(stats.totalEnviado)}</p>
            <p className="text-xs text-bia-gray-light">en envíos</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Caja menor por técnico</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: Math.min(zoneUsers.length || 3, 6) }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-[#525A72]/20 bg-[#0A1B4D]"
                />
              ))
            : zoneUsers.map((u) => {
                const met = metricasPorUsuario.get(u.responsable)!;
                const pct = met.pctEjecutado;
                const pctBar = Math.min(pct, 100);
                const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#08DDBC";
                const disponible = met.disponible;
                return (
                  <div
                    key={u.responsable}
                    className="rounded-xl border border-[#525A72]/20 bg-[#0A1B4D] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#08DDBC]/20 text-sm font-bold text-[#08DDBC]">
                          {u.responsable.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{u.responsable}</p>
                          <p className="text-xs text-[#525A72]">{u.cargo}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          pct >= 90
                            ? "bg-red-500/10 text-red-400"
                            : pct >= 70
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-[#08DDBC]/10 text-[#08DDBC]"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#001035]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pctBar}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold text-[#08DDBC]">{formatCOP(met.totalAprobado)}</p>
                        <p className="text-xs text-[#525A72]">Aprobado</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-yellow-400">{formatCOP(met.totalPendiente)}</p>
                        <p className="text-xs text-[#525A72]">Pendiente</p>
                      </div>
                      <div>
                        <p
                          className={`text-sm font-bold ${disponible >= 0 ? "text-white" : "text-red-400"}`}
                        >
                          {formatCOP(Math.abs(disponible))}
                        </p>
                        <p className="text-xs text-[#525A72]">
                          {disponible >= 0 ? "Disponible" : "Excedido"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
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
                <TableHead>Aprobado</TableHead>
                <TableHead>Por legalizar</TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-5 animate-pulse rounded bg-bia-blue-mid" />
                    </TableCell>
                  </TableRow>
                ))
              ) : zoneUsers.length ? (
                zoneUsers.map((u) => {
                  const met = metricasPorUsuario.get(u.responsable)!;
                  return (
                    <TableRow key={u.responsable}>
                      <TableCell className="font-medium">{u.responsable}</TableCell>
                      <TableCell className="text-bia-gray-light">{u.cargo}</TableCell>
                      <TableCell>{formatCOP(met.totalRecibido)}</TableCell>
                      <TableCell className="text-bia-aqua">{formatCOP(met.totalAprobado)}</TableCell>
                      <TableCell className="text-amber-200">{formatCOP(met.totalPendiente)}</TableCell>
                      <TableCell>
                        <span
                          className={`tabular-nums ${met.disponible >= 0 ? "text-white" : "text-red-400"}`}
                        >
                          {formatCOP(Math.abs(met.disponible))}
                        </span>
                        <p className="text-xs text-bia-gray">
                          {met.disponible >= 0 ? "para gastar" : "excedido"}
                        </p>
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
                  <TableCell colSpan={7} className="text-bia-gray">
                    No hay usuarios en esta zona
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detalleUser} onOpenChange={(o) => !o && setDetalleUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-bia-gray/20 bg-bia-blue-mid text-white">
          <DialogHeader>
            <DialogTitle>{detalleUser}</DialogTitle>
          </DialogHeader>
          {detalleUser ? (
            <>
              <p className="mb-2 text-sm text-bia-gray-light">Últimas facturas</p>
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
              <p className="mb-2 mt-4 text-sm text-bia-gray-light">Últimas entregas</p>
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
