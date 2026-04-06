import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { GastosGeneralesClient } from "@/components/coordinador/gastos-generales-client";

export default async function GastosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "coordinador" && rol !== "admin") redirect("/");
  const sector = String(session.user.sector || "");
  const responsable = String(session.user?.responsable || session.user?.name || "").trim();
  return <GastosGeneralesClient sector={sector} responsable={responsable} />;
}
