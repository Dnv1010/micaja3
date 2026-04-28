import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSupabase } from "@/lib/supabase";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol !== "admin")
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });

  const sb = getSupabase();

  const { data: envios, error: eErr } = await sb
    .from("envios")
    .select("id_envio, fecha, responsable, monto");
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  const { data: entregas, error: entErr } = await sb
    .from("entregas")
    .select("id_envio");
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 });

  const entregasPorEnvio = new Set((entregas ?? []).map((e: { id_envio: string | null }) => e.id_envio).filter(Boolean));

  const faltantes = (envios ?? []).filter(
    (env: { id_envio: string | null }) => env.id_envio && !entregasPorEnvio.has(env.id_envio)
  ) as { id_envio: string; fecha: string | null; responsable: string | null; monto: number | string | null }[];

  if (!faltantes.length) {
    return NextResponse.json({ ok: true, reparadas: 0, message: "No hay entregas faltantes" });
  }

  const inserts = faltantes.map((env) => ({
    id_entrega: `ENT-REP-${env.id_envio}`,
    fecha_entrega: env.fecha,
    id_envio: env.id_envio,
    responsable: env.responsable,
    monto_entregado: typeof env.monto === "number" ? env.monto : Number(String(env.monto ?? "0").replace(/[^\d]/g, "")),
  }));

  const { error: insErr } = await sb.from("entregas").insert(inserts);
  if (insErr) return NextResponse.json({ error: insErr.message, intentados: inserts.length }, { status: 500 });

  return NextResponse.json({ ok: true, reparadas: inserts.length, responsables: faltantes.map((e) => e.responsable) });
}
