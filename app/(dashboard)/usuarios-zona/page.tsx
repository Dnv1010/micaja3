import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UsuariosZonaClient } from "@/components/coordinador/usuarios-zona-client";
import { normalizeSector } from "@/lib/sector-normalize";

export default async function UsuariosZonaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") redirect("/");

  const sectorRaw = String(session.user.sector || "").trim();
  if (!sectorRaw && rol !== "admin") redirect("/");

  let sectorLabel: string;
  let sectorFilter: string | null;
  if (!sectorRaw && rol === "admin") {
    sectorLabel = "Todas las zonas";
    sectorFilter = null;
  } else {
    sectorLabel = normalizeSector(sectorRaw) ?? sectorRaw;
    sectorFilter = normalizeSector(sectorRaw) ?? sectorRaw;
  }

  return <UsuariosZonaClient sectorLabel={sectorLabel} sectorFilter={sectorFilter} />;
}
