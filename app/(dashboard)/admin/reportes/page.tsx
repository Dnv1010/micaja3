import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminReportesClient } from "@/components/admin/admin-reportes-client";

export default async function AdminReportesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin") redirect("/");
  return <AdminReportesClient />;
}
