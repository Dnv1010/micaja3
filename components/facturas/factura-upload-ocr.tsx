"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, Check, AlertCircle } from "lucide-react";

export interface OcrResult {
  num_factura: string | null;
  fecha_factura: string | null;
  monto_factura: number | null;
  nit_factura: string | null;
  razon_social: string | null;
  nombre_bia: boolean | null;
  ciudad: string | null;
  descripcion: string | null;
  image_url: string;
  drive_file_id: string;
  raw_text?: string;
}

interface FacturaUploadOcrProps {
  onOcrComplete: (data: OcrResult) => void;
  onError: (error: string) => void;
}

export function FacturaUploadOcr({ onOcrComplete, onError }: FacturaUploadOcrProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "uploading" | "reading" | "done" | "error">("idle");

  const processFile = useCallback(
    async (file: File) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        onError("Solo se permiten archivos JPG, PNG o WebP");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        onError("El archivo no puede superar los 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);

      setIsProcessing(true);
      setOcrStatus("uploading");

      try {
        const formData = new FormData();
        formData.append("factura", file);
        setOcrStatus("reading");
        const response = await fetch("/api/ocr/factura", { method: "POST", body: formData });
        if (!response.ok) {
          const j = await response.json().catch(() => ({}));
          throw new Error(j.error || "Error al procesar la factura");
        }
        const result = await response.json();
        if (result.success) {
          setOcrStatus("done");
          onOcrComplete(result.data);
        } else {
          throw new Error(result.error || "Error desconocido");
        }
      } catch (err: unknown) {
        setOcrStatus("error");
        onError(err instanceof Error ? err.message : "Error");
      } finally {
        setIsProcessing(false);
      }
    },
    [onOcrComplete, onError]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await processFile(file);
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
                  <p className="text-sm">Leyendo factura (OCR)…</p>
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
                Toma una foto o selecciona la imagen de tu factura
              </p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP — máx. 10MB</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> No se pudo leer la factura
            </>
          )}
        </div>
      )}

      {preview && (
        <div>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
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
            <Upload className="h-4 w-4 mr-2" /> Cambiar imagen
          </Button>
        </div>
      )}
    </div>
  );
}
