import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { enviarTelegram } from "@/lib/notificaciones";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const chatId = process.env.TELEGRAM_TEST_CHAT_ID?.trim() || "";
  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_TEST_CHAT_ID no configurado" },
      { status: 400 }
    );
  }

  const ok = await enviarTelegram(
    chatId,
    "✅ <b>BIA Energy - MiCaja</b>\n\nPrueba de Telegram OK."
  );
  const masked = chatId.slice(0, 4) + "****";
  return NextResponse.json({ ok, chatId: masked });
}
