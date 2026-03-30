import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { SHEET_NAMES } from "@/lib/google-sheets";
import { getSheetData, rowsToObjects } from "@/lib/sheets-helpers";
import { loadUsuariosMerged } from "@/lib/usuarios-data";
import { filterFacturas } from "@/lib/roles";
import type { FacturaRow } from "@/types/models";
import { sessionCtxFromSession } from "@/lib/session-ctx";
import { spreadsheetKeyForSession } from "@/lib/spreadsheet-key";

function toCsv(rows: string[][]): string {
  return rows
    .map((cells) =>
      cells
        .map((c) => {
          const s = String(c ?? "");
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(";")
    )
    .join("\r\n");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ctx = sessionCtxFromSession(session);
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = spreadsheetKeyForSession(ctx);

  try {
    const [factRows, usuarios] = await Promise.all([
      getSheetData(key, SHEET_NAMES.FACTURAS),
      loadUsuariosMerged(),
    ]);
    const headers = factRows[0];
    if (!headers) return NextResponse.json({ error: "Vacío" }, { status: 500 });

    const facturas = rowsToObjects<FacturaRow>(factRows);
    const filtered = filterFacturas(facturas, ctx, usuarios);

    const dataRows = filtered.map((f) => {
      const rec = f as unknown as Record<string, string>;
      return headers.map((h) => String(rec[h] ?? ""));
    });
    const csv = toCsv([headers, ...dataRows]);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="facturas_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
