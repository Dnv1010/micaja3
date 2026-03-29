"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mail, Phone } from "lucide-react";
import { formatCOP } from "@/lib/format";

type U = {
  Responsable: string;
  Correos: string;
  Telefono: string;
  Rol: string;
  Area: string;
  Cargo: string;
  Sector: string;
  Cedula: string;
  saldo?: number;
};

export default function UsuarioDetallePage() {
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [u, setU] = useState<U | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((j) => {
        const found = (j.data || []).find((x: U) => x.Responsable === id);
        setU(found || null);
      });
  }, [id]);

  if (!u) return <p className="text-muted-foreground">Cargando o no encontrado…</p>;

  const tel = (u.Telefono || "").replace(/\D/g, "");

  return (
    <div className="space-y-6 max-w-lg pb-8">
      <Link href="/usuarios" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← Volver
      </Link>
      <h1 className="text-2xl font-bold">{u.Responsable}</h1>
      {u.saldo != null && (
        <p className="text-lg font-semibold tabular-nums">Saldo: {formatCOP(u.saldo)}</p>
      )}
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${u.Correos}`} className="text-primary underline">
            {u.Correos}
          </a>
        </div>
        {u.Telefono && (
          <div className="flex flex-wrap gap-2 items-center">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${tel}`} className="text-primary underline">
              {u.Telefono}
            </a>
            <a
              href={`sms:${tel}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              SMS
            </a>
          </div>
        )}
        <p>
          <span className="text-muted-foreground">Rol:</span> {u.Rol}
        </p>
        <p>
          <span className="text-muted-foreground">Área:</span> {u.Area}
        </p>
        <p>
          <span className="text-muted-foreground">Sector:</span> {u.Sector}
        </p>
        <p>
          <span className="text-muted-foreground">Cargo:</span> {u.Cargo}
        </p>
        <p>
          <span className="text-muted-foreground">Cédula:</span> {u.Cedula}
        </p>
      </div>
    </div>
  );
}
