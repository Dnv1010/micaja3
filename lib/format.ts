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
  const cleaned = s.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateDisplay(isoOrSheet: string): string {
  if (!isoOrSheet) return "";
  const d = new Date(isoOrSheet);
  if (Number.isNaN(d.getTime())) return isoOrSheet;
  return format(d, "d MMM yyyy", { locale: es });
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
