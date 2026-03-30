"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UsuarioRow } from "@/types/models";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { coordinadorAssignableUsers } from "@/lib/roles";
import type { SessionCtx } from "@/lib/roles";

export default function NuevaEntregaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [responsable, setResponsable] = useState("");
  const [fecha, setFecha] = useState("");
  const [monto, setMonto] = useState("");
  const [obs, setObs] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const rol = (session?.user?.rol || "user").toLowerCase();
  const can = rol === "admin" || rol === "coordinador";

  useEffect(() => {
    if (!can) return;
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((j) => setUsuarios(j.data || []));
  }, [can]);

  const ctx: SessionCtx | null = session?.user?.email
    ? {
        email: session.user.email,
        rol: session.user.rol || "user",
        responsable: session.user.responsable || "",
        area: session.user.area || "",
        sector: session.user.sector || "",
      }
    : null;

  const lista =
    rol === "admin"
      ? usuarios.filter((u) => {
          const v = (u.UserActive || "").toUpperCase();
          return v === "TRUE" || v === "SI" || v === "SÍ";
        })
      : ctx
        ? coordinadorAssignableUsers(usuarios, ctx)
        : [];

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/entregas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Responsable: responsable,
          Fecha: fecha || undefined,
          Monto: monto,
          Observaciones: obs,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Error al guardar");
      router.push("/entregas");
    } catch (er: unknown) {
      setErr(er instanceof Error ? er.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!can) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No tienes permiso para crear entregas.</p>
        <Link href="/entregas" className={cn(buttonVariants({ variant: "outline" }))}>
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Nueva entrega</h1>
        <Link href="/entregas" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Volver
        </Link>
      </div>
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={guardar} className="space-y-4">
        <div className="space-y-2">
          <Label>Responsable</Label>
          <Select value={responsable} onValueChange={(v) => setResponsable(v ?? "")} required>
            <SelectTrigger className="min-h-11">
              <SelectValue placeholder="Seleccione usuario activo" />
            </SelectTrigger>
            <SelectContent>
              {lista.map((u) => (
                <SelectItem key={u.Responsable} value={u.Responsable}>
                  {u.Responsable}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input type="date" className="min-h-11" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Monto (COP)</Label>
          <Input
            className="min-h-11"
            placeholder="ej. 500000"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Input className="min-h-11" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full min-h-12" disabled={loading}>
          {loading ? "Guardando…" : "Guardar en hoja Entregas"}
        </Button>
      </form>
    </div>
  );
}
