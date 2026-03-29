"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type U = {
  Responsable: string;
  Correos: string;
  Rol: string;
  UserActive: string;
  Area: string;
  Cargo: string;
  Sector: string;
  saldo: number;
  _rowIndex: number;
};

export default function UsuariosPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<{ data: U[]; canManage: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const rows = data?.data || [];
  const activos = rows.filter((u) => String(u.UserActive).toUpperCase() === "TRUE");
  const inactivos = rows.filter((u) => String(u.UserActive).toUpperCase() !== "TRUE");

  function SaldoBadge({ v }: { v: number }) {
    const color =
      v > 0 ? "bg-blue-600 hover:bg-blue-600 text-white" : v < 0 ? "bg-red-600 hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-600 text-white";
    return (
      <Badge className={cn("font-bold gap-1", color)}>
        <CheckCircle2 className="h-3 w-3" />
        {formatCOP(v)}
      </Badge>
    );
  }

  return (
    <div className="space-y-8 pb-8 overflow-x-auto">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <p className="text-sm text-muted-foreground">
        Sesión: {session?.user?.email} — {data?.canManage ? "Puede gestionar filas (Hernán)" : "Solo lectura"}
      </p>

      {[{ label: "Activos", list: activos }, { label: "Inactivos", list: inactivos }].map(({ label, list }) => (
        <div key={label} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">{label}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsable</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead className="hidden md:table-cell">Zona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.Responsable}>
                  <TableCell className="font-medium">{u.Responsable}</TableCell>
                  <TableCell>
                    <SaldoBadge v={u.saldo} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{u.Area || u.Sector}</TableCell>
                  <TableCell className="capitalize">{u.Rol}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{u.Cargo}</TableCell>
                  <TableCell>
                    <Link
                      href={`/usuarios/${encodeURIComponent(u.Responsable)}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      Ver
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
