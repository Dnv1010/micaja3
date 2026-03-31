import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { EnviosCoordinadorClient } from "@/components/coordinador/envios-coordinador-client";
import { FALLBACK_USERS } from "@/lib/users-fallback";

export default async function EnviosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") redirect("/");
  const sector = String(session.user.sector || "");
  const zoneUsers = FALLBACK_USERS.filter(
    (u) => u.rol === "user" && u.sector === sector && u.userActive
  );
  return <EnviosCoordinadorClient sector={sector} zoneUsers={zoneUsers} />;
}
