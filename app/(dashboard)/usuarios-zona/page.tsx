import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UsuariosZonaClient } from "@/components/coordinador/usuarios-zona-client";
import { FALLBACK_USERS } from "@/lib/users-fallback";
import { normalizeSector } from "@/lib/sector-normalize";

export default async function UsuariosZonaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") redirect("/");

  const sectorRaw = String(session.user.sector || "").trim();
  if (!sectorRaw && rol !== "admin") redirect("/");

  let sectorLabel: string;
  let zoneUsers: typeof FALLBACK_USERS;
  if (!sectorRaw && rol === "admin") {
    sectorLabel = "Todas las zonas";
    zoneUsers = [...FALLBACK_USERS];
  } else {
    sectorLabel = normalizeSector(sectorRaw) ?? sectorRaw;
    const target = normalizeSector(sectorRaw);
    zoneUsers = FALLBACK_USERS.filter((u) => {
      const uCanon = normalizeSector(u.sector);
      return (target !== null && uCanon === target) || (target === null && u.sector === sectorRaw);
    });
  }

  return <UsuariosZonaClient sectorLabel={sectorLabel} zoneUsers={zoneUsers} />;
}
