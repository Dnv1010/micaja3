"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        const enc = encodeURIComponent(responsable);
        const [fRes, eRes] = await Promise.all([
          fetch(`/api/facturas?responsable=${enc}`),
          fetch(`/api/entregas?responsable=${enc}`),
        ]);
        const fJson = await fRes.json().catch(() => ({ data: [] }));
        const eJson = await eRes.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setFacturas(Array.isArray(fJson.data) ? fJson.data : []);
        setEntregas(Array.isArray(eJson.data) ? eJson.data : []);
      } catch {
        if (!mounted) return;
        setFacturas([]); setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => { mounted = false; };
  }, [responsable]);

  // Recibido = Total entregas al técnico
  const totalRecibido = useMemo(
    () => entregas.reduce((s, e) => s + parseMonto(String(getCellCaseInsensitive(e, "Monto_Entregado", "Monto") || "0")), 0),
    [entregas]
  );

  // Facturado = Total facturas del técnico
  const totalFacturado = useMemo(
    () => facturas.reduce((s, f) => s + parseMonto(String(getCellCaseInsensitive(f, "Monto_Factura", "Valor") || "0")), 0),
    [facturas]
  );

  // Total = Recibido - Facturado
  // positivo = tiene disponible
  // negativo = excedido (gastó de más)
  const saldo = totalRecibido - totalFacturado;

  const ultimasEntregas = useMemo(() => [...entregas].slice(-3).reverse(), [entregas]);
  const ultimasFacturas = useMemo(() => [...facturas].slice(-3).reverse(), [facturas]);

  return (
    <div className="space-y-4">

      {/* ── PERFIL ── */}
      <Card className="border-white/5 bg-[#0A1B4D] text-white">
        <CardContent className="pt-6 flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-white/20">
            <AvatarFallback className="bg-[#001035] text-white">{initials(String(user.name || "MiCaja"))}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-[#8892A4]">{user.cargo || "Sin cargo"}</p>
            <p className="text-xs text-[#525A72]">{user.area || "Sin area"} · {user.sector || "Sin sector"}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 3 MÉTRICAS ── */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[0,1,2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[#001035]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#001035] p-4 border border-white/5">
            <p className="text-xs text-[#8892A4] mb-1">💸 Recibido</p>
            <p className="text-lg font-bold text-white">{formatCOP(totalRecibido)}</p>
            <p className="text-xs text-[#525A72] mt-1">Total entregado</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4 border border-white/5">
            <p className="text-xs text-[#8892A4] mb-1">🧾 Facturado</p>
            <p className="text-lg font-bold text-[#08DDBC]">{formatCOP(totalFacturado)}</p>
            <p className="text-xs text-[#525A72] mt-1">Total facturas</p>
          </div>
          <div className="rounded-xl bg-[#001035] p-4 border border-white/5">
            <p className="text-xs text-[#8892A4] mb-1">
              {saldo >= 0 ? "✅ Total" : "🔴 Excedido"}
            </p>
            <p className={`text-lg font-bold ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCOP(Math.abs(saldo))}
            </p>
            <p className="text-xs text-[#525A72] mt-1">
              {saldo >= 0 ? "disponible" : "gastaste de más"}
            </p>
          </div>
        </div>
      )}

      {/* ── ALERTA ── */}
      {!loading && saldo > 0 && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-400">
            ⚠️ Tienes <span className="font-bold">{formatCOP(saldo)}</span> pendiente por legalizar
          </p>
        </div>
      )}
      {!loading && saldo < 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">
            🔴 Facturaste <span className="font-bold">{formatCOP(Math.abs(saldo))}</span> más de lo recibido
          </p>
        </div>
      )}
      {!loading && saldo === 0 && totalRecibido > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm text-emerald-400">✅ Todo legalizado — estás al día</p>
        </div>
      )}

      {/* ── ÚLTIMAS ENTREGAS ── */}
      <Card className="border-white/5 bg-[#0A1B4D] text-white">
        <CardHeader><CardTitle className="text-base">Últimas entregas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-[#8892A4]">Cargando...</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-[#8892A4]">Fecha</TableHead>
                  <TableHead className="text-[#8892A4]">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasEntregas.length ? ultimasEntregas.map((e, i) => (
                  <TableRow key={`ent-${i}`} className="border-white/5">
                    <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha", "Fecha_Entrega"))}</TableCell>
                    <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(e, "Monto_Entregado", "Monto")))}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={2} className="text-[#8892A4]">Sin entregas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── ÚLTIMAS FACTURAS ── */}
      <Card className="border-white/5 bg-[#0A1B4D] text-white">
        <CardHeader><CardTitle className="text-base">Últimas facturas</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-[#8892A4]">Cargando...</p> : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-[#8892A4]">Fecha</TableHead>
                  <TableHead className="text-[#8892A4]">Proveedor</TableHead>
                  <TableHead className="text-[#8892A4]">Valor</TableHead>
                  <TableHead className="text-[#8892A4]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasFacturas.length ? ultimasFacturas.map((f, i) => {
                  const estado = String(getCellCaseInsensitive(f, "Estado", "Legalizado", "Verificado") || "Pendiente");
                  return (
                    <TableRow key={`fac-${i}`} className="border-white/5">
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(f, "Fecha", "Fecha_Factura"))}</TableCell>
                      <TableCell>{String(getCellCaseInsensitive(f, "Proveedor", "Razon_Social") || "—")}</TableCell>
                      <TableCell>{formatCOP(parseMonto(getCellCaseInsensitive(f, "Monto_Factura", "Valor")))}</TableCell>
                      <TableCell><Badge variant="outline">{estado}</Badge></TableCell>
                    </TableRow>
                  );
                }) : <TableRow><TableCell colSpan={4} className="text-[#8892A4]">Sin facturas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}