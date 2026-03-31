import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminUsuariosClient } from "@/components/admin/admin-usuarios-client";

export default async function AdminUsuariosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  if (String(session.user.rol || "").toLowerCase() !== "admin") redirect("/");
  return <AdminUsuariosClient />;
}
