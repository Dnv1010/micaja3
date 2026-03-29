"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

type U = { Responsable: string; saldo?: number };

export default function NuevoEnvioPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<U[]>([]);
  const [responsable, setResponsable] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [comprobante, setComprobante] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((j) => setUsuarios(j.data || []));
  }, []);

  async function guardar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Responsable: responsable,
          Monto: monto,
          Fecha: fecha,
          Comprobante: comprobante,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error");
      router.push("/envios");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md pb-8">
      <h1 className="text-2xl font-bold">Nuevo envío</h1>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label>Responsable</Label>
        <Select value={responsable} onValueChange={(v) => setResponsable(v ?? "")}>
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="Seleccione" />
          </SelectTrigger>
          <SelectContent>
            {usuarios.map((u) => (
              <SelectItem key={u.Responsable} value={u.Responsable}>
                {u.Responsable}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Monto (COP)</Label>
        <Input className="min-h-11" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input type="date" className="min-h-11" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>URL comprobante (Drive)</Label>
        <Input className="min-h-11" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Al guardar se crea el envío y automáticamente un registro en Entregas.
      </p>
      <Button size="lg" className="w-full min-h-12" disabled={loading || !responsable} onClick={guardar}>
        Guardar
      </Button>
    </div>
  );
}
