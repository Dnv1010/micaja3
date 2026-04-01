import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { CoordinatorZonaClient } from "@/components/coordinador/coordinator-zona-client";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { normalizeSector } from "@/lib/sector-normalize";
import { fallbackActiveZoneUsers } from "@/lib/users-fallback";

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/mi-cuenta");
  if (rol === "admin") redirect("/admin");
  if (rol === "coordinador") {
    const sectorRaw = String(session.user.sector || "");
    const sector = normalizeSector(sectorRaw) ?? sectorRaw;
    const zoneUsers = fallbackActiveZoneUsers(sector).map((u) => ({
      responsable: u.responsable,
      cargo: u.cargo,
    }));
    return (
      <CoordinatorZonaClient
        sector={sector}
        zonaLabel={etiquetaZona(sector)}
        coordinatorName={String(session.user.responsable || session.user.name || "")}
        coordinatorCargo={String(session.user.cargo || "")}
        zoneUsers={zoneUsers}
      />
    );
  }
  redirect("/mi-cuenta");
}
