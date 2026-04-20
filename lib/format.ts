import { format } from "date-fns";
import { es } from "date-fns/locale";

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCOP(value: number): string {
  return copFormatter.format(value);
}

export function parseCOPString(s: string): number {
  const raw = String(s ?? "");
  const cleaned = raw.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) {
    console.warn(`[parseCOPString] valor no parseable: ${JSON.stringify(raw)}`);
    return 0;
  }
  return n;
}

/** Montos en celdas de Sheet (formato colombiano, con o sin `$`). */
export function parseMonto(val: unknown): number {
  if (val == null) return 0;
  const raw = String(val).trim();
  if (!raw) return 0;
  const clean = raw.replace(/\$/g, "").replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!clean) return 0;

  let n: number;
  if (clean.includes(".") && clean.includes(",")) {
    n = parseFloat(clean.replace(/\./g, "").replace(",", "."));
  } else if (clean.includes(".")) {
    const parts = clean.split(".");
    n =
      parts.length > 2 || parts[parts.length - 1]?.length === 3
        ? parseInt(clean.replace(/\./g, ""), 10)
        : parseFloat(clean);
  } else if (clean.includes(",")) {
    n = parseFloat(clean.replace(",", "."));
  } else {
    n = parseInt(clean, 10);
  }

  if (!Number.isFinite(n)) {
    console.warn(`[parseMonto] valor no parseable: ${JSON.stringify(raw)}`);
    return 0;
  }
  return n;
}

export function formatDateDisplay(isoOrSheet: string): string {
  if (!isoOrSheet) return "";
  const d = parseSheetDate(isoOrSheet);
  if (!d) return isoOrSheet;
  return format(d, "d MMM yyyy", { locale: es });
}

/** dd/MM/yyyy para UI */
export function formatDateDDMMYYYY(isoOrSheet: string): string {
  if (!isoOrSheet) return "";
  const d = parseSheetDate(isoOrSheet);
  if (!d) return isoOrSheet;
  return format(d, "dd/MM/yyyy", { locale: es });
}

/** ISO, dd/MM/yyyy o similar desde celdas de Sheet */
export function parseSheetDate(s: string): Date | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  // YYYY-MM-DD → interpretar como fecha LOCAL (no UTC) para evitar desfase de zona horaria.
  const isoDateOnly = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const d = new Date(+isoDateOnly[1], +isoDateOnly[2] - 1, +isoDateOnly[3]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Timestamp completo con hora/TZ → usar Date normal
  if (t.includes("-") && (t.includes("T") || t.includes(":"))) {
    const iso = new Date(t);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d2 = new Date(t);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export const CENTRO_COSTO_INFO: Record<string, string> = {
  "OPS-Activation":
    "⚡ Activaciones en campo: gestión de recursos operativos en actividades de activación en campo",
  "OPS-Retention":
    "🔒 Retención de clientes: tareas de retención y mantenimiento de clientes",
};
