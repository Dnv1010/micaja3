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
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import { isFechaFacturaFutura, parseFechaFacturaDDMMYYYY } from "@/lib/nueva-factura-validation";

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
  num_factura?: string | null;
  descripcion?: string | null;
  monto_factura?: number | null;
  image_url?: string | null;
  message?: string | null;
  nombre_bia?: boolean | null;
  ciudad?: string | null;
  tipo_factura?: string | null;
  servicio_declarado?: string | null;
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
  const [numFactura, setNumFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [tipoFactura, setTipoFactura] = useState("");
  const [servicioDeclarado, setServicioDeclarado] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [sectorForm, setSectorForm] = useState("");
  const [aNombreBia, setANombreBia] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [duplicada, setDuplicada] = useState(false);
  const [responsableTarget, setResponsableTarget] = useState("");
  const [usuariosZona, setUsuariosZona] = useState<
    { responsable: string; cargo: string; email: string }[]
  >([]);

  const sessionSector = String(user?.sector || "");
  const rol = String(user?.rol || "user").toLowerCase();

  useEffect(() => {
    if (rol !== "coordinador" && rol !== "admin") return;
    const url =
      rol === "admin"
        ? "/api/usuarios?rol=user"
        : `/api/usuarios?sector=${encodeURIComponent(sessionSector)}&rol=user`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = Array.isArray(d.data) ? d.data : [];
        const list: { responsable: string; cargo: string; email: string }[] = [];
        for (const row of rows) {
          const rec = row as Record<string, unknown>;
          const responsable = String(getCellCaseInsensitive(rec, "Responsable") || "").trim();
          const email = String(getCellCaseInsensitive(rec, "Correos", "Correo", "Email") || "").trim();
          if (!responsable || !email) continue;
          list.push({
            responsable,
            email,
            cargo: String(getCellCaseInsensitive(rec, "Cargo") || "").trim(),
          });
        }
        list.sort((a, b) => a.responsable.localeCompare(b.responsable, "es"));
        setUsuariosZona(list);
      })
      .catch(() => {
        if (!cancelled) setUsuariosZona([]);
      });
    return () => {
      cancelled = true;
    };
  }, [rol, sessionSector]);

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

  useEffect(() => {
    const def = String(user?.responsable || user?.name || "").trim();
    if (!def) return;
    setResponsableTarget((prev) => (prev ? prev : def));
  }, [user?.responsable, user?.name]);

  useEffect(() => {
    setDuplicada(false);
    setSaveError("");
  }, [nit, numFactura]);

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
      let fileToProcess = file;
      if (file.type === "application/pdf") {
        if (typeof window === "undefined") throw new Error("Conversión PDF no disponible en servidor.");
        const { base64ToFile, pdfToJpgPages } = await import("@/lib/pdf-to-jpg");
        const pages = await pdfToJpgPages(file);
        if (!pages.length) throw new Error("No se pudo convertir el PDF.");
        resetPreview();
        const previewBlob = base64ToFile(pages[0], file.name.replace(/\.pdf$/i, ".jpg"));
        setPreviewUrl(URL.createObjectURL(previewBlob));
        fileToProcess = base64ToFile(pages[0], file.name.replace(/\.pdf$/i, ".jpg"));
      }

      const formUp = new FormData();
      formUp.append("file", fileToProcess);
      formUp.append("sector", sessionSector);
      formUp.append("responsable", responsableTarget || String(user?.responsable || ""));
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
          mimeType: fileToProcess.type,
          filename: fileToProcess.name,
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
        if (d.ciudad && (CIUDADES_FACTURA as readonly string[]).includes(d.ciudad)) {
          setCiudad(d.ciudad);
        }
        if (d.tipo_factura && (TIPOS_FACTURA_FIJOS as readonly string[]).includes(d.tipo_factura)) {
          setTipoFactura(d.tipo_factura);
        }
        if (
          d.servicio_declarado &&
          (SERVICIOS_DECLARADOS as readonly string[]).includes(d.servicio_declarado)
        ) {
          setServicioDeclarado(d.servicio_declarado);
        }
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
    if (!responsableTarget.trim()) {
      setSaveError("Seleccione o confirme el responsable.");
      return;
    }
    const localErr = validateLocal();
    if (localErr) {
      setSaveError(localErr);
      return;
    }
    setSaveError("");
    setDuplicada(false);
    setUploadState("saving");
    try {
      const body = {
        fecha: fecha.trim(),
        proveedor: proveedor.trim(),
        nit: nit.trim(),
        numFactura: numFactura.trim(),
        concepto: concepto.trim(),
        valor: String(valor).trim(),
        tipoFactura,
        servicioDeclarado,
        tipoOperacion,
        aNombreBia,
        ciudad,
        sector: sectorForm,
        responsable: responsableTarget.trim(),
        area: String(user.area || ""),
        imagenUrl: imagenUrl.trim(),
        driveFileId: driveFileId.trim(),
      };
      // eslint-disable-next-line no-console -- depuración envío POST facturas
      console.log("guardando factura:", body);
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        duplicada?: boolean;
        estadoInicial?: string;
      };
      if (res.status === 409 && j.duplicada) {
        setDuplicada(true);
        setSaveError(typeof j.error === "string" ? j.error : "Esta factura ya está registrada.");
        setUploadState("ready");
        return;
      }
      if (!res.ok) {
        throw new Error(j.error || "No se pudo guardar en la hoja. Revisa los datos e intenta de nuevo.");
      }
      setUploadState("done");
      const auto =
        String(j.estadoInicial || "").toLowerCase() === "aprobada" ? "aprobada" : "pendiente";
      router.push(`/facturas?saved=1&auto=${encodeURIComponent(auto)}`);
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
      <div className="rounded-lg border border-bia-gray/25 bg-bia-blue/50 p-4">
        <p className="mb-3 text-xs font-medium text-bia-gray-light">Progreso</p>
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
                        : "text-bia-gray"
                  }
                >
                  {done ? "●" : "○"}
                </span>
                <span
                  className={
                    done
                      ? "text-white"
                      : pulse
                        ? "text-white animate-pulse"
                        : "text-bia-gray"
                  }
                >
                  {label}
                </span>
                {i < PROGRESS_STEPS.length - 1 ? (
                  <span className="mx-0.5 text-bia-gray sm:mx-1" aria-hidden>
                    →
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
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
              className="bg-bia-blue-mid text-white hover:bg-bia-gray/25"
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 Tomar foto
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-bia-blue-mid text-white hover:bg-bia-gray/25"
              onClick={() => galleryInputRef.current?.click()}
            >
              📁 Galería / archivo
            </Button>
          </div>
          <p className="text-xs text-bia-gray">
            Imagen (JPG, PNG, WebP, HEIC…) o PDF · máximo 10MB
          </p>

          {uploadError ? <p className="text-sm text-red-400">{uploadError}</p> : null}

          {file ? (
            <div className="rounded-md border border-bia-gray/40 bg-bia-blue/40 p-3">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Factura"
                  width={640}
                  height={360}
                  unoptimized
                  className="max-h-64 w-full rounded-md border border-bia-gray/40 object-contain"
                />
              ) : isPdf ? (
                <div className="flex items-center gap-3 text-bia-gray-light">
                  <FileText className="h-12 w-12 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium">PDF</p>
                    <p className="text-sm text-bia-gray">{file.name}</p>
                  </div>
                </div>
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
            className="bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid"
          >
            {uploadState === "uploading"
              ? "Subiendo imagen ☁️..."
              : uploadState === "extracting"
                ? "Extrayendo datos 🔍..."
                : "☁️ Subir y extraer datos"}
          </Button>
          {(uploadState === "uploading" || uploadState === "extracting") && (
            <p className="text-sm text-bia-gray-light animate-pulse">
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

      <Card className="border-bia-gray/20 bg-bia-blue-mid text-white">
        <CardHeader>
          <CardTitle>Paso 2 — Revisar y completar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Imagen en Drive</Label>
            <Input
              readOnly
              value={imagenUrl}
              className="bg-bia-blue border-bia-gray/40 font-mono text-xs"
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
              className="bg-bia-blue border-bia-gray/40 [color-scheme:dark]"
            />
            <p className="text-xs text-bia-gray">Guardado como {fecha || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Input
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className="bg-bia-blue border-bia-gray/40"
            />
          </div>

          <div className="space-y-1.5">
            <Label>NIT {!aNombreBia ? <span className="text-bia-gray">(opcional)</span> : null}</Label>
            <Input value={nit} onChange={(e) => setNit(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1.5">
            <Label>Número de Factura</Label>
            <Input
              value={numFactura}
              onChange={(e) => setNumFactura(e.target.value)}
              placeholder="Ej: FEV3418"
              className="bg-bia-blue border-bia-gray/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Factura</Label>
            <Select value={tipoFactura} onValueChange={(value) => setTipoFactura(value || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
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
              className="bg-bia-blue border-bia-gray/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Servicio declarado</Label>
            <Select value={servicioDeclarado} onValueChange={(value) => setServicioDeclarado(value || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
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
              className="bg-bia-blue border-bia-gray/40"
            />
            <p className="text-xs text-bia-gray">{valorVista}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <Select value={ciudad} onValueChange={(value) => setCiudad(value || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
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
                className="border-bia-gray"
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
            {rol === "coordinador" || rol === "admin" ? (
              <Select
                value={responsableTarget}
                onValueChange={(v) => setResponsableTarget(v || "")}
              >
                <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                  <SelectValue placeholder="Seleccionar responsable" />
                </SelectTrigger>
                <SelectContent>
                  {user?.responsable ? (
                    <SelectItem value={String(user.responsable)}>
                      {user.responsable} (yo)
                    </SelectItem>
                  ) : null}
                  {usuariosZona
                    .filter((u) => u.responsable !== user?.responsable)
                    .map((u) => (
                      <SelectItem value={u.responsable} key={u.email}>
                        {u.responsable} — {u.cargo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={responsableTarget}
                readOnly
                className="bg-bia-blue border-bia-gray/40 opacity-80"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Área</Label>
            <Input value={user?.area || ""} readOnly className="bg-bia-blue border-bia-gray/40 opacity-80" />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Sector</Label>
            <Select value={sectorForm} onValueChange={(value) => setSectorForm(value || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
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

      {duplicada ? (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <span className="text-lg text-yellow-400" aria-hidden>
            ⚠
          </span>
          <div>
            <p className="text-sm font-semibold text-yellow-400">Factura duplicada</p>
            <p className="mt-1 text-xs text-yellow-300">{saveError}</p>
          </div>
        </div>
      ) : saveError ? (
        <p className="text-sm text-red-400">{saveError}</p>
      ) : null}

      <Button
        onClick={() => void saveFactura()}
        disabled={uploadState === "saving" || !imagenUrl.trim() || duplicada}
        className={
          duplicada
            ? "w-full cursor-not-allowed bg-[#525A72]/30 text-[#525A72] hover:bg-[#525A72]/30"
            : "w-full bg-bia-aqua text-bia-blue font-semibold hover:bg-bia-blue-mid"
        }
      >
        {uploadState === "saving"
          ? "Guardando en hoja..."
          : duplicada
            ? "Factura ya registrada"
            : "Guardar factura"}
      </Button>
    </div>
  );
}
