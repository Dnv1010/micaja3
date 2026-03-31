import { NextResponse } from "next/server";

/** Solo desarrollo: comprobar presencia de variables (sin exponer secretos completos). */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible en producción" }, { status: 403 });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  const key = process.env.GOOGLE_PRIVATE_KEY ?? "";

  return NextResponse.json({
    hasEmail: !!email,
    emailValue: email ? `${email.slice(0, 20)}...` : null,
    hasKey: !!key,
    keyStart: key ? `${key.slice(0, 30)}...` : null,
    keyHasRealNewlines: key.includes("\n"),
    keyHasLiteralNewlines: key.includes("\\n"),
    hasDriveFolder: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    hasOcrKey: !!process.env.OCR_SPACE_API_KEY,
  });
}
