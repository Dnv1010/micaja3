"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metricasCajaMenorUsuario } from "@/lib/caja-menor-dashboard";
import { formatCOP, formatDateDDMMYYYY, parseMonto } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import type { Session } from "next-auth";

type FacturaItem = Record<string, unknown>;
type EntregaItem = Record<string, unknown>;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MC";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function UserHomeClient({ user }: { user: Session["user"] }) {
  const responsable = String(user.responsable || "");
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<FacturaItem[]>([]);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fRes, eRes] = await Promise.all([
          fetch(`/api/facturas?responsable=${encodeURIComponent(responsable)}`),
          fetch(`/api/entregas?responsable=${encodeURIComponent(responsable)}`),
        ]);
        const fJson = await fRes.json().catch(() => ({ data: [] }));
        const eJson = await eRes.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
        setEntregas(Array.isArray(eJson.data) ? eJson.data : []);
      } catch {
        if (!mounted) return;
        setFacturas([]);
        setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [responsable]);

  const sector = String(user.sector || "");
  const caja = useMemo(
    () => metricasCajaMenorUsuario(facturas, entregas, responsable, sector),
    [facturas, entregas, responsable, sector]
  );

  const ultimasEntregas = useMemo(() => [...entregas].slice(-3).reverse(), [entregas]);
  const ultimasFacturas = useMemo(() => [...facturas].slice(-3).reverse(), [facturas]);
  const pctBar = Math.min(caja.pctEjecutado, 100);
  const barColor =
    caja.pctEjecutado >= 90 ? "#ef4444" : caja.pctEjecutado >= 70 ? "#f59e0b" : "#08DDBC";

  return (
    <div className="space-y-4">
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardContent className="pt-6 flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-bia-gray/40">
            <AvatarFallback className="bg-bia-blue text-white">{initials(String(user.name || "MiCaja"))}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-bia-gray-light">{user.cargo || "Sin cargo"}</p>
            <p className="text-xs text-bia-gray">{user.area || "Sin area"} · {user.sector || "Sin sector"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-[#525A72]/20 bg-[#0A1B4D] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">Mi Caja Menor</h3>
          <span className="text-xs text-[#8892A4]">Límite: {formatCOP(caja.limiteZona)}</span>
        </div>
        <p className="mb-4 text-sm text-[#8892A4]">
          En caja: {formatCOP(caja.totalAprobado)} legalizado de {formatCOP(caja.limiteZona)} —{" "}
          <span className="font-medium text-white">{caja.pctEjecutado}%</span> ejecutado
        </p>

        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-[#8892A4]">Ejecutado</span>
            <span className="font-medium text-white">{caja.pctEjecutado}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#001035]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pctBar}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#001035] p-3">
            <p className="mb-1 text-xs text-[#8892A4]">💰 Recibido</p>
            <p className="text-lg font-bold text-white">{formatCOP(caja.totalRecibido)}</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-3">
            <p className="mb-1 text-xs text-[#8892A4]">✅ Aprobado</p>
            <p className="text-lg font-bold text-[#08DDBC]">{formatCOP(caja.totalAprobado)}</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-3">
            <p className="mb-1 text-xs text-[#8892A4]">⏳ Por legalizar</p>
            <p className="text-lg font-bold text-yellow-400">{formatCOP(caja.totalPendiente)}</p>
            <p className="text-xs text-[#525A72]">{caja.countPendiente} facturas</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-3">
            <p className="mb-1 text-xs text-[#8892A4]">🏦 Disponible</p>
            <p
              className={`text-lg font-bold ${caja.disponible >= 0 ? "text-white" : "text-red-400"}`}
            >
              {formatCOP(Math.abs(caja.disponible))}
            </p>
            <p className="text-xs text-[#525A72]">
              {caja.disponible >= 0 ? "para gastar" : "excedido"}
            </p>
          </div>
        </div>

        {caja.pctEjecutado >= 90 ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-400">
              ⚠ Estás al {caja.pctEjecutado}% de tu límite de caja menor
            </p>
          </div>
        ) : null}
        {caja.pctEjecutado < 90 && caja.pctEjecutado >= 70 ? (
          <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
            <p className="text-xs text-yellow-400">📊 Has usado el {caja.pctEjecutado}% de tu límite</p>
          </div>
        ) : null}
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader><CardTitle className="text-base">Ultimas entregas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-bia-gray-light">Cargando...</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Monto</TableHead><TableHead>Enviado por</TableHead></TableRow></TableHeader>
              <TableBody>
                {ultimasEntregas.length ? ultimasEntregas.map((e, i) => (
                  <TableRow key={`ent-${i}`}>
                    <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha", "Fecha_Entrega"))}</TableCell>
                    <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")))}</TableCell>
                    <TableCell>
                      {getCellCaseInsensitive(e, "ComprobanteEnvio", "Comprobante") || "—"}
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={3} className="text-bia-gray">Sin entregas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader><CardTitle className="text-base">Ultimas facturas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-bia-gray-light">Cargando...</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Valor</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {ultimasFacturas.length ? ultimasFacturas.map((f, i) => {
                  const estado =
                    getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente";
                  return (
                    <TableRow key={`fac-${i}`}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "-"}</TableCell>
                      <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor")))}</TableCell>
                      <TableCell><Badge variant="outline">{estado}</Badge></TableCell>
                    </TableRow>
                  );
                }) : <TableRow><TableCell colSpan={4} className="text-bia-gray">Sin facturas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
