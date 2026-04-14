"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FacturaUploadOcr, type OcrResult } from "./factura-upload-ocr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CENTRO_COSTO_INFO } from "@/lib/format";
import { SERVICIOS_DECLARADOS, TIPOS_FACTURA_FIJOS } from "@/lib/factura-field-options";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { canEditVerificado } from "@/lib/roles";

const SECTORES = ["Costa", "Bogota"] as const;
const CENTROS = ["OPS-Activation", "OPS-Retention"] as const;

export function FacturaForm({
  initial,
  facturaId,
}: {
  initial?: Record<string, string>;
  facturaId?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogos, setCatalogos] = useState<{
    tiposFactura: string[];
    servicios: string[];
    ciudades: string[];
  } | null>(null);

  const [form, setForm] = useState<Record<string, string>>({
    Num_Factura: "",
    Fecha_Factura: "",
    Monto_Factura: "",
    Responsable: session?.user?.responsable || "",
    Tipo_servicio: "",
    Tipo_Factura: "",
    Nit_Factura: "",
    Razon_Social: "",
    Nombre_bia: "No",
    Observacion: "",
    Adjuntar_Factura: "",
    URL: "",
    Legalizado: "Pendiente",
    Verificado: "No",
    Ciudad: "",
    Sector: "Bogota",
    "Centro de Costo": "OPS-Activation",
    ...initial,
  });

  useEffect(() => {
    fetch("/api/catalogos")
      .then((r) => r.json())
      .then(setCatalogos)
      .catch(() => setCatalogos({ tiposFactura: [], servicios: [], ciudades: [] }));
  }, []);

  useEffect(() => {
    const r = session?.user?.responsable;
    if (r) {
      setForm((f) => ({ ...f, Responsable: f.Responsable || r }));
    }
  }, [session?.user?.responsable]);

  const onOcr = (data: OcrResult) => {
    setForm((f) => {
      const tipos = catalogos?.tiposFactura?.length
        ? catalogos.tiposFactura
        : [...TIPOS_FACTURA_FIJOS];
      const servs = catalogos?.servicios?.length ? catalogos.servicios : [...SERVICIOS_DECLARADOS];
      const tipoOk = data.tipo_factura && tipos.includes(data.tipo_factura);
      const servOk = data.servicio_declarado && servs.includes(data.servicio_declarado);
      return {
        ...f,
        Num_Factura: data.num_factura || f.Num_Factura,
        Fecha_Factura: data.fecha_factura || f.Fecha_Factura,
        Monto_Factura: data.monto_factura != null ? String(data.monto_factura) : f.Monto_Factura,
        Nit_Factura: data.nit_factura || f.Nit_Factura,
        Razon_Social: data.razon_social || f.Razon_Social,
        Nombre_bia: data.nombre_bia ? "Si" : "No",
        Observacion: data.descripcion || f.Observacion,
        Adjuntar_Factura: data.image_url || f.Adjuntar_Factura,
        Ciudad: data.ciudad || f.Ciudad,
        Tipo_Factura: tipoOk ? data.tipo_factura! : f.Tipo_Factura,
        Tipo_servicio: servOk ? data.servicio_declarado! : f.Tipo_servicio,
      };
    });
    setError("");
  };

  const adminVerif = session?.user?.rol && canEditVerificado(session.user.rol);
  const ciudadesLista = catalogos?.ciudades || [];
  const ciudadEsOtra = form.Ciudad !== "" && !ciudadesLista.includes(form.Ciudad);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const centro = form["Centro de Costo"];
      const payload = {
        ...form,
        InfoCentroCosto: CENTRO_COSTO_INFO[centro] || "",
      };
      const url = facturaId ? `/api/facturas/${facturaId}` : "/api/facturas";
      const res = await fetch(url, {
        method: facturaId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error al guardar");
      router.push("/facturas");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-lg mx-auto">
      {!facturaId && (
        <FacturaUploadOcr
          sector={form.Sector || session?.user?.sector || "Bogota"}
          responsable={form.Responsable || session?.user?.responsable || ""}
          fechaCarpeta={form.Fecha_Factura}
          onOcrComplete={onOcr}
          onError={setError}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="Num_Factura">Número de factura</Label>
          <Input
            id="Num_Factura"
            value={form.Num_Factura}
            onChange={(e) => setForm({ ...form, Num_Factura: e.target.value })}
            required
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="Fecha_Factura">Fecha</Label>
          <Input
            id="Fecha_Factura"
            type="date"
            value={form.Fecha_Factura?.slice(0, 10)}
            onChange={(e) => setForm({ ...form, Fecha_Factura: e.target.value })}
            required
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="Monto_Factura">Monto (COP)</Label>
          <Input
            id="Monto_Factura"
            inputMode="decimal"
            value={form.Monto_Factura}
            onChange={(e) => setForm({ ...form, Monto_Factura: e.target.value })}
            required
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>NIT factura</Label>
          <Input
            value={form.Nit_Factura}
            onChange={(e) => setForm({ ...form, Nit_Factura: e.target.value })}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Razón social</Label>
          <Input
            value={form.Razon_Social}
            onChange={(e) => setForm({ ...form, Razon_Social: e.target.value })}
            className="min-h-11"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="nb"
            checked={form.Nombre_bia === "Si"}
            onCheckedChange={(c) => setForm({ ...form, Nombre_bia: c ? "Si" : "No" })}
          />
          <Label htmlFor="nb">A nombre de BIA Energy</Label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Tipo de servicio</Label>
          <Select
            value={form.Tipo_servicio}
            onValueChange={(v) => setForm({ ...form, Tipo_servicio: v ?? "" })}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {(catalogos?.servicios || []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Tipo de factura</Label>
          <Select
            value={form.Tipo_Factura}
            onValueChange={(v) => setForm({ ...form, Tipo_Factura: v ?? "" })}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {(catalogos?.tiposFactura || []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── CIUDAD con opción "Otra" ── */}
        <div className="space-y-2 sm:col-span-2">
          <Label>Ciudad</Label>
          <Select
            value={ciudadEsOtra ? "otra" : form.Ciudad}
            onValueChange={(v) => {
              if (v === "otra") setForm({ ...form, Ciudad: "" });
              else setForm({ ...form, Ciudad: v ?? "" });
            }}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {ciudadesLista.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              <SelectItem value="otra">✏️ Otra ciudad...</SelectItem>
            </SelectContent>
          </Select>
          {ciudadEsOtra || (form.Ciudad === "" && catalogos !== null && ciudadesLista.length > 0 && !ciudadesLista.includes(form.Ciudad)) ? (
            ciudadEsOtra ? (
              <Input
                placeholder="Escribe la ciudad"
                value={form.Ciudad}
                onChange={(e) => setForm({ ...form, Ciudad: e.target.value })}
                className="mt-2 min-h-11"
                autoFocus
              />
            ) : null
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Sector</Label>
          <Select
            value={form.Sector}
            onValueChange={(v) => setForm({ ...form, Sector: v ?? "" })}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTORES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Centro de costo</Label>
          <Select
            value={form["Centro de Costo"]}
            onValueChange={(v) => setForm({ ...form, "Centro de Costo": v ?? "" })}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CENTROS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {CENTRO_COSTO_INFO[form["Centro de Costo"]] || ""}
        </p>
        <div className="space-y-2 sm:col-span-2">
          <Label>URL adjunta (Drive)</Label>
          <Input
            value={form.Adjuntar_Factura}
            onChange={(e) => setForm({ ...form, Adjuntar_Factura: e.target.value })}
            className="min-h-11 text-sm"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Observación</Label>
          <Textarea
            value={form.Observacion}
            onChange={(e) => setForm({ ...form, Observacion: e.target.value })}
            rows={3}
          />
        </div>
        {adminVerif && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Verificado</Label>
            <Select
              value={form.Verificado}
              onValueChange={(v) => setForm({ ...form, Verificado: v ?? "" })}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Si">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full min-h-12 text-base" disabled={loading}>
        {loading ? "Guardando…" : "Guardar factura"}
      </Button>
    </form>
  );
}