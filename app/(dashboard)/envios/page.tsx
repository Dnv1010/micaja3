import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { EnviosCoordinadorClient } from "@/components/coordinador/envios-coordinador-client";
import { normalizeSector } from "@/lib/sector-normalize";
import { FALLBACK_USERS } from "@/lib/users-fallback";

export default async function EnviosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/");
  const sectorRaw = String(session.user.sector || "");
  const sector = normalizeSector(sectorRaw) ?? sectorRaw;
  const target = normalizeSector(sector);
  const zoneUsers = FALLBACK_USERS.filter((u) => {
    if (u.rol !== "user" || !u.userActive) return false;
    const uCanon = normalizeSector(u.sector);
    return (target !== null && uCanon === target) || (target === null && u.sector === sector.trim());
  });
  return <EnviosCoordinadorClient sector={sector} zoneUsers={zoneUsers} />;
}
