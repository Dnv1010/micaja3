import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { appPublicBaseUrl } from "@/lib/notificaciones";
import { verifyInternalApiKey } from "@/lib/internal-api";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const admin = String(session?.user?.rol || "").toLowerCase() === "admin";
  if (!admin && !verifyInternalApiKey(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "Falta TELEGRAM_BOT_TOKEN" }, { status: 400 });
  }

  const base = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") || appPublicBaseUrl();
  const webhookUrl = `${base}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  const params = new URLSearchParams();
  params.set("url", webhookUrl);
  if (secret) params.set("secret_token", secret);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`);
  const data = (await res.json()) as Record<string, unknown>;
  return NextResponse.json({ webhookUrl, ...data });
}
