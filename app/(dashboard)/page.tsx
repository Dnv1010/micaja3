import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserHomeClient } from "@/components/dashboard/user-home-client";

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "coordinador") redirect("/usuarios");
  if (rol === "admin") redirect("/admin");
  return <UserHomeClient user={session.user} />;
}
