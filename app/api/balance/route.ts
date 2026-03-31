import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import type { BalanceRow } from "@/types/models";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rol = String(session.user.rol || "user").toLowerCase();
  if (rol === "user") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rows = await getSheetData("MICAJA", SHEET_NAMES.BALANCE);
  const data = rowsToObjects<BalanceRow>(rows);
  return NextResponse.json({ data });
}
