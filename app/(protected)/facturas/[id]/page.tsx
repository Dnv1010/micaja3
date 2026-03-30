"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCOP, formatDateDDMMYYYY, parseCOPString } from "@/lib/format";
import type { FacturaRow } from "@/types/models";
import { cn } from "@/lib/utils";
import {
  facturaConcepto,
  facturaEstado,
  facturaFecha,
  facturaImagenUrl,
  facturaNit,
  facturaNumero,
  facturaProveedor,
  facturaResponsable,
  facturaTipo,
  facturaValor,
  facturaVerificado,
} from "@/lib/row-fields";

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

  const img = facturaImagenUrl(row);

  return (
    <div className="space-y-6 max-w-lg pb-8">
      <h1 className="text-2xl font-bold">Factura {facturaNumero(row) || id}</h1>
      <dl className="grid gap-2 text-sm">
        <dt className="text-muted-foreground">Fecha</dt>
        <dd>{formatDateDDMMYYYY(facturaFecha(row))}</dd>
        <dt className="text-muted-foreground">Proveedor</dt>
        <dd>{facturaProveedor(row) || "—"}</dd>
        <dt className="text-muted-foreground">NIT</dt>
        <dd>{facturaNit(row) || "—"}</dd>
        <dt className="text-muted-foreground">Concepto</dt>
        <dd>{facturaConcepto(row) || "—"}</dd>
        <dt className="text-muted-foreground">Tipo</dt>
        <dd>{facturaTipo(row) || "—"}</dd>
        <dt className="text-muted-foreground">Monto</dt>
        <dd className="text-xl font-bold">{formatCOP(parseCOPString(facturaValor(row) || "0"))}</dd>
        <dt className="text-muted-foreground">Responsable</dt>
        <dd>{facturaResponsable(row)}</dd>
        <dt className="text-muted-foreground">Estado / Legalizado</dt>
        <dd>{facturaEstado(row) || row.Legalizado || "—"}</dd>
        <dt className="text-muted-foreground">Verificado</dt>
        <dd>{facturaVerificado(row) || row.Verificado || "—"}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/facturas/${encodeURIComponent(id)}/editar`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
        >
          Editar
        </Link>
        {img && (
          <a
            href={img}
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
