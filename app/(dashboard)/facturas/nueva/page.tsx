"use client";

import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CIUDADES_FACTURA,
  SERVICIOS_DECLARADOS,
  SECTORES_FACTURA,
  TIPOS_FACTURA_FIJOS,
  TIPOS_OPERACION,
} from "@/lib/factura-field-options";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import {
  isFechaFacturaFutura,
  nitIndicaBiaEnergy,
  parseFechaFacturaDDMMYYYY,
} from "@/lib/nueva-factura-validation";

/** DD/MM/YYYY → YYYY-MM-DD (input type="date") */
function toInputDate(ddmmyyyy: string): string {
  const m = ddmmyyyy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  const y = m[3];
  return `${y}-${mo}-${d}`;
}

/** YYYY-MM-DD → DD/MM/YYYY (Sheets / validación) */
function fromInputDate(yyyymmdd: string): string {
  const m = yyyymmdd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function getTodayDDMMYYYY(): string {
  const today = new Date();
  return `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
}

const GALLERY_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

type UploadState = "idle" | "selected" | "uploading" | "extracting" | "ready" | "saving" | "done";

type OcrPayload = {
  fecha_factura?: string | null;
  razon_social?: string | null;
  nit_factura?: string | null;
  descripcion?: string | null;
  monto_factura?: number | null;
  image_url?: string | null;
  message?: string | null;
  nombre_bia?: boolean | null;
};

const PROGRESS_STEPS = ["Seleccionar", "Subir", "Extraer", "Revisar", "Guardar"] as const;

const OCR_MANUAL_HINT = "No se pudieron extraer todos los datos. Completa los campos manualmente.";

function validateFile(f: File): string | null {
  if (f.type === "image/svg+xml") return "SVG no está permitido.";
  if (f.type === "application/pdf") {
    /* ok */
  } else if (f.type.startsWith("image/")) {
    /* ok */
  } else {
    return "Use una imagen o un PDF.";
  }
  if (f.size > MAX_BYTES) return "El archivo no puede superar 10MB.";
  return null;
}

function progressSolidCount(state: UploadState): number {
  switch (state) {
    case "idle":
      return 0;
    case "selected":
      return 1;
    case "uploading":
      return 1;
    case "extracting":
      return 2;
    case "ready":
      return 3;
    case "saving":
      return 4;
    case "done":
      return 5;
    default:
      return 0;
  }
}

function progressPulseIndex(state: UploadState): number {
  switch (state) {
    case "idle":
      return 0;
    case "selected":
      return 1;
    case "uploading":
      return 1;
    case "extracting":
      return 2;
    case "ready":
      return 3;
    case "saving":
      return 4;
    default:
      return 0;
  }
}

export default function NuevaFacturaPage() {
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;
  const idOpAct = useId();
  const idOpRet = useId();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [ocrHint, setOcrHint] = useState("");

  const [driveFileId, setDriveFileId] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");

  const [fecha, setFecha] = useState(getTodayDDMMYYYY);
  const [proveedor, setProveedor] = useState("");
  const [nit, setNit] = useState("");
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [tipoFactura, setTipoFactura] = useState("");
  const [servicioDeclarado, setServicioDeclarado] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [sectorForm, setSectorForm] = useState("");
  const [aNombreBia, setANombreBia] = useState(false);
  const [saveError, setSaveError] = useState("");

  const sessionSector = String(user?.sector || "");
  const responsable = String(user?.responsable || user?.name || "");

  useEffect(() => {
    const s = String(user?.sector || "");
    setSectorForm((prev) => (prev ? prev : s));
    setCiudad((prev) => {
      if (prev) return prev;
      if (s === "Bogota") return "Bogotá";
      if (s === "Costa Caribe") return "Barranquilla";
      return prev;
    });
  }, [user?.sector]);

  const nitBiaWarning = useMemo(() => {
    if (!aNombreBia || !nit.trim()) return false;
    return !nitIndicaBiaEnergy(nit);
  }, [aNombreBia, nit]);

  const maxFechaInput = useMemo(() => toInputDate(getTodayDDMMYYYY()), []);

  function resetPreview() {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }

  function assignFile(selected: File | null) {
    resetPreview();
    setFile(selected);
    setUploadError("");
    setOcrHint("");
    setDriveFileId("");
    setImagenUrl("");
    setUploadState(selected ? "selected" : "idle");
    if (selected) {
      const err = validateFile(selected);
      if (err) {
        setUploadError(err);
        setFile(null);
        setUploadState("idle");
        return;
      }
      if (selected.type !== "application/pdf") {
        setPreviewUrl(URL.createObjectURL(selected));
      }
    }
  }

  function onGalleryChange(e: ChangeEvent<HTMLInputElement>) {
    assignFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  }

  async function uploadAndOcr() {
    if (!file || !user) return;
    const err = validateFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    if (!sessionSector || (sessionSector !== "Bogota" && sessionSector !== "Costa Caribe")) {
      setUploadError("Su cuenta no tiene un sector válido (Bogota / Costa Caribe).");
      return;
    }

    setUploadError("");
    setOcrHint("");
    setUploadState("uploading");

    try {
      const formUp = new FormData();
      formUp.append("file", file);
      formUp.append("sector", sessionSector);
      formUp.append("responsable", responsable);
      if (fecha.trim()) formUp.append("fecha", fecha.trim());

      const upRes = await fetch("/api/facturas/upload", {
        method: "POST",
        body: formUp,
      });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        throw new Error(upJson.error || "Error al subir imagen. Intenta de nuevo.");
      }

      const url = String(upJson.url || "");
      const fid = String(upJson.fileId || "");
      if (!url || !fid) throw new Error("Respuesta de subida incompleta.");

      setImagenUrl(url);
      setDriveFileId(fid);
      setUploadState("extracting");

      const ocrRes = await fetch("/api/ocr/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: url,
          mimeType: file.type,
          filename: file.name,
        }),
      });
      const ocrJson = await ocrRes.json().catch(() => ({}));
      const d = (ocrJson?.data || {}) as OcrPayload;

      if (ocrJson.success && d) {
        // Parser/OCR puede venir en ISO o sheet; normalizamos a DD/MM/YYYY
        if (d.fecha_factura) setFecha(formatDateDDMMYYYY(d.fecha_factura));
        if (d.razon_social) setProveedor(d.razon_social);
        if (d.nit_factura) setNit(d.nit_factura);
        if (d.descripcion) setConcepto(d.descripcion);
        if (d.monto_factura != null && !Number.isNaN(d.monto_factura)) {
          setValor(String(Math.round(d.monto_factura)));
        }
        if (d.nombre_bia === true) setANombreBia(true);
        setImagenUrl(String(d.image_url || url));
        if (d.message) {
          setOcrHint(d.message);
        } else if (!d.razon_social && !d.monto_factura) {
          setOcrHint(OCR_MANUAL_HINT);
        } else {
          setOcrHint("");
        }
      }

      setUploadState("ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al subir imagen. Intenta de nuevo.";
      setUploadError(msg);
      setUploadState("selected");
      setDriveFileId("");
      setImagenUrl("");
    }
  }

  function validateLocal(): string | null {
    if (!imagenUrl.trim()) return "Debes subir la imagen a Drive antes de guardar.";
    const fd = parseFechaFacturaDDMMYYYY(fecha);
    if (!fd) return "La fecha es obligatoria (DD/MM/YYYY).";
    if (isFechaFacturaFutura(fd)) return "La fecha no puede ser futura.";
    if (!proveedor.trim()) return "Proveedor es obligatorio.";
    if (!concepto.trim()) return "Concepto es obligatorio.";
    if (!tipoFactura) return "Tipo de factura es obligatorio.";
    if (!servicioDeclarado) return "Servicio declarado es obligatorio.";
    if (!tipoOperacion) return "Tipo de operación es obligatorio.";
    if (!ciudad) return "Ciudad es obligatoria.";
    if (!sectorForm) return "Sector es obligatorio.";
    const v = parseCOPString(valor || "0");
    if (!Number.isFinite(v) || v <= 0) return "El valor debe ser mayor a 0.";
    if (aNombreBia && !nit.trim()) {
      return "Si la factura es a nombre de BIA, el NIT es obligatorio.";
    }
    return null;
  }

  async function saveFactura() {
    if (!user) return;
    const localErr = validateLocal();
    if (localErr) {
      setSaveError(localErr);
      return;
    }
    setSaveError("");
    setUploadState("saving");
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fecha.trim(),
          proveedor: proveedor.trim(),
          nit: nit.trim(),
          concepto: concepto.trim(),
          valor: valor.trim(),
          tipoFactura,
          servicioDeclarado,
          tipoOperacion,
          aNombreBia,
          ciudad,
          responsable: user.responsable || "",
          area: user.area || "",
          sector: sectorForm,
          imagenUrl: imagenUrl.trim(),
          driveFileId: driveFileId.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "No se pudo guardar en la hoja. Revisa los datos e intenta de nuevo.");
      }
      setUploadState("done");
      router.push("/facturas?saved=1");
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Error al guardar");
      setUploadState("ready");
    }
  }

  const valorVista = useMemo(() => formatCOP(Number(valor || "0")), [valor]);

  const solidCount = progressSolidCount(uploadState);
  const pulseIdx = progressPulseIndex(uploadState);

  const isPdf = file?.type === "application/pdf";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="mb-3 text-xs font-medium text-zinc-400">Progreso</p>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs sm:text-sm">
          {PROGRESS_STEPS.map((label, i) => {
            const done = i < solidCount;
            const pulse = pulseIdx === i && !done;
            return (
              <span key={label} className="inline-flex items-center gap-1">
                <span
                  className={
                    done
                      ? "text-emerald-400"
                      : pulse
                        ? "text-amber-400 animate-pulse"
                        : "text-zinc-600"
                  }
                >
                  {done ? "●" : "○"}
                </span>
                <span
                  className={
                    done
                      ? "text-zinc-200"
                      : pulse
                        ? "text-zinc-200 animate-pulse"
                        : "text-zinc-500"
                  }
                >
                  {label}
                </span>
                {i < PROGRESS_STEPS.length - 1 ? (
                  <span className="mx-0.5 text-zinc-600 sm:mx-1" aria-hidden>
                    →
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Paso 1 — Seleccionar archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onGalleryChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept={GALLERY_ACCEPT}
              className="hidden"
              onChange={onGalleryChange}
            />
            <Button
              type="button"
              variant="secondary"
              className="bg-zinc-800 text-white hover:bg-zinc-700"
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 Tomar foto
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-zinc-800 text-white hover:bg-zinc-700"
              onClick={() => galleryInputRef.current?.click()}
            >
              📁 Galería / archivo
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Imagen (JPG, PNG, WebP, HEIC…) o PDF · máximo 10MB
          </p>

          {uploadError ? <p className="text-sm text-red-400">{uploadError}</p> : null}

          {file ? (
            <div className="rounded-md border border-zinc-700 bg-zinc-900/40 p-3">
              {isPdf ? (
                <div className="flex items-center gap-3 text-zinc-300">
                  <FileText className="h-12 w-12 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium">PDF</p>
                    <p className="text-sm text-zinc-500">{file.name}</p>
                  </div>
                </div>
              ) : previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Factura"
                  width={640}
                  height={360}
                  unoptimized
                  className="max-h-64 w-full rounded-md border border-zinc-700 object-contain"
                />
              ) : null}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void uploadAndOcr()}
            disabled={
              !file ||
              uploadState === "uploading" ||
              uploadState === "extracting" ||
              uploadState === "saving"
            }
            className="bg-black text-white hover:bg-zinc-800"
          >
            {uploadState === "uploading"
              ? "Subiendo imagen ☁️..."
              : uploadState === "extracting"
                ? "Extrayendo datos 🔍..."
                : "☁️ Subir y extraer datos"}
          </Button>
          {(uploadState === "uploading" || uploadState === "extracting") && (
            <p className="text-sm text-zinc-400 animate-pulse">
              {uploadState === "uploading"
                ? "Subiendo imagen ☁️..."
                : "Extrayendo datos 🔍..."}
            </p>
          )}
          {uploadState === "ready" ? (
            <p className="text-sm text-emerald-400">Listo ✅ — revisa los datos abajo</p>
          ) : null}
        </CardContent>
      </Card>

      {ocrHint ? (
        <p className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {ocrHint}
        </p>
      ) : null}

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Paso 2 — Revisar y completar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Imagen en Drive</Label>
            <Input
              readOnly
              value={imagenUrl}
              className="bg-zinc-900 border-zinc-700 font-mono text-xs"
              placeholder="Se llena al subir el archivo"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={toInputDate(fecha)}
              max={maxFechaInput}
              onChange={(e) => {
                const v = e.target.value;
                setFecha(v ? fromInputDate(v) : getTodayDDMMYYYY());
              }}
              className="bg-zinc-900 border-zinc-700 [color-scheme:dark]"
            />
            <p className="text-xs text-zinc-500">Guardado como {fecha || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>

          <div className="space-y-1.5">
            <Label>NIT {!aNombreBia ? <span className="text-zinc-500">(opcional)</span> : null}</Label>
            <Input value={nit} onChange={(e) => setNit(e.target.value)} className="bg-zinc-900 border-zinc-700" />
            {nitBiaWarning ? (
              <p className="text-xs text-amber-300">
                ⚠️ El NIT no coincide con BIA Energy. Verifica la factura.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Factura</Label>
            <Select value={tipoFactura} onValueChange={(value) => setTipoFactura(value || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FACTURA_FIJOS.map((t) => (
                  <SelectItem value={t} key={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Servicio declarado</Label>
            <Select value={servicioDeclarado} onValueChange={(value) => setServicioDeclarado(value || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {SERVICIOS_DECLARADOS.map((t) => (
                  <SelectItem value={t} key={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input
              type="number"
              min={1}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="bg-zinc-900 border-zinc-700"
            />
            <p className="text-xs text-zinc-500">{valorVista}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <Select value={ciudad} onValueChange={(value) => setCiudad(value || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {CIUDADES_FACTURA.map((c) => (
                  <SelectItem value={c} key={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Tipo de operación</Label>
            <RadioGroup
              value={tipoOperacion}
              onValueChange={(v) => setTipoOperacion(String(v ?? ""))}
              className="grid gap-2 sm:max-w-md"
            >
              <RadioGroupItem id={idOpAct} value={TIPOS_OPERACION[0]} label={TIPOS_OPERACION[0]} />
              <RadioGroupItem id={idOpRet} value={TIPOS_OPERACION[1]} label={TIPOS_OPERACION[1]} />
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <Checkbox
                checked={aNombreBia}
                onCheckedChange={(c) => setANombreBia(c === true)}
                className="border-zinc-500"
              />
              <Label className="cursor-pointer text-sm font-normal leading-snug">
                Factura a nombre de BIA Energy SAS ESP (NIT 901.588.413-2)
              </Label>
            </div>
            {aNombreBia ? (
              <Badge className="w-fit border-emerald-700 bg-emerald-950 text-emerald-200">
                ✅ A nombre de BIA
              </Badge>
            ) : (
              <Badge className="w-fit border-amber-700 bg-amber-950 text-amber-200">
                ⚠️ No es a nombre de BIA
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Responsable</Label>
            <Input value={user?.responsable || ""} readOnly className="bg-zinc-900 border-zinc-700 opacity-80" />
          </div>
          <div className="space-y-1.5">
            <Label>Área</Label>
            <Input value={user?.area || ""} readOnly className="bg-zinc-900 border-zinc-700 opacity-80" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Sector</Label>
            <Select value={sectorForm} onValueChange={(value) => setSectorForm(value || "")}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {SECTORES_FACTURA.map((s) => (
                  <SelectItem value={s} key={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}

      <Button
        onClick={() => void saveFactura()}
        disabled={uploadState === "saving" || !imagenUrl.trim()}
        className="w-full bg-black text-white hover:bg-zinc-800"
      >
        {uploadState === "saving" ? "Guardando en hoja..." : "Guardar factura"}
      </Button>
    </div>
  );
}
