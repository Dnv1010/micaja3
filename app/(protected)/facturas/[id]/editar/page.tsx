"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FacturaForm } from "@/components/facturas/factura-form";
import type { FacturaRow } from "@/types/models";

export default function EditarFacturaPage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [initial, setInitial] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch(`/api/facturas/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j.data as FacturaRow;
        if (!d) return;
        const { _rowIndex, ...rest } = d;
        void _rowIndex;
        const flat: Record<string, string> = {};
        Object.entries(rest).forEach(([k, v]) => {
          flat[k] = String(v ?? "");
        });
        setInitial(flat);
      });
  }, [id]);

  if (!initial) return <p className="text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold">Editar factura</h1>
      <FacturaForm facturaId={id} initial={initial} />
    </div>
  );
}
