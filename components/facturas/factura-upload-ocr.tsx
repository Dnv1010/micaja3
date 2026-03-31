"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, Check, AlertCircle } from "lucide-react";
import { formatDateDDMMYYYY } from "@/lib/format";

export interface OcrResult {
  num_factura: string | null;
  fecha_factura: string | null;
  monto_factura: number | null;
  nit_factura: string | null;
  razon_social: string | null;
  nombre_bia: boolean | null;
  ciudad: string | null;
  descripcion: string | null;
  tipo_factura: string | null;
  servicio_declarado: string | null;
  image_url: string;
  drive_file_id?: string | null;
  raw_text?: string;
  message?: string | null;
}

interface FacturaUploadOcrProps {
  sector: string;
  responsable: string;
  /** YYYY-MM-DD u otro formato para carpeta YYYY-MM en Drive (opcional) */
  fechaCarpeta?: string;
  onOcrComplete: (data: OcrResult) => void;
  onError: (error: string) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX = 10 * 1024 * 1024;

function mapSector(s: string): string {
  const t = s.trim();
  if (t === "Costa" || t === "Costa Caribe") return "Costa Caribe";
  if (t === "Bogota") return "Bogota";
  return t;
}

export function FacturaUploadOcr({
  sector,
  responsable,
  fechaCarpeta,
  onOcrComplete,
  onError,
}: FacturaUploadOcrProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "uploading" | "reading" | "done" | "error">("idle");

  const processFile = useCallback(
    async (file: File) => {
      const ok = ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type);
      if (!ok) {
        onError("Solo se permiten JPG, PNG, WebP o PDF");
        return;
      }
      if (file.size > MAX) {
        onError("El archivo no puede superar los 10MB");
        return;
      }

      const mapped = mapSector(sector);
      if (mapped !== "Bogota" && mapped !== "Costa Caribe") {
        onError('Sector debe ser "Bogota" o "Costa Caribe"');
        return;
      }
      if (!responsable.trim()) {
        onError("Falta responsable");
        return;
      }

      if (file.type !== "application/pdf") {
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }

      setIsProcessing(true);
      setOcrStatus("uploading");

      try {
        const formUp = new FormData();
        formUp.append("file", file);
        formUp.append("sector", mapped);
        formUp.append("responsable", responsable.trim());
        if (fechaCarpeta?.trim()) formUp.append("fecha", fechaCarpeta.trim());

        const upRes = await fetch("/api/facturas/upload", { method: "POST", body: formUp });
        const upJson = await upRes.json().catch(() => ({}));
        if (!upRes.ok) throw new Error(upJson.error || "Error al subir a Drive");

        const url = String(upJson.url || "");
        const fileId = String(upJson.fileId || "");
        if (!url || !fileId) throw new Error("Respuesta de subida incompleta");

        setOcrStatus("reading");
        const ocrRes = await fetch("/api/ocr/factura", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: url,
            mimeType: file.type,
            filename: file.name,
          }),
        });
        const result = await ocrRes.json();
        if (!ocrRes.ok) throw new Error(result.error || "Error OCR");

        const d = result.data || {};
        const fechaRaw = d.fecha_factura as string | null | undefined;
        const fechaUi = fechaRaw ? formatDateDDMMYYYY(fechaRaw) : null;

        setOcrStatus("done");
        onOcrComplete({
          num_factura: d.num_factura ?? null,
          fecha_factura: fechaUi || fechaRaw || null,
          monto_factura: d.monto_factura ?? null,
          nit_factura: d.nit_factura ?? null,
          razon_social: d.razon_social ?? null,
          nombre_bia: d.nombre_bia ?? null,
          ciudad: d.ciudad ?? null,
          descripcion: d.descripcion ?? null,
          tipo_factura: d.tipo_factura ?? null,
          servicio_declarado: d.servicio_declarado ?? null,
          image_url: String(d.image_url || url),
          drive_file_id: fileId,
          raw_text: d.raw_text,
          message: d.message ?? null,
        });
      } catch (err: unknown) {
        setOcrStatus("error");
        onError(err instanceof Error ? err.message : "Error");
      } finally {
        setIsProcessing(false);
      }
    },
    [sector, responsable, fechaCarpeta, onOcrComplete, onError]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      await processFile(f);
      e.target.value = "";
    },
    [processFile]
  );

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
        {preview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Vista previa factura" className="max-h-64 mx-auto rounded-md" />
            {ocrStatus === "reading" && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md">
                <div className="text-white text-center px-4">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Extrayendo texto (OCR)…</p>
                </div>
              </div>
            )}
            {ocrStatus === "done" && (
              <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
            )}
          </div>
        ) : (
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center gap-2 py-4">
              <Camera className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Toma una foto o selecciona la imagen / PDF de tu factura
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP, PDF — máx. 10MB</p>
            </div>
            <input
              type="file"
              accept={ACCEPT}
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
          </label>
        )}
      </div>

      {ocrStatus !== "idle" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {ocrStatus === "uploading" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Subiendo imagen…
            </>
          )}
          {ocrStatus === "reading" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Extrayendo texto…
            </>
          )}
          {ocrStatus === "done" && (
            <>
              <Check className="h-4 w-4 text-green-600 shrink-0" /> Datos extraídos; revisa y corrige si hace falta
            </>
          )}
          {ocrStatus === "error" && (
            <>
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> No se pudo completar subida u OCR
            </>
          )}
        </div>
      )}

      {(preview || ocrStatus === "error") && (
        <div>
          <input
            ref={replaceInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => replaceInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" /> Cambiar archivo
          </Button>
        </div>
      )}
    </div>
  );
}
