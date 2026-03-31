"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCOP } from "@/lib/format";

type OcrData = {
  fecha_factura?: string | null;
  razon_social?: string | null;
  nit_factura?: string | null;
  descripcion?: string | null;
  monto_factura?: string | null;
  image_url?: string | null;
};

export default function NuevaFacturaPage() {
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [tipos, setTipos] = useState<string[]>([]);

  const [fecha, setFecha] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [nit, setNit] = useState("");
  const [concepto, setConcepto] = useState("");
  const [valor, setValor] = useState("");
  const [tipoFactura, setTipoFactura] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");

  useEffect(() => {
    fetch("/api/catalogos?tab=TipoFactura")
      .then((r) => r.json())
      .then((j) => setTipos(Array.isArray(j.data) ? j.data : []))
      .catch(() => setTipos([]));
  }, []);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (!selected) {
      setPreviewUrl("");
      return;
    }
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function extractOcr() {
    if (!file) return;
    setLoadingOcr(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/ocr/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          base64,
        }),
      });
      const json = await res.json().catch(() => ({ data: {} as OcrData }));
      const d = (json?.data || {}) as OcrData;
      setFecha(d.fecha_factura || "");
      setProveedor(d.razon_social || "");
      setNit(d.nit_factura || "");
      setConcepto(d.descripcion || "");
      setValor(String(d.monto_factura || "").replace(/[^\d]/g, ""));
      setImagenUrl(d.image_url || "");
    } catch {
      // Si OCR falla, se dejan campos manuales.
    } finally {
      setLoadingOcr(false);
    }
  }

  async function saveFactura() {
    if (!user) return;
    setLoadingSave(true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          proveedor,
          nit,
          concepto,
          valor,
          tipoFactura,
          responsable: user.responsable || "",
          area: user.area || "",
          sector: user.sector || "",
          imagenUrl: imagenUrl || "",
        }),
      });
      if (res.ok) {
        router.push("/facturas?saved=1");
      }
    } finally {
      setLoadingSave(false);
    }
  }

  const valorVista = useMemo(() => formatCOP(Number(valor || "0")), [valor]);

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader><CardTitle>Paso 1 · Subir imagen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={onFileChange} />
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Factura"
              width={640}
              height={360}
              unoptimized
              className="max-h-64 w-full rounded-md border border-zinc-700 object-contain"
            />
          ) : null}
          <Button onClick={extractOcr} disabled={!file || loadingOcr} className="bg-black text-white hover:bg-zinc-800">
            {loadingOcr ? "Leyendo factura..." : "Extraer datos con OCR →"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader><CardTitle>Paso 2 · Revisar y completar</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Fecha</Label><Input placeholder="DD/MM/YYYY" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Proveedor</Label><Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>NIT</Label><Input value={nit} onChange={(e) => setNit(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Concepto</Label><Input value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
            <p className="text-xs text-zinc-500">{valorVista}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Factura</Label>
            <Select value={tipoFactura} onValueChange={(value) => setTipoFactura(value || "")}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t) => <SelectItem value={t} key={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Responsable</Label><Input value={user?.responsable || ""} readOnly /></div>
          <div className="space-y-1.5"><Label>Area</Label><Input value={user?.area || ""} readOnly /></div>
          <div className="space-y-1.5"><Label>Sector</Label><Input value={user?.sector || ""} readOnly /></div>
        </CardContent>
      </Card>

      <Button onClick={saveFactura} disabled={loadingSave} className="w-full bg-black text-white hover:bg-zinc-800">
        {loadingSave ? "Guardando..." : "Guardar factura"}
      </Button>
    </div>
  );
}
