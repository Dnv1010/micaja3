import { NextResponse } from "next/server";

/** Solo desarrollo: comprobar presencia de variables (sin exponer secretos). */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible en producción" }, { status: 403 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return NextResponse.json({
    hasSupabaseUrl: !!supabaseUrl,
    supabaseUrlPreview: supabaseUrl ? `${supabaseUrl.slice(0, 40)}...` : null,
    hasSupabaseKey: !!supabaseKey,
    supabaseKeyStart: supabaseKey ? `${supabaseKey.slice(0, 30)}...` : null,
    hasInternalApiKey: !!process.env.INTERNAL_API_KEY,
    hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasOcrKey: !!process.env.OCR_SPACE_API_KEY,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
  });
}
