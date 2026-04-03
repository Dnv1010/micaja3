import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { EnviosCoordinadorClient } from "@/components/coordinador/envios-coordinador-client";
import { normalizeSector } from "@/lib/sector-normalize";

export default async function EnviosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/");
  const sectorRaw = String(session.user.sector || "");
  const sector = normalizeSector(sectorRaw) ?? sectorRaw;
  const uploadResponsableFallback = String(session.user?.responsable || session.user?.name || "").trim();
  return (
    <EnviosCoordinadorClient sector={sector} uploadResponsableFallback={uploadResponsableFallback} />
  );
}
