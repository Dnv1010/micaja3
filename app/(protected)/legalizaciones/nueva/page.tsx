"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { FacturaRow } from "@/types/models";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NuevaLegalizacionPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [facturas, setFacturas] = useState<FacturaRow[]>([]);
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/facturas")
      .then((r) => r.json())
      .then((j) => setFacturas(j.data || []));
  }, []);

  const pendientes = facturas.filter((f) => f.Legalizado === "Pendiente");

  async function guardar() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/legalizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ID_Factura: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error");
      router.push("/legalizaciones");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md pb-8">
      <h1 className="text-2xl font-bold">Nueva legalización</h1>
      <p className="text-sm text-muted-foreground">
        Usuario: <strong>{session?.user?.responsable}</strong>
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label>Factura pendiente</Label>
        <Select value={id} onValueChange={(v) => setId(v ?? "")}>
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="Seleccione factura" />
          </SelectTrigger>
          <SelectContent>
            {pendientes.map((f) => (
              <SelectItem key={f.ID_Factura} value={f.ID_Factura}>
                {f.Num_Factura} — {f.Monto_Factura} COP
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="lg" className="w-full min-h-12" disabled={loading || !id} onClick={guardar}>
        Guardar
      </Button>
    </div>
  );
}
