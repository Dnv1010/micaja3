/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type GastoRow = Record<string, unknown>;

export function GastosGeneralesClient({ sector, responsable }: { sector: string; responsable: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<GastoRow[]>([]);

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

  const total = lista.reduce((acc, r) => acc + parseCOPString(getCellCaseInsensitive(r, "Valor")), 0);

  return (
    <div className="space-y-6">
      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Gastos Generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
            </div>
            <div className="space-y-1">
              <Label>Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Centro Costos</TableHead>
                  <TableHead>NIT</TableHead>
                  <TableHead>Fecha Factura</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8}><div className="h-6 animate-pulse rounded bg-bia-blue-mid" /></TableCell></TableRow>
                ) : lista.length ? (
                  lista.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(r, "FechaCreacion"))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Responsable")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Concepto")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "CentroCostos")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "NIT")}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "FechaFactura")}</TableCell>
                      <TableCell>{formatCOP(parseCOPString(getCellCaseInsensitive(r, "Valor")))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Estado") || "Pendiente"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={8} className="text-bia-gray">Sin gastos registrados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-right text-sm font-medium">Total: {formatCOP(total)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
