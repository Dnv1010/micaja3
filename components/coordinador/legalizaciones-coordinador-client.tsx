"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";

type LegRow = Record<string, unknown>;

function estadoBadge(estado: string) {
  const e = estado.toLowerCase();
  if (e.includes("aprobado") && !e.includes("pendiente")) {
    return <Badge className="border-emerald-700 bg-emerald-950 text-emerald-200">{estado}</Badge>;
  }
  if (e.includes("rechaz")) {
    return <Badge className="border-red-700 bg-red-950 text-red-200">{estado}</Badge>;
  }
  return <Badge className="border-yellow-700 bg-yellow-950 text-yellow-200">{estado}</Badge>;
}

export function LegalizacionesCoordinadorClient() {
  const { data } = useSession();
  const coordinador = String(data?.user?.responsable || data?.user?.name || "");
  const searchParams = useSearchParams();
  const enviado = searchParams.get("enviado") === "1";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LegRow[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch(`/api/legalizaciones?coordinador=${encodeURIComponent(coordinador)}`);
        const json = await res.json().catch(() => ({ data: [] }));
        if (!mounted) return;
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch {
        if (!mounted) return;
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (coordinador) load();
    else setLoading(false);
    return () => {
      mounted = false;
    };
  }, [coordinador]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      String(getCellCaseInsensitive(b, "Fecha")).localeCompare(String(getCellCaseInsensitive(a, "Fecha")))
    );
  }, [rows]);

  function descargarPdf(row: LegRow) {
    const url = getCellCaseInsensitive(row, "PdfURL");
    const b64 = getCellCaseInsensitive(row, "PdfBase64");
    if (url) {
      window.open(url, "_blank");
      return;
    }
    if (b64) {
      const a = document.createElement("a");
      a.href = b64.startsWith("data:") ? b64 : `data:application/pdf;base64,${b64}`;
      a.download = `legalizacion-${getCellCaseInsensitive(row, "ID")}.pdf`;
      a.click();
    }
  }

  return (
    <div className="space-y-4">
      {enviado ? (
        <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          ✅ Reporte enviado correctamente
        </p>
      ) : null}
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Legalizaciones enviadas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="h-6 animate-pulse rounded bg-zinc-800" />
                  </TableCell>
                </TableRow>
              ) : sorted.length ? (
                sorted.map((r, i) => {
                  const estado = getCellCaseInsensitive(r, "Estado") || "Pendiente revisión";
                  const aprobado = estado.toLowerCase().includes("aprobado") && !estado.toLowerCase().includes("pendiente");
                  return (
                    <TableRow key={i}>
                      <TableCell>{formatDateDDMMYYYY(getCellCaseInsensitive(r, "Fecha"))}</TableCell>
                      <TableCell>{getCellCaseInsensitive(r, "Periodo")}</TableCell>
                      <TableCell>{formatCOP(parseCOPString(getCellCaseInsensitive(r, "TotalAprobado")))}</TableCell>
                      <TableCell>{estadoBadge(estado)}</TableCell>
                      <TableCell>
                        {aprobado ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => descargarPdf(r)}>
                            ⬇ Descargar PDF firmado
                          </Button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-zinc-500">
                    No hay reportes registrados
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
