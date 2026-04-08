import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import GastosGeneralesClient from "@/components/gastos/GastosGeneralesClient";

export default async function GastosPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const rol = String(session.user.rol || "").toLowerCase();
  if (rol !== "admin" && rol !== "coordinador") {
    redirect("/");
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Gastos Generales</h1>
        <p className="mt-1 text-sm text-gray-400">
          Gastos registrados vía Telegram por coordinadores y admins
        </p>
      </div>
      <GastosGeneralesClient rol={rol} sector={String(session.user.sector || "")} />
    </div>
  );
}