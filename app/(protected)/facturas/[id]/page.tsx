"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCOP, formatDateDisplay } from "@/lib/format";
import type { FacturaRow } from "@/types/models";
import { cn } from "@/lib/utils";

function parseMonto(s: string): number {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function FacturaDetallePage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const router = useRouter();
  const [row, setRow] = useState<FacturaRow | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/facturas/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Error");
        setRow(j.data);
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  async function eliminar() {
    if (!confirm("¿Eliminar esta factura?")) return;
    const res = await fetch(`/api/facturas/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Error");
      return;
    }
    router.push("/facturas");
  }

  if (err) return <p className="text-destructive">{err}</p>;
  if (!row) return <p className="text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6 max-w-lg pb-8">
      <h1 className="text-2xl font-bold">Factura {row.Num_Factura}</h1>
      <dl className="grid gap-2 text-sm">
        <dt className="text-muted-foreground">Fecha</dt>
        <dd>{formatDateDisplay(row.Fecha_Factura)}</dd>
        <dt className="text-muted-foreground">Monto</dt>
        <dd className="text-xl font-bold">{formatCOP(parseMonto(row.Monto_Factura))}</dd>
        <dt className="text-muted-foreground">Responsable</dt>
        <dd>{row.Responsable}</dd>
        <dt className="text-muted-foreground">Legalizado</dt>
        <dd>{row.Legalizado}</dd>
        <dt className="text-muted-foreground">Verificado</dt>
        <dd>{row.Verificado}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/facturas/${encodeURIComponent(id)}/editar`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
        >
          Editar
        </Link>
        {row.Adjuntar_Factura && (
          <a
            href={row.Adjuntar_Factura}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
          >
            Descargar / ver imagen
          </a>
        )}
        <Button variant="destructive" size="lg" className="min-h-11" type="button" onClick={eliminar}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}
