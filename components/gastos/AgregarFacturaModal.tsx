"use client";
import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { pdfToJpgPages } from "@/lib/pdf-to-jpg";

export interface OcrDataExtracted {
  proveedor: string | null;
  nit: string | null;
  numFactura: string | null;
  concepto: string | null;
  valor: string | null;
  fecha: string | null;
}

interface AgregarFacturaModalProps {
  open: boolean;
  onClose: () => void;
  responsable: string;
  cargo: string;
  cc: string;
  ciudad: string;
  onSaved: (rowIndex: string) => void;
}

export default function AgregarFacturaModal({
  open,
  onClose,
  responsable,
  cargo,
  cc,
  ciudad,
  onSaved,
}: AgregarFacturaModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "edit">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OcrDataExtracted>({
    proveedor: null,
    nit: null,
    numFactura: null,
    concepto: null,
    valor: null,
    fecha: null,
  });
  const [form, setForm] = useState({
    motivo: "",
    fechaInicio: "",
    fechaFin: "",
    centroCostos: "",
  });
  const [saving, setSaving] = useState(false);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError("");
      setLoading(true);

      try {
        let imageBase64 = "";
        let mimeType = file.type;

        if (file.type === "application/pdf") {
          const pages = await pdfToJpgPages(file);
          if (!pages.length) throw new Error("No se pudo convertir PDF a JPG");
          imageBase64 = pages[0].split(",")[1] || "";
          mimeType = "image/jpeg";
          setPreview(pages[0]);
        } else if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("No se pudo leer imagen"));
            reader.readAsDataURL(file);
          });
          imageBase64 = dataUrl.split(",")[1] || "";
          setPreview(dataUrl);
        } else {
          throw new Error("Formato no soportado (usa JPG, PNG o PDF)");
        }

        // Llamar a OCR
        const ocrRes = await fetch("/api/ia/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, mimeType }),
        });

        if (!ocrRes.ok) {
          const errJson = await ocrRes.json().catch(() => ({}));
          throw new Error(errJson.error || "Error en OCR");
        }

        const ocrJson = (await ocrRes.json()) as {
          success?: boolean;
          data?: OcrDataExtracted;
          error?: string;
        };

        if (!ocrJson.success || !ocrJson.data) {
          throw new Error(ocrJson.error || "No se extrajeron datos");
        }

        setOcrData(ocrJson.data);
        setStep("edit");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error procesando archivo");
      } finally {
        setLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!form.motivo || !form.fechaInicio || !form.fechaFin || !form.centroCostos) {
      setError("Completa motivo, fechas y centro de costos");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        responsable,
        cargo,
        cc,
        ciudad,
        motivo: form.motivo,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin,
        concepto: ocrData.concepto || "",
        nit: ocrData.nit || "",
        valor: ocrData.valor || "",
        fechaFactura: ocrData.fecha || "",
        centroCostos: form.centroCostos,
      };

      const res = await fetch("/api/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };

      if (!res.ok || !json.id) {
        throw new Error(json.error || "Error creando gasto");
      }

      onSaved(json.id);
      setStep("upload");
      setPreview(null);
      setOcrData({ proveedor: null, nit: null, numFactura: null, concepto: null, valor: null, fecha: null });
      setForm({ motivo: "", fechaInicio: "", fechaFin: "", centroCostos: "" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [form, ocrData, responsable, cargo, cc, ciudad, onSaved, onClose]);

  const handleClose = () => {
    if (step === "edit") {
      setStep("upload");
    }
    setPreview(null);
    setOcrData({ proveedor: null, nit: null, numFactura: null, concepto: null, valor: null, fecha: null });
    setForm({ motivo: "", fechaInicio: "", fechaFin: "", centroCostos: "" });
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0f1729] text-white">
        <DialogHeader>
          <DialogTitle>Agregar Factura con OCR</DialogTitle>
        </DialogHeader>

        {error && <div className="rounded bg-red-500/20 border border-red-500/50 p-3 text-sm text-red-300">{error}</div>}

        {step === "upload" ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-bia-gray/30 rounded-lg p-8 text-center">
              <label className="cursor-pointer block">
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-bia-gray" />
                  <div>
                    <p className="text-sm font-medium">Sube una imagen o PDF de la factura</p>
                    <p className="text-xs text-bia-gray mt-1">JPG, PNG o PDF — máx. 10MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Procesando OCR...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {preview && (
              <div className="rounded border border-white/10 p-3 overflow-hidden max-h-[200px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Vista previa" className="max-h-[180px] mx-auto rounded object-contain" />
              </div>
            )}

            <div className="space-y-3 bg-white/5 p-3 rounded">
              <p className="text-sm font-medium">Datos extraídos por OCR:</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Proveedor</Label>
                  <Input
                    value={ocrData.proveedor || ""}
                    onChange={(e) => setOcrData({ ...ocrData, proveedor: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">NIT</Label>
                  <Input
                    value={ocrData.nit || ""}
                    onChange={(e) => setOcrData({ ...ocrData, nit: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nº Factura</Label>
                  <Input
                    value={ocrData.numFactura || ""}
                    onChange={(e) => setOcrData({ ...ocrData, numFactura: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input
                    value={ocrData.fecha || ""}
                    onChange={(e) => setOcrData({ ...ocrData, fecha: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Concepto</Label>
                  <Input
                    value={ocrData.concepto || ""}
                    onChange={(e) => setOcrData({ ...ocrData, concepto: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={ocrData.valor || ""}
                    onChange={(e) => setOcrData({ ...ocrData, valor: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-3">
              <p className="text-sm font-medium">Información del gasto:</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Motivo</Label>
                  <Input
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Centro de Costos</Label>
                  <Input
                    value={form.centroCostos}
                    onChange={(e) => setForm({ ...form, centroCostos: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha Inicio</Label>
                  <Input
                    type="date"
                    value={form.fechaInicio}
                    onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha Fin</Label>
                  <Input
                    type="date"
                    value={form.fechaFin}
                    onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                    className="mt-1 bg-white/5 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 justify-end">
          <Button onClick={handleClose} variant="outline" className="border-white/20 text-white hover:bg-white/5">
            {step === "upload" ? "Cerrar" : "Volver"}
          </Button>
          {step === "edit" && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? "Guardando..." : "Guardar gasto"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
