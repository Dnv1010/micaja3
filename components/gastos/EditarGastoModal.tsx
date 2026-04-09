"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface GastoEditable {
  _rowIndex: string;
  Ciudad: string;
  Motivo: string;
  FechaInicio: string;
  FechaFin: string;
  Concepto: string;
  CentroCostos: string;
  NIT: string;
  FechaFactura: string;
  Valor: string;
  Estado?: string;
}

export default function EditarGastoModal({
  gasto,
  open,
  onClose,
  onSaved,
}: {
  gasto: GastoEditable | null;
  open: boolean;
  onClose: () => void;
  onSaved: (rowIndex: string, patch: Partial<GastoEditable>) => void;
}) {
  const [form, setForm] = useState<GastoEditable | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(gasto);
  }, [gasto]);

  if (!form) return null;

  async function guardar() {
    const current = form;
    if (!current) return;
    setSaving(true);
    try {
      const payload = {
        Ciudad: current.Ciudad,
        Motivo: current.Motivo,
        FechaInicio: current.FechaInicio,
        FechaFin: current.FechaFin,
        Concepto: current.Concepto,
        CentroCostos: current.CentroCostos,
        NIT: current.NIT,
        FechaFactura: current.FechaFactura,
        Valor: current.Valor,
      };
      const res = await fetch(`/api/gastos/${encodeURIComponent(current._rowIndex)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(j.error || "No se pudo guardar");
        return;
      }
      onSaved(current._rowIndex, payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0f1729] text-white">
        <DialogHeader>
          <DialogTitle>Editar gasto</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Ciudad</Label>
            <Input value={form.Ciudad} onChange={(e) => setForm({ ...form, Ciudad: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={form.Motivo} onChange={(e) => setForm({ ...form, Motivo: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Fecha inicio</Label>
            <Input value={form.FechaInicio} onChange={(e) => setForm({ ...form, FechaInicio: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Fecha fin</Label>
            <Input value={form.FechaFin} onChange={(e) => setForm({ ...form, FechaFin: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Concepto</Label>
            <Input value={form.Concepto} onChange={(e) => setForm({ ...form, Concepto: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Centro costos</Label>
            <Select value={form.CentroCostos || ""} onValueChange={(v) => setForm({ ...form, CentroCostos: v || "" })}>
              <SelectTrigger className="mt-1 bg-white/5">
                <SelectValue placeholder="Centro de costos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ops-Activacion">Ops-Activacion</SelectItem>
                <SelectItem value="Ops-Retention">Ops-Retention</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>NIT</Label>
            <Input value={form.NIT} onChange={(e) => setForm({ ...form, NIT: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Fecha factura</Label>
            <Input value={form.FechaFactura} onChange={(e) => setForm({ ...form, FechaFactura: e.target.value })} className="mt-1 bg-white/5" />
          </div>
          <div>
            <Label>Valor</Label>
            <Input value={form.Valor} onChange={(e) => setForm({ ...form, Valor: e.target.value })} className="mt-1 bg-white/5" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
