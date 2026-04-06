/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
type GastoRow = Record<string, unknown>;
interface Sesion { nombre: string; cargo: string; cc: string; ciudad: string; motivo: string; fechaInicio: string; fechaFin: string; facturas: any[]; }
function agrupar(lista: GastoRow[], responsable: string, rol: string): Sesion[] {
  const map = new Map<string, Sesion>();
  for (const r of lista) {
    const nombre = String(getCellCaseInsensitive(r, "Responsable") || "");
    if (rol === "coordinador" && nombre !== responsable) continue;
    const cargo = String(getCellCaseInsensitive(r, "Cargo") || "");
    const cc = String(getCellCaseInsensitive(r, "CC") || "");
    const ciudad = String(getCellCaseInsensitive(r, "Ciudad") || "");
    const motivo = String(getCellCaseInsensitive(r, "Motivo") || "");
    const fechaInicio = String(getCellCaseInsensitive(r, "FechaInicio") || "");
    const fechaFin = String(getCellCaseInsensitive(r, "FechaFin") || "");
    const key = nombre + "|" + motivo + "|" + fechaInicio + "|" + fechaFin;
    if (!map.has(key)) map.set(key, { nombre, cargo, cc, ciudad, motivo, fechaInicio, fechaFin, facturas: [] });
    map.get(key)!.facturas.push({ concepto: getCellCaseInsensitive(r, "Concepto"), centroCostos: getCellCaseInsensitive(r, "CentroCostos"), nit: getCellCaseInsensitive(r, "NIT"), fecha: getCellCaseInsensitive(r, "FechaFactura"), valor: String(getCellCaseInsensitive(r, "Valor") || "0") });
  }
  return Array.from(map.values());
}
export function GastosGeneralesClient({ responsable, rol, chatId }: { sector: string; responsable: string; rol: string; chatId: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<GastoRow[]>([]);
  const [generando, setGenerando] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  async function cargar() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (desde) q.set("desde", desde);
      if (hasta) q.set("hasta", hasta);
      const res = await fetch("/api/gastos?" + q);
      const json = await res.json().catch(() => ({ data: [] }));
      setLista(Array.isArray(json.data) ? json.data : []);
    } catch { setLista([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { void cargar(); }, [desde, hasta]);
  const sesiones = agrupar(lista, responsable, rol);
  const totalGlobal = sesiones.reduce((a, s) => a + s.facturas.reduce((b: number, f: any) => b + Number(String(f.valor).replace(/[^0-9]/g, "")), 0), 0);
  async function generarPDF(s: Sesion) {
    const key = s.nombre + s.motivo + s.fechaInicio;
    setGenerando(key); setMsg("");
    try {
      const res = await fetch("/api/gastos/enviar-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, chatId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "Legalizacion_Gastos_" + s.nombre.replace(/s+/g, "_") + ".pdf";
        a.click(); URL.revokeObjectURL(url);
        setMsg("PDF generado y enviado por Telegram a " + s.nombre);
      } else { setMsg("Error al generar PDF"); }
    } catch { setMsg("Error de conexion"); }
    finally { setGenerando(null); }
  }
  return (
    <div className="space-y-6">
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader><CardTitle>Gastos Generales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-bia-blue border-bia-gray/40" /></div>
            <div className="space-y-1"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-bia-blue border-bia-gray/40" /></div>
          </div>
          {msg && <p className="text-sm text-green-400">{msg}</p>}
          {loading ? <p className="text-bia-gray">Cargando...</p> : sesiones.length === 0 ? <p className="text-bia-gray">Sin gastos registrados</p> : sesiones.map((s, si) => {
            const key = s.nombre + s.motivo + s.fechaInicio;
            const total = s.facturas.reduce((a: number, f: any) => a + Number(String(f.valor).replace(/[^0-9]/g, "")), 0);
            return (
              <Card key={si} className="bg-bia-blue border-bia-gray/20">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold">{s.nombre} — {s.motivo}</p>
                      <p className="text-sm text-bia-gray">{s.ciudad} · {s.fechaInicio} al {s.fechaFin}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCOP(total)}</span>
                      <Button size="sm" onClick={() => generarPDF(s)} disabled={generando === key} className="bg-green-600 hover:bg-green-700 text-white">
                        {generando === key ? "Generando..." : "PDF + Telegram"}
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>NIT</TableHead><TableHead>Fecha</TableHead><TableHead>Valor</TableHead><TableHead>Centro</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {s.facturas.map((f: any, fi: number) => (
                        <TableRow key={fi}>
                          <TableCell>{f.concepto}</TableCell>
                          <TableCell>{f.nit || "-"}</TableCell>
                          <TableCell>{f.fecha}</TableCell>
                          <TableCell>{formatCOP(Number(String(f.valor).replace(/[^0-9]/g, "")))}</TableCell>
                          <TableCell>{f.centroCostos}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <p className="text-right font-semibold">Total general: {formatCOP(totalGlobal)}</p>
        </CardContent>
      </Card>
    </div>
  );
}