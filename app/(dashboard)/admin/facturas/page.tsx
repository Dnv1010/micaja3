import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminFacturasClient } from "@/components/admin/admin-facturas-client";

export default async function AdminFacturasPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  if (String(session.user.rol || "").toLowerCase() !== "admin") redirect("/");
  return <AdminFacturasClient />;
}
