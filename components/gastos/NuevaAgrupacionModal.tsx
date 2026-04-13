"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FirmaCanvas } from "@/components/firma-canvas";
import { pdf } from "@react-pdf/renderer";
import { GastosGruposPdf } from "@/components/pdf/GastosGruposPdf";
import { formatCOP } from "@/lib/format";
import { Loader2, Trash2, Upload } from "lucide-react";
import { pdfToJpgPages } from "@/lib/pdf-to-jpg";

interface GastoSel {
  _rowIndex: string;
  FechaFactura: string;
  Concepto: string;
  NIT: string;
  Proveedor?: string;
  Ciudad: string;
  CentroCostos: string;
  Valor: string;
  ImagenURL?: string;
}

interface FacturaOcr {
  id: string;
  proveedor: string;
  nit: string;
  numFactura: string;
  concepto: string;
  valor: string;
  fecha: string;
  error?: string;
  loading?: boolean;
}

type OcrResultado = {
  id: string;
  proveedor?: string;
  nit?: string;
  numFactura?: string;
  concepto?: string;
  valor?: string;
  fecha?: string;
  error?: string;
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [motivo, setMotivo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [centroCostos, setCentroCostos] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [facturasOcr, setFacturasOcr] = useState<FacturaOcr[]>([]);
  const [firma, setFirma] = useState("");
  const [saving, setSaving] = useState(false);
  const [ocrError, setOcrError] = useState("");

  const gastosSel = useMemo(() => gastos.filter((g) => selected.has(g._rowIndex)), [gastos, selected]);
  const totalGastos = useMemo(
    () => gastosSel.reduce((s, g) => s + (parseFloat(String(g.Valor || "").replace(/[^\d.-]/g, "")) || 0), 0),
    [gastosSel]
  );
  const totalOcr = useMemo(
    () => facturasOcr.reduce((s, f) => s + (parseFloat(String(f.valor || "").replace(/[^\d.-]/g, "")) || 0), 0),
    [facturasOcr]
  );
  const totalGeneral = totalGastos + totalOcr;

  async function procesarArchivos(files: FileList | null) {
    if (!files?.length) return;
    setOcrError("");

    const archivos: { base64: string; mimeType: string; id: string }[] = [];

    for (const f of Array.from(files)) {
      const id = `ocr-${Date.now()}-${Math.random()}`;
      try {
        let base64 = "";
        let mimeType = f.type;
        if (f.type === "application/pdf") {
          const pages = await pdfToJpgPages(f);
          if (!pages.length) {
            setFacturasOcr((prev) => [...prev, { id, proveedor: "", nit: "", numFactura: "", concepto: "", valor: "", fecha: "", error: "No se pudo convertir PDF a imagen" }]);
            continue;
          }
          base64 = pages[0].split(",")[1] || "";
          mimeType = "image/jpeg";
        } else if (f.type.startsWith("image/")) {
          const reader = new FileReader();
          base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
            reader.onerror = () => reject(new Error("No se pudo leer imagen"));
            reader.readAsDataURL(f);
          });
        } else {
          setOcrError("Formato no soportado (usa JPG, PNG o PDF)");
          continue;
        }
        archivos.push({ base64, mimeType, id });
      } catch (err) {
        setFacturasOcr((prev) => [...prev, { id, proveedor: "", nit: "", numFactura: "", concepto: "", valor: "", fecha: "", error: `Error: ${err instanceof Error ? err.message : "desconocido"}` }]);
      }
    }

    setFacturasOcr((prev) => [
      ...prev,
      ...archivos.map((a) => ({ id: a.id, proveedor: "", nit: "", numFactura: "", concepto: "", valor: "", fecha: "", loading: true })),
    ]);

    const resultados: OcrResultado[] = await Promise.all(
      archivos.map(async (a): Promise<OcrResultado> => {
        try {
          const ocrRes = await fetch("/api/ia/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: a.base64, mimeType: a.mimeType }),
          });
          if (!ocrRes.ok) {
            const err = await ocrRes.json().catch(() => ({})) as Record<string, unknown>;
            return { id: a.id, error: String(err.error || "Error en OCR") };
          }
          const data = await ocrRes.json() as { data?: Partial<FacturaOcr> };
          return { id: a.id, ...data.data };
        } catch (err) {
          return { id: a.id, error: err instanceof Error ? err.message : "Error OCR" };
        }
      })
    );

    setFacturasOcr((prev) =>
      prev.map((f) => {
        const r = resultados.find((x) => x.id === f.id);
        if (!r) return f;
        return {
          ...f,
          proveedor: r.proveedor || "",
          nit: r.nit || "",
          numFactura: r.numFactura || "",
          concepto: r.concepto || "",
          valor: r.valor || "",
          fecha: r.fecha || "",
          error: r.error,
          loading: false,
        };
      })
    );

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function editarFacturaOcr(id: string, campo: keyof Omit<FacturaOcr, "id" | "error" | "loading">, valor: string) {
    setFacturasOcr((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function eliminarFacturaOcr(id: string) {
    setFacturasOcr((prev) => prev.filter((f) => f.id !== id));
  }

  async function crear() {
    if (!motivo || !fechaInicio || !fechaFin || !centroCostos) { alert("Completa motivo, fechas y centro de costos"); return; }
    if (!firma) { alert("Debes confirmar la firma"); return; }
    if (gastosSel.length === 0 && facturasOcr.length === 0) { alert("Selecciona al menos un gasto o agrega facturas con OCR"); return; }

    setSaving(true);
    try {
      const createRes = await fetch("/api/gastos-grupos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsable, cargo, sector, motivo, fechaInicio, fechaFin, centroCostos, gastosIds: gastosSel.map((g) => g._rowIndex), total: String(totalGeneral) }),
      });
      const createJson = (await createRes.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!createRes.ok || !createJson.id) { alert(createJson.error || "No se pudo crear grupo"); return; }

      const allItems = [
     ...gastosSel.map((g) => ({ FechaFactura: g.FechaFactura || "", Concepto: g.Concepto || "", NIT: g.NIT || "", Valor: g.Valor || "", imagenBase64: g.ImagenURL || "", Ciudad: g.Ciudad || "", CentroCostos: g.CentroCostos || "" })),
...facturasOcr.filter((f) => !f.error).map((f) => ({ FechaFactura: f.fecha || "", Concepto: f.concepto || "", NIT: f.nit || "", Valor: f.valor || "", imagenBase64: "", Ciudad: "", CentroCostos: centroCostos })),
        ...facturasOcr.filter((f) => !f.error).map((f) => ({ FechaFactura: f.fecha || "", Concepto: f.concepto || "", NIT: f.nit || "", Valor: f.valor || "", imagenBase64: "" })),
      ];

      const blob = await pdf(
        <GastosGruposPdf
          grupo={{ ID_Grupo: createJson.id, Responsable: responsable, Cargo: cargo, Motivo: motivo, FechaInicio: fechaInicio, FechaFin: fechaFin, CentroCostos: centroCostos, Total: String(totalGeneral) }}
          gastos={allItems}
          firma={firma}
        />
      ).toBlob();

      const formData = new FormData();
      formData.append("file", new File([blob], `Gastos_${createJson.id}.pdf`, { type: "application/pdf" }));
      const uploadRes = await fetch("/api/facturas/upload", { method: "POST", body: formData });
      const uploadJson = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!uploadRes.ok || !uploadJson.url) { alert(uploadJson.error || "No se pudo subir PDF"); return; }

      await fetch(`/api/gastos-grupos/${encodeURIComponent(createJson.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl: uploadJson.url, firma, estado: "Firmado", total: String(totalGeneral), gastosIds: gastosSel.map((g) => g._rowIndex), motivo }),
      });

      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const hasErrors = facturasOcr.some((f) => f.error);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto border-white/10 bg-[#0f1729] text-white w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva agrupación de gastos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300">Información de la agrupación</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Motivo del viaje</Label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 bg-white/5 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Centro de costos</Label>
                <Select value={centroCostos} onValueChange={(v) => setCentroCostos(v ?? "")}>
                  <SelectTrigger className="mt-1 bg-white/5 text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPS-Activation">OPS-Activation</SelectItem>
                    <SelectItem value="OPS-Retention">OPS-Retention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fecha inicio</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="mt-1 bg-white/5 text-sm [color-scheme:dark]" />
              </div>
              <div>
                <Label className="text-xs">Fecha fin</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="mt-1 bg-white/5 text-sm [color-scheme:dark]" />
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-gray-300">Sección 1: Seleccionar gastos existentes</h3>
            {gastos.length === 0 ? (
              <p className="text-xs text-gray-500">No hay gastos disponibles</p>
            ) : (
              <div className="max-h-48 overflow-auto rounded border border-white/10 p-2 space-y-1">
                {gastos.map((g) => (
                  <label key={g._rowIndex} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-white/5">
                    <Checkbox
                      checked={selected.has(g._rowIndex)}
                      onCheckedChange={(v) => setSelected((prev) => { const n = new Set(prev); if (v === true) n.add(g._rowIndex); else n.delete(g._rowIndex); return n; })}
                    />
                    <span className="flex-1 text-gray-300">
                      <span className="font-medium">{g.Concepto || "—"}</span>
                      {g.Proveedor && <span className="text-gray-500"> • {g.Proveedor}</span>}
                      {g.FechaFactura && <span className="text-gray-500"> • {g.FechaFactura}</span>}
                    </span>
                    <span className="text-cyan-400 font-medium">{formatCOP(parseFloat(String(g.Valor || "0").replace(/[^\d.-]/g, "")))}</span>
                  </label>
                ))}
              </div>
            )}
            {gastosSel.length > 0 && (
              <div className="text-right text-xs pt-1">
                <p className="text-gray-400">Seleccionados: <span className="text-cyan-400 font-semibold">{gastosSel.length}</span></p>
                <p className="text-gray-300 font-medium">Subtotal: <span className="text-cyan-400">{formatCOP(totalGastos)}</span></p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-gray-300">Sección 2: Subir facturas nuevas con OCR</h3>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
              <label className="cursor-pointer block">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-gray-400" />
                  <p className="text-xs font-medium text-gray-300">Selecciona imágenes o PDFs</p>
                  <p className="text-xs text-gray-500">Soporta: JPG, PNG, PDF (máx. 10MB por archivo)</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={(e) => void procesarArchivos(e.target.files)} className="hidden" />
              </label>
            </div>

            {ocrError && <div className="rounded bg-red-500/20 border border-red-500/50 p-2 text-xs text-red-300">{ocrError}</div>}

            {facturasOcr.length > 0 && (
              <div className="overflow-auto rounded border border-white/10">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="border-b border-white/10 hover:bg-transparent">
                      <TableHead className="px-2 py-1 text-gray-400">Proveedor</TableHead>
                      <TableHead className="px-2 py-1 text-gray-400">NIT</TableHead>
                      <TableHead className="px-2 py-1 text-gray-400">Nº Factura</TableHead>
                      <TableHead className="px-2 py-1 text-gray-400">Fecha</TableHead>
                      <TableHead className="px-2 py-1 text-gray-400 text-right">Valor</TableHead>
                      <TableHead className="px-2 py-1 text-gray-400">Concepto</TableHead>
                      <TableHead className="px-2 py-1 text-center text-gray-400">Acc.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturasOcr.map((f) => (
                      <TableRow key={f.id} className="border-b border-white/5 hover:bg-white/5">
                        {f.loading ? (
                          <TableCell colSpan={7} className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-gray-400">Procesando OCR...</span>
                            </div>
                          </TableCell>
                        ) : f.error ? (
                          <TableCell colSpan={7} className="px-2 py-2">
                            <div className="text-red-400 text-xs mb-1">{f.error}</div>
                            <div className="grid grid-cols-2 gap-1">
                              <Input placeholder="Proveedor" value={f.proveedor} onChange={(e) => editarFacturaOcr(f.id, "proveedor", e.target.value)} className="h-6 bg-white/5 text-xs px-1" />
                              <Input placeholder="NIT" value={f.nit} onChange={(e) => editarFacturaOcr(f.id, "nit", e.target.value)} className="h-6 bg-white/5 text-xs px-1" />
                              <Input placeholder="Nº Factura" value={f.numFactura} onChange={(e) => editarFacturaOcr(f.id, "numFactura", e.target.value)} className="h-6 bg-white/5 text-xs px-1" />
                              <Input placeholder="Fecha" value={f.fecha} onChange={(e) => editarFacturaOcr(f.id, "fecha", e.target.value)} className="h-6 bg-white/5 text-xs px-1" />
                              <Input placeholder="Valor" value={f.valor} onChange={(e) => editarFacturaOcr(f.id, "valor", e.target.value)} className="h-6 bg-white/5 text-xs px-1" />
                              <Input placeholder="Concepto" value={f.concepto} onChange={(e) => editarFacturaOcr(f.id, "concepto", e.target.value)} className="h-6 bg-white/5 text-xs px-1 col-span-2" />
                            </div>
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="px-2 py-1"><Input value={f.proveedor} onChange={(e) => editarFacturaOcr(f.id, "proveedor", e.target.value)} className="h-6 bg-white/5 text-xs px-1" /></TableCell>
                            <TableCell className="px-2 py-1"><Input value={f.nit} onChange={(e) => editarFacturaOcr(f.id, "nit", e.target.value)} className="h-6 bg-white/5 text-xs px-1" /></TableCell>
                            <TableCell className="px-2 py-1"><Input value={f.numFactura} onChange={(e) => editarFacturaOcr(f.id, "numFactura", e.target.value)} className="h-6 bg-white/5 text-xs px-1" /></TableCell>
                            <TableCell className="px-2 py-1"><Input value={f.fecha} onChange={(e) => editarFacturaOcr(f.id, "fecha", e.target.value)} className="h-6 bg-white/5 text-xs px-1" /></TableCell>
                            <TableCell className="px-2 py-1 text-right"><Input value={f.valor} onChange={(e) => editarFacturaOcr(f.id, "valor", e.target.value)} className="h-6 bg-white/5 text-xs px-1 text-right" /></TableCell>
                            <TableCell className="px-2 py-1"><Input value={f.concepto} onChange={(e) => editarFacturaOcr(f.id, "concepto", e.target.value)} className="h-6 bg-white/5 text-xs px-1" /></TableCell>
                            <TableCell className="px-2 py-1">
                              <Button size="sm" variant="ghost" onClick={() => eliminarFacturaOcr(f.id)} className="h-6 px-1 text-red-400 hover:bg-red-500/20">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {facturasOcr.length > 0 && (
              <div className="text-right text-xs pt-1">
                <p className="text-gray-300 font-medium">OCR Total: <span className="text-cyan-400">{formatCOP(totalOcr)}</span></p>
              </div>
            )}

            {hasErrors && <p className="text-xs text-orange-400">⚠️ Algunos archivos tuvieron errores. Completa manualmente o elimínalos.</p>}
          </div>

          {(gastosSel.length > 0 || facturasOcr.length > 0) && (
            <div className="border-t border-white/10 pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">Resumen consolidado</h3>
              <div className="bg-white/5 rounded p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Gastos seleccionados:</span>
                  <span className="text-cyan-400">{formatCOP(totalGastos)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Facturas OCR:</span>
                  <span className="text-cyan-400">{formatCOP(totalOcr)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-1 mt-1">
                  <span className="text-gray-300">Total general:</span>
                  <span className="text-emerald-400">{formatCOP(totalGeneral)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Firma digital</h3>
            <FirmaCanvas onFirma={(b64) => setFirma(b64)} onLimpiar={() => setFirma("")} />
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 text-gray-300 hover:bg-white/5">Cancelar</Button>
          <Button
            onClick={() => void crear()}
            disabled={saving || !firma || (gastosSel.length === 0 && facturasOcr.length === 0)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "Generando PDF..." : "Confirmar firma y generar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}