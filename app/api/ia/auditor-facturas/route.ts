export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { auditarFacturas, TOPES_COP, type FacturaAuditar } from "@/lib/auditor-facturas";

type Body = {
  facturas?: Array<Partial<FacturaAuditar> & { valor: number | string }>;
  historicas?: Array<Partial<FacturaAuditar> & { valor: number | string }>;
  coordinador?: string;
  sector?: string;
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normFactura(f: Partial<FacturaAuditar> & { valor: number | string }): FacturaAuditar {
  return {
    idFactura: String(f.idFactura ?? "").trim(),
    numFactura: f.numFactura ? String(f.numFactura) : undefined,
    nit: f.nit ? String(f.nit) : undefined,
    proveedor: f.proveedor ? String(f.proveedor) : undefined,
    concepto: f.concepto ? String(f.concepto) : undefined,
    tipoServicio: f.tipoServicio ? String(f.tipoServicio) : undefined,
    responsable: f.responsable ? String(f.responsable) : undefined,
    fecha: f.fecha ? String(f.fecha) : undefined,
    valor: toNum(f.valor),
    categoria: f.categoria,
  };
}

async function resumenNarrativo(params: {
  coordinador: string;
  sector: string;
  totales: { ok: number; excedidos: number; duplicados: number; alertasCoherencia: number };
  detalles: Array<{ proveedor: string; categoria: string; valor: number; estado: string; diferencia: number; alertas: string[] }>;
  total: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return "";

  const muestra = params.detalles.slice(0, 40);
  const prompt = `Eres Auditor Inteligente de la app Mi Caja (BIA Energy). Redacta un resumen ejecutivo (3-5 frases, sin markdown, tono profesional) de la auditoría de estas facturas.

Contexto:
- Coordinador: ${params.coordinador || "—"}
- Zona: ${params.sector || "—"}
- Total: $${params.total.toLocaleString("es-CO")}
- Facturas OK: ${params.totales.ok}
- Facturas EXCEDIDO: ${params.totales.excedidos}
- Facturas DUPLICADO: ${params.totales.duplicados}
- Alertas de coherencia: ${params.totales.alertasCoherencia}

Topes aplicados (COP): desayuno $20.000, almuerzo $25.000, cena $20.000, hospedaje $70.000.

Muestra (${muestra.length}):
${muestra
  .map(
    (d, i) =>
      `${i + 1}. ${d.proveedor || "Proveedor?"} — ${d.categoria} — $${d.valor.toLocaleString("es-CO")} — ${d.estado}${d.diferencia > 0 ? ` (+$${d.diferencia.toLocaleString("es-CO")})` : ""}${d.alertas.length ? ` | ${d.alertas.join("; ")}` : ""}`
  )
  .join("\n")}

Instrucciones:
- Identifica patrones (ej. proveedor repetido, mayor gasto por categoría).
- Destaca los EXCEDIDOs/DUPLICADOs con cifras.
- Si hay alertas de coherencia, mencionarlo.
- Si todo está OK, dilo claramente.`;

  const modelos = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });

  for (const modelo of modelos) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        const overloaded = /overloaded|high demand|UNAVAILABLE|503/i.test(msg) || res.status === 503;
        const quota = /quota|rate.?limit|429/i.test(msg) || res.status === 429;
        if (overloaded || quota) continue;
        console.error("[auditor resumen]", msg);
        return "";
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e) {
      console.error("[auditor resumen] fetch:", e);
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const facturas = (body.facturas ?? []).map(normFactura);
  if (!facturas.length) {
    return NextResponse.json({ error: "Sin facturas" }, { status: 400 });
  }
  const historicas = (body.historicas ?? []).map(normFactura);

  const resultado = auditarFacturas(facturas, { historicas });
  const total = facturas.reduce((s, f) => s + (Number.isFinite(f.valor) ? f.valor : 0), 0);

  const detalles = resultado.items.map((it, idx) => ({
    proveedor: facturas[idx]?.proveedor ?? "",
    categoria: it.categoria,
    valor: facturas[idx]?.valor ?? 0,
    estado: it.estado,
    diferencia: it.diferencia,
    alertas: it.alertas,
  }));

  const resumen = await resumenNarrativo({
    coordinador: body.coordinador ?? "",
    sector: body.sector ?? "",
    totales: resultado.totales,
    detalles,
    total,
  });

  return NextResponse.json({
    ok: true,
    topes: TOPES_COP,
    total,
    resumen,
    ...resultado,
  });
}
