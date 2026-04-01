"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CIUDADES_FACTURA,
  SERVICIOS_DECLARADOS,
  SECTORES_FACTURA,
  TIPOS_FACTURA_FIJOS,
  TIPOS_OPERACION,
} from "@/lib/factura-field-options";
import { getCellCaseInsensitive } from "@/lib/sheet-cell";
import { sheetANombreBiaTrue } from "@/lib/nueva-factura-validation";

type FacturaItem = Record<string, unknown>;

function fechaRowToDDMM(f: FacturaItem): string {
  const raw = getCellCaseInsensitive(f, "Fecha", "Fecha_Factura");
  const t = raw.trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return t;
}

export function FacturaEditDialog({
  factura,
  open,
  onOpenChange,
  onSaved,
}: {
  factura: FacturaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [nit, setNit] = useState("");
  const [numFactura, setNumFactura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [tipoFactura, setTipoFactura] = useState("");
  const [servicioDeclarado, setServicioDeclarado] = useState("");
  const [tipoOperacion, setTipoOperacion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [sector, setSector] = useState("");
  const [aNombreBia, setANombreBia] = useState(false);
  const [imagenUrl, setImagenUrl] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!factura || !open) return;
    setFecha(fechaRowToDDMM(factura));
    setProveedor(getCellCaseInsensitive(factura, "Proveedor", "Razon_Social"));
    setNit(getCellCaseInsensitive(factura, "NIT", "Nit_Factura"));
    setNumFactura(getCellCaseInsensitive(factura, "NumFactura", "Num_Factura"));
    setConcepto(getCellCaseInsensitive(factura, "Concepto", "Observacion"));
    setValor(getCellCaseInsensitive(factura, "Valor", "Monto_Factura"));
    setTipoFactura(getCellCaseInsensitive(factura, "TipoFactura", "Tipo_Factura"));
    setServicioDeclarado(getCellCaseInsensitive(factura, "ServicioDeclarado", "Tipo_servicio"));
    setTipoOperacion(getCellCaseInsensitive(factura, "OPS", "TipoOperacion"));
    setCiudad(getCellCaseInsensitive(factura, "Ciudad"));
    setSector(getCellCaseInsensitive(factura, "Sector") || "Bogota");
    setANombreBia(sheetANombreBiaTrue(getCellCaseInsensitive(factura, "ANombreBia", "Nombre_bia")));
    setImagenUrl(getCellCaseInsensitive(factura, "ImagenURL", "URL", "Adjuntar_Factura"));
    setDriveFileId(getCellCaseInsensitive(factura, "DriveFileId"));
    setError("");
  }, [factura, open]);

  async function guardar() {
    if (!factura) return;
    const id = getCellCaseInsensitive(factura, "ID_Factura", "ID");
    if (!id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fecha.trim(),
          proveedor: proveedor.trim(),
          nit: nit.trim(),
          numFactura: numFactura.trim(),
          concepto: concepto.trim(),
          valor: valor.trim(),
          tipoFactura,
          servicioDeclarado,
          tipoOperacion,
          aNombreBia,
          ciudad,
          sector,
          imagenUrl: imagenUrl.trim(),
          driveFileId: driveFileId.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "No se pudo guardar");
      onOpenChange(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-bia-blue-mid text-white ring-bia-gray/40 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar factura</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label>Fecha (DD/MM/YYYY)</Label>
            <Input value={fecha} onChange={(e) => setFecha(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Proveedor</Label>
            <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>NIT</Label>
            <Input value={nit} onChange={(e) => setNit(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Número de factura</Label>
            <Input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Concepto</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Valor (COP)</Label>
            <Input type="number" min={1} value={valor} onChange={(e) => setValor(e.target.value)} className="bg-bia-blue border-bia-gray/40" />
          </div>
          <div className="space-y-1">
            <Label>Tipo de factura</Label>
            <Select value={tipoFactura} onValueChange={(v) => setTipoFactura(v || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FACTURA_FIJOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Servicio declarado</Label>
            <Select value={servicioDeclarado} onValueChange={(v) => setServicioDeclarado(v || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {SERVICIOS_DECLARADOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo de operación</Label>
            <Select value={tipoOperacion} onValueChange={(v) => setTipoOperacion(v || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_OPERACION.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ciudad</Label>
            <Select value={ciudad} onValueChange={(v) => setCiudad(v || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {CIUDADES_FACTURA.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sector</Label>
            <Select value={sector} onValueChange={(v) => setSector(v || "")}>
              <SelectTrigger className="bg-bia-blue border-bia-gray/40">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {SECTORES_FACTURA.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>URL imagen (Drive)</Label>
            <Input value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} className="bg-bia-blue border-bia-gray/40 text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Drive file ID</Label>
            <Input value={driveFileId} onChange={(e) => setDriveFileId(e.target.value)} className="bg-bia-blue border-bia-gray/40 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="fe-bia" checked={aNombreBia} onCheckedChange={(c) => setANombreBia(Boolean(c))} />
            <Label htmlFor="fe-bia">A nombre de BIA</Label>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-bia-gray/20 bg-bia-blue-mid sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-bia-gray/30">
            Cancelar
          </Button>
          <Button type="button" className="bg-emerald-700 text-white hover:bg-emerald-600" disabled={saving} onClick={() => void guardar()}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
