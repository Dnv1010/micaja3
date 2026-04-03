import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { CoordinadorDashboardClient } from "@/components/coordinador/coordinador-dashboard-client";
import { etiquetaZona } from "@/lib/coordinador-zona";
import { normalizeSector } from "@/lib/sector-normalize";

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/mi-cuenta");
  if (rol === "admin") redirect("/admin");
  if (rol === "coordinador") {
    const sectorRaw = String(session.user.sector || "");
    const sector = normalizeSector(sectorRaw) ?? sectorRaw;
    return (
      <CoordinadorDashboardClient sector={sector} zonaLabel={etiquetaZona(sector)} />
    );
  }
  redirect("/mi-cuenta");
}
