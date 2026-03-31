import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { loadUsuariosMerged } from "@/lib/usuarios-data";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const usuarios = await loadUsuariosMerged();
  return NextResponse.json({ data: usuarios });
}
