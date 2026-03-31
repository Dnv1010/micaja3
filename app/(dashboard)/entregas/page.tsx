"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type EntregaItem = Record<string, unknown>;

export default function EntregasPage() {
  const { data } = useSession();
  const responsable = String(data?.user?.responsable || "");
  const [loading, setLoading] = useState(true);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadEntregas() {
      try {
        const query = new URLSearchParams({ responsable, desde, hasta }).toString();
        const res = await fetch(`/api/entregas?${query}`);
        const json = await res.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setEntregas(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!mounted) return;
        setEntregas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (responsable) loadEntregas();
    else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [responsable, desde, hasta]);

  const totalRecibido = useMemo(
    () =>
      entregas.reduce((acc, e) => acc + parseCOPString(getCellCaseInsensitive(e, "Monto", "Monto_Entregado")), 0),
    [entregas]
  );

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader className="space-y-3">
        <CardTitle>Entregas recibidas</CardTitle>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Enviado por</TableHead>
                <TableHead>Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={4}><div className="h-5 w-full animate-pulse rounded bg-zinc-800" /></TableCell>
                  </TableRow>
                ))
              ) : entregas.length ? (
                entregas.map((e, i) => (
                  <TableRow key={`e-${i}`}>
                    <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(e, "Fecha", "Fecha_Entrega"))}</TableCell>
                    <TableCell>{formatCOP(parseCOPString(getCellCaseInsensitive(e, "Monto", "Monto_Entregado")))}</TableCell>
                    <TableCell>{getCellCaseInsensitive(e, "EnviadoPor", "usuario", "Responsable") || "-"}</TableCell>
                    <TableCell>{getCellCaseInsensitive(e, "Observaciones") || "-"}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-zinc-500">No hay entregas para el rango seleccionado</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-4 text-right text-sm font-semibold">Total recibido: {formatCOP(totalRecibido)}</p>
      </CardContent>
    </Card>
  );
}
