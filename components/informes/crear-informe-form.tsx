"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/shared/signature-pad";
import { HERNAN_EMAIL } from "@/lib/roles";
import { formatCOP } from "@/lib/format";
import type { FacturaRow, UsuarioRow } from "@/types/models";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CrearInformeForm() {
  const { data: session } = useSession();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [fechaIni, setFechaIni] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [responsable, setResponsable] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [firmaLeg, setFirmaLeg] = useState("");
  const [firmaApr, setFirmaApr] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const esHernan = session?.user?.email?.toLowerCase() === HERNAN_EMAIL;

  useEffect(() => {
    Promise.all([
      fetch("/api/usuarios").then((r) => r.json()),
      fetch("/api/facturas").then((r) => r.json()),
    ]).then(([u, f]) => {
      setUsuarios(u.data || []);
      setFacturas(f.data || []);
    });
  }, []);

  const candidatas = useMemo(() => {
    if (!fechaIni || !fechaFin || !responsable) return [];
    const a = new Date(fechaIni);
    const b = new Date(fechaFin);
    b.setHours(23, 59, 59, 999);
    return facturas.filter((f) => {
      if (f.Responsable !== responsable) return false;
      const v = (f.Verificado || "").toLowerCase();
      if (v === "si" || v === "sí") return false;
      const d = new Date(f.Fecha_Factura);
      return !Number.isNaN(d.getTime()) && d >= a && d <= b;
    });
  }, [facturas, fechaIni, fechaFin, responsable]);

  const total = useMemo(() => {
    return candidatas
      .filter((f) => selected[f.ID_Factura])
      .reduce((acc, f) => {
        const n = Number(String(f.Monto_Factura).replace(/\./g, "").replace(",", "."));
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
  }, [candidatas, selected]);

  async function generar() {
    const ids = candidatas.filter((f) => selected[f.ID_Factura]).map((f) => f.ID_Factura);
    if (!ids.length) {
      setError("Seleccione al menos una factura");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/informes/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_inicio: fechaIni,
          fecha_fin: fechaFin,
          usuario_responsable: responsable,
          factura_ids: ids,
          firma_legaliza: firmaLeg || undefined,
          firma_aprueba: esHernan ? firmaApr || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Error al generar");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe_${responsable}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Fecha inicio</Label>
          <Input type="date" value={fechaIni} onChange={(e) => setFechaIni(e.target.value)} className="min-h-11" />
        </div>
        <div className="space-y-2">
          <Label>Fecha fin</Label>
          <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="min-h-11" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Usuario (responsable)</Label>
          <Select value={responsable} onValueChange={(v) => setResponsable(v ?? "")}>
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.Responsable} value={u.Responsable}>
                  {u.Responsable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Facturas no verificadas en el rango</p>
        <p className="text-xs text-muted-foreground">
          Total seleccionado: {formatCOP(total)} · {candidatas.filter((f) => selected[f.ID_Factura]).length}{" "}
          facturas
        </p>
        <ul className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {candidatas.map((f) => (
            <li key={f.ID_Factura} className="flex items-center gap-3 p-3">
              <Checkbox
                checked={!!selected[f.ID_Factura]}
                onCheckedChange={(c) =>
                  setSelected((s) => ({ ...s, [f.ID_Factura]: !!c }))
                }
              />
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-medium truncate">{f.Num_Factura}</p>
                <p className="text-muted-foreground text-xs">
                  {f.Fecha_Factura} · {f.Monto_Factura}
                </p>
              </div>
            </li>
          ))}
          {!candidatas.length && (
            <li className="p-4 text-sm text-muted-foreground text-center">Sin facturas en el criterio</li>
          )}
        </ul>
      </div>

      <div className="space-y-2">
        <Label>Firma quien legaliza</Label>
        <SignaturePad onEnd={setFirmaLeg} />
      </div>

      {esHernan && (
        <div className="space-y-2">
          <Label>Firma aprobación (jefe directo)</Label>
          <SignaturePad onEnd={setFirmaApr} />
        </div>
      )}

      <Button type="button" size="lg" className="w-full min-h-12" disabled={loading} onClick={generar}>
        {loading ? "Generando PDF…" : "Generar informe"}
      </Button>
    </div>
  );
}
