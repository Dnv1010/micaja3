"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FirmaCanvas } from "@/components/firma-canvas";
import { pdf } from "@react-pdf/renderer";
import { GastosGruposPdf } from "@/components/pdf/GastosGruposPdf";

interface GastoSel {
  _rowIndex: string;
  FechaFactura: string;
  Concepto: string;
  NIT: string;
  Ciudad: string;
  CentroCostos: string;
  Valor: string;
  ImagenURL?: string;
}

export default function NuevaAgrupacionModal({
  open,
  onClose,
  responsable,
  cargo,
  sector,
  gastos,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  responsable: string;
  cargo: string;
  sector: string;
  gastos: GastoSel[];
  onCreated: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [centroCostos, setCentroCostos] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [firma, setFirma] = useState("");
  const [saving, setSaving] = useState(false);

  const gastosSel = useMemo(() => gastos.filter((g) => selected.has(g._rowIndex)), [gastos, selected]);
  const total = useMemo(
    () => gastosSel.reduce((s, g) => s + (parseFloat(String(g.Valor || "").replace(/[^\d.-]/g, "")) || 0), 0),
    [gastosSel]
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const newImgs: string[] = [];
    for (const f of Array.from(files)) {
      if (f.type === "application/pdf") {
        if (typeof window === "undefined") return;
        const { pdfToJpgPages } = await import("@/lib/pdf-to-jpg");
        const pages = await pdfToJpgPages(f);
        newImgs.push(...pages);
      } else if (f.type.startsWith("image/")) {
        const r = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          r.onload = () => resolve(String(r.result || ""));
          r.onerror = () => reject(new Error("No se pudo leer imagen"));
          r.readAsDataURL(f);
        });
        newImgs.push(dataUrl);
      }
    }
    setExtras((prev) => [...prev, ...newImgs]);
  }

  async function crear() {
    if (!motivo || !fechaInicio || !fechaFin || !centroCostos) {
      window.alert("Completa motivo, fechas y centro de costos");
      return;
    }
    if (!firma) {
      window.alert("Debes confirmar la firma");
      return;
    }
    setSaving(true);
    try {
      const createRes = await fetch("/api/gastos-grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsable,
          cargo,
          sector,
          motivo,
          fechaInicio,
          fechaFin,
          centroCostos,
          gastosIds: gastosSel.map((g) => g._rowIndex),
          total: String(total),
        }),
      });
      const createJson = (await createRes.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!createRes.ok || !createJson.id) {
        window.alert(createJson.error || "No se pudo crear grupo");
        return;
      }

      const allItems = [
        ...gastosSel.map((g) => ({ ...g, imagenBase64: g.ImagenURL })),
        ...extras.map((img, i) => ({
          FechaFactura: "",
          Concepto: `Adjunto ${i + 1}`,
          NIT: "",
          Ciudad: "",
          CentroCostos: centroCostos,
          Valor: "0",
          imagenBase64: img,
        })),
      ];

      const blob = await pdf(
        <GastosGruposPdf
          grupo={{
            ID_Grupo: createJson.id,
            Responsable: responsable,
            Cargo: cargo,
            Motivo: motivo,
            FechaInicio: fechaInicio,
            FechaFin: fechaFin,
            CentroCostos: centroCostos,
            Total: String(total),
          }}
          gastos={allItems}
          firma={firma}
        />
      ).toBlob();

      const formData = new FormData();
      formData.append("file", new File([blob], `Gastos_${createJson.id}.pdf`, { type: "application/pdf" }));
      const uploadRes = await fetch("/api/facturas/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.url) {
        window.alert(uploadJson.error || "No se pudo subir PDF");
        return;
      }

      await fetch(`/api/gastos-grupos/${encodeURIComponent(createJson.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfUrl: uploadJson.url,
          firma,
          estado: "Firmado",
          total: String(total),
          gastosIds: gastosSel.map((g) => g._rowIndex),
          motivo,
        }),
      });

      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto border-white/10 bg-[#0f1729] text-white">
        <DialogHeader>
          <DialogTitle>Nueva agrupación de gastos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Motivo del viaje</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 bg-white/5" />
            </div>
            <div>
              <Label>Centro de costos</Label>
              <Select value={centroCostos} onValueChange={(v) => setCentroCostos(v ?? "")}>
                <SelectTrigger className="mt-1 bg-white/5">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ops-Activacion">Ops-Activacion</SelectItem>
                  <SelectItem value="Ops-Retention">Ops-Retention</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha inicio</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="mt-1 bg-white/5 [color-scheme:dark]" />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="mt-1 bg-white/5 [color-scheme:dark]" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 p-3">
            <p className="mb-2 text-xs text-gray-400">Seleccionar gastos existentes</p>
            <div className="max-h-52 overflow-auto space-y-1">
              {gastos.map((g) => (
                <label key={g._rowIndex} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(g._rowIndex)}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (v) n.add(g._rowIndex);
                        else n.delete(g._rowIndex);
                        return n;
                      })
                    }
                  />
                  <span className="text-gray-300">
                    {g.FechaFactura || "—"} · {g.Concepto || "—"} · {g.Valor || "0"}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-cyan-400">Total seleccionado: {total.toLocaleString("es-CO")}</p>
          </div>

          <div className="rounded-lg border border-white/10 p-3">
            <Label>Subir facturas adicionales (PDF o imagen)</Label>
            <Input type="file" accept="image/*,application/pdf" multiple className="mt-2 bg-white/5" onChange={(e) => void onFiles(e.target.files)} />
            <p className="mt-1 text-xs text-gray-400">Adjuntos convertidos a imagen: {extras.length}</p>
          </div>

          <div className="rounded-lg border border-white/10 p-3">
            <p className="mb-2 text-xs text-gray-400">Firma</p>
            <FirmaCanvas onFirma={(b64) => setFirma(b64)} onLimpiar={() => setFirma("")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void crear()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Generando..." : "Generar PDF y guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
