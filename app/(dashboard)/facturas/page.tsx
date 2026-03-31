"use client";

import { useSession } from "next-auth/react";
import { FacturasCoordinadorClient } from "@/components/coordinador/facturas-coordinador-client";
import { FacturasUsuarioClient } from "@/components/coordinador/facturas-usuario-client";

export default function FacturasPage() {
  const { data, status } = useSession();
  if (status === "loading") {
    return <p className="text-sm text-zinc-400">Cargando...</p>;
  }
  const rol = String(data?.user?.rol || "user").toLowerCase();
  if (rol === "coordinador") return <FacturasCoordinadorClient />;
  if (rol === "admin") return <FacturasCoordinadorClient admin />;
  return <FacturasUsuarioClient />;
}
