"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFxUrl } from "@/lib/fx-form-config";
import { CheckCircle2, Download, ExternalLink, FileText } from "lucide-react";
import { formatCOP, parseCOPString } from "@/lib/format";

function pdfPreviewUrl(url: string): string {
  const u = url.trim();
  const driveFile = u.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (driveFile?.[1]) {
    return `https://drive.google.com/file/d/${driveFile[1]}/preview`;
  }
  return u;
}

export interface FxReporte {
  ID_Reporte?: string;
  ID?: string;
  Fecha?: string;
  Coordinador?: string;
  Sector?: string;
  Periodo_Desde?: string;
  Periodo_Hasta?: string;
  Total?: string | number;
  Estado?: string;
  PDF_URL?: string;
}

interface EnviarFxModalProps {
  reporte: FxReporte | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (reporteId: string) => void;
}

export default function EnviarFxModal({ reporte, open, onClose, onSuccess }: EnviarFxModalProps) {
  const { data: session } = useSession();
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState({
    empresa: "Bia Energy S.A.S E.S.P",
    nombres: "",
    identificacion: "",
    cargo: "",
    correo: "",
    tipoSolicitud: "Legalización caja menor",
    descripcion: "Legalización gastos",
    departamento: "General Ops",
  });

  useEffect(() => {
    if (!open) {
      setEnviado(false);
    }
  }, [open]);

  useEffect(() => {
    if (session?.user) {
      setCampos((prev) => ({
        ...prev,
        nombres: session.user.responsable || prev.nombres,
        identificacion: session.user.cedula || prev.identificacion,
        cargo: session.user.cargo || prev.cargo,
        correo: session.user.email || prev.correo,
      }));
    }
  }, [session]);

  useEffect(() => {
    if (!open || !reporte) return;
    const desde = String(reporte.Periodo_Desde || "").trim();
    const hasta = String(reporte.Periodo_Hasta || "").trim();
    const totalRaw = reporte.Total;
    const totalNum =
      typeof totalRaw === "number" ? totalRaw : parseCOPString(String(totalRaw ?? ""));
    const periodo = desde && hasta ? `${desde} → ${hasta}` : desde || hasta || "";
    const descripcion =
      periodo || totalNum
        ? `Legalización caja menor${periodo ? ` · ${periodo}` : ""}${totalNum ? ` · Total ${formatCOP(totalNum)}` : ""}`
        : "Legalización gastos";
    setCampos((prev) => ({ ...prev, descripcion }));
  }, [open, reporte]);

  const pdfUrl = String(reporte?.PDF_URL || "").trim();
  const previewSrc = pdfUrl ? pdfPreviewUrl(pdfUrl) : "";
  const fxUrl = useMemo(() => buildFxUrl(campos), [campos]);
  const reporteId = String(reporte?.ID_Reporte || reporte?.ID || "").trim();

  if (!reporte) return null;

  const handleAbrirFormulario = () => {
    window.open(fxUrl, "_blank", "noopener,noreferrer");
  };

  const handleMarcarEnviado = async () => {
    if (!reporteId) {
      window.alert("❌ Reporte sin ID");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/legalizaciones/${encodeURIComponent(reporteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Enviado FX" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(`❌ ${j.error || "No se pudo actualizar el estado"}`);
        return;
      }
      setEnviado(true);
      onSuccess(reporteId);
    } catch {
      window.alert("❌ Error de red al actualizar estado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[98vh] w-[98vw] max-w-5xl overflow-y-auto border border-white/10 bg-[#0f1729] text-white p-5 sm:p-6 text-[15px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 shrink-0 text-cyan-400" />
            Enviar a FX — Legalización
          </DialogTitle>
          <p className="text-sm text-gray-400">
            Reporte {reporteId || "—"} · {reporte.Periodo_Desde || "—"} → {reporte.Periodo_Hasta || "—"}
          </p>
        </DialogHeader>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            PDF del reporte (ya firmado)
          </p>
          {pdfUrl ? (
            <>
              <div className="mb-3 h-[min(50vh,420px)] min-h-[200px] w-full overflow-hidden rounded-md border border-white/10 bg-black/30">
                <iframe
                  title="Vista previa PDF"
                  src={previewSrc}
                  className="h-full w-full border-0"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 truncate rounded bg-white/5 p-2 text-xs text-gray-300">{pdfUrl}</div>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </Button>
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-400">⚠️ No se encontró PDF para este reporte.</p>
          )}
          <p className="mt-2 text-xs text-amber-400">
            ⚠️ Descarga el PDF antes de abrir el formulario; se adjunta manualmente en Google Forms.
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Datos del formulario FX (editables)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs text-gray-400">Empresa</Label>
              <Input
                value={campos.empresa}
                onChange={(e) => setCampos((p) => ({ ...p, empresa: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Nombres y apellidos</Label>
              <Input
                value={campos.nombres}
                onChange={(e) => setCampos((p) => ({ ...p, nombres: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">No. identificación (cédula)</Label>
              <Input
                value={campos.identificacion}
                onChange={(e) => setCampos((p) => ({ ...p, identificacion: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5 text-white"
                placeholder="Sin cédula en perfil — ingresar"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Cargo</Label>
              <Input
                value={campos.cargo}
                onChange={(e) => setCampos((p) => ({ ...p, cargo: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Correo corporativo</Label>
              <Input
                value={campos.correo}
                onChange={(e) => setCampos((p) => ({ ...p, correo: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Tipo de solicitud</Label>
              <Input
                value={campos.tipoSolicitud}
                readOnly
                className="mt-1 cursor-not-allowed border-white/10 bg-white/5 text-white/60"
              />
            </div>

            <div>
              <Label className="text-xs text-gray-400">Breve descripción</Label>
              <Input
                value={campos.descripcion}
                readOnly
                className="mt-1 cursor-not-allowed border-white/10 bg-white/5 text-white/60"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs text-gray-400">Departamento origen del costo/gasto</Label>
              <Input
                value={campos.departamento}
                readOnly
                className="mt-1 cursor-not-allowed border-white/10 bg-white/5 text-white/60"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-300">
          <p className="mb-1 font-semibold">Pasos para enviar:</p>
          <ol className="list-inside list-decimal space-y-1 text-xs text-amber-200">
            <li>Descarga el PDF firmado</li>
            <li>Haz clic en Abrir Google Form (campos de texto prellenados)</li>
            <li>Adjunta el PDF descargado</li>
            <li>Envía el formulario en Google Forms</li>
            <li>Regresa y marca como Enviado</li>
          </ol>
        </div>

        <DialogFooter className="flex gap-2 pt-2">
          {!enviado ? (
            <>
              <Button variant="ghost" onClick={onClose} className="text-gray-400">
                Cancelar
              </Button>
              <Button
                onClick={handleAbrirFormulario}
                disabled={!pdfUrl}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Google Form
              </Button>
              <Button
                onClick={handleMarcarEnviado}
                disabled={loading}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? "Guardando..." : "Marcar como Enviado"}
              </Button>
            </>
          ) : (
            <div className="w-full text-center font-semibold text-emerald-400">
              ✅ ¡Reporte marcado como Enviado FX!
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
