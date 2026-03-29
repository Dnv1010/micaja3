"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/format";
import { Star } from "lucide-react";

type Row = {
  sede: string;
  _rowIndex?: number;
  ValorTotalEntregado: number;
  ValorTotalFacturas: number;
  TotalRegistrado: number;
  Retiro: number;
  "4x1000": number;
  Iva: number;
  FotoRetiro: string;
};

export default function BalancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [retiros, setRetiros] = useState<Record<string, string>>({});

  function load() {
    fetch("/api/balance")
      .then((r) => r.json())
      .then((j) => {
        const d = j.data || [];
        setRows(d);
        const r: Record<string, string> = {};
        d.forEach((x: Row) => {
          r[x.sede] = String(x.Retiro ?? "");
        });
        setRetiros(r);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function guardar(sede: string) {
    const row = rows.find((x) => x.sede === sede);
    if (!row?._rowIndex) {
      alert("No hay fila en la hoja Balance para esta sede. Cree la fila en Google Sheets.");
      return;
    }
    await fetch("/api/balance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: row._rowIndex, Retiro: retiros[sede] || "0" }),
    });
    load();
  }

  return (
    <div className="space-y-6 pb-8 overflow-x-auto">
      <h1 className="text-2xl font-bold">Balance por sede</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sede</TableHead>
            <TableHead>Entregado</TableHead>
            <TableHead>Facturas</TableHead>
            <TableHead>Total registrado</TableHead>
            <TableHead>Retiro</TableHead>
            <TableHead>4×1000</TableHead>
            <TableHead>IVA</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const tr = r.TotalRegistrado;
            const highlight =
              tr > 0 ? "bg-red-500/10" : tr < 0 ? "bg-green-500/10" : "";
            return (
              <TableRow key={r.sede} className={highlight}>
                <TableCell className="font-medium">{r.sede}</TableCell>
                <TableCell className="tabular-nums">{formatCOP(r.ValorTotalEntregado)}</TableCell>
                <TableCell className="tabular-nums">{formatCOP(r.ValorTotalFacturas)}</TableCell>
                <TableCell className="tabular-nums font-semibold">
                  {formatCOP(r.TotalRegistrado)} {tr !== 0 && <Star className="inline h-3 w-3" />}
                </TableCell>
                <TableCell>
                  <Input
                    className="min-h-9 w-28"
                    value={retiros[r.sede] ?? ""}
                    onChange={(e) => setRetiros((s) => ({ ...s, [r.sede]: e.target.value }))}
                  />
                </TableCell>
                <TableCell className="tabular-nums">{formatCOP(r["4x1000"])}</TableCell>
                <TableCell className="tabular-nums">{formatCOP(r.Iva)}</TableCell>
                <TableCell>
                  <Button size="sm" type="button" onClick={() => guardar(r.sede)}>
                    Guardar retiro
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
