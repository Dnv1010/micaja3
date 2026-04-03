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

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 300,
          },
        }),
      }
    );

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      console.error("Gemini resumen:", data?.error?.message || res.status);
      return "No se pudo generar el resumen.";
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || "No se pudo generar el resumen.";
  } catch (e) {
    console.error("Gemini resumen fetch:", e);
    return "Error al conectar con el servicio de IA.";
  }
}
