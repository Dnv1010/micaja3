import { parseCOPString } from "@/lib/format";

/** Líneas de factura aceptadas por el resumen (PDF legalización o filas hoja). */
export type FacturaResumenLinea = {
  proveedor?: string;
  concepto?: string;
  valor?: string | number;
  fecha?: string;
  tipoFactura?: string;
};

function valorLinea(n: unknown): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  return parseCOPString(String(n ?? ""));
}

/**
 * Genera resumen ejecutivo vía Gemini (requiere `GEMINI_API_KEY`).
 * Devuelve texto listo para UI/Sheets; no lanza si falla la red.
 */
export async function generarResumenLegalizacionGemini(params: {
  facturas: FacturaResumenLinea[];
  coordinador: string;
  sector: string;
  total: number;
  limite: number;
}): Promise<string> {
  const { facturas, coordinador, sector, total, limite } = params;

  if (!facturas.length) {
    return "No hay facturas para analizar.";
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return "API key no configurada.";
  }

  const pct = limite > 0 ? Math.round((total / limite) * 100) : 0;

  const facturasTexto = facturas
    .map((f, i) => {
      const v = valorLinea(f.valor);
      return `${i + 1}. ${f.proveedor || "Sin proveedor"} — ${f.concepto || f.tipoFactura || "Sin concepto"} — $${v.toLocaleString("es-CO")} — ${f.fecha || "Sin fecha"}`;
    })
    .join("\n");

  const prompt = `Eres el asistente de caja menor de BIA Energy SAS ESP. Analiza este reporte de legalización y genera un resumen ejecutivo en español, conciso y profesional (máximo 4 oraciones).

Coordinador: ${coordinador}
Zona: ${sector}
Total a reembolsar: $${total.toLocaleString("es-CO")} COP
Límite de zona: $${limite.toLocaleString("es-CO")} COP (${pct}% ejecutado)
Número de facturas: ${facturas.length}

Facturas incluidas:
${facturasTexto}

Instrucciones:
- Identifica los principales tipos de gasto
- Menciona si hay algún gasto inusual o destacado
- Indica el porcentaje del límite utilizado
- Si hay facturas del mismo proveedor repetidas, mencionarlo
- Tono profesional y directo
- Solo texto plano, sin markdown ni asteriscos`;

  const modelos = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite"];
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
  });

  let ultimoError = "";
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
        ultimoError = data?.error?.message || `HTTP ${res.status}`;
        console.error(`Gemini resumen (${modelo}):`, ultimoError);
        const overloaded = /overloaded|high demand|UNAVAILABLE|503/i.test(ultimoError) || res.status === 503;
        const quota = /quota|rate.?limit|429/i.test(ultimoError) || res.status === 429;
        if (overloaded || quota) continue; // probar siguiente modelo
        break; // otro tipo de error: no reintentar
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
      console.error(`Gemini resumen fetch (${modelo}):`, ultimoError);
    }
  }
  return "No se pudo generar el resumen.";
}
