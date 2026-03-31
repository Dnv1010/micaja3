"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { balanceStatusTone } from "@/lib/balance-status";
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

  const resumen = useMemo(() => {
    const recibido = entregas.reduce(
      (acc, e) => acc + parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")),
      0
    );
    const gastado = facturas
      .filter((f) => {
        const v = String(getCellCaseInsensitive(f, "Verificado", "Estado", "Legalizado") || "").toLowerCase();
        return v === "aprobada";
      })
      .reduce((acc, f) => acc + parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor")), 0);
    const balance = recibido - gastado;
    return { recibido, gastado, balance };
  }, [entregas, facturas]);

  const ultimasEntregas = useMemo(() => [...entregas].slice(-3).reverse(), [entregas]);
  const ultimasFacturas = useMemo(() => [...facturas].slice(-3).reverse(), [facturas]);
  const tone = balanceStatusTone(resumen.balance);

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardContent className="pt-6 flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-zinc-700">
            <AvatarFallback className="bg-zinc-900 text-zinc-100">{initials(String(user.name || "MiCaja"))}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-zinc-400">{user.cargo || "Sin cargo"}</p>
            <p className="text-xs text-zinc-500">{user.area || "Sin area"} · {user.sector || "Sin sector"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader><CardTitle className="text-sm">💰 Recibido</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCOP(resumen.recibido)}</p><p className="text-xs text-zinc-400">Total enviado</p></CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader><CardTitle className="text-sm">🧾 Gastado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCOP(resumen.gastado)}</p><p className="text-xs text-zinc-400">Fact. aprobadas</p></CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader><CardTitle className="text-sm">📊 Balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCOP(resumen.balance)}</p><p className={`text-xs ${tone.cls}`}>{tone.label}</p></CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader><CardTitle className="text-base">Ultimas entregas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-zinc-400">Cargando...</p> : (
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
                )) : <TableRow><TableCell colSpan={3} className="text-zinc-500">Sin entregas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader><CardTitle className="text-base">Ultimas facturas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-zinc-400">Cargando...</p> : (
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
                }) : <TableRow><TableCell colSpan={4} className="text-zinc-500">Sin facturas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
