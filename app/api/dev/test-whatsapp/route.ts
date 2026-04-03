import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { enviarWhatsApp } from "@/lib/whatsapp";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const phone = process.env.CALLMEBOT_PHONE_DINOVI?.trim() || "";
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "CALLMEBOT_PHONE_DINOVI no configurado" },
      { status: 400 }
    );
  }

  const ok = await enviarWhatsApp(
    phone,
    "*BIA Energy - MiCaja*\n\nPrueba de notificación WhatsApp funcionando correctamente ✅"
  );
  const masked = phone.replace(/[^0-9]/g, "").slice(0, 6) + "****";
  return NextResponse.json({ ok, phone: masked });
}
