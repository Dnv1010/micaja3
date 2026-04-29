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
    .from("transfers")
    .select("transfer_id, fecha, assignee, amount");
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  const { data: entregas, error: entErr } = await sb
    .from("deliveries")
    .select("transfer_id");
  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 });

  const entregasPorEnvio = new Set((entregas ?? []).map((e: { transfer_id: string | null }) => e.transfer_id).filter(Boolean));

  const faltantes = (envios ?? []).filter(
    (env: { transfer_id: string | null }) => env.transfer_id && !entregasPorEnvio.has(env.transfer_id)
  ) as { transfer_id: string; fecha: string | null; assignee: string | null; amount: number | string | null }[];

  if (!faltantes.length) {
    return NextResponse.json({ ok: true, reparadas: 0, message: "No hay entregas faltantes" });
  }

  const inserts = faltantes.map((env) => ({
    delivery_id: `ENT-REP-${env.transfer_id}`,
    delivery_date: env.fecha,
    transfer_id: env.transfer_id,
    assignee: env.assignee,
    delivered_amount: typeof env.amount === "number" ? env.amount : Number(String(env.amount ?? "0").replace(/[^\d]/g, "")),
  }));

  const { error: insErr } = await sb.from("deliveries").insert(inserts);
  if (insErr) return NextResponse.json({ error: insErr.message, intentados: inserts.length }, { status: 500 });

  return NextResponse.json({ ok: true, reparadas: inserts.length, responsables: faltantes.map((e) => e.assignee) });
}
